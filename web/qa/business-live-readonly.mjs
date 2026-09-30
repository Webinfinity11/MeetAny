import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const origin=process.env.QA_ORIGIN||'http://localhost:3001';
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[],failures=[];
fs.mkdirSync('qa/shots/business-live',{recursive:true});
try{
 for(const key of ['guest','owner_company','owner_admin']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/db/')&&r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()});});
 await context.route('**/api/db/rpc/*',route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);
  if(['set_company_distributor','save_company_review','request_company_plan','cancel_company_plan_request','admin_moderate_review','admin_resolve_plan','send_message','start_conversation','mark_read'].includes(name))throw new Error('Unexpected write '+name);
  return route.continue();
 });
 if(key!=='guest'){
  await p.goto(origin+'/account/',{waitUntil:'domcontentloaded'});await p.locator('#login-email').fill(ledger.accounts[key].email);await p.locator('#login-password').fill(ledger.accounts[key].password);await p.locator('form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:45000});
 }
 const paths=key==='guest'?['/ideas/','/companies/?industry=finance','/companies/?type=distributors']:key==='owner_company'?['/account/?tab=business']:['/admin/?tab=reviews','/admin/?tab=plans'];
 for(const [index,path] of paths.entries()){
  await p.goto(origin+path,{waitUntil:'domcontentloaded'});
  if(key==='owner_company')await p.getByRole('switch',{name:'ვარ დისტრიბუტორი'}).waitFor({timeout:45000});
  else if(key==='owner_admin')await p.getByText('ჩანაწერი ჯერ არ არის.',{exact:true}).waitFor({timeout:45000});
  else if(path.includes('companies'))await p.locator('.catalog-empty').waitFor({timeout:45000});
  else await p.locator('.idea-card').first().waitFor();
  assert.equal(await p.locator('.business-error').count(),0);
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:900});await p.evaluate(()=>window.scrollTo(0,0));assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);if(width!==320)await p.screenshot({path:`qa/shots/business-live/${key}-${index}-${width}.png`,fullPage:true});}
 }
 console.log('PASS '+key+' real database read-only views, desktop/mobile 390/320');await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS zero runtime or database API errors; no business data writes');
}finally{await browser.close();}
