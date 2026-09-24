// P12: /admin/?tab=audit shows actor and target names, not raw ids. Read-only.
// Run: QA_ORIGIN=http://localhost:3001 node qa/admin-audit-shot.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const out = path.join(root, 'qa/shots/ideal-0924');
fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({headless:true, executablePath});
const page = await browser.newPage({viewport:{width:1440, height:1000}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const loaded = () => page.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, {timeout:60000});
await page.goto(base+'/account/', {waitUntil:'networkidle'}); await loaded();
await page.locator('#login-email').fill('demo-admin@meetany.ge');
await page.locator('#login-password').fill(ledger.accounts.admin.password);
await page.locator('form button[type="submit"]').click();
await page.waitForFunction(() => !document.querySelector('#login-email'), null, {timeout:60000});
await page.goto(base+'/admin/?tab=audit', {waitUntil:'networkidle'}); await loaded();
await page.waitForSelector('main .ma-table tbody tr', {timeout:60000});
const check = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('main .ma-table tbody tr')];
  const text = document.querySelector('main .ma-table').innerText;
  return {rows: rows.length, uuids: (text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []).length,
    sample: rows.slice(0, 3).map(r => [...r.querySelectorAll('td')].slice(1, 3).map(td => td.innerText.replace(/\s+/g, ' ')))};
});
console.log(JSON.stringify(check));
assert.equal(check.uuids, 0, 'raw UUIDs in audit table');
await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
await page.screenshot({path: path.join(out, 'admin-audit-1440.png'), fullPage:true});
assert.deepEqual(errors, []);
await browser.close();
