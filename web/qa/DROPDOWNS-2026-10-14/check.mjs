import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const b=await chromium.launch(); const results=[];
try {
for(const width of [1440,390,360]) {
 const p=await b.newPage({viewport:{width,height:900}});
 p.on('pageerror',e=>results.push({error:e.message}));
 await p.goto('http://localhost:3430/dev/ui/');
 await p.locator('#demo-single').waitFor();
 await p.locator('#demo-single').focus();await p.keyboard.press('ArrowDown');
 const input=p.getByRole('combobox',{name:'დარგი — ძიება'});
 await input.fill('ავეჯი');await input.press('Enter');
 await assert.equal(await p.locator('#demo-single').getAttribute('aria-expanded'),'false');
 assert.match(await p.locator('#demo-single').innerText(),/ავეჯი/);
 await p.locator('#demo-single').click();await input.fill('');await input.press('ArrowDown');
 await p.screenshot({animations:"disabled",path:`qa/DROPDOWNS-2026-10-14/after-single-${width}.png`});
 await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 let axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
 assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(x=>x.id)));
 results.push({width,screen:'single',axe:axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))});
 await input.press('Escape'); await p.waitForTimeout(250);
 assert.equal(await p.evaluate(()=>document.activeElement?.id),'demo-single');
 await p.locator('#demo-multiple').click();
 const multi=p.getByRole('combobox',{name:'მომარაგება — ძიება'});
 await multi.fill('');assert.equal(await p.getByRole('option',{selected:true}).count(),2);
 assert.ok(await p.locator('[role=option][aria-disabled=true]').count()>0);
 await p.getByRole('button',{name:'გასუფთავება',exact:true}).click();
 assert.equal(await p.getByRole('option',{selected:true}).count(),0);
 await multi.fill('ავეჯი');await multi.press('Enter');
 await p.screenshot({animations:"disabled",path:`qa/DROPDOWNS-2026-10-14/after-multi-${width}.png`});
 axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
 assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(x=>x.id)));
 results.push({width,screen:'multi',axe:axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))});
 await p.getByRole('button',{name:'მზადაა',exact:true}).click();await p.waitForTimeout(250);
 await p.locator('#demo-chips').click();const custom=p.getByRole('combobox',{name:'რას ვთავაზობთ — ძიება'});
 await custom.fill('ახალი მომსახურება');await custom.press('Enter');await custom.press('Escape');await p.waitForTimeout(250);
 assert.match(await p.locator('#demo-chips').locator('..').innerText(),/ახალი მომსახურება/);
 const cityBox=await p.locator('#demo-cities').boundingBox();
 await p.locator('#demo-cities').click({position:{x:cityBox.width-20,y:22}});
 await p.getByRole('option',{name:'მთელი საქართველო',exact:true}).click();
 assert.equal(await p.getByRole('option',{selected:true}).count(),1);
 await p.getByRole('option',{name:'თბილისი',exact:true}).click();
 assert.equal(await p.getByRole('option',{selected:true}).count(),1);
 await p.getByRole('button',{name:'მზადაა',exact:true}).click();await p.waitForTimeout(250);
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.equal(overflow,0);
 results.push({width,exclusive:'PASS',focusReturn:'PASS',keyboard:'PASS',limit:'PASS',creatable:'PASS',overflow});await p.close();
}
}finally {fs.writeFileSync('qa/DROPDOWNS-2026-10-14/components.json',JSON.stringify(results,null,2));await b.close();}
