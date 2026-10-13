// Read-only live UI audit. No request/offer/message submissions or account changes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.QA_ORIGIN||'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets=Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe=s=>secrets.reduce((v,key)=>v.replaceAll(key,'[redacted]'),String(s));
const dir='qa/shots/usability-2026-09-30';fs.mkdirSync(dir,{recursive:true});
const report={checks:[],pages:[],errors:[]};
const save=()=>fs.writeFileSync('qa/usability-report.json',JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function check(name,fn){try{const evidence=await fn();report.checks.push({name,status:'PASS',evidence});}catch(e){report.checks.push({name,status:'FAIL',reason:safe(e.message).slice(0,500)});}console.log(report.checks.at(-1).status,name);save();}
async function loaded(p){await p.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&document.querySelector('main')?.innerText.trim(),null,{timeout:30000});assert(!(await p.locator('main').innerText()).includes('სერვისი დროებით მიუწვდომელია'));}
async function go(p,url){await p.goto(origin+url,{waitUntil:'domcontentloaded'});await loaded(p);await p.locator('.ma-header__login,.ma-header__account').first().waitFor({state:'attached'});}
async function scan(p,key){await p.evaluate(()=>document.fonts.ready);const info=await p.evaluate(()=>{const visible=n=>!!(n.offsetWidth||n.offsetHeight||n.getClientRects().length);const els=[...document.querySelectorAll('main [id]')].filter(visible);return {overflow:document.documentElement.scrollWidth>innerWidth,headings:[...document.querySelectorAll('main h1,main h2')].filter(visible).map(n=>n.textContent),duplicateIds:els.map(n=>n.id).filter((id,i,a)=>a.indexOf(id)!==i),unlabelled:[...document.querySelectorAll('main button,main input:not([type=hidden]), main textarea')].filter(visible).filter(n=>n.getAttribute('aria-hidden')!=='true'&&!n.textContent.trim()&&!n.getAttribute('aria-label')&&!n.getAttribute('aria-labelledby')&&!n.labels?.length&&!n.getAttribute('title')).map(n=>n.id||n.className)};});report.pages.push({key,...info});assert.equal(info.overflow,false,'horizontal overflow');assert.deepEqual(info.duplicateIds,[],'duplicate visible IDs');await p.addStyleTag({content:'nextjs-portal{display:none!important}'});await p.screenshot({path:`${dir}/${key}.png`,fullPage:!await p.locator('dialog[open]').count(),animations:'disabled'});return info;}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>report.errors.push(safe(e.message)));
 let requestHref,companyHref;
 for(const route of ['/','/companies/','/requests/','/account/','/account/?tab=register','/account/?tab=register&role=company','/terms/','/requests/view/?id=missing','/companies/view/?id=missing','/does-not-exist/']){
  for(const width of [1440,390])await check(`guest ${route} ${width}`,async()=>{await p.setViewportSize({width,height:1000});await go(p,route);if(route==='/requests/')requestHref=await p.locator('.request-card .card-main-link').first().getAttribute('href');if(route==='/companies/')companyHref=await p.locator('.company-card .card-main-link').first().getAttribute('href');return scan(p,`guest-${route.replace(/\W+/g,'-')}-${width}`)});
 }
 for(const [name,href]of[['request',requestHref],['company',companyHref]])for(const width of [1440,390])await check(`guest ${name} detail ${width}`,async()=>{assert(href);await p.setViewportSize({width,height:1000});await go(p,href);return scan(p,`guest-${name}-detail-${width}`)});
 for(const route of ['/companies/','/requests/']){
  await check(`${route} search empty/reset and URL`,async()=>{await p.setViewportSize({width:1440,height:1000});await go(p,route);const input=p.locator('main input[role=combobox]');await input.fill('არარსებული-qa-ძიება');await p.waitForURL(/q=/, {waitUntil:"domcontentloaded"});await p.waitForFunction(()=>!document.querySelector('.company-card,.request-card'));assert.equal(await p.locator('.company-card,.request-card').count(),0);await input.fill('');await input.press('Escape');await p.waitForFunction(()=>!new URL(location.href).searchParams.has('q'));await p.locator('.company-card,.request-card').first().waitFor();assert(await p.locator('.company-card,.request-card').count()>0);});
  await check(`${route} mobile filters Escape/focus`,async()=>{await p.setViewportSize({width:390,height:844});await go(p,route);const button=p.getByRole('button',{name:/ფილტრი/}).first();await button.click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);assert(await button.evaluate(n=>n===document.activeElement));});
 }
 await check('guest request draft/auth handoff',async()=>{await go(p,'/requests/new/');await p.locator('#title').fill('QA მოთხოვნის მონახაზი');await p.locator('#body').fill('QA აღწერა რომელიც უნდა დარჩეს შესვლის შემდეგ.');const link=p.locator('.request-form__guest').getByRole('link',{name:'შედი ანგარიშში'});await link.click();await p.locator('#login-email').waitFor();const next=new URL(p.url()).searchParams.get('next');assert(next?.startsWith('/requests/new/'));await go(p,next);await p.locator('#body').waitFor();assert.equal(await p.locator('#body').inputValue(),'QA აღწერა რომელიც უნდა დარჩეს შესვლის შემდეგ.');});
 await ctx.close();
 for(const key of ['owner_user','owner_company','owner_admin']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(safe(e.message)));
  await check(`${key} real UI sign-in`,async()=>{await go(page,'/account/');await page.locator('#login-email').fill(ledger.accounts[key].email);await page.locator('#login-password').fill(ledger.accounts[key].password);await page.locator('form button[type=submit]').click();await page.locator('#login-email').waitFor({state:'detached',timeout:45000});await loaded(page);});
  if(await page.locator('#login-email').count()){await context.close();continue;}
  const routes=key==='owner_admin'?['/admin/','/admin/?tab=users','/admin/?tab=requests','/admin/?tab=offers']:['/account/','/account/?tab=requests','/account/?tab=offers','/account/?tab=saved','/account/?tab=messages','/account/?tab=notifications','/account/?tab=profile','/admin/'];
  for(const route of routes)for(const width of [1440,390])await check(`${key} ${route} ${width}`,async()=>{await page.setViewportSize({width,height:1000});await go(page,route);if(route==='/admin/'&&key!=='owner_admin')assert((await page.locator('main').innerText()).includes('მხოლოდ ადმინისტრატორისთვის'));
if(route.startsWith('/account/')&&key!=='owner_admin'){
 const active=page.locator('.account-nav__list [aria-current="page"]');assert.equal(await active.count(),1);
 if(key==='owner_user')assert.equal(await page.locator('.account-nav__list a[href*="tab=offers"]').count(),0);
 const box=await active.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'active account tab is visible');
}
return scan(page,`${key}-${route.replace(/\W+/g,'-')}-${width}`)});
  if(key!=='owner_admin')await check(`${key} new request validation`,async()=>{await go(page,'/requests/new/');await page.locator('#title').waitFor();await page.locator('button[form="new-request-form"]').click();assert(await page.locator('#title').getAttribute('aria-invalid')==='true');assert.equal(await page.evaluate(()=>document.activeElement.id),'title');});
  await context.close();
 }
}finally{await browser.close();save();console.log('RESULT',JSON.stringify({pass:report.checks.filter(x=>x.status==='PASS').length,fail:report.checks.filter(x=>x.status==='FAIL').length,errors:report.errors.length}));}
