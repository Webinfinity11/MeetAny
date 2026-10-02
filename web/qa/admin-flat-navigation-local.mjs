import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {auth,credentials,rpc,safe,origin as apiOrigin} from './e2e/lib.mjs';
import {readRPCs} from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';assert.equal(apiOrigin,origin);assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output='qa/shots/admin-flat-navigation-local';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={origin,readOnly:true,views:[],errors:[],blockedWrites:[]};
const routes=['overview','companies','requests','offers','reports','users','content','reviews','contacts','photos','audit'];
const href=tab=>tab==='overview'?'/admin/':`/admin/?tab=${tab}`;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/api/**',route=>{const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin);if(['GET','HEAD','OPTIONS'].includes(request.method()))return route.continue();const fn=url.pathname.match(/^\/api\/db\/rpc\/([^/]+)$/)?.[1];if(fn&&(readRPCs.has(fn)||fn==='admin_business_audit'))return route.continue();if(url.pathname==='/api/analytics/registration')return route.fulfill({status:202,json:{enabled:false}});report.blockedWrites.push(request.method()+' '+url.pathname);return route.abort('blockedbyclient');});
 const login=await page.request.post(auth+'/sign-in/email',{data:credentials('owner_admin')});assert(login.ok());assert.equal((await rpc(page,'my_profile'))[0]?.role,'admin');
 await page.goto(origin+'/admin/',{waitUntil:'domcontentloaded'});
 const nav=page.locator('[aria-label="ადმინისტრირების განყოფილებები"]'),trigger=page.locator('[aria-controls="admin-section-navigation"]');await nav.waitFor({state:'attached'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  const mobile=await trigger.isVisible();
  if(mobile){await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert(await trigger.evaluate(node=>node.getBoundingClientRect().height>=44),'Mobile trigger touch size');await trigger.focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('href'),'/admin/','Tab enters first section');await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert(await trigger.evaluate(node=>node===document.activeElement),'Escape restores trigger focus');assert(!(await nav.isVisible()),'Collapsed nav hidden');}
  for(const tab of routes){
   if(mobile&&await trigger.getAttribute('aria-expanded')==='false')await trigger.click();
   assert.equal(await nav.locator('a').count(),11,'All eleven sections');
   assert.equal(await nav.locator('p').count(),0,'No intermediary group captions');
   assert.equal(await nav.locator('xpath=..').getByText('სამუშაო სივრცე',{exact:true}).count(),0,'No static workspace heading in sidebar');
   assert(!(await page.locator('aside').innerText()).includes('განყოფილება'),'No duplicate trigger label');
   const link=nav.locator(`a[href="${href(tab)}"]`);await link.scrollIntoViewIfNeeded();await link.click();await page.waitForURL(url=>url.pathname==='/admin/'&&(url.searchParams.get('tab')||'overview')===tab);await page.waitForFunction(()=>document.querySelector('main h1')?.textContent.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000});
   assert.equal(await nav.locator('a[aria-current="page"]').count(),1,'Exactly one current section');assert.equal(await nav.locator('a[aria-current="page"]').getAttribute('href'),href(tab));
   if(mobile){assert.equal(await trigger.getAttribute('aria-expanded'),'false','Navigation selection collapses');assert.equal(await trigger.getAttribute('aria-label'),`ადმინის მენიუ: ${(await page.locator('main h1').innerText()).trim()}`,'Current section gives exact mobile menu name');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${tab} ${width} no horizontal overflow`);
   assert.equal(await page.locator('main').getByText('სერვისი დროებით მიუწვდომელია',{exact:true}).count(),0,'Page available');
   report.views.push({width,tab,current:href(tab)});
  }
  if(mobile&&await trigger.getAttribute('aria-expanded')==='false')await trigger.click();
  await nav.locator('a[href="/admin/?tab=companies"]').click();
  await page.waitForURL(url=>url.searchParams.get('tab')==='companies');
  const applications=page.getByRole('link',{name:'პაკეტის განაცხადები',exact:true});await applications.waitFor();await applications.click();
  await page.waitForURL(url=>url.searchParams.get('tab')==='plans');await page.getByRole('heading',{level:1,name:'პაკეტის განაცხადები',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.business-admin-row,.business-empty,.business-panel [role="alert"]'));assert.equal(await page.locator('.business-panel [role="alert"]').count(),0,'Existing applications queue loads');assert(await page.locator('.business-admin-row').count()<=20,'Applications queue stays bounded');for(const select of await page.locator('.business-admin-row select').all()){assert.deepEqual(await select.locator('option').allTextContents(),['30 დღე','90 დღე','365 დღე']);}assert.equal(await nav.locator('a').count(),11);assert.equal(await nav.locator('a[href="/admin/?tab=plans"]').count(),0,'No separate package sidebar space');
  assert.equal(await nav.locator('a[aria-current="page"]').getAttribute('href'),'/admin/?tab=companies','Applications belong to Companies');
  if(mobile)assert.equal(await trigger.getAttribute('aria-label'),'ადმინის მენიუ: კომპანიები');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Applications no horizontal overflow');
  await page.screenshot({path:`${output}/package-applications-${width}.png`,fullPage:false,mask:[page.locator('.business-admin-row p,td[data-label="კონტაქტი"],a[href^="tel:"],a[href^="mailto:"]')]});
  await page.locator('a.ma-btn[href="/admin/?tab=companies"]').click();await page.waitForURL(url=>url.searchParams.get('tab')==='companies');
  report.views.push({width,tab:'plans-via-companies',current:'/admin/?tab=companies'});
  if(mobile){await page.screenshot({path:`${output}/navigation-collapsed-${width}.png`,fullPage:false,mask:[page.locator('td[data-label="კონტაქტი"],a[href^="tel:"],a[href^="mailto:"]')]});await trigger.click();}
  await page.screenshot({path:`${output}/navigation-${width}.png`,fullPage:false,mask:[page.locator('td[data-label="კონტაქტი"],a[href^="tel:"],a[href^="mailto:"]')]});
  if(mobile){const last=nav.locator('a').last();await last.scrollIntoViewIfNeeded();await last.focus();await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert(await trigger.evaluate(node=>node===document.activeElement));}
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.blockedWrites,[]);report.pass=true;fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(`PASS ${report.views.length} real route/viewport checks;11sections plus package applications through Companies,onecurrent,caption-free sidebar,mobile keyboard/Escape/focus,no overflow or writes.`);
}catch(error){report.pass=false;report.failure=safe(error.message);fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.error(safe(error.stack));process.exitCode=1;}
finally{await browser.close();}
