// Stage 1 analysis, area = client (owner_user). Read-only: every mutating DB/RPC/upload request is aborted and logged.
// Usage: QA_ORIGIN=http://localhost:3300 QA_ENV=<path to web/.env.local> node qa/PERFECTION-2026-10-12/scripts/client.mjs [probe]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3300';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local origin only');
const envFile = process.env.QA_ENV || path.resolve(import.meta.dirname, '../../../.env.local');
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).flatMap(l => { const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : []; }));
const auth = env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
if (!email || !password) throw new Error("QA_EMAIL and QA_PASSWORD are required");
const mode = process.argv[2] || 'full';
const out = path.resolve(import.meta.dirname, '..', process.env.OUT || 'before', 'client', mode === 'dashboard' ? 'dashboard-company' : '.');
fs.mkdirSync(out, { recursive: true });

const READ_RPC = /^(my_|list_|get_|search_|count_|is_|has_|public_|request_detail|company_detail|compare_|unread_|engagement_state|request_preferences|company_business_features)/;
const report = { origin, email, startedAt: new Date().toISOString(), pages: [], blockedWrites: [], requests: {} };

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ka-GE' });
let current = 'boot';
// The Next dev overlay badge is not part of the product; hide it so it neither covers controls nor appears in shots.
await context.addInitScript(() => { const css = 'nextjs-portal{display:none!important}'; const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add); });
await context.route('**/api/**', route => {
  const req = route.request(); const url = new URL(req.url());
  const p = url.pathname; const method = req.method();
  let blocked = false;
  if (p.startsWith('/api/db/rpc/')) { const name = p.split('/').at(-1); if (!READ_RPC.test(name)) blocked = name; }
  else if (p.startsWith('/api/db/') && method !== 'GET') blocked = `${method} ${p}`;
  else if (/upload|blob/.test(p) && method !== 'GET') blocked = `${method} ${p}`;
  if (blocked) { report.blockedWrites.push({ page: current, call: blocked, body: (req.postData() || '').slice(0, 300) }); return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"qa read-only"}' }); }
  return route.continue();
});
const page = await context.newPage();
const rawGoto = page.goto.bind(page);
page.goto = async (...args) => { for (let i = 0; ; i++) { try { return await rawGoto(...args); } catch (e) { if (i === 2 || !/ERR_ABORTED|interrupted/.test(e.message)) throw e; await page.waitForTimeout(1500); } } };
const log = { errors: [], console: [] };
page.on('pageerror', e => log.errors.push(`${current}: ${e.message}`));
page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 400 && r.status() !== 503) (report.apiFailures ||= []).push(`${current}: ${r.status()} ${r.request().method()} ${u.pathname}`); });
page.on('console', m => { if (m.type() === 'error') log.console.push(`${current}: ${m.text().slice(0, 300)}`); });

const signIn = await page.request.post(auth + '/sign-in/email', { data: { email, password }, headers: { Origin: origin } });
if (!signIn.ok()) throw new Error('sign-in failed ' + signIn.status());
async function token() { const r = await page.request.get(auth + '/token'); return (await r.json()).token; }
async function rpc(name, args = {}) {
  const r = await page.request.post(`${origin}/api/db/rpc/${name}`, { headers: { Authorization: `Bearer ${await token()}` }, data: args });
  return r.ok() ? r.json() : { error: r.status(), text: (await r.text()).slice(0, 200) };
}
async function table(route) {
  const r = await page.request.get(`${origin}/api/db/${route}`, { headers: { Authorization: `Bearer ${await token()}` } });
  return r.ok() ? r.json() : { error: r.status(), text: (await r.text()).slice(0, 200) };
}

async function settle() {
  await page.locator('main').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { const m = document.querySelector('main'); return m && m.innerText.trim().length > 0 && !m.querySelector('[aria-busy="true"], .skeleton, [class*="skeleton"]'); }, null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}
async function measure() {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - innerWidth;
    const wide = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1) && getComputedStyle(el).position !== 'fixed'; }).slice(0, 6).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} r=${Math.round(el.getBoundingClientRect().right)}`);
    const main = document.querySelector('main');
    return { overflow, wide, text: (main?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 6000) };
  });
}
async function shot(name, url, { widths = [1440, 390], before, full = true } = {}) {
  for (const width of widths) {
    current = `${name}@${width}`;
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    if (url) await page.goto(origin + url, { waitUntil: 'domcontentloaded' });
    await settle();
    if (before) await before(width);
    const m = await measure();
    await page.screenshot({ path: `${out}/${name}-${width}.jpg`, type: 'jpeg', quality: 70, fullPage: full });
    report.pages.push({ name, url: url || page.url().replace(origin, ''), width, finalUrl: page.url().replace(origin, ''), ...m });
    console.log(`${name}@${width} overflow=${m.overflow} ${m.wide.join(' | ')}`);
  }
}

try {
  const me = await rpc('my_profile');
  report.me = Array.isArray(me) ? me[0] : me;
  console.log('me', JSON.stringify(report.me).slice(0, 600));
  const reqs = await table(`requests?select=id,title,status,owner_id,created_at&owner_id=eq.${report.me?.id}&order=created_at.desc`);
  report.requests.mine = reqs;
  console.log('requests', JSON.stringify(reqs).slice(0, 1500));
  if (Array.isArray(reqs) && reqs.length) {
    const offers = await table(`offers?select=id,request_id,status,viewed_at&request_id=in.(${reqs.map(r => r.id).join(',')})`);
    report.requests.offers = offers;
    console.log('offers', JSON.stringify(offers).slice(0, 1500));
  }
  if (mode === 'probe') { await shot('probe-account', '/account/', { widths: [1440] }); }
  else if (mode === 'dashboard') {
    // The dashboard (Dashboard.tsx) renders only for company accounts; captured with QA_EMAIL=company@gmail.com for the owner's dashboard findings.
    await shot('dashboard-company', '/account/?space=sell&tab=overview');
    report.dashboard = await page.evaluate(() => ({
      stats: [...document.querySelectorAll('ul[aria-label="რიცხვები"] a')].map(a => { const r = a.getBoundingClientRect(); return { t: a.innerText.replace(/\n/g, ' | '), h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left) }; }),
      verification: (() => { const p = document.querySelector('.account-verification p'); if (!p) return null; const lh = parseFloat(getComputedStyle(p).lineHeight) || 20; return { lines: Math.round(p.getBoundingClientRect().height / lh), w: Math.round(p.getBoundingClientRect().width), text: p.innerText }; })(),
      progress: (() => { const el = document.querySelector('.account-profile-status progress'); if (!el) return null; const cs = getComputedStyle(el); return { accent: cs.accentColor, color: cs.color, bg: cs.backgroundColor }; })(),
      quick: [...document.querySelectorAll('.account-quick-actions a')].map(a => a.innerText.trim()),
      forYou: (document.querySelector('.account-for-you')?.innerText || '').slice(0, 1200),
    }));
    console.log(JSON.stringify(report.dashboard, null, 1));
  }
  else await import('./client-pages.mjs').then(m => m.run({ page, shot, settle, measure, report, origin, out, setCurrent: v => { current = v; } }));
} catch (e) {
  console.error('FAIL', e.stack);
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.errors = log.errors; report.console = log.console; report.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(`errors=${log.errors.length} console=${log.console.length} blockedWrites=${report.blockedWrites.length}`);
  await browser.close();
}
