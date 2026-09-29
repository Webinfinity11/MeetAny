import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const phase = process.argv[2] || 'after';
assert(['before', 'after'].includes(phase));
const ledger = JSON.parse(fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md', import.meta.url), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const out = path.resolve('qa/shots/admin-2026-09-29');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors = [];
try {
 const page = await browser.newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
 await page.goto('http://localhost:3001/account/');
 // The owner's single admin account; the old demo admin only as a fallback.
 const account = ledger.accounts.owner_admin || { ...ledger.accounts.admin, email: 'demo-admin@meetany.ge' };
 await page.locator('#login-email').fill(account.email);
 await page.locator('#login-password').fill(account.password);
 await page.locator('form button[type="submit"]').click();
 await page.locator('#login-email').waitFor({state:'hidden',timeout:60000});
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const tab of phase==='before'?['requests','users','audit','contacts']:['requests','users','offers','audit','contacts']) {
   await page.goto(`http://localhost:3001/admin/?tab=${tab}`,{waitUntil:'networkidle'});
   await page.locator('main .ma-stat').first().waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
   await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
   await page.screenshot({path:path.join(out,`${phase}-${tab}-${width}.png`),fullPage:true});
   const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
   console.log(JSON.stringify({phase,tab,width,overflow,rows:await page.locator('main tbody tr').count(),alerts:await page.locator('main [role="alert"]').allTextContents()}));
   assert.equal(overflow,0);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS screenshots, overflow and console');
} catch(e) {
 const safe=Object.values(ledger.accounts).reduce((s,a)=>s.replaceAll(a.password,'[redacted]'),String(e.message));
 console.error(safe);process.exitCode=1;
} finally {await browser.close();}
