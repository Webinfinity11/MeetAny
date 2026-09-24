// UI checks only. Fixtures render the real RequestRow; no database writes for request states.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'qa/shots/ideal-0924');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const redact=s=>Object.values(ledger.accounts).reduce((text,a)=>a.password?text.replaceAll(a.password,'[redacted]'):text,String(s));
const errors=[];
const checks=[];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
const go=async(route)=>{await page.goto('http://localhost:3001'+route,{waitUntil:'networkidle'});await page.locator('main').waitFor();};
const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
const check=(s)=>{checks.push(s);console.log('PASS',s);};
function loadTS(file){
 const compiled={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require:(id)=>id==='next/link'?{default:({children,...props})=>React.createElement('a',props,children)}:id.startsWith('.')?loadTS(path.resolve(path.dirname(file),id+'.ts')):require(id)});
 return compiled.exports;
}
try {
 if(!process.argv.includes('--fixtures')) {
 await go('/companies/');await page.locator('.supplier-row').first().waitFor();
 assert.equal(await page.locator('.catalog-heading [role=status]').count(),1);
 assert.equal(await page.locator('.r2-results-bar [role=status]').count(),0);
 const row=page.locator('.supplier-row').first();
 const title=row.locator('.card-main-link');await title.focus();
 assert(await title.evaluate(e=>getComputedStyle(e,'::after').boxShadow!=='none'));
 await row.locator('[data-contact-action=reveal]').click();
 const call=row.locator('[data-contact-action=call]');await call.waitFor();
 assert(await call.evaluate(e=>e===document.activeElement&&e.getAttribute('href').startsWith('tel:')));
 await overflow();check('phone reveal → tel + focus; no phone screenshot');
 await go('/companies/');
 const direction=page.locator('.listing-directions').first();
 assert.equal(await direction.getAttribute('target'),'_blank');
 assert((await direction.getAttribute('rel')).includes('noopener'));
 const target=await direction.getAttribute('href');
 await ctx.route(target,route=>route.fulfill({body:'QA direction destination',contentType:'text/plain'}));
 const popupPromise=page.waitForEvent('popup');await direction.click();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(popup.url(),target);await popup.close();
 check('directions opens its existing URL independently');
 const toggle=page.locator('.catalog-filter-toggle');await toggle.click();
 await page.locator('#filters[open]').waitFor();
 await page.locator('#company-city-mobile').selectOption('tbilisi');
 await page.locator('#filters button[aria-label="ფილტრების დახურვა"]').click();
 assert(await toggle.evaluate(e=>e===document.activeElement));
 await page.locator('.r2-results-summary button').filter({hasText:'გასუფთავება'}).click();
 await page.waitForFunction(()=>!location.search.includes('city='));await overflow();
 check('mobile sheet, city filter, reset, focus returns');
 await page.locator('.listing-utilities button').first().click();await page.waitForURL('**/account/?tab=saved');
 check('guest save opens sign-in');
 // A separate context avoids carrying the guest save intent into authenticated QA.
 const auth=await browser.newContext({viewport:{width:390,height:844}});const ap=await auth.newPage();ap.on('pageerror',e=>errors.push(e.message));
 await ap.goto('http://localhost:3001/account/',{waitUntil:'networkidle'});
 await ap.locator('#login-email').fill('demo-hotel@meetany.ge');await ap.locator('#login-password').fill(ledger.accounts.hotel.password);
 await ap.locator('form button[type=submit]').click();await ap.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
 await ap.goto('http://localhost:3001/companies/',{waitUntil:'networkidle'});const save=ap.locator('.listing-utilities button').first();await save.waitFor();await ap.waitForTimeout(800);
 const original=await save.getAttribute('aria-pressed');await save.click();
 await ap.waitForFunction(v=>document.querySelector('.listing-utilities button')?.getAttribute('aria-pressed')!==v,original);
 await save.click();await ap.waitForFunction(v=>document.querySelector('.listing-utilities button')?.getAttribute('aria-pressed')===v,original);
 assert.equal(await ap.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
 await auth.close();check('authenticated save toggles and restores initial state');
 await go('/requests/');await page.locator('.request-card').first().waitFor();
 assert.equal(await page.locator('.request-tier-zone').count(),0);
 assert(await page.locator('.request-card--vip').count()>0);assert(await page.locator('.request-card--top').count()>0);
 assert.equal(await page.locator('.request-card:not(.request-card--photo) .request-card-visual').count(),0);
 const photo=page.locator('.request-card--photo').first();const photoId=await photo.locator('.card-main-link').getAttribute('href');
 await photo.locator('img').dispatchEvent('error');
 assert.equal(await page.locator(`.request-card:has(a[href="${photoId}"]) .request-card-visual`).count(),0);
 check('VIP/top/default, absent and failed photo remove visual DOM');
 await page.locator('.request-board-tabs a').filter({hasText:'ახალი'}).click();await page.waitForURL('**tab=new');
 await page.locator('.request-board-tabs a').filter({hasText:'ყველა'}).click();
 await page.waitForFunction(()=>!location.search.includes('tab='));
 assert.equal(await page.locator('.request-card-grid').getAttribute('data-tab-changed'),'');
 await page.locator('select[aria-label="ქალაქი"]').selectOption('tbilisi');
 await page.locator('.r2-results-summary button').filter({hasText:'გასუფთავება'}).click();await page.waitForFunction(()=>!location.search.includes('city='));
 check('request tabs, no repeated entrance, filter reset');
 for(const route of ['/companies/','/requests/']) {
  await page.emulateMedia({reducedMotion:'reduce'});await go(route);await page.locator('.supplier-row,.request-card').first().waitFor();
  assert.equal(await page.locator('.catalog-page').evaluate(e=>[e,...e.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return s.animationName!=='none'||s.transitionDuration.split(',').some(x=>parseFloat(x)!==0);}).length),0);
  await overflow();
 }
 check('reduced-motion disables all catalog animation/transition; overflow 0');
 }
 await page.emulateMedia({reducedMotion:'reduce'});await go('/requests/');
 const {RequestRow}=loadTS(path.join(root,'app/components/market/RequestRow.tsx'));
 const base={id:'qa-fixture',title:'გრძელი ქართული მოთხოვნის სათაური სრული ტექსტით და დამატებითი სიტყვებით',category:'furniture',city:'tbilisi',cityLabel:'თბილისი, ზუგდიდი, ქუთაისი',photo:null,quantity:12,unit:'piece',neededBy:null,ownerName:'ორგანიზაციის გრძელი ქართული დასახელება',offerCount:0,state:'open',daysLeft:2,isOwn:false,showOwnOfferBadge:false};
 const fixtures=[{}, {isNew:true}, {state:'closed',isOwn:true}, {state:'expired'}, {state:'chosen',showOwnOfferBadge:true,ownOfferStatus:'chosen'}, {state:'hidden'}];
 const html=fixtures.map((props,i)=>renderToStaticMarkup(React.createElement(RequestRow,{r:{...base,...props,id:`qa-${i}`}}))).join('');
 await page.locator('.request-card-grid').evaluate((e,html)=>{e.innerHTML=html;},html);
 for(const status of ['დახურულია','ვადაგასულია','მომწოდებელი არჩეულია','დამალულია'])assert((await page.locator('.request-card-status').allTextContents()).some(t=>t.includes(status)));
 assert.equal(await page.locator('.request-card-urgent').count(),2);
 assert.equal(await page.locator('.request-card-visual').count(),0);
 await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 for(const [width,height] of [[1440,1000],[390,844]]) {
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,`request-states-fixture-${width}.png`),fullPage:true});await overflow();
 }
 check('real RequestRow fixtures: new, own, closed, expired, chosen offer, hidden, long title/cities');
 assert.deepEqual(errors,[]);check('pageerror 0');
 if(!process.argv.includes('--fixtures')) fs.writeFileSync(path.join(out,'qa-results.json'),JSON.stringify({checks,pageerrors:errors},null,2)+'\n');
}catch(error){throw new Error(redact(error.message));}finally{await browser.close();}
