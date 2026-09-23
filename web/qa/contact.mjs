import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const base=process.env.QA_BASE_URL || 'http://localhost:3001';
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const p=await browser.newPage({viewport:{width:1440,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(45000);
await p.addInitScript(()=>{window.contactEvents=[];window.addEventListener('meetany:contact-action',e=>window.contactEvents.push(e.detail));document.addEventListener('click',e=>{if(e.target.closest('a[href^="tel:"]'))e.preventDefault();},true);});
async function visiblePhone(selector='.ma-call') {
 const link=p.locator(selector).first();await link.waitFor();
 assert.equal(await link.evaluate(e=>e.tagName),'A');
 assert.match(await link.getAttribute('href'),/^tel:\+995\d+$/);
 assert(await link.locator('.ma-call__number').isVisible());
 assert.equal(await p.getByRole('button',{name:'ნომრის ნახვა',exact:true}).count(),0);
 return link;
}
async function shot(name) {
 await p.evaluate(()=>document.fonts.ready);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 for(const number of await p.locator('.ma-call__number').all()) {
  assert(await number.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.closest('a').getBoundingClientRect();return r.left>=a.left&&r.right<=a.right&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth;}));
 }
 await p.screenshot({path:path.join(root,`qa/shots/${name}.png`),fullPage:true});
}
try{
 await p.goto(`${base}/companies/`);const link=await visiblePhone();
 assert.deepEqual(await p.evaluate(()=>window.contactEvents),[]);
 await link.click();const events=await p.evaluate(()=>window.contactEvents);
 assert.equal(events.length,1);assert.equal(events[0].action,'call');assert.equal(events[0].source,'company-list');assert(events[0].contactId);assert(!('phone' in events[0]));
 await shot('phone-companies-1440');
 await p.setViewportSize({width:390,height:900});await shot('phone-companies-390');
 await p.reload();await visiblePhone();
 await p.locator('.listing-heading h3 a').first().click();const profile=await visiblePhone('.company-profile-contact .ma-call');
 await profile.press('Enter');const profileEvents=await p.evaluate(()=>window.contactEvents);
 assert.equal(profileEvents.length,1);assert.equal(profileEvents[0].action,'call');assert.equal(profileEvents[0].source,'company-profile');
 await shot('phone-company-view-390');
 await p.goto(`${base}/requests/`);await p.locator('.request-card-heading a').first().click();const owner=await visiblePhone();await owner.click();
 const ownerEvents=await p.evaluate(()=>window.contactEvents);assert.equal(ownerEvents.length,1);assert.equal(ownerEvents[0].action,'call');assert.equal(ownerEvents[0].source,'request-owner');
 assert.deepEqual(errors,[]);console.log('PASS visible phones and tel links, click/keyboard call events, metadata without phone, reload persistence, no clipping at 1440/390');
}finally{await browser.close();}
