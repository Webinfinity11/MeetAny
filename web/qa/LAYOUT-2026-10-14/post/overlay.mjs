// Checks the actual CTA hit areas; the Next.js development badge is excluded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:3444',AUTH='http://127.0.0.1:4444',id='bacf1572-7493-4ac9-bfc7-95719e911c4c';
const jwt=(await(await fetch(`${AUTH}/__mint?sub=${id}`)).json()).token;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try {
 for(const width of [1440,1280,1024,390,360,320]) {
  const context=await browser.newContext({viewport:{width,height:width<1024?844:1000},serviceWorkers:'block'});
  await context.route(`${AUTH}/**`,route=>{const url=route.request().url();if(url.includes('/.well-known/'))return route.continue();return route.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:url.includes('/get-session')?{user:{id,email:'qa@local.test',name:'QA'}}:{token:jwt}});});
  await context.route(/https:\/\/.*\/auth\//,route=>route.abort());
  await context.addInitScript(()=>localStorage.setItem('meetany.session','1'));
  const page=await context.newPage();
  await page.goto(`${BASE}/requests/new/?step=3`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('#post-request-form').waitFor();await page.locator('button[aria-controls="ma-account-menu"]').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);
  // Only the dev-server badge is hidden; no application element is modified.
  await page.addStyleTag({content:'nextjs-portal { display: none !important; }'});
  const action=width>=1024?'aside button[form="post-request-form"]':'[data-form-footer] .post-actions__next';
  for(const scroll of [0,300]) {
   await page.evaluate(y=>scrollTo(0,y),scroll);await page.waitForTimeout(100);
   const data=await page.locator(action).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,visible:r.top>=0&&r.bottom<=innerHeight,unobscured:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
   results.push({width,scroll,...data});assert.ok(data.visible&&data.unobscured&&data.height>=44&&data.width>=44,JSON.stringify(results.at(-1)));
  }
  if(width<1024) {
   const summary=page.locator('aside[aria-label="ასე ჩანს"] summary');await summary.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('aside[aria-label="ასე ჩანს"] details').getAttribute('open'),'');
   await page.keyboard.press('Enter');assert.equal(await page.locator('aside[aria-label="ასე ჩანს"] details').getAttribute('open'),null);
  }
  await context.close();
 }
} finally {await browser.close();fs.writeFileSync('qa/LAYOUT-2026-10-14/post/overlays.json',JSON.stringify(results,null,2));}
console.log(`${results.length} CTA position/hit-area checks passed; mobile preview keyboard toggle passed.`);
