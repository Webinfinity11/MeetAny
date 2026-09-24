// Acceptance shots: login / account / request form (2026-09-24, v2 after 1375cdb). Run: QA_ORIGIN=http://localhost:3001 node qa/accept-account-shots.mjs
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
const safe = v => secrets.reduce((t, s) => t.replaceAll(s, '[redacted]'), String(v));
const out = path.join(root, 'qa/shots/accept-0924/v2');
fs.mkdirSync(out, {recursive:true});
const widths = [[1440,1000],[390,844]];
const browser = await chromium.launch({headless:true, executablePath});
const loaded = async p => {await p.waitForFunction(() => (document.querySelector('main')?.innerText.length||0)>20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000}); await p.evaluate(()=>document.fonts.ready);};
const go = async (p,r) => {await p.goto(base+r,{waitUntil:'networkidle'}); await loaded(p);};
const shot = async (p,name,full=true) => {await p.addStyleTag({content:'nextjs-portal{display:none!important}'}); await p.waitForTimeout(400); await p.screenshot({path:path.join(out,name+'.png'),fullPage:full}); console.log('shot',name);};
const info={};
const dump = async (p,label,sel) => {info[label]=JSON.parse(safe(JSON.stringify(await p.evaluate(sel))));};
const geo = `(()=>{const r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top+scrollY),Math.round(b.width),Math.round(b.height)]};
 const cs=e=>{const c=getComputedStyle(e);return {fs:c.fontSize,fw:c.fontWeight,ff:c.fontFamily.slice(0,20),tn:c.fontVariantNumeric,rad:c.borderRadius,bg:c.backgroundImage!=='none'?c.backgroundImage.slice(0,40):''}};
 const q=s=>[...document.querySelectorAll(s)];
 return {scrollW:document.documentElement.scrollWidth,
  els:q('main h1,main h2,main h3,main label,main input,main select,main textarea,main button,main a,main .ma-tab,main [role=tab],dialog h1,dialog h2,dialog label,dialog input,dialog select,dialog textarea,dialog button').slice(0,90).map(e=>({t:(e.innerText||e.placeholder||e.value||'').slice(0,40).replace(/\\n/g,' | '),tag:e.tagName,cls:(e.className||'').toString().slice(0,40),box:r(e),...cs(e)}))}})()`;
try {
  const g = await browser.newContext(); const p = await g.newPage();
  for (const [w,h] of widths) {
    await p.setViewportSize({width:w,height:h});
    await p.goto(base+'/account/',{waitUntil:'networkidle'}); await p.locator('#login-email').waitFor({timeout:30000}); await p.evaluate(()=>document.fonts.ready);
    await shot(p,`login-${w}`); await dump(p,`LOGIN-${w}`,geo);
    if (w===1440) {
      await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(500);
      await shot(p,'login-empty-1440'); await dump(p,'LOGIN-EMPTY',`document.querySelector('main').innerText.slice(0,700)`);
      await p.locator('#login-email').fill('abc'); await p.locator('#login-password').fill('x');
      await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(1200);
      await shot(p,'login-error-1440'); await dump(p,'LOGIN-ERR',`document.querySelector('main').innerText.slice(0,700)`);
    }
    await p.locator('main .ma-tab',{hasText:'რეგისტრაცია'}).click(); await p.waitForTimeout(500);
    await shot(p,`login-register-${w}`); await dump(p,`REG-${w}`,geo);
    if (w===1440) {
      await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(500);
      await shot(p,'login-register-empty-1440'); await dump(p,'REG-EMPTY',`document.querySelector('main').innerText.slice(0,1200)`);
      const em = p.locator('form input[type=email], form input[name=email]').first();
      if (await em.count()) { await em.fill('abc'); await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(600); await shot(p,'login-register-error-1440'); await dump(p,'REG-ERR',`document.querySelector('main').innerText.slice(0,1200)`); }
    }
  }
  await g.close();
  for (const [key,tag] of [['hotel','account'],['supply','account-company']]) {
    const ctx = await browser.newContext(); const a = await ctx.newPage();
    await a.setViewportSize({width:1440,height:1000});
    await go(a,'/account/');
    await a.locator('#login-email').fill(`demo-${key}@meetany.ge`); await a.locator('#login-password').fill(ledger.accounts[key].password);
    await a.locator('form button[type="submit"]').click();
    await a.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000}); await loaded(a);
    for (const [w,h] of widths) {
      await a.setViewportSize({width:w,height:h});
      await go(a,'/account/');
      await shot(a,`${tag}-${w}`); await dump(a,`${tag}-${w}`,geo);
      await dump(a,`${tag}-TEXT-${w}`,`document.querySelector('main').innerText.slice(0,3000)`);
      if (key==='hotel') {
        await go(a,'/account/?tab=profile'); await shot(a,`account-profile-${w}`); await dump(a,`PROFILE-${w}`,geo);
        await dump(a,`PROFILE-TEXT-${w}`,`document.querySelector('main').innerText.slice(0,2500)`);
        await go(a,'/account/');
        const btn = a.getByRole('link',{name:/მოთხოვნის დამატება/}).or(a.getByRole('button',{name:/მოთხოვნის დამატება/})).first();
        await btn.click(); await a.locator('#new-request[open]').waitFor({timeout:120000});
        await a.waitForFunction(()=>!document.querySelector('#new-request')?.innerText.includes('შედი ანგარიშში'),null,{timeout:15000}).catch(()=>console.log('STILL-GUEST',w));
        await a.locator('#new-request input, #new-request textarea').first().waitFor({timeout:30000}); await a.waitForTimeout(800);
        await shot(a,`request-new-${w}`,false);
        await dump(a,`FORM-${w}`,`(()=>{const d=document.querySelector('#new-request');const r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]};return {dlg:r(d),scrollH:d.scrollHeight,ch:d.clientHeight,text:d.innerText.slice(0,2000),els:[...d.querySelectorAll('h1,h2,label,input,select,textarea,button')].map(e=>({t:(e.innerText||e.placeholder||'').slice(0,30),tag:e.tagName,box:r(e),rad:getComputedStyle(e).borderRadius}))}})()`);
        await a.locator('#new-request button[type="submit"], #new-request form button').last().click(); await a.waitForTimeout(600);
        await shot(a,`request-new-errors-${w}`,false); await dump(a,`FORM-ERR-${w}`,`document.querySelector('#new-request').innerText.slice(0,2000)`);
      }
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out,'info-account.json'),JSON.stringify(info,null,1));
  console.log('PASS');
} catch (e) {console.error(safe(e.message));} finally {await browser.close();}
