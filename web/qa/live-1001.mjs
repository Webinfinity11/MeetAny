import fs from 'node:fs';
import { chromium } from 'playwright';
import { credentials, auth, safe, assert } from './e2e/lib.mjs';
import { guard } from './visual/lib/browser.mjs';
const origin='https://meet-any.vercel.app';
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=[];fs.mkdirSync('qa/shots/live-1001',{recursive:true});
try {
 for(const [role,key]of [['guest',null],['client','hotel'],['company','linen'],['admin','owner_admin']]) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
  const state={blocked:[],chat:null,interceptions:0};await guard(ctx,state);
  p.on('pageerror',e=>errors.push(e.message));
  if(key){const r=await p.request.post(auth+'/sign-in/email',{data:credentials(key)});assert(r.ok(),`live login ${role}: ${r.status()}`);}
  const routes=key?['/account/?tab=profile',...(role==='company'?['/account/?tab=business']:[]),...(role==='admin'?['/admin/','/admin/?tab=reports']:[])]:['/','/companies/','/companies/?type=distributors','/requests/','/account/','/terms/'];
  for(const route of routes) {
   const response=await p.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
   await p.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:45000});
   if(key)assert.equal(await p.locator('#login-email').count(),0,`${role} signed in`);
   if(role==='admin'&&route.startsWith('/account/')){
    await p.waitForURL('**/admin/');
    await p.getByRole('heading',{name:'მიწოდება და მოთხოვნა',exact:true}).waitFor();
   }
   if(route==='/account/?tab=business')await p.getByRole('heading',{name:'პროდუქტები ფოტოთი',exact:true}).waitFor();
   if(route==='/admin/')await p.getByRole('heading',{name:'მიწოდება და მოთხოვნა',exact:true}).waitFor();
   if(route==='/admin/?tab=reports')assert((await p.locator('main').innerText()).includes('საჩივრები'));
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});await p.evaluate(()=>document.fonts.ready);
    if(width===390&&['client','company'].includes(role)&&route.startsWith('/account/'))await p.waitForFunction(()=>{
     const nav=document.querySelector('.account-nav__list'),active=nav?.querySelector('[aria-current="page"]');
     if(!nav||!active)return false;
     const desired=nav.scrollLeft+active.getBoundingClientRect().left-nav.getBoundingClientRect().left-nav.clientLeft-(nav.clientWidth-active.getBoundingClientRect().width)/2;
     return Math.abs(nav.scrollLeft-Math.max(0,Math.min(nav.scrollWidth-nav.clientWidth,desired)))<=1;
    },null,{timeout:10000});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${role} ${route} overflow`);
    await p.screenshot({path:`qa/shots/live-1001/${role}-${routes.indexOf(route)}-${width}.png`,fullPage:true});
   }
   report.push({role,route,status:'PASS'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);await ctx.close();console.log(role,'PASS');
 }
 const r=await fetch(origin+'/dev/ui/');assert.equal(r.status,404,'UI kit stays local');
 fs.writeFileSync('qa/live-1001-report.json',JSON.stringify({origin,report,readOnly:true,passed:true},null,2));
 console.log('PASS live:',report.length,'pages, desktop/mobile, no runtime errors, no writes');
}catch(e){console.error(safe(e.stack));process.exitCode=1;}finally{await browser.close();}
