import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { auth,credentials,root,safe,assert } from './e2e/lib.mjs';
import { guard } from './visual/lib/browser.mjs';
const origin=process.env.UX_ORIGIN||'http://localhost:3003';
assert(['http://localhost:3003','https://meet-any.vercel.app'].includes(origin));
const out=`qa/shots/ux-refinement-${origin.includes('localhost')?'local':'live'}`;
fs.mkdirSync(out,{recursive:true});
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=[];
async function go(page,route){
 await page.goto(origin+route,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]')&&![...document.querySelectorAll('main .ma-loading,main .ma-skel')].some(el=>el.checkVisibility())&&!document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:45000});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForLoadState('networkidle',{timeout:30000});
 await page.evaluate(()=>window.scrollTo(0,0));
}
async function login(page,key){for(let attempt=0;attempt<8;attempt++){const response=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});if(response.status()===429){await new Promise(resolve=>setTimeout(resolve,20000));continue;}assert(response.ok(),`login ${key}: ${response.status()}`);return;}throw Error('Auth rate limit persisted');}
async function layouts(page,role,route){
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
  if(route.includes("section=products"))assert(await page.locator(".company-product--preview img").evaluateAll(images=>images.every(image=>image.getBoundingClientRect().width<=161&&image.getBoundingClientRect().height<=121)),"compact product previews");
  const measurements=await page.evaluate(()=>{
   const page=document.querySelector('main .ma-page, main .home-wrap'),r=page?.getBoundingClientRect();
   const panels=[...document.querySelectorAll('.account-main>.account-section,.account-main--profile>section,.offer-comparison__card,.auth-card')].filter(el=>el.checkVisibility());
   const padding=panels.map(el=>parseFloat(getComputedStyle(el).paddingLeft));
   const buttons=[...document.querySelectorAll('main .ma-btn,.company-profile-sections a')].filter(el=>el.checkVisibility()&&!el.closest('dialog:not([open])'));
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r?.left,right:r?innerWidth-r.right:null,padding,taps:buttons.map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))};
  });
  assert(measurements.scrollWidth<=width+1,`${role} ${route} ${width}: overflow`);
  assert(measurements.left>=15&&measurements.right>=15,`${role} ${route} ${width}: page gutters`);
  assert(measurements.padding.every(p=>p>=16),`${role} ${route} ${width}: panel breathing room`);
  if(width<768)assert(measurements.taps.every(t=>t.height>=43),`${role} ${route} ${width}: touch height: ${measurements.taps.filter(t=>t.height<43).map(t=>t.text).join(', ')}`);
  const params=new URLSearchParams(route.split('?')[1]);const slug=route.split('?')[0].replaceAll('/','-')+[params.get('tab'),params.get('section'),params.get('id')?.slice(-8),params.get('comparison')?'comparison':null,params.get('expanded')?'queue-open':null].filter(Boolean).join('-');
  if([1440,390,320].includes(width))await page.screenshot({path:`${out}/${role}${slug}-${width}.png`,fullPage:true});
  report.push({role,route,...measurements,pass:true});
 }
}
try{
 for(const [role,key,routes]of [
 ['guest',null,['/','/requests/','/requests/new/','/account/','/companies/',`/companies/view/?id=${ledger.accounts.linen.id}`,`/companies/view/?id=${ledger.accounts.supply.id}`]],
 ['company','linen',['/account/','/account/?tab=offers','/account/?tab=profile','/account/?tab=profile&section=products','/account/?tab=profile&section=distribution','/account/?tab=business']],
 ['client','cafe',['/account/',`/requests/view/?id=${ledger.v2.requests.tables}`]],
 ['admin','owner_admin',['/admin/','/admin/?tab=requests','/admin/?tab=users']]]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  const state={blocked:[],chat:null,interceptions:0},errors=[];await guard(context,state);page.on('pageerror',e=>errors.push(e.message));if(key)await login(page,key);
  for(const route of routes){await go(page,route);assert(await page.locator('main [role="alert"]').evaluateAll(nodes=>nodes.every(node=>!node.textContent.trim())),`${role} ${route}: no service/form errors`);await layouts(page,role,route);}
  if(role==='guest'){
   await go(page,'/companies/');assert(!(await page.locator('main').innerText()).includes('სატესტო კომპანია'));assert(await page.getByText('სადემო კომპანია',{exact:true}).count()>0);
   await go(page,`/companies/view/?id=${ledger.accounts.linen.id}`);await page.getByRole('heading',{name:'შეფასებები',exact:false}).waitFor();await page.getByText(/სადემო შეფასება — პრეზენტაციის მაგალითი/).first().waitFor();
  }
  if(role==='company'){
   await go(page,'/account/');assert.equal(await page.locator('.account-nav__list [aria-current]').innerText(),'შესაბამისი მოთხოვნები');assert(!(await page.locator('main').innerText()).includes('ტესტრექ'));
   await page.getByRole('link',{name:'ხილვადობის პაკეტები',exact:true}).first().click();await page.getByRole('heading',{name:'ხილვადობის პაკეტები',level:1}).waitFor();assert.equal(await page.getByText('პროდუქტები ფოტოთი',{exact:true}).count(),0);
   await go(page,`/requests/view/?id=${ledger.v2.requests.tables}`);await page.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).click();
   await page.locator('#of-price-type').click();await page.getByRole('option',{name:'შეთანხმებით',exact:true}).click();assert.equal(await page.locator('#of-price').count(),0);
   await page.locator('#of-price-type').click();await page.getByRole('option',{name:'ერთეულის ფასი',exact:true}).click();await page.locator('#of-price').fill('0');await page.locator('#of-body').fill('სადემო UI შემოწმება — გადახდის პირობები შეთანხმებით.');await page.getByRole('button',{name:'შეთავაზების განახლება',exact:true}).click();assert((await page.locator('main').innerText()).includes('მიუთითე ფასი ლარში'));
   let payload;await page.route('**/api/db/rpc/send_offer',route=>{payload=route.request().postDataJSON();return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',request_id:ledger.v2.requests.tables,company_id:ledger.accounts.linen.id,body:payload.p_body,price:12.5,price_type:'unit',vat_included:true,delivery_included:true,delivery_days:2,status:'sent',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}});});
   await page.locator('#of-price').fill('12,50');await page.getByLabel('დღგ ფასში შედის',{exact:true}).check();await page.getByLabel('მიწოდების ხარჯი შეთავაზებაში შედის',{exact:true}).check();await page.locator('#of-days').fill('2');await page.getByRole('button',{name:'შეთავაზების განახლება',exact:true}).click();await page.getByText('შეთავაზება განახლდა.',{exact:true}).waitFor();assert.equal(payload.p_price,12.5);assert.equal(payload.p_price_type,'unit');assert.equal(payload.p_vat_included,true);assert.equal(payload.p_delivery_included,true);
  }
  if(role==='client'){
   await page.getByRole('button',{name:'შედარება',exact:true}).click();await page.locator('.offer-comparison').waitFor();assert.equal(await page.locator('.offer-comparison__card').count(),6);assert.equal(await page.locator('.offer-comparison__card').getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).count(),6);await layouts(page,role,`/requests/view/?id=${ledger.v2.requests.tables}&comparison=1`);
   await page.locator('.offer-comparison__card details').first().locator('summary').click();assert(await page.locator('.offer-comparison__card details').first().getAttribute('open')!==null);
  }
  if(role==='admin'){
   await go(page,'/admin/');const queue=page.locator('details').filter({has:page.locator('summary',{hasText:'დასადასტურებელი კომპანიები'})});await queue.locator('summary').click();await layouts(page,role,'/admin/?expanded=attention');await queue.locator('summary').click();
   for(const tab of ['requests','users']){await go(page,'/admin/?tab='+tab);assert.equal(await page.locator('tbody').getByRole('button',{name:'წაშლა',exact:true}).count(),0);const row=tab==='users'?page.locator('tbody tr').filter({has:page.locator('input[type=checkbox]')}).first():page.locator('tbody tr').first();await row.getByRole('button',{name:'დეტალები',exact:true}).click();await page.locator('dialog[open]').getByRole('button',{name:tab==='requests'?'წაშლა':/^(დაბლოკვა|განბლოკვა)$/,exact:true}).waitFor();await page.keyboard.press('Escape');}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);await context.close();console.log('PASS:',role,'layout and interactions');
 }
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({origin,views:report.length,report,readOnly:true,offerWriteMocked:true,pass:true},null,2));console.log('PASS:',report.length,'responsive views, gutters, padding, tap targets, comparison and profile flows');
}catch(error){console.error(safe(error.stack));process.exitCode=1;}finally{await browser.close();}
