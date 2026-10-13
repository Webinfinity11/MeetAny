import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
const jwt=(await (await fetch('http://127.0.0.1:3713/__mint?sub=3d12ff1f-0d72-4a53-a92f-1830cfd5b290')).json()).token;
for(const width of [1440,390,360]) {
 const page=await browser.newPage({reducedMotion:'reduce',viewport:{width,height:900}});
 await page.addInitScript(()=>localStorage.setItem('meetany.session','1'));
 await page.route('http://127.0.0.1:3713/**',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'http://localhost:3703','Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:route.request().url().endsWith('/get-session')?{user:{id:'3d12ff1f-0d72-4a53-a92f-1830cfd5b290',email:'qa@local.test'}}:{token:jwt}}));
 await page.route('**/api/db/bootstrap',async route=>{const response=await route.fetch();const data=await response.json();data.companies=data.companies.map(c=>({...c,logo_url:'/qa/p7-logo.svg',gallery:[]}));await route.fulfill({json:data});});
 await page.route('**/qa/p7-logo.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect width="400" height="100" fill="white"/><text x="200" y="70" font-family="sans-serif" font-size="70" text-anchor="middle">LOGO</text></svg>'}));
 for(const path of ['/companies/','/']) {
  await page.goto('http://localhost:3703'+path);const logo=page.locator('article img[src="/qa/p7-logo.svg"]').first();await logo.waitFor();await logo.evaluate(e=>e.scrollIntoView({block:'center'}));
  const fit=await logo.evaluate(e=>({fit:getComputedStyle(e).objectFit,bg:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).padding,complete:e.complete&&e.naturalWidth>0}));assert.equal(fit.fit,'contain');assert.ok(fit.complete);
  await page.screenshot({path:`qa/p7-card/shots/logo-${path==='/'?'home':'companies'}-${width}.png`});results.push({width,path,...fit});
 }
 await page.route('**/*',route=>route.request().resourceType()==='image' && !route.request().url().includes('icons.svg') ? route.abort() : route.fallback());
 await page.goto('http://localhost:3703/requests/');const card=page.locator('[data-request-id]').first();await card.waitFor();await card.scrollIntoViewIfNeeded();await page.waitForTimeout(700);
 const fallback=await card.evaluate(e=>{const v=e.firstElementChild;return{noPhoto:e.className.includes('noPhoto'),ratio:v.clientWidth/v.clientHeight};});assert.ok(fallback.noPhoto);assert.ok(Math.abs(fallback.ratio-3.2)<0.05);
 await card.screenshot({path:`qa/p7-card/shots/failed-photo-${width}.png`});results.push({width,...fallback});
 if(width===1440){await page.getByRole('button',{name:'სია',exact:true}).click();const slot=await card.evaluate(e=>e.firstElementChild.getBoundingClientRect().width);assert.equal(slot,160);await card.screenshot({path:'qa/p7-card/shots/horizontal-fallback-1440.png'});results.push({width,horizontalSlot:slot});}
 await page.close();
}
await browser.close();fs.writeFileSync('qa/p7-card/states.json',JSON.stringify(results,null,2));console.log(results);
