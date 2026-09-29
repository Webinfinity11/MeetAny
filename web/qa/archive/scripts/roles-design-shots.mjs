// Roles design audit 2026-09-29: read-only screenshots of register/profile/account/admin. No form is submitted.
// Run: QA_ORIGIN=http://localhost:3001 node qa/roles-design-shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const out = path.join(root, 'qa/shots/roles-0929');
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true, executablePath});
const report = {};
const loaded = p => p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, {timeout:60000});
async function shot(p, name) {
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => ({overflow: document.documentElement.scrollWidth - innerWidth, h1: document.querySelector('main h1')?.textContent}));
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage:true});
  report[name] = m; console.log('shot', name, JSON.stringify(m));
}
const geom = p => p.evaluate(() => [...document.querySelectorAll('main form .ma-field, main form .auth-row, main form input, main form select')].slice(0,40).map(e => {const r=e.getBoundingClientRect(); return {t:e.tagName+'#'+(e.id||e.className).toString().slice(0,30), x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)};}));
async function login(p, key) {
  await p.goto(base+'/account/', {waitUntil:'networkidle'}); await loaded(p);
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('#login-email'), null, {timeout:60000});
  await loaded(p);
}
for (const [w,h] of (process.env.QA_W ? [[+process.env.QA_W, +process.env.QA_H]] : [[1440,1000],[390,844]])) {
  const g = await browser.newContext({viewport:{width:w,height:h}}); const p = await g.newPage();
  await p.goto(base+'/account/?tab=register', {waitUntil:'networkidle'}); await loaded(p);
  await shot(p, `register-client-${w}`);
  report[`register-client-${w}-geom`] = await geom(p);
  await p.locator('form button[type="submit"]').last().click(); await p.waitForTimeout(400);
  await shot(p, `register-client-errors-${w}`);
  await p.locator('input[name="role"]').nth(1).check({force:true}); await p.waitForTimeout(300);
  await shot(p, `register-company-${w}`);
  report[`register-company-${w}-geom`] = await geom(p);
  await p.locator('form button[type="submit"]').last().click(); await p.waitForTimeout(400);
  await shot(p, `register-company-errors-${w}`);
  await g.close();
  for (const [key, label, routes] of [
    ['hotel','client',[['profile','/account/?tab=profile'],['overview','/account/']]],
    ['supply','company',[['profile','/account/?tab=profile'],['overview','/account/']]],
    ['admin','admin',[['users','/admin/?tab=users'],['requests','/admin/?tab=requests'],['audit','/admin/?tab=audit'],['contacts','/admin/?tab=contacts']]]]) {
    const c = await browser.newContext({viewport:{width:w,height:h}}); const q = await c.newPage();
    try { await login(q, key);
      for (const [n, r] of routes) { await q.goto(base+r, {waitUntil:'domcontentloaded'}); await loaded(q); await q.waitForTimeout(600); await shot(q, `${label}-${n}-${w}`); }
    } catch (e) { console.log('FAIL', key, w, String(e.message).slice(0,200)); }
    await c.close();
  }
}
fs.writeFileSync(path.join(out,'report.json'), JSON.stringify(report,null,1));
await browser.close();
