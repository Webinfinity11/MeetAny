import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='qa/DROPDOWNS-2026-10-14', report=[];
const b=await chromium.launch();
const c=await b.newContext({storageState:process.env.QA_STORAGE_STATE || `${out}/company-local.storage.json`});
try {
 const p=await c.newPage();p.setDefaultTimeout(20000);
 for(const width of [1440,390,360]) {
  await p.setViewportSize({width,height:900});
  await p.goto('http://localhost:3430/account/?tab=profile');
  await p.locator('#offers').waitFor();await p.evaluate(()=>document.fonts.ready);
  for(const id of ['offers','seeks','profile-service-cities']) {
   const metrics=await p.locator(`#${id}`).evaluate(trigger=>{
    const control=trigger.parentElement;
    const tokens=[...control.querySelectorAll('button[aria-label$="წაშალეთ"]')].map(button=>button.parentElement);
    const rects=tokens.map(el=>{const r=el.getBoundingClientRect();const text=el.firstElementChild;return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,text:text.textContent,clipped:text.scrollWidth>text.clientWidth+1,border:getComputedStyle(el).borderLeftWidth}});
    const arrow=trigger.querySelector('svg');
    return {rects,field:trigger.getBoundingClientRect().toJSON(),arrow:arrow?.getBoundingClientRect().toJSON()};
   });
   assert.ok(metrics.arrow?.width>0,'visible trigger arrow');
   assert.ok(metrics.arrow.top-metrics.field.top<20,'arrow remains on first row');
   assert.ok(new Set(metrics.rects.map(r=>Math.round(r.top))).size<=2,'at most two token rows');
   for(let i=0;i<metrics.rects.length;i++) {
    const a=metrics.rects[i];assert.equal(a.clipped,false);assert.equal(a.border,'0px');assert.ok(a.right<=metrics.field.right);
    for(const d of metrics.rects.slice(i+1)) assert.ok(a.right<=d.left||d.right<=a.left||a.bottom<=d.top||d.bottom<=a.top,'tokens never overlap');
   }
   report.push({width,id,status:'PASS',tokens:metrics.rects.map(r=>r.text),height:metrics.field.height});
  }
  await p.screenshot({path:`${out}/after-profile-${width}.png`,fullPage:true,animations:'disabled'});
  await p.locator('#offers').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
  await p.waitForTimeout(350);
  await p.screenshot({path:`${out}/after-profile-tokens-${width}.png`,animations:'disabled'});
  await p.locator('#offers').focus();await p.keyboard.press('ArrowDown');
  const input=p.getByRole('combobox',{name:'რას ვთავაზობთ — ძიება'});
  await input.fill('ავეჯი');assert.ok(await p.getByRole('option').count()>0);
  await p.screenshot({path:`${out}/after-profile-open-${width}.png`,animations:'disabled'});
  await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
  assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(x=>x.id)));
  await input.press('Escape');await p.waitForTimeout(250);
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'offers');
  await p.goto('http://localhost:3430/onboarding/?step=need');
  await p.locator('main form fieldset').waitFor();
  assert.match(await p.locator('main h1').innerText(),/ყიდულობთ/);
  await p.screenshot({path:`${out}/after-onboarding-need-${width}.png`,fullPage:true,animations:'disabled'});
  console.log(width,'PASS');
 }
}finally{fs.writeFileSync(`${out}/token-layout.json`,JSON.stringify(report,null,2));await b.close();}
