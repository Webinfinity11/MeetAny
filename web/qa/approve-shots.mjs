// Approval screenshots for T9.3 (white PageBand) and T9.6 (request board A/B).
// Run: QA_ORIGIN=http://localhost:3001 node qa/approve-shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/approve-0924');
fs.mkdirSync(out, {recursive:true});
const widths = [[1440,1000],[390,844]];
const errors = [];
const browser = await chromium.launch({headless:true, executablePath});

async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  assert(!await p.locator('main').innerText().then(t=>t.includes('სერვისი დროებით მიუწვდომელია')), 'API unavailable');
  await p.evaluate(() => document.fonts.ready);
}
async function go(p, route) {await p.goto(base+route, {waitUntil:'networkidle'}); await loaded(p);}
async function capture(p, name, fullPage=true) {
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${name}: horizontal overflow`);
  await p.evaluate(async () => {await Promise.all(Array.from(document.images).map(img => {img.loading='eager'; return img.decode().catch(()=>{});}));});
  const broken = await p.evaluate(() => Array.from(document.images).filter(i => i.complete && i.naturalWidth===0 && i.getAttribute('src')).map(i=>i.getAttribute('src')));
  if (broken.length) console.log('broken images', name, broken);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'}); // dev-only indicator, not part of the page
  await p.waitForTimeout(400); // let entrance motion settle
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage});
  console.log('shot', name);
}
async function newPage(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => {if(m.type()==='error') errors.push(m.text().slice(0,250));});
  return p;
}
async function login(p, key) {
  await go(p, '/account/');
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  await loaded(p);
}

try {
  const guest = await browser.newContext();
  const page = await newPage(guest);
  await go(page, '/requests/');
  const request = await page.locator('a[href^="/requests/view/?id="]').first().getAttribute('href');
  await go(page, '/companies/');
  const company = await page.locator('a[href^="/companies/view/?id="]').first().getAttribute('href');
  const guestRoutes = {'head-request':request, 'head-company':company, 'board-a':'/requests/?variant=a', 'board-b':'/requests/?variant=b'};
  for (const [w,h] of widths) {
    await page.setViewportSize({width:w,height:h});
    for (const [name,route] of Object.entries(guestRoutes)) {
      await go(page, route);
      if (name.startsWith('head-')) await page.locator('.ma-call').first().waitFor({timeout:30000});
      await capture(page, `${name}-${w}`);
      if (w===390 && name.startsWith('board-')) {
        await page.evaluate(() => scrollTo(0,0));
        await capture(page, `${name}-390-fold`, false);
      }
    }
  }
  await guest.close();

  for (const [key,name,route] of [['hotel','head-account','/account/'],['admin','head-admin','/admin/']]) {
    const ctx = await browser.newContext();
    const p = await newPage(ctx);
    await login(p, key);
    for (const [w,h] of widths) {
      await p.setViewportSize({width:w,height:h});
      await go(p, route);
      if (key==='admin') await p.locator('.ma-stat').first().waitFor({timeout:60000});
      await capture(p, `${name}-${w}`);
    }
    await ctx.close();
  }
  if (errors.length) console.log('console errors:', errors.map(safe));
  console.log('PASS');
} catch (err) {
  console.error('Console errors:', errors.map(safe));
  throw new Error(safe(err.message));
} finally {
  await browser.close();
}
