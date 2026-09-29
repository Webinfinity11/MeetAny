// Explicitly authorized fixture only: one request and one offer, deleted before exit.
import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {adminSession} from './admin-session.mjs';
process.env.QA_ORIGIN=process.env.BASE||'http://localhost:3003';const {rpc,db,query,origin}=await import('./e2e/lib.mjs');
const dir='qa/shots/final-2026-09-29/admin';const report={checks:[]};const save=()=>fs.writeFileSync(`${dir}/moderation.json`,JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});let user,admin,company,r,o;
async function shot(p,name){await p.screenshot({path:`${dir}/${name}.png`});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);}
async function ready(p){await p.waitForTimeout(350);await p.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება…'));}
async function visit(tab,q){await admin.goto(`${origin}/admin/?tab=${tab}&q=${encodeURIComponent(q)}`,{waitUntil:'networkidle'});await ready(admin);await admin.locator('main tbody tr').first().waitFor();}
async function action(tab,q,name,width,reason){await visit(tab,q);await admin.locator('main tbody tr').filter({hasText:q}).first().getByRole('button',{name,exact:true}).click();const d=admin.locator('dialog#moderation');await d.waitFor({state:'visible'});if(await d.locator('textarea').count())await d.locator('textarea').fill(reason);await shot(admin,`own-${tab}-${name}-${width}`);const response=admin.waitForResponse(x=>x.url().includes('/rpc/admin_')&&['admin_set_hidden','admin_delete_offer','admin_delete_request_v2'].some(k=>x.url().endsWith('/'+k)));await d.locator('button[type="submit"]').click();assert((await response).ok());await d.waitFor({state:'hidden',timeout:60000});report.checks.push({name:`${name} ${width}`,pass:true});save();}
try{
 user=(await adminSession(browser,'owner_user')).page;company=(await adminSession(browser,'owner_company')).page;admin=(await adminSession(browser,'owner_admin')).page;admin.setDefaultTimeout(30000);
 const title=`[შემოწმება] ადმინის საბოლოო გავლა ${Date.now()}`;
 r=await rpc(user,'create_request',{p_title:title,p_body:'დროებითი მოთხოვნა ადმინისტრირების შემოწმებისთვის. საჭიროა შეფუთული ყუთების გადაზიდვა თბილისში.',p_category:'freight',p_city:'tbilisi'});report.requestId=r.id;save();
 o=await rpc(company,'send_offer',{p_request_id:r.id,p_body:'დროებითი შეთავაზება ადმინისტრირების შემოწმებისთვის. ტრანსპორტირებას ერთ დღეში შევასრულებთ.',p_delivery_days:1});report.offerId=o.id;save();
 const guest=await browser.newPage();
 for(const width of [1440,390]){await admin.setViewportSize({width,height:width===390?844:1000});await action('requests',title,'დამალვა',width,'[შემოწმება] დროებითი მოთხოვნის დამალვა');assert.equal((await db(guest,`requests?select=id&id=eq.${r.id}`)).length,0);await guest.goto(origin+'/requests/',{waitUntil:'networkidle'});assert.equal(await guest.locator(`main a[href="/requests/view/?id=${r.id}"]`).count(),0);report.checks.push({name:`hidden public ${width}`,pass:true});await action('requests',title,'გამოჩენა',width);assert.equal((await db(guest,`requests?select=id&id=eq.${r.id}`)).length,1);}
 await action('offers',title,'წაშლა',390,'[შემოწმება] დროებითი შეთავაზების წაშლა');
 await action('requests',title,'წაშლა',390,'[შემოწმება] დროებითი მოთხოვნის წაშლა');
 const audit=await rpc(admin,'admin_list_audit_v2',{p_limit:100});const events=audit.items.filter(x=>[r.id,o.id].includes(x.target_id));assert.equal(events.length,6);assert(events.every(x=>x.actor_name));report.checks.push({name:'audit six named actions',pass:events.every(x=>x.target_name),events:events.map(x=>({action:x.action,actor:x.actor_name,target:x.target_name}))});
 for(const width of [1440,390]){await admin.setViewportSize({width,height:width===390?844:1000});await admin.goto(origin+'/admin/?tab=audit',{waitUntil:'networkidle'});await ready(admin);assert(await admin.locator('main tbody tr').count()>=6);await shot(admin,`own-audit-${width}`);}
}catch(e){report.fatal=e.message.slice(0,400);console.log('FAIL moderation '+report.fatal);}
finally{if(r&&user){try{if((await db(user,`requests?select=id&id=eq.${r.id}`)).length)await rpc(user,'delete_request',{p_request_id:r.id});report.cleanup=(await query('select (select count(*)::int from public.requests where id=$1) requests,(select count(*)::int from public.offers where request_id=$1) offers',[r.id]))[0];assert.equal(report.cleanup.requests+report.cleanup.offers,0);}catch(e){report.cleanupError=e.message.slice(0,200);}}save();await browser.close();}
console.log(JSON.stringify(report,null,2));

process.exitCode = report.fatal || report.cleanupError || report.checks.some(x => !x.pass) ? 1 : 0;
