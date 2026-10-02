import fs from 'node:fs';
import { chromium } from 'playwright';
import { auth, credentials, rpc, safe, assert } from './e2e/lib.mjs';
import { guard } from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'local QA only');
const output='qa/shots/account-hub-1002';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=[];
try {
 for(const [role,key] of [['company','linen'],['client','cafe'],['admin','owner_admin']]) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),state={blocked:[],chat:null,interceptions:0},errors=[];
  await guard(context,state);page.on('pageerror',e=>errors.push(e.message));
  const login=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});assert(login.ok(),`sign in ${role}: ${login.status()}`);
  if(role==='company'){
   const me=(await rpc(page,'my_profile'))[0];
   await page.route('**/api/db/rpc/my_profile',r=>r.fulfill({json:[{...me,company:'ლუკა',name:'ლუკა',verified:false,logo_url:null,about:'',offers:[]}]}));
  }
  if(role!=='admin')await page.route('**/api/db/rpc/list_my_conversations',r=>r.fulfill({json:[]}));
  const pendingQueries=[];
  if(role==='admin')page.on('request',request=>{if(request.url().endsWith('/rpc/admin_search_users'))pendingQueries.push(request.postDataJSON());});
  const routes=role==='admin'?['/admin/?tab=users&role=company&status=unverified']:role==='company'?['/account/','/account/?tab=messages']:['/account/?tab=messages'];
  for(const route of routes){
   await page.goto(origin+route,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
   await page.evaluate(()=>document.fonts.ready);
   if(role==='company'&&route==='/account/'){
    await page.getByRole('heading',{name:'გამარჯობა, ლუკა',exact:true}).waitFor();
    await page.getByText('კომპანიის დადასტურების მოლოდინში',{exact:true}).waitFor();
    assert.equal(await page.locator('.account-welcome__stats a').count(),3);
    assert(!(await page.locator('.account-nav__who .ma-avatar').innerText()).includes('ლუ'));
   }
   if(route.includes('messages'))await page.getByRole('heading',{name:'პირველი საუბარი წინ არის',exact:true}).waitFor();
   for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${role} ${route} ${width}: overflow`);
    const visibleTaps=await page.locator('main .ma-btn').evaluateAll(nodes=>nodes.filter(el=>el.checkVisibility()).map(el=>el.getBoundingClientRect().height));
    if(width<768)assert(visibleTaps.every(height=>height>=43),`${role} ${width}: tap heights`);
    if([1440,390,320].includes(width))await page.screenshot({path:`${output}/${role}-${route.includes('messages')?'inbox':role==='admin'?'pending':'welcome'}-${width}.png`,fullPage:true});
    report.push({role,route,width,pass:true});
   }
  }
  if(role==='admin')assert(pendingQueries.some(q=>q.p_role==='company'&&q.p_verified===false&&q.p_blocked===false),'pending status invokes actual unverified company RPC filter');
  assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);await context.close();
 }
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,views:report.length,pass:true,readOnly:true,companyProfileAndEmptyInboxMocked:true,report},null,2));
 console.log(`PASS: ${report.length} local views; welcome, pending status, generic avatar, empty inbox, filtered admin queue. No application writes.`);
}catch(error){console.error(safe(error.stack));process.exitCode=1;}finally{await browser.close();}
