import {chromium} from 'playwright';
import fs from 'node:fs';
import {reuseAnonymousToken} from '../site-walk-a-auth.mjs';
const phase=process.env.PHASE||'after', out='qa/DROPDOWNS-2026-10-14';
const b=await chromium.launch();const report=[];
try {
 for(const role of (process.env.QA_ROLE ? [process.env.QA_ROLE] : ['guest','company'])) {
  const c=await b.newContext(role==='company'?{storageState:process.env.QA_STORAGE_STATE || '/tmp/717E24C5-company.json'}:{});
  await reuseAnonymousToken(c);
  const p=await c.newPage();p.setDefaultTimeout(25000);
  p.on('pageerror',e=>report.push({role,error:e.message}));
  for(const width of [1440,390,360]) {
   await p.setViewportSize({width,height:900});
   const routes=role==='guest'?[['register','/account/?tab=register&role=company','#reg-industry']]:[['profile','/account/?tab=profile','#industry'],['distribution','/account/?tab=profile&section=distribution','#distribution-cities'],['onboarding-provide','/onboarding/?step=provide','#onboard-services'],['onboarding-need','/onboarding/?step=need','main form fieldset']];
   for(const [name,route,selector]of routes) {
    try {
     await p.goto('http://localhost:3430'+route);
     await p.locator(selector).waitFor();
     await p.evaluate(()=>document.fonts.ready);
     await p.screenshot({path:`${out}/${phase}-${name}-${width}.png`,fullPage:true,animations:"disabled"});
     if(phase==='after') {
      await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
      const axe=await p.evaluate(()=>axe.run(document.querySelector('main')));
      const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      report.push({role,width,name,axe:axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),overflow});
     } else report.push({role,width,name,status:'captured'});
     console.log(phase,name,width,'PASS');
    } catch(e) {report.push({role,width,name,error:e.message.slice(0,300)});console.log(phase,name,width,'FAIL',e.message.slice(0,200));}
   }
  }
  await c.close();
 }
}finally {fs.writeFileSync(`${out}/${phase}-${process.env.QA_ROLE || "all"}-pages.json`,JSON.stringify(report,null,2));await b.close();}

if(report.some(row=>row.error || row.axe?.length || row.overflow > 0)) process.exitCode=1;
