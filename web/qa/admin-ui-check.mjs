// Quick admin UI check against a given origin (BASE, default http://localhost:3003).
// Read-only: opens tabs and the moderation sheet, confirms nothing.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base = process.env.BASE || 'http://localhost:3003';
const ledger = JSON.parse(fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md', import.meta.url), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const account = ledger.accounts.owner_admin;
const out = path.resolve('qa/shots/admin-2026-09-29');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(`${base}/account/`);
  await page.locator('#login-email').fill(account.email);
  await page.locator('#login-password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.locator('#login-email').waitFor({ state: 'hidden', timeout: 90000 });
  const settle = async () => {
    await page.locator('main .ma-stat').first().waitFor({ timeout: 90000 });
    await page.waitForFunction(() => !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 60000 });
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const tab of ['requests', 'users', 'offers', 'audit', 'contacts']) {
      await page.goto(`${base}/admin/?tab=${tab}`, { waitUntil: 'networkidle' });
      await settle();
      await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
      await page.screenshot({ path: path.join(out, `verified-${tab}-${width}.png`), fullPage: true });
      results.push({ tab, width,
        current: await page.locator('nav.ma-tabs a[aria-current="page"]').allTextContents(),
        tabs: await page.locator('nav.ma-tabs a').count(),
        kpis: await page.locator('main .ma-stat').count(),
        rows: await page.locator('main tbody tr').count(),
        overflow: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/admin/?tab=requests&q=zzzz-no-match`, { waitUntil: 'networkidle' });
  await settle();
  results.push({ state: 'empty', rows: await page.locator('main tbody tr').count(), text: (await page.locator('main .ma-empty, main [class*="state"]').allTextContents()).join(' | ').slice(0, 200) });
  await page.goto(`${base}/admin/?tab=requests`, { waitUntil: 'networkidle' });
  await settle();
  await page.locator('main tbody tr').first().getByRole('button', { name: /დამალვა|გამოჩენა/ }).click();
  const sheet = page.locator('dialog#moderation');
  await sheet.waitFor({ state: 'visible', timeout: 10000 });
  results.push({ state: 'sheet', reasonField: await sheet.locator('textarea[name="reason"]').count() });
  await sheet.getByRole('button', { name: 'გაუქმება' }).click();
  console.log(JSON.stringify({ base, results, errors }, null, 1));
  if (errors.length || results.some(r => r.overflow)) process.exitCode = 1;
} catch (e) {
  console.error(String(e.message).replaceAll(account.password, '[redacted]').slice(0, 600));
  console.log(JSON.stringify({ base, results, errors }, null, 1));
  process.exitCode = 1;
} finally { await browser.close(); }
