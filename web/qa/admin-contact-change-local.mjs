// Local QA DB only. The owner's integrated profile form is served by OWNER_BASE.
// Contact writes are real; restore the starting contacts with the same admin RPC.
import {chromium} from 'playwright';
import {adminSession,rpc,assert,origin,safe} from './admin-session.mjs';
const ownerBase=process.env.OWNER_BASE||origin;
assert(['localhost','127.0.0.1'].includes(new URL(ownerBase).hostname));
const out='qa/QA-2026-10-13/shots/admin';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let admin,owner,original,requestId;
const profile=async page=>{const data=await rpc(page,'my_profile');return Array.isArray(data)?data[0]:data;};
try {
 ({page:admin}=await adminSession(browser,'owner_admin'));
 ({page:owner}=await adminSession(browser,'owner_company'));
 for(const p of [admin,owner])p.setDefaultTimeout(60000);
 original=await profile(owner);
 const phone='599'+String(Date.now()).slice(-6), note='[qa] admin contact '+Date.now();
 await owner.goto(ownerBase+'/account/?tab=profile',{waitUntil:'domcontentloaded'});
 await owner.getByRole('button',{name:'შეცვალეთ კონტაქტი',exact:true}).click();
 let sheet=owner.locator('dialog[open]');
 await sheet.getByLabel('ახალი ტელეფონი',{exact:true}).fill(phone);
 await sheet.getByLabel('შენიშვნა',{exact:true}).fill(note);
 const response=owner.waitForResponse(r=>r.url().endsWith('/rpc/request_contact_change')&&r.request().method()==='POST');
 await sheet.getByRole('button',{name:'გაგზავნეთ მოთხოვნა',exact:true}).click();
 const created=await response;assert(created.ok(),safe(await created.text()));requestId=(await created.json()).id;
 const normalized='+995 '+phone.slice(0,3)+' '+phone.slice(3,6)+' '+phone.slice(6);
 for(const width of [1440,390]) {
  await admin.setViewportSize({width,height:width===390?844:1000});
  await admin.goto(origin+'/admin/?tab=reports',{waitUntil:'domcontentloaded'});
  const row=admin.locator('tbody tr').filter({hasText:note});await row.waitFor();
  assert(await row.getByText('კონტაქტის შეცვლის მოთხოვნა',{exact:true}).count()>0);
  await admin.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}nextjs-portal{display:none!important}'});
  assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await admin.screenshot({animations:'disabled',path:`${out}/contact-list-${width}.png`});
  await row.getByRole('button',{name:'განხილვა',exact:true}).click();
  sheet=admin.locator('dialog[open]');await sheet.getByText(note,{exact:true}).waitFor();
  assert((await sheet.innerText()).includes(normalized));assert((await sheet.innerText()).includes(original.phone));
  await admin.screenshot({animations:'disabled',path:`${out}/contact-detail-${width}.png`});
  await sheet.getByRole('button',{name:'შესრულება',exact:true}).click();
  const confirmation=admin.getByRole('dialog',{name:'კონტაქტის ცვლილების შესრულება',exact:true});await confirmation.waitFor();
  await admin.screenshot({animations:'disabled',path:`${out}/contact-confirm-${width}.png`});
  if(width===1440){await confirmation.getByRole('button',{name:'დაბრუნება',exact:true}).click();await confirmation.waitFor({state:'hidden'});await admin.getByRole('dialog',{name:'კონტაქტის შეცვლის მოთხოვნა',exact:true}).getByRole('button',{name:'დახურვა',exact:true}).click();}
  else {await confirmation.getByRole('button',{name:'შესრულება',exact:true}).click();await admin.getByText('საკონტაქტო მონაცემები განახლდა; მოთხოვნა დამუშავებულია.',{exact:true}).waitFor();}
 }
 const updated=await profile(owner);assert.equal(updated.phone,normalized);assert.equal(updated.email,original.email);
 await owner.reload({waitUntil:'domcontentloaded'});await owner.getByText(normalized,{exact:true}).waitFor();
 await owner.getByText(normalized,{exact:true}).scrollIntoViewIfNeeded();
 await owner.screenshot({path:`${out}/contact-owner-profile.png`});
 const handled=await rpc(admin,'admin_list_reports',{p_status:'handled',p_offset:0});assert(handled.items.some(r=>r.id===requestId&&r.resolution==='applied'));
 console.log('PASS contact request via owner UI → admin ConfirmSheet 1440/390 → updated profile');
} catch(e){console.error(safe(e.stack));process.exitCode=1;}
finally {
 if(admin&&owner&&original){
  const current=await profile(owner);
  if(current.phone!==original.phone||current.email!==original.email){
   const restore=await rpc(owner,'request_contact_change',{p_phone:original.phone,p_email:original.email,p_note:'[qa] restore original contacts'});
   await rpc(admin,'admin_apply_contact_change',{p_report_id:restore.id,p_note:'[qa] restore original contacts'});
   const restored=await profile(owner);assert.equal(restored.phone,original.phone);assert.equal(restored.email,original.email);console.log('RESTORED original contacts');
  } else if(requestId) {
   const queue=await rpc(admin,'admin_list_reports',{p_status:'new',p_offset:0});
   if(queue.items.some(r=>r.id===requestId))await rpc(admin,'admin_resolve_report',{p_id:requestId,p_action:'reject',p_reason:'[qa] incomplete test cleanup'});
  }
 }
 await browser.close();
}
