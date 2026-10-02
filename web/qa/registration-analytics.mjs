import {assertLocalPreview} from './local-preview.mjs';
import {chromium} from 'playwright';
import {auth,credentials,token,safe} from './e2e/lib.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
assertLocalPreview('http://localhost:3004');
const origin='http://localhost:3004',url=origin+'/api/analytics/registration';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let count=0;const check=(v,msg)=>{assert(v,msg);count++;};
try{
const guest=await browser.newContext(),admin=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),company=await browser.newContext();
const gp=await guest.newPage(),ap=await admin.newPage(),cp=await company.newPage();
check((await gp.request.get(url)).status()===401,'anonymous analytics GET denied');
for(const [page,key]of [[ap,'owner_admin'],[cp,'linen']]){const r=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});check(r.ok(),key+' signed in');}
const adminToken=await token(ap),companyToken=await token(cp);
const get=async(role='client')=>{const r=await ap.request.get(url+'?days=30&role='+role,{headers:{Authorization:'Bearer '+adminToken}});check(r.ok(),'admin aggregates available');const d=await r.json();check(d.enabled===true,'local feature enabled with migration');return d;};
check((await cp.request.get(url,{headers:{Authorization:'Bearer '+companyToken}})).status()===403,'company analytics GET denied');
const before=await get(),sessionId=randomUUID(),eventId=randomUUID(),base={eventId,sessionId,role:'client',stage:'form_open',source:'company',device:'tablet'};
const post=(data,authorization)=>gp.request.post(url,{headers:{Origin:origin,...(authorization?{Authorization:'Bearer '+authorization}:{})},data});
check((await gp.request.post(url,{data:base})).status()===403,'missing origin denied');
check((await post({...base,email:'private@example.ge'})).status()===400,'PII field rejected');
check((await post({...base,extra:'x'.repeat(600)})).status()===413,'oversized body rejected');
check((await post({...base,source:'https://example.com/?email=x'})).status()===400,'URL source rejected');
check((await post(base)).status()===202,'opened event durable');
check((await post(base)).status()===202,'duplicate retries accepted idempotently');
for(const stage of ['form_started','form_submitted','email_pending'])check((await post({...base,eventId:randomUUID(),stage})).status()===202,'durable stage '+stage);
check((await post({...base,eventId:randomUUID(),stage:'profile_created'})).status()===401,'anonymous cannot fabricate completion');
const after=await get();check(after.sessions===before.sessions+1,'dedupe: one extra attempt');check(after.started===before.started+1,'start count persisted');check(after.submitted===before.submitted+1,'submitted count persisted');check(after.completed===before.completed,'guest completion unchanged');
const find=(data,prop,key,value)=>data[prop].find(row=>row[key]===value)?.sessions||0;
check(find(after,'sources','source','company')===find(before,'sources','source','company')+1,'source aggregated exactly');check(find(after,'devices','device','tablet')===find(before,'devices','device','tablet')+1,'device aggregated exactly');
const stages=after.lastStages.find(row=>row.stage==='email_pending').count,beforeStages=before.lastStages.find(row=>row.stage==='email_pending').count;check(stages===beforeStages+1,'last-stage reflects actual email pending');
const again=await get();check(again.sessions===after.sessions&&again.submitted===after.submitted,'fresh API read persistence');
const companySession={eventId:randomUUID(),sessionId:randomUUID(),role:'company',stage:'form_open',source:'header',device:'desktop'};
check((await post(companySession)).status()===202,'company role event accepted');check((await post({...companySession,eventId:randomUUID(),stage:'profile_created'},companyToken)).status()===400,'old existing profile cannot fabricate new registration');
const errors=[];ap.on('pageerror',e=>errors.push(e.message));await ap.goto(origin+'/admin/');await ap.getByRole('heading',{name:'რეგისტრაციის გზა',exact:true}).waitFor({timeout:60000});await ap.locator('section').filter({has:ap.getByRole('heading',{name:'რეგისტრაციის გზა',exact:true})}).getByText('ბოლო გავლილი ეტაპი',{exact:true}).waitFor({timeout:45000});
const section=ap.locator('section').filter({has:ap.getByRole('heading',{name:'რეგისტრაციის გზა',exact:true})});await section.getByText('საიდან და რომელი მოწყობილობით',{exact:true}).click();check(await section.getByText('ტაბლეტი',{exact:true}).isVisible(),'source/device disclosure real-data UI');
for(const width of [1440,768,390,320]){await ap.setViewportSize({width,height:1000});await ap.waitForTimeout(200);check(await ap.evaluate(()=>document.documentElement.scrollWidth)<=width,'admin analytics no overflow '+width);if(width===390)await section.screenshot({path:'/tmp/meetany-registration-analytics-mobile.png'});}
const firstChart=ap.locator('figure').first();await firstChart.locator('button').first().focus();await ap.keyboard.press('ArrowRight');check(await firstChart.locator('output').isVisible(),'chart keyboard tooltip');check(await firstChart.locator('svg').evaluate(el=>el.getAnimations({subtree:true}).every(animation=>animation.playState==='finished')),'chart reduced motion');
await section.getByRole('combobox',{name:'ანგარიშის ტიპი',exact:true}).click();check(await ap.getByRole('option',{name:'კლიენტი',exact:true}).isVisible(),'custom role options visible');await ap.getByRole('option',{name:'კლიენტი',exact:true}).click();await section.getByText('ბოლო გავლილი ეტაპი',{exact:true}).waitFor();check(await section.getByRole('combobox',{name:'ანგარიშის ტიპი',exact:true}).textContent()==='კლიენტი','custom role selected');
await section.getByRole('combobox',{name:'პერიოდი',exact:true}).click();await ap.getByRole('option',{name:'7 დღე',exact:true}).click();await section.getByText('ბოლო გავლილი ეტაპი',{exact:true}).waitFor();check(await section.getByRole('combobox',{name:'პერიოდი',exact:true}).textContent()==='7 დღე','custom period selected and data reloads');
check(errors.length===0,'no runtime errors');console.log('PASS:',count,'actual local API/UI checks: role/stage/source/device/dedup/persistence/PII/auth denial/last-stage/4 widths/reduced-motion');
}catch(e){console.error(safe(e.stack));process.exitCode=1;}finally{await browser.close();}
