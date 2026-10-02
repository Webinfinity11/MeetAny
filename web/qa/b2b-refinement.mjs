import fs from 'node:fs';
import {chromium} from 'playwright';
import {auth,credentials,assert,safe} from './e2e/lib.mjs';
import {guard} from './visual/lib/browser.mjs';

const origin=process.env.B2B_ORIGIN||'http://localhost:3004';
assert.equal(new URL(origin).hostname,'localhost','Refinement checks stay local');
const output='qa/shots/b2b-refinement';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[],widths=[1440,1024,768,390,320];
const state={blocked:[],chat:null,interceptions:0};
async function go(page,route){
 await page.goto(origin+route,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000});
 await page.evaluate(()=>document.fonts.ready);
}
async function login(page,key){const r=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});assert(r.ok(),`Login ${key}: ${r.status()}`);}
async function screenshot(page,name,width){
 await page.waitForTimeout(200);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width} no overflow`);
 await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true});checks.push(`${name} ${width}`);
}
try{
 const guest=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await guard(guest,state);
 const page=await guest.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/companies/']){
  await go(page,route);
  assert(!(await page.locator('main').innerText()).includes('ფასიანი განთავსება'),'Paid placement boilerplate removed');
  for(const width of widths){await page.setViewportSize({width,height:1000});await screenshot(page,route==='/'?'home':'companies',width);}
 }
 await guest.close();
 const admin=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await guard(admin,state);
 const adminPage=await admin.newPage();adminPage.on('pageerror',e=>errors.push(e.message));await login(adminPage,'owner_admin');await go(adminPage,'/admin/');
 await adminPage.waitForFunction(()=>document.querySelectorAll('[aria-labelledby="activity-heading"] figure').length===2);
 for(const width of widths){
  await adminPage.setViewportSize({width,height:1000});
  const layout=await adminPage.evaluate(()=>{
   const a=document.querySelector('[aria-labelledby="activity-heading"]').getBoundingClientRect(),q=document.querySelector('[aria-labelledby="attention-heading"]').getBoundingClientRect(),p=document.querySelector('[aria-labelledby="activity-heading"]').parentElement.getBoundingClientRect();
   return {activity:{left:a.left,right:a.right,bottom:a.bottom,width:a.width},attention:{left:q.left,top:q.top,width:q.width},parentWidth:p.width};
  });
  assert(layout.attention.top>=layout.activity.bottom+16,`Attention below charts ${width}`);
  assert(Math.abs(layout.activity.width-layout.parentWidth)<2,`Chart panel full width ${width}`);
  assert(Math.abs(layout.attention.width-layout.activity.width)<2,`Attention panel aligned ${width}`);
  await screenshot(adminPage,'admin-overview',width);
 }
 await adminPage.getByRole('button',{name:'7 დღე',exact:true}).click();
 await adminPage.waitForFunction(()=>[...document.querySelectorAll('[aria-labelledby="activity-heading"] figure small')].every(e=>e.textContent==='7 დღეში'));
 await adminPage.getByRole('button',{name:'30 დღე',exact:true}).click();checks.push('7/30 day chart periods work after layout change');
 await admin.close();
 const company=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await guard(company,state);
 const companyPage=await company.newPage();companyPage.on('pageerror',e=>errors.push(e.message));await login(companyPage,'wood');
 await companyPage.route('**/rpc/engagement_state',async route=>{
  const r=await route.fetch(),data=await r.json();
  const title='საწყობიდან 24 შეფუთული ყუთის ტრანსპორტირება თბილისის სხვადასხვა მისამართზე დატვირთვა-გადმოტვირთვით';
  const items=[{id:'00000000-0000-4000-8000-000000000001',request_id:'00000000-0000-4000-8000-000000000002',kind:'request_match',title,category:'freight',city:'tbilisi',created_at:new Date().toISOString(),read_at:null}];
  const value=Array.isArray(data)?data[0]:data;
  value.unread=1;value.notifications={items,nextCursor:null};
  await route.fulfill({response:r,json:data});
 });
 await go(companyPage,'/');
 for(const width of widths){
  await companyPage.setViewportSize({width,height:1000});await companyPage.getByRole('button',{name:/^შეტყობინებები/}).first().click();await companyPage.locator('#notification-list article').waitFor();
  const popup=await companyPage.locator('#notification-list').evaluate(el=>{
   const r=el.getBoundingClientRect(),link=el.querySelector('article a'),title=link.querySelector('[class*="previewTitle"]'),t=title.getBoundingClientRect();
   return {left:r.left,right:r.right,height:r.height,linkHeight:link.getBoundingClientRect().height,titleHeight:t.height,lineHeight:parseFloat(getComputedStyle(title).lineHeight),event:link.querySelector('[class*="noticeKind"]').textContent};
  });
  assert(popup.left>=15&&popup.right<=width-15,'Notification popup stays inside screen');
  assert(popup.linkHeight>=44,'Whole notification is a comfortable click target');
  assert(popup.titleHeight<=popup.lineHeight*2+1,'Long title preview uses at most two lines');
  assert.equal(popup.event,'შესაბამისი მოთხოვნა');
  assert(popup.height<360,'One notification stays compact');
  await screenshot(companyPage,'notifications',width);
  await companyPage.keyboard.press('Escape');assert.equal(await companyPage.locator('#notification-list').count(),0);
  assert(await companyPage.getByRole('button',{name:/^შეტყობინებები/}).first().evaluate(el=>el===document.activeElement),'Escape restores bell focus');
 }
 await company.close();assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,checks,errors,readOnly:true,notificationDataMocked:true},null,2));
 console.log(`PASS ${checks.length} checks: public pages, full-width analytics, attention below, compact notifications, keyboard focus; no app writes`);
}catch(e){console.error(safe(e.stack));fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:false,checks,error:safe(e.message)},null,2));process.exitCode=1;}
finally{await browser.close();}
