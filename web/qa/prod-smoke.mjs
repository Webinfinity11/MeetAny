// P12 T12.5 production smoke: every role against `next start` (default :3002). Read-only — no submits,
// no conversation opened (mark_read), no call reveal. Passwords come from the ledger and never reach output.
// Run: QA_ORIGIN=http://localhost:3002 node qa/prod-smoke.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3002';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/prod-0924');
fs.mkdirSync(out, { recursive: true });
const rows = [];
const browser = await chromium.launch({ headless: true, executablePath });

async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const p = await ctx.newPage();
  p.bag = { console: [], pageerror: [], failed: [], csp: [] };
  p.on('console', m => {
    if (m.type() !== 'error') return;
    if (p.bag.allow404 && /status of 404/.test(m.text())) return; // the 404 document itself
    (/Content Security Policy/i.test(m.text()) ? p.bag.csp : p.bag.console).push(safe(m.text()).slice(0, 200));
  });
  p.on('pageerror', e => p.bag.pageerror.push(safe(e.message).slice(0, 200)));
  p.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) p.bag.failed.push(`${r.failure()?.errorText} ${r.url()}`); });
  p.on('response', r => { if (r.status() >= 400 && !p.bag.allow404?.(r)) p.bag.failed.push(`${r.status()} ${r.url().replace(base, '')}`); });
  return p;
}
const reset = p => { for (const k of ['console', 'pageerror', 'failed', 'csp']) p.bag[k] = []; };
async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
}
// One row per page: time until networkidle, then the page's own check, then errors.
async function visit(p, role, name, route, check, { shot = true, allow404 = false } = {}) {
  reset(p); p.bag.allow404 = allow404 ? r => r.status() === 404 && r.request().resourceType() === 'document' : null;
  const t0 = Date.now(); let ms = null, note = '';
  try {
    if (route) await p.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
    else await p.waitForLoadState('networkidle', { timeout: 60000 });
    ms = Date.now() - t0;
    await loaded(p);
    note = (await check?.(p)) || '';
    await p.waitForTimeout(400);
    const csp = await p.evaluate(() => window.__csp || []);
    p.bag.csp.push(...csp);
    if (shot) await p.screenshot({ path: path.join(out, `${role}-${name}-1440.png`), fullPage: false });
  } catch (e) { note = 'FAIL: ' + safe(e.message).split('\n')[0].slice(0, 160); }
  const b = p.bag, ok = !note.startsWith('FAIL') && !b.console.length && !b.pageerror.length && !b.failed.length && !b.csp.length;
  const row = { role, page: name, route: route || '(ნავიგაცია)', ok, ms, note, console: b.console, pageerror: b.pageerror, failed: b.failed, csp: b.csp };
  rows.push(row);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${role} ${name} ${ms}ms ${note} ${[...b.console, ...b.pageerror, ...b.failed, ...b.csp].join(' | ')}`);
  return row;
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
async function login(p, role, key) {
  await visit(p, role, 'login', '/account/', async q => {
    await q.locator('#login-email').fill(`demo-${key}@meetany.ge`);
    await q.locator('#login-password').fill(ledger.accounts[key].password);
    await q.locator('form button[type="submit"]').click();
    await q.waitForFunction(() => !document.querySelector('#login-email'), null, { timeout: 60000 });
    await q.waitForLoadState('networkidle');
    await loaded(q);
    return 'შესვლა OK';
  }, { shot: false });
}
const tabs = async q => (await q.locator('main .ma-tabs .ma-tab').allTextContents()).join(' / ');

try {
  // ---- guest
  const g = await context();
  await visit(g, 'guest', 'home', '/', async q => expect(await q.locator('h1').count(), 'h1 არ არის'));
  let requestHref, companyHref;
  await visit(g, 'guest', 'requests', '/requests/', async q => {
    requestHref = await q.locator('main a[href*="/requests/view/"]').first().getAttribute('href');
    expect(requestHref, 'მოთხოვნის ბმული არ არის');
    return `${await q.locator('main a[href*="/requests/view/"]').count()} ბმული`;
  });
  await visit(g, 'guest', 'companies', '/companies/', async q => {
    const hrefs = await q.locator('main a[href*="/companies/view/"]').evaluateAll(a => a.map(x => x.getAttribute('href')));
    companyHref = hrefs[0];
    expect(companyHref, 'კომპანიის ბმული არ არის');
    return `${hrefs.length} ბმული`;
  });
  await visit(g, 'guest', 'request', requestHref, async q => expect(await q.locator('main h1').count(), 'h1 არ არის'));
  await visit(g, 'guest', 'company', companyHref, async q => expect(await q.locator('main h1').count(), 'h1 არ არის'));
  await visit(g, 'guest', '404', '/nosuch/', async q => `სტატუსი ${(await q.evaluate(() => document.title))}`, { allow404: true });
  const s404 = await fetch(base + '/nosuch/'); rows.at(-1).note += ` · HTTP ${s404.status}`;
  if (s404.status !== 404) { rows.at(-1).ok = false; rows.at(-1).note = 'FAIL: HTTP ' + s404.status; }
  await g.context().close();

  // ---- client
  const c = await context();
  await login(c, 'client', 'hotel');
  const clientTabs = [['account', '/account/'], ['saved', '/account/?tab=saved'], ['messages', '/account/?tab=messages'], ['profile', '/account/?tab=profile']];
  for (const [name, route] of clientTabs) await visit(c, 'client', name, route, async q => tabs(q), { shot: name === 'account' || name === 'profile' });
  await visit(c, 'client', 'request-new', '/requests/new/', async q => {
    await q.locator('[role="dialog"], dialog[open]').first().waitFor({ state: 'visible', timeout: 20000 });
    return `მოდალი ღიაა, ${await q.locator('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, dialog[open] input, dialog[open] textarea, dialog[open] select').count()} ველი (submit არა)`;
  });
  await c.context().close();

  // ---- company
  const k = await context();
  await login(k, 'company', 'wood');
  await visit(k, 'company', 'profile', '/account/?tab=profile', async q => {
    const logo = await q.locator('#profile-logo').count(), lat = await q.locator('#lat').count(), lng = await q.locator('#lng').count();
    expect(logo && lat && lng, `ლოგო ${logo}, lat ${lat}, lng ${lng}`);
    await q.locator('#profile-logo').evaluate(e => e.closest('section, fieldset, .ma-field')?.scrollIntoView({ block: 'center' }));
    return `ლოგოს ველი, განედი/გრძედი (${await q.locator('#lat').inputValue()}, ${await q.locator('#lng').inputValue()})`;
  });
  await visit(k, 'company', 'inbox', '/account/?tab=messages', async q => tabs(q));
  // First open request without an offer from this company shows the offer form.
  const links = await (async () => { await k.goto(base + '/requests/', { waitUntil: 'networkidle' }); await loaded(k); return k.locator('main a[href*="/requests/view/"]').evaluateAll(a => [...new Set(a.map(x => x.getAttribute('href')))].slice(0, 12)); })();
  let offerDone = false;
  for (const href of links) {
    await k.goto(base + href, { waitUntil: 'networkidle' }); await loaded(k);
    if (await k.locator('#of-body').count()) {
      await visit(k, 'company', 'offer-form', href, async q => {
        await q.locator('#of-body').scrollIntoViewIfNeeded();
        return `შეთავაზების ფორმა ხილულია (submit არა)`;
      });
      offerDone = true; break;
    }
  }
  if (!offerDone) rows.push({ role: 'company', page: 'offer-form', route: '-', ok: false, ms: null, note: `FAIL: ${links.length} მოთხოვნიდან ფორმა ვერ ვიპოვე`, console: [], pageerror: [], failed: [], csp: [] });
  await k.context().close();

  // ---- admin
  const a = await context();
  await login(a, 'admin', 'admin');
  for (const t of ['requests', 'users', 'audit', 'contacts']) await visit(a, 'admin', t, `/admin/?tab=${t}`, async q => {
    await q.locator('main .ma-tab[aria-current="page"]').waitFor({ timeout: 20000 });
    return `${await q.locator('main .ma-tab[aria-current="page"]').textContent()} · ${await q.locator('main table tbody tr').count()} რიგი`;
  });
  await a.context().close();
} finally {
  await browser.close();
  fs.writeFileSync(path.join(root, 'qa/shots/prod-0924/report.json'), safe(JSON.stringify({ base, at: new Date().toISOString(), rows }, null, 2)));
  const pass = rows.filter(r => r.ok).length;
  console.log(`\n${pass}/${rows.length} PASS; slow (>3s): ${rows.filter(r => r.ms > 3000).map(r => `${r.role}/${r.page} ${r.ms}ms`).join(', ') || 'none'}`);
}
