import {reuseAnonymousToken} from "./site-walk-a-auth.mjs";
// Local read-only breadth audit. Writes are blocked; flow/registration tests run separately.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
process.env.QA_ORIGIN ||= 'http://localhost:3002';
const {origin,root,credentials,safe,assert}=await import('./e2e/lib.mjs');
const {readRPCs}=await import('./visual/lib/browser.mjs');
const phase=process.argv[2]||'before';
const dir=path.join(root,'qa/shots/final-2026-09-29/public');fs.mkdirSync(dir,{recursive:true});
const report={phase,pages:[],checks:[],blocked:[],errors:[],links:[]};
const save=()=>fs.writeFileSync(path.join(dir,`${phase}.json`),safe(JSON.stringify(report,null,2)));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let current='';
async function check(name,fn){try{const evidence=await fn();report.checks.push({page:current,name,status:'PASS',evidence});}catch(e){report.checks.push({page:current,name,status:'FAIL',reason:safe(e.message)});}save();}
const linkSet=new Set();
try{
for(const role of ['guest','owner_user','owner_company']){
 const session=`/tmp/meetany-flows-${role}.json`;
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},...(role!=='guest'&&fs.existsSync(session)?{storageState:session}:{}),locale:'ka-GE',timezoneId:'Asia/Tbilisi'});
 await reuseAnonymousToken(ctx);const p=await ctx.newPage();p.setDefaultTimeout(8000);p.setDefaultNavigationTimeout(30000);
 if(role!=='guest'){
  await p.goto(origin+'/account/');await p.locator('#login-email, .account-tabs').first().waitFor({timeout:30000});
  if(await p.locator('#login-email').isVisible()){
   const c=credentials(role);await p.locator('#login-email').fill(c.email);await p.locator('#login-password').fill(c.password);await p.locator('main form button[type=submit]').click();await p.locator('.account-tabs').waitFor({timeout:30000});
  }
  await ctx.storageState({path:session});fs.chmodSync(session,0o600);
 }
 await ctx.route('**/api/**',async r=>{const req=r.request(),url=new URL(req.url());const rpc=url.pathname.split('/rpc/')[1];if(['GET','OPTIONS','HEAD'].includes(req.method())||(rpc&&readRPCs.has(rpc)&&rpc!=='mark_read'))return r.continue();report.blocked.push({page:current,path:url.pathname});return r.abort('blockedbyclient');});
 p.on('pageerror',e=>report.errors.push({page:current,type:'pageerror',message:safe(e.message)}));
 p.on('console',e=>{if(e.type()==='error')report.errors.push({page:current,type:'console',message:safe(e.text())});});
 await p.addInitScript(()=>{window.qaShifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.qaShifts.push({value:e.value,input:e.hadRecentInput});}).observe({type:'layout-shift',buffered:true});});
 await p.goto(origin+'/companies/');await p.locator('.card-main-link').first().waitFor();const company=await p.locator('.card-main-link').first().getAttribute('href');
 const routes=[['home','/'],['requests','/requests/'],['companies','/companies/'],['company',company],['request','/requests/view/?id=fb2d9c2f-acef-4cde-be59-f1686aaf14ad'],['new-request','/requests/new/'],['account','/account/'],...(role==='guest'?[['register-client','/account/?tab=register'],['register-company','/account/?tab=register&role=company']]:['requests','saved','messages','profile','notifications',...(role==='owner_company'?['offers']:[])].map(t=>['account-'+t,'/account/?tab='+t]))];
 for(const width of [1440,390]){
 await p.setViewportSize({width,height:width===390?844:1000});
 for(const [name,route]of routes){
  current=`${role}-${name}-${width}`;console.log(current);
  try{
   const response=await p.goto(origin+route,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main [aria-busy=true]'));
   await p.locator('.ma-header__session-placeholder').waitFor({state:'hidden',timeout:20000});await p.locator('main [aria-busy=true]').first().waitFor({state:'hidden',timeout:20000});if(role!=='guest')await p.locator('.ma-menu__trigger').waitFor({state:'attached',timeout:25000});await p.waitForTimeout(400);await p.evaluate(()=>document.fonts.ready);
   await p.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}scrollTo(0,0);});await p.waitForTimeout(250);
   const metrics=await p.evaluate(()=>({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,broken:[...document.images].filter(x=>x.complete&&!x.naturalWidth).map(x=>x.getAttribute('src')),cls:window.qaShifts?.filter(x=>!x.input).reduce((s,x)=>s+x.value,0)||0,font:getComputedStyle(document.body).fontFamily,bodyOverflow:getComputedStyle(document.body).overflowY,links:[...document.querySelectorAll('a[href]')].filter(x=>x.getClientRects().length).map(x=>({text:x.innerText,href:x.getAttribute('href')})),controls:[...document.querySelectorAll('main button,main input,main [role=combobox],dialog[open] button')].filter(x=>x.getClientRects().length).map(x=>({tag:x.tagName,id:x.id,text:x.innerText,role:x.getAttribute('role'),disabled:x.disabled}))}));
   report.pages.push({key:current,route,status:response.status(),...metrics});
   for(const a of metrics.links)if(a.href?.startsWith('/')&&!a.href.startsWith('//')&&!a.href.startsWith('/admin'))linkSet.add(a.href);
   await p.screenshot({path:path.join(dir,`${phase}-${current}.png`),fullPage:true,animations:'disabled'});
   await check('layout/images/status',()=>{assert.equal(metrics.overflow,0);assert.equal(metrics.broken.length,0);assert.equal(response.status(),200);return {cls:metrics.cls};});
   if(!await p.locator('dialog[open]').count()){
    await check('skip link',async()=>{await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Control+Home');await p.locator('.ma-skip').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.id),'main');});
    await check('focus-visible + hover',async()=>{const b=p.locator('main button:visible:not(:disabled), main a:visible').first();await b.focus();await p.keyboard.press('Tab');const focus=await p.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth}));assert.notEqual(focus.tag,'BODY');await b.hover();return focus;});
   }
   if(name==='requests'||name==='companies'){
    await check('search empty/reset + CLS',async()=>{const input=p.locator('input[type=search]').first();await input.fill('zzzxxyy999noresults');await p.waitForTimeout(700);await input.press('Escape');assert((await p.locator('main').innerText()).match(/ვერ მოიძებნა|არ მოიძებნა|არ არის|შეცვალე/));await p.getByRole('button',{name:'ძიების გასუფთავება',exact:true}).first().click();assert.equal(await input.inputValue(),'');return await p.evaluate(()=>window.qaShifts);});
    await check('search keyboard',async()=>{const input=p.locator('input[type=search]').first();await input.focus();await input.press('ArrowDown');assert(await input.getAttribute('aria-activedescendant'));await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');});
    if(width===390)await check('mobile filters: Escape/scroll/focus',async()=>{const b=p.getByRole('button',{name:/ფილტრ/}).filter({visible:true}).first();await b.click();const d=p.locator('dialog[open]');await d.waitFor();const overflow=await p.evaluate(()=>getComputedStyle(document.documentElement).overflowY);await p.screenshot({path:path.join(dir,`${phase}-${current}-filters.png`)});await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});assert(await b.evaluate(x=>x===document.activeElement));assert.equal(overflow,'hidden');});
   }
   if(width===390&&!await p.locator('dialog[open]').count())await check('mobile menu: Space/Escape/scroll/focus',async()=>{const b=p.getByRole('button',{name:'მენიუ',exact:true});await b.focus();await p.keyboard.press('Space');await p.locator('#ma-mnav[open]').waitFor();const overflow=await p.evaluate(()=>getComputedStyle(document.documentElement).overflowY);await p.keyboard.press('Escape');await p.locator('#ma-mnav[open]').waitFor({state:'hidden'});assert(await b.evaluate(x=>x===document.activeElement));assert.equal(overflow,'hidden');});
   if(name==='new-request')await check('request modal: Escape',async()=>{await p.keyboard.press('Escape');await p.locator('#new-request').waitFor({state:'hidden'});});
   await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(300);
   await check('reduced motion',async()=>{const running=await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&Number(a.effect?.getTiming().duration)>1).length);assert.equal(running,0);});
   await p.emulateMedia({reducedMotion:'no-preference'});
  }catch(e){report.checks.push({page:current,name:'page audit',status:'FAIL',reason:safe(e.message)});}
  save();
 }
 }
 await ctx.close();
}
// Read-only HTTP checks for all discovered local destinations (deduplicated).
const ctx=await browser.newContext();await reuseAnonymousToken(ctx);const p=await ctx.newPage();
for(const href of linkSet){const r=await p.request.get(origin+href,{timeout:20000});report.links.push({href,status:r.status()});}save();
}finally{await browser.close();save();}
console.log(JSON.stringify({pages:report.pages.length,checks:report.checks.length,failures:report.checks.filter(x=>x.status==='FAIL'),errors:report.errors,blocked:report.blocked,links:report.links.length},null,2));
