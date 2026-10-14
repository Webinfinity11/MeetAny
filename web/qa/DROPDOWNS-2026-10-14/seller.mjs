import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='qa/DROPDOWNS-2026-10-14', report=[], writes=[];
const b=await chromium.launch();
try {
 for(const width of [1440,390,360]) {
  for(const name of ['onboarding-provide','distribution']) {
   const c=await b.newContext({storageState:process.env.QA_STORAGE_STATE || `${out}/company-seller-local.storage.json`,viewport:{width,height:900},reducedMotion:'reduce'});
   const p=await c.newPage();p.setDefaultTimeout(20000);
   p.on('request',r=>{const rpc=new URL(r.url()).pathname.split('/rpc/')[1];if(rpc&&/^(set_|update_|save_|complete_|create_|delete_|remove_)/.test(rpc))writes.push(rpc);});
   p.on('pageerror',error=>report.push({width,name,error:error.message}));
   const id=name==='distribution'?'distribution-cities':'onboard-services';
   await p.goto(`http://localhost:3430/${name==='distribution'?'account/?tab=profile&section=distribution':'onboarding/?step=provide'}`);
   await p.locator('#'+id).waitFor();await p.evaluate(()=>document.fonts.ready);
   const initial=await p.locator('#'+id).getAttribute('aria-label');
   await p.screenshot({path:`${out}/after-${name}-${width}.png`,fullPage:true,animations:'disabled'});
   await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
   let axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
   assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))));
   await p.locator('#'+id).focus();await p.keyboard.press('ArrowDown');
   const label=name==='distribution'?'მომსახურების ქალაქები':'მომსახურებები';
   const input=p.getByRole('combobox',{name:`${label} — ძიება`});
   await input.fill(name==='distribution'?'თბილისი':'შეფუთვა');
   await p.screenshot({path:`${out}/after-${name}-open-${width}.png`,animations:'disabled'});
   axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
   assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(x=>x.id)));
   await input.fill('');
   const choice=p.locator('[role=option][aria-selected=false]:not([aria-disabled=true])').filter({hasNotText:'მთელი საქართველო'}).first();
   const choiceText=await choice.innerText();
   const selected=await choice.getAttribute('aria-selected');
   await choice.click();
   await input.fill(choiceText.trim());
   const chosen=p.getByRole('option',{name:choiceText.trim(),exact:true});
   assert.equal(await chosen.getAttribute('aria-selected'),selected==='true'?'false':'true');
   await chosen.click(); // Undo the transient selection; never submit the form.
   await input.press('Escape');await p.waitForTimeout(200);
   assert.equal(await p.evaluate(()=>document.activeElement?.id),id);
   assert.equal(await p.locator('#'+id).getAttribute('aria-label'),initial);
   if(name==='distribution') {
    const categories=p.getByRole('combobox',{name:/^პროდუქტის კატეგორიები/});
    await categories.focus();await p.keyboard.press('ArrowDown');
    const search=p.getByRole('combobox',{name:'პროდუქტის კატეგორიები — ძიება'});
    await search.fill('ავეჯი');assert.ok(await p.getByRole('option').count()>0);
    await search.press('Escape');await p.waitForTimeout(200);
   } else {
    // The onboarding draft records touched fields even after restoring their values.
    const discard=p.getByRole('button',{name:'გააუქმეთ ცვლილებები',exact:true});
    if(await discard.isVisible()) {
     await discard.click();await p.getByRole('button',{name:'ცვლილებების გაუქმება',exact:true}).click();
     await p.waitForTimeout(200);
    }
   }
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.equal(overflow,0);
   report.push({width,name,status:'PASS',axe:0,overflow,search:'PASS',selectionUndo:'PASS',focusReturn:'PASS',databaseWrites:writes.length});
   console.log(width,name,'PASS');await c.close();
  }
 }
 assert.deepEqual(writes,[],'no database mutation RPCs');
}finally {fs.writeFileSync(`${out}/seller.json`,JSON.stringify({report,writes},null,2));await b.close();}
if(report.some(row=>row.error))process.exitCode=1;
