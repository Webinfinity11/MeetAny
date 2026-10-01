import fs from 'node:fs';
import { chromium } from 'playwright';
import { Scenario, assert, go, origin, safe } from './e2e/lib.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const t=new Scenario(browser,'links',`${Date.now()}-links`);const results=[];
try {
 for(const [role,key]of [['guest',null],['client','hotel'],['company','linen'],['admin','owner_admin']]){
  const p=await t.page(key);const routes=['/','/companies/','/requests/','/account/','/terms/','/how-it-works/'];
  if(key)routes.push('/account/?tab=profile','/account/?tab=messages','/account/?tab=notifications');
  if(role==='company')routes.push('/account/?tab=business');if(role==='admin')routes.push('/admin/','/admin/?tab=reports');
  const unique=new Set();
  for(const route of routes){
   await go(p,route);
   await p.waitForFunction(()=>!document.querySelector('main .catalog-skeleton'),null,{timeout:20000});
   const links=await p.locator('a[href]').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),text:a.textContent.trim()})));
   for(const link of links){assert(!/undefined|null|javascript:/i.test(link.href),`invalid link ${route} ${link.href}`);if(link.href.startsWith('tel:'))assert.match(link.href,/^tel:\+?\d+$/);if(link.href.startsWith('/')&&!link.href.startsWith('//'))unique.add(link.href.split('#')[0]);results.push({role,page:route,...link});}
   if(route==='/account/'&&key)assert.equal(await p.locator('#login-email').count(),0,`${role} session`);
  }
  for(const href of [...unique].sort()) {const response=await p.request.get(origin+href,{timeout:20000});assert(response.status()<400,`${role}: ${href} HTTP ${response.status()}`);}
  if(role!=='admin'){await go(p,'/admin/');assert(!(await p.locator('main').innerText()).includes('მიწოდება და მოთხოვნა'));}
  console.log(role,unique.size,'internal targets OK');
 }
 results.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const report={links:results.map(({role,page,href})=>({role,page,href})),checkedAt:new Date().toISOString()};
 const output=process.argv.includes('--second')?'qa/links-second.json':'qa/links-first.json';
 if(process.argv.includes('--second'))assert.deepEqual(report.links,JSON.parse(fs.readFileSync('qa/links-first.json','utf8')).links,'link inventory differs between runs');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS',results.length,'links; four roles');
}catch(e){console.error(safe(e.stack));process.exitCode=1;}finally{await browser.close();}
