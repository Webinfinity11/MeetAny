import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const base=process.env.QA_BASE_URL||'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'QA uses a local app');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const p=await browser.newPage({viewport:{width:390,height:900}});
p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(45000);
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{
 window.contactEvents=[];window.addEventListener('meetany:contact-action',e=>window.contactEvents.push(e.detail));
 document.addEventListener('click',e=>{if(e.target.closest('a[href^="tel:"]'))e.preventDefault();},true);
});
async function action(locator,kind) {
 const response=p.waitForResponse(r=>r.url().endsWith('/rpc/log_contact_event')&&r.request().postDataJSON().p_kind===kind);
 await locator.click();const res=await response;assert(res.ok(),`contact ${kind} HTTP ${res.status()}`);
 return {body:res.request().postDataJSON(),result:await res.json()};
}
async function shot(name) {
 await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:path.join(root,`qa/shots/${name}.png`),fullPage:true});
}
try {
 await p.goto(base+'/companies/');
 const reveal=p.locator('[data-contact-action="reveal"]').first();await reveal.waitFor();
 assert.equal(await p.locator('a.ma-call').count(),0);
 const first=await action(reveal,'reveal');
 const call=p.locator('[data-contact-action="call"]').first();
 assert.match(await call.getAttribute('href'),/^tel:\+995\d+$/);
 assert(await call.locator('.ma-call__number').isVisible());assert(await call.evaluate(e=>e===document.activeElement));
 const second=await action(call,'call');
 const events=await p.evaluate(()=>window.contactEvents);
 assert.deepEqual(events.map(e=>e.action),['reveal','call']);
 assert(events.every(e=>e.source==='company-list'&&e.contactId&&!('phone' in e)));
 await shot('contacts-companies-390');
 await p.reload();await p.locator('[data-contact-action="reveal"]').first().waitFor();assert.equal(await p.locator('a.ma-call').count(),0);
 // Telemetry failure must leave the number and telephone link usable.
 await p.route('**/api/db/rpc/log_contact_event',route=>route.fulfill({status:503,json:{message:'QA unavailable'}}),{times:1});
 const failedTelemetry=p.waitForResponse(r=>r.url().endsWith('/rpc/log_contact_event'));
 await p.locator('[data-contact-action="reveal"]').first().click();await p.locator('[data-contact-action="call"]').first().waitFor();
 assert.equal((await failedTelemetry).status(),503);
 await p.goto(base+'/account/');await p.locator('#login-email').fill('demo-admin@meetany.ge');
 await p.locator('#login-password').fill(ledger.accounts.admin.password);await p.locator('form button[type=submit]').click();
 await p.locator('#login-email').waitFor({state:'hidden',timeout:60000});
 await p.goto(base+'/companies/');
 await p.locator('.listing-heading h3 a').first().click();
 const signed=await action(p.locator('[data-contact-action="reveal"]').first(),'reveal');
 assert.equal(signed.body.p_source,'company-profile');
 await p.locator('[data-contact-action="call"]').first().press('Enter');
 await p.setViewportSize({width:1440,height:1050});
 const response=p.waitForResponse(r=>r.url().endsWith('/rpc/admin_contact_events'));
 await p.goto(base+'/admin/?tab=contacts');const res=await response;assert(res.ok());
 const page=await res.json();
 for(const event of [first,second]) {
  assert(page.items.some(row=>row.target_id===event.body.p_target_id&&row.kind===event.body.p_kind&&row.actor_id===null),'persisted anonymous event is returned by admin RPC');
  if(event.result.recorded) assert(page.items.some(row=>row.id===event.result.id),'insert id visible to admin');
 }
 assert(page.items.some(row=>row.actor_id&&row.target_id===signed.body.p_target_id&&row.kind==='reveal'),'signed-in actor persisted');
 await p.locator('[data-contact-event-id]').first().waitFor();await shot('contacts-admin-1440');
 const filter=p.waitForResponse(r=>r.url().endsWith('/rpc/admin_contact_events')&&r.request().postDataJSON().p_kind==='call');
 await p.getByLabel('მოქმედება',{exact:true}).selectOption('call');assert((await (await filter).json()).items.every(row=>row.kind==='call'));
 await p.reload();await p.locator('[data-contact-event-id]').first().waitFor();assert.equal(await p.getByLabel('მოქმედება',{exact:true}).inputValue(),'call');
 await p.getByLabel('სამიზნე',{exact:true}).selectOption('request');await p.getByLabel('პერიოდი',{exact:true}).selectOption('day');
 await p.getByText('კონტაქტები იტვირთება…',{exact:true}).waitFor({state:'hidden'});
 await p.setViewportSize({width:390,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Deterministic UI pagination fixtures supplement the real database traversal tests.
 const fixture=page.items[0];let fail=false;
 await p.route('**/api/db/rpc/admin_contact_events',route=>{
  if(fail)return route.fulfill({status:503,json:{message:'QA unavailable'}});
  const next=!!route.request().postDataJSON().p_cursor;
  return route.fulfill({json:{items:[{...fixture,id:next?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111'}],hasMore:!next,nextCursor:next?null:{created_at:fixture.created_at,id:fixture.id,asOf:page.asOf},filteredTotal:2,asOf:page.asOf}});
 });
 await p.goto(base+'/admin/?tab=contacts');await p.locator('[data-contact-event-id]').first().waitFor();
 await p.getByRole('button',{name:'მეტის ჩვენება',exact:true}).click();
 await p.locator('[data-contact-event-id="22222222-2222-4222-8222-222222222222"]').waitFor();
 assert.equal(await p.locator('[data-contact-event-id]').count(),2);
 await p.getByRole('button',{name:'პირველი გვერდი',exact:true}).click();
 await p.getByRole('button',{name:'მეტის ჩვენება',exact:true}).waitFor();assert.equal(await p.locator('[data-contact-event-id]').count(),1);
 fail=true;await p.getByLabel('მოქმედება',{exact:true}).selectOption('reveal');await p.getByRole('button',{name:'ხელახლა ცდა',exact:true}).waitFor();
 fail=false;await p.getByRole('button',{name:'ხელახლა ცდა',exact:true}).click();await p.locator('[data-contact-event-id]').first().waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS reveal/call, focus, reload, failure tolerance, anonymous/authenticated persistence, admin filters, append pagination/retry and 390/1440 layout');
} finally {await browser.close();}
