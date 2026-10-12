// Stage 3 (account space) after-shots: dashboard, every account tab, /matching/ and the chat popup, 1440 and 390.
// Usage: QA_ORIGIN=http://localhost:3305 node qa/PERFECTION-2026-10-12/scripts/account.mjs [client|company|wood ...]
// Local origin only; nothing is submitted. Output: after/account/<screen>-<role>-<width>.png + report.json.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3305';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local origin only');
const root = path.resolve(import.meta.dirname, '..');
const envFile = process.env.QA_ENV || path.resolve(root, '../../.env.local');
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).flatMap(l => { const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : []; }));
const auth = env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
const ledgerPath = [path.resolve(root, '../../../DEMO-ACCOUNTS.local.md'), '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md'].find(p => fs.existsSync(p));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]).accounts;
const roles = {
  client: { email: ledger.owner_user.email, password: ledger.owner_user.password, company: false },
  company: { email: ledger.owner_company.email, password: ledger.owner_company.password, company: true },
  wood: { email: 'demo-wood@meetany.ge', password: ledger.wood.password, company: true },
};
const out = path.resolve(root, 'after/account');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const report = fs.existsSync(`${out}/report.json`) ? JSON.parse(fs.readFileSync(`${out}/report.json`, 'utf8')) : {};

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const [role, account] of Object.entries(roles)) {
  if (only.length && !only.includes(role)) continue;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ka-GE' });
  // The Next dev overlay badge is not part of the product.
  await context.addInitScript(() => { const add = () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(s); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add); });
  const page = await context.newPage();
  let current = 'boot';
  const log = { console: [], errors: [], api: [] };
  page.on('pageerror', e => log.errors.push(`${current}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') log.console.push(`${current}: ${m.text().slice(0, 240)}`); });
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 400) log.api.push(`${current}: ${r.status()} ${u.pathname}`); });
  const signIn = await page.request.post(auth + '/sign-in/email', { data: { email: account.email, password: account.password }, headers: { Origin: origin } });
  if (!signIn.ok()) throw new Error(`${role}: sign-in failed ${signIn.status()}`);
  const settle = async () => {
    await page.locator('main').first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => { const m = document.querySelector('main'); return m && m.innerText.trim().length > 0 && !m.querySelector('[aria-busy="true"], .skeleton, [class*="skeleton"], [class*="Skeleton"]'); }, null, { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
  };
  const measure = () => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, text: (document.querySelector('main')?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 3000) }));
  const pages = [];
  async function shot(screen, url, { before, full = true } = {}) {
    for (const width of [1440, 390]) {
      current = `${screen}-${role}-${width}`;
      await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
      if (url) await page.goto(origin + url, { waitUntil: 'domcontentloaded' });
      await settle();
      if (before) await before(width);
      const m = await measure();
      await page.screenshot({ path: `${out}/${current}.png`, fullPage: full });
      pages.push({ screen, width, url: page.url().replace(origin, ''), ...m });
      console.log(`${current} overflow=${m.overflow}`);
    }
  }
  const space = account.company ? 'sell' : 'buy';
  await shot('dashboard', account.company ? '/account/?space=sell&tab=overview' : '/account/');
  if (account.company) await shot('dashboard-buy', '/account/?space=buy&tab=overview');
  await shot('requests', '/account/?space=buy&tab=requests');
  if (account.company) await shot('offers', '/account/?space=sell&tab=offers');
  for (const tab of ['deals', 'saved', 'messages', 'notifications', 'profile']) await shot(tab, `/account/?space=${space}&tab=${tab}`);
  await shot('matching', '/matching/');
  // Chat popup: the header's conversations button opens the list, the first row opens a thread.
  await shot('chat', '/account/?tab=requests', { full: false, before: async () => {
    await page.locator('.ma-chat-unread').first().click({ timeout: 10000 }).catch(() => {});
    const row = page.locator('.ma-chat-list__row').first();
    if (await row.isVisible({ timeout: 30000 }).catch(() => false)) { await row.click(); await page.locator('.ma-chat__messages [role=status]').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); }
  } });
  report[role] = { email: account.email, pages, ...log };
  console.log(`${role}: console=${log.console.length} errors=${log.errors.length} api=${log.api.length}`);
  await context.close();
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
