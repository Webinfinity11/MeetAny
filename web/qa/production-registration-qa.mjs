import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { neon } from '@neondatabase/serverless';
import { readRPCs } from './visual/lib/browser.mjs';

const root=path.resolve(import.meta.dirname,'..');
const origin='https://www.meetany.ge';
const run=Date.now().toString();
const recheck=process.argv.includes('--recheck');
const out=path.join(root,'qa',`live-registration-${run}`);
fs.mkdirSync(out,{recursive:true});
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).flatMap(line=>{
 const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
 return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];
}));
const auth=env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets=[env.DATABASE_URL,...Object.values(ledger.accounts).map(a=>a.password)].filter(Boolean);
const safe=s=>secrets.reduce((text,secret)=>text.replaceAll(secret,'[redacted]'),String(s)).replace(/Bearer\s+[^\s"']+/g,'Bearer [redacted]');
const report={origin,run,startedAt:new Date().toISOString(),checks:[],runtimeErrors:[],httpFailures:[],blockedWrites:[],registration:[],cleanup:[],limitations:['Real email OTP delivery and successful password reset require a receiving mailbox; not asserted by this runner.','Existing account pages are inspected without submitting business changes.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const reads=new Set([...readRPCs,'get_deal','list_matching_feed','onboarding_state','get_onboarding_profile','admin_registration_analytics','admin_business_audit','admin_design_settings','admin_list_deal_issues']);
const created=[];
async function check(name,page,fn){
 try{const evidence=await fn();report.checks.push({name,status:'PASS',evidence});console.log('PASS '+name);}
 catch(e){report.checks.push({name,status:'FAIL',error:safe(e.message)});console.log('FAIL '+name+': '+safe(e.message).split('\n')[0]);if(page)await page.screenshot({path:path.join(out,`failure-${report.checks.length}.png`),fullPage:true}).catch(()=>{});}
 save();
}
async function context(label,{signup=false,width=1440}={}){
 const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 await c.route('**/api/**',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(['GET','HEAD','OPTIONS'].includes(r.method()))return route.continue();
  if(u.origin===origin&&u.pathname==='/api/analytics/registration')return route.continue();
  const rpc=u.pathname.match(/^\/api\/db\/rpc\/([^/]+)$/)?.[1];
  if(rpc==='mark_read'||rpc==='mark_notification_read')return route.fulfill({json:rpc==='mark_read'?{marked:0,read_at:null}:null});
  if(reads.has(rpc)||signup&&rpc==='complete_profile')return route.continue();
  report.blockedWrites.push({label,path:u.pathname,method:r.method()});return route.abort('blockedbyclient');
 });
 const p=await c.newPage();p.setDefaultTimeout(15000);
 p.on('pageerror',e=>report.runtimeErrors.push({label,error:safe(e.message)}));
 p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===origin)report.httpFailures.push({label,path:new URL(r.url()).pathname,status:r.status()});});
 return {c,p};
}
async function navigate(p,route){
 const response=await p.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
 await p.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy=true]'),null,{timeout:25000});
 await p.waitForTimeout(600);
 assert(!(await p.locator('main').innerText()).includes('სერვისი დროებით მიუწვდომელია'));
}
async function layout(p,label){
 const dimensions=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));
 await p.screenshot({path:path.join(out,label+'.png'),fullPage:true,mask:[p.locator('input[type=password],input[type=email],input[type=tel],a[href^="mailto:"],a[href^="tel:"]')]});
 return dimensions;
}
async function token(c){const r=await c.request.get(auth+'/token');assert(r.ok(),'Token HTTP '+r.status());return (await r.json()).token;}
async function rpc(c,name,args={}){
 const jwt=await token(c);const r=await c.request.post(origin+'/api/db/rpc/'+name,{headers:{Authorization:'Bearer '+jwt},data:args});
 assert(r.ok(),name+' HTTP '+r.status());return r.json();
}
const one=value=>Array.isArray(value)?value[0]:value;
try{
 const guest=await context('guest');
 for(const route of ['/','/requests/','/companies/','/ideas/','/account/','/account/?tab=register','/account/?tab=register&role=company','/account/?tab=reset','/onboarding/']){
  if(recheck&&route!=='/account/?tab=register&role=company')continue;
  for(const width of [390,1440])await check(`guest ${route} ${width}`,guest.p,async()=>{await guest.p.setViewportSize({width,height:1000});await navigate(guest.p,route);return layout(guest.p,`guest-${report.checks.length}-${width}`);});
 }
 await check('signup empty validation focuses first invalid field',guest.p,async()=>{
  await navigate(guest.p,'/account/?tab=register');await guest.p.locator('main form button[type=submit]').click();
  await guest.p.locator('#reg-name[aria-invalid=true]').waitFor();assert.equal(await guest.p.evaluate(()=>document.activeElement.id),'reg-name');
 });
 await check('signup password visibility and industry selection',guest.p,async()=>{
  await navigate(guest.p,'/account/?tab=register&role=company');await guest.p.locator('#reg-password').fill('QaVisibility123!');
  await guest.p.getByRole('button',{name:'პაროლის ჩვენება',exact:true}).click();assert.equal(await guest.p.locator('#reg-password').getAttribute('type'),'text');
  await guest.p.getByRole('button',{name:'პაროლის დამალვა',exact:true}).click();
  await guest.p.locator('#reg-industry').click();await guest.p.locator('[role=option]:not([aria-disabled=true])').filter({hasText:'ავეჯ'}).first().click();
  assert(await guest.p.locator('select').last().inputValue());
 });
 await guest.c.close();
 for(const [role,key,routes] of [
  ['client','hotel',['/account/','/account/?tab=profile','/account/?tab=requests','/account/?tab=deals','/account/?tab=messages','/requests/new/']],
  ['company','owner_company',['/account/','/account/?tab=profile','/account/?tab=offers','/account/?tab=deals','/matching/']],
  ['admin','owner_admin',['/admin/','/admin/?tab=users','/admin/?tab=requests']]
 ]){
  if(recheck&&role==='admin')continue;
  const {c,p}=await context(role);
  let signed=false;
  await check(role+' real UI sign-in',p,async()=>{
   await navigate(p,'/account/');const a=ledger.accounts[key];await p.locator('#login-email').fill(a.email||`demo-${key}@meetany.ge`);await p.locator('#login-password').fill(a.password);
   await p.locator('main form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:25000});
   const me=one(await rpc(c,'my_profile'));assert.equal(me.role,role);signed=true;return {role:me.role};
  });
  if(signed)for(const route of routes.filter(route=>!recheck||['/account/?tab=deals','/matching/','/requests/new/'].includes(route)))for(const width of [390,1440])await check(`${role} ${route} ${width}`,p,async()=>{await p.setViewportSize({width,height:1000});await navigate(p,route);assert.equal(await p.locator('#reg-name').count(),0);return layout(p,`${role}-${report.checks.length}-${width}`);});
  await c.close();
 }
 for(const [index,role,width] of [[0,'client',1440],[1,'client',390],[2,'company',390]]){
  if(recheck&&role!=='company')continue;
  const account={email:`e2e+${run}-${role}-${index}@meetany.local`,password:crypto.randomBytes(24).toString('base64url'),role};secrets.push(account.password);created.push(account);
  const {c,p}=await context(`registration-${role}-${width}`,{signup:true,width});
  await check(`one submission registration ${role} ${width}`,p,async()=>{
   await navigate(p,`/account/?tab=register${role==='company'?'&role=company':''}`);
   await p.locator('#reg-name').fill('QA რეგისტრაცია');
   if(role==='company'){await p.locator('#reg-company').fill(`QA ${run}`);await p.locator('#reg-industry').click();await p.locator('[role=option]:not([aria-disabled=true])').filter({hasText:'ავეჯ'}).first().click();}
   await p.locator('#reg-phone').fill('+995 5'+(Number(run.slice(-8))+index).toString().padStart(8,'0').slice(-8));
   await p.locator('#reg-email').fill(account.email);await p.locator('#reg-password').fill(account.password);await p.locator('#reg-terms').check();
   let submits=0,profileWrites=0;
   p.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/sign-up/email'))submits++;if(new URL(r.url()).pathname.endsWith('/complete_profile'))profileWrites++;});
   await p.locator('main form button[type=submit]').click();
   await p.waitForFunction(()=>!document.querySelector('#reg-name')||document.querySelector('#reset-code')||document.querySelector('.auth-alert')?.textContent.trim(),null,{timeout:30000});
   if(await p.locator('#reset-code').isVisible()){report.registration.push({role,width,status:'OTP_PENDING',submits});throw new Error('Email confirmation required; no receiving mailbox available');}
   if(await p.locator('#reg-name').isVisible())throw new Error('Registration form remains: '+await p.locator('.auth-alert').innerText());
   const me=one(await rpc(c,'my_profile'));assert.equal(me.role,role);assert.equal(me.email,account.email);account.id=me.id;
   assert.equal(submits,1);assert.equal(profileWrites,1);
   if(role==='company')await p.waitForURL('**/onboarding/**');
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);assert.equal(await p.locator('#reg-name').count(),0);
   await navigate(p,'/account/');assert.equal(await p.locator('#reg-name').count(),0);assert.equal(await p.locator('#login-email').count(),0);
   report.registration.push({role,width,status:'PASS',submits,profileWrites,reloadRetained:true});
   return layout(p,`registered-${role}-${width}`);
  });
  await c.close();
 }
}catch(e){report.checks.push({name:'runner',status:'FAIL',error:safe(e.message)});}
finally{
 // Exact run emails only. Match the established QA cleanup: block completed test
 // profiles and remove only orphan Auth users. Existing users are never targeted.
 if(created.length)try{
  assert.match(new URL(env.DATABASE_URL).hostname,/^ep-withered-glade-b54ts1g5(?:-pooler)?\./);
  const sql=neon(env.DATABASE_URL),emails=created.map(a=>a.email);
  assert(emails.every(e=>e.startsWith(`e2e+${run}-`)&&e.endsWith('@meetany.local')));
  const profiles=await sql.query('select id,email from public.profiles where email=any($1::text[])',[emails]);
  const admin=await browser.newContext();const a=ledger.accounts.owner_admin;
  const login=await admin.request.post(auth+'/sign-in/email',{data:{email:a.email,password:a.password}});assert(login.ok(),'Cleanup admin sign-in failed');
  for(const p of profiles){await rpc(admin,'admin_set_blocked',{p_user_id:p.id,p_blocked:true,p_reason:'Live QA registration completed'});report.cleanup.push({id:p.id,status:'BLOCKED_TEST_PROFILE'});}
  await sql.query('delete from neon_auth."user" u where email=any($1::text[]) and not exists(select 1 from public.profiles p where p.id=u.id)',[emails]);
  const remaining=await sql.query('select id,blocked from public.profiles where email=any($1::text[])',[emails]);assert(remaining.every(p=>p.blocked));
  report.cleanup.push({status:'PASS',blockedProfiles:remaining.length,orphanAuthAccountsRemoved:true});await admin.close();
 }catch(e){report.cleanup.push({status:'FAIL',error:safe(e.message)});}
 await browser.close();report.finishedAt=new Date().toISOString();report.pass=report.checks.every(c=>c.status==='PASS')&&!report.runtimeErrors.length&&!report.httpFailures.length&&!report.blockedWrites.length&&!report.cleanup.some(c=>c.status==='FAIL');save();
 console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failed:report.checks.filter(c=>c.status==='FAIL'),runtimeErrors:report.runtimeErrors,httpFailures:report.httpFailures,blockedWrites:report.blockedWrites,registration:report.registration,cleanup:report.cleanup,report:path.join(out,'report.json')},null,2));
 process.exitCode=report.pass?0:1;
}
