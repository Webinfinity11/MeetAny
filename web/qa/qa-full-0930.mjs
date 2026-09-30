// QA walk 2026-09-30: 4 roles x pages x 2 viewports on one dev server. Read-only; one login per role.
import fs from 'node:fs';
import { chromium } from 'playwright';
const { login, origin } = await import('./e2e/lib.mjs');
const OUT = 'qa/shots/qa-full-0930'; fs.mkdirSync(OUT, { recursive: true });
const roles = ['guest', 'owner_user', 'owner_company', 'owner_admin'];
const VP = { d: { width: 1440, height: 1000 }, m: { width: 390, height: 844 } };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
async function visit(page, role, vpk, name, url, extra) {
  const errs = []; const onc = m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }; const onp = e => errs.push('PAGEERR ' + e.message.slice(0, 160));
  page.on('console', onc); page.on('pageerror', onp);
  const t0 = Date.now(); let status = null, err = null;
  try { const r = await page.goto(origin + url, { waitUntil: 'domcontentloaded', timeout: 30000 }); status = r?.status();
    await page.waitForFunction(() => !!document.querySelector('main')?.innerText.trim() && !document.querySelector('main [aria-busy="true"]'), null, { timeout: 20000 }).catch(() => { err = 'loading>20s'; });
    await page.waitForTimeout(600); if (extra) await extra(page);
  } catch (e) { err = e.message.slice(0, 120); }
  const info = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.innerText?.slice(0, 80), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: (document.querySelector('main')?.innerText || '').length, unavailable: /დროებით მიუწვდომელია/.test(document.body.innerText), notfound: /404|ვერ მოიძებნა/.test(document.querySelector('main')?.innerText.slice(0,300) || ''), vip: document.querySelectorAll('[data-plan="vip"]').length, premium: document.querySelectorAll('[data-plan="premium"]').length, imgBroken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length, url: location.pathname + location.search })).catch(() => ({}));
  const shot = `${role}-${vpk}-${name}.png`; await page.screenshot({ path: `${OUT}/${shot}`, fullPage: false }).catch(() => {});
  page.off('console', onc); page.off('pageerror', onp);
  results.push({ role, vp: vpk, name, url, status, ms: Date.now() - t0, err, errs: [...new Set(errs)].slice(0, 4), ...info, shot });
  console.log(role, vpk, name, status, info.overflow, info.text, 'vip', info.vip, 'prem', info.premium, errs.length ? 'ERR' + errs.length : '', err || '');
}
let ids = {};
for (const role of roles) {
  const ctx = await browser.newContext({ viewport: VP.d }); const page = await ctx.newPage();
  if (role !== 'guest') { try { await login(page, role); } catch (e) { console.log('LOGIN FAIL', role, e.message.slice(0, 100)); results.push({ role, name: 'login', err: e.message.slice(0, 200) }); await ctx.close(); await new Promise(r => setTimeout(r, 4000)); continue; } }
  if (!ids.req) { await page.goto(origin + '/requests/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('a[href*="/requests/view"]', { timeout: 20000 }).catch(() => {}); ids.req = await page.locator('a[href*="/requests/view"]').first().getAttribute('href').catch(() => null);
    await page.goto(origin + '/companies/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('a[href*="/companies/view"]', { timeout: 20000 }).catch(() => {}); ids.co = await page.locator('a[href*="/companies/view"]').first().getAttribute('href').catch(() => null); console.log(ids); }
  const pages = [['home', '/'], ['requests', '/requests/'], ['requests-new', '/requests/new/'], ['companies', '/companies/'], ['companies-sort-rec', '/companies/?sort=recommended'], ['how', '/how-it-works/'], ['ideas', '/ideas/'], ['terms', '/terms/'], ['notfound', '/no-such-page/'], ['account', '/account/'], ['admin', '/admin/']];
  if (ids.req) pages.push(['request-detail', ids.req]); if (ids.co) pages.push(['company-detail', ids.co]);
  if (role !== 'guest') for (const t of ['requests', 'saved', 'messages', 'notifications', 'profile', ...(role === 'owner_company' ? ['offers', 'business'] : [])]) pages.push(['account-' + t, `/account/?tab=${t}`]);
  if (role === 'owner_admin') for (const t of ['overview', 'users', 'requests', 'offers', 'contacts', 'reviews', 'plans', 'photos', 'audit']) pages.push(['admin-' + t, `/admin/?tab=${t}`]);
  for (const vpk of ['d', 'm']) { await page.setViewportSize(VP[vpk]); for (const [n, u] of pages) await visit(page, role, vpk, n, u); }
  await ctx.storageState({ path: `/tmp/qa0930-${role}.json` }).catch(() => {}); fs.chmodSync(`/tmp/qa0930-${role}.json`, 0o600);
  await ctx.close(); await new Promise(r => setTimeout(r, 3000));
}
fs.writeFileSync(OUT + '/walk.json', JSON.stringify({ ids, results }, null, 1)); await browser.close();
