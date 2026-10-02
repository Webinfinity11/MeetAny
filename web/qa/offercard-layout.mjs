import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {auth,credentials,root,assert,safe} from './e2e/lib.mjs';
import {guard} from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const before=process.env.QA_OFFER_BEFORE==='1',output=`qa/shots/offercard-${process.env.QA_OFFER_VARIANT|| (before?'before':'compact')}-local`;fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),report=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),state={blocked:[],chat:null,interceptions:0};await guard(context,state);page.on('pageerror',e=>errors.push(e.message));
 let signed=false;for(let n=0;n<6;n++){const response=await page.request.post(auth+'/sign-in/email',{data:credentials('cafe')});if(response.ok()){signed=true;break;}assert.equal(response.status(),429);await new Promise(r=>setTimeout(r,20000));}assert(signed,'client sign in');
 let variant='actual';const longBody='პირობები სრულად: მასალა, დამზადება, მიწოდება და მონტაჟი შეთანხმებული გრაფიკით. '.repeat(24)+'\nდამატებითი პირობა: '+ 'ძალიანგრძელიერთიანისიტყვა'.repeat(12);
 await context.route('**/api/db/offers?**',async route=>{if(variant==='actual')return route.continue();const response=await route.fetch();const rows=await response.json();assert(Array.isArray(rows));return route.fulfill({response,json:rows.map((row,index)=>({...row,...(variant==='default'?{price:null,price_type:'negotiable',delivery_days:null,vat_included:false,delivery_included:false,body:'მომსახურების ფასი და შესრულების ვადა შეთანხმდება მოთხოვნის დეტალების დაზუსტების შემდეგ.'}:index===0?{price:999999999.99,price_type:'total',delivery_days:365,vat_included:true,delivery_included:true,body:longBody}:{} )}))});});
 for(variant of process.env.QA_OFFER_VARIANT?[process.env.QA_OFFER_VARIANT]:before?['actual']:['actual','default','long']){
  await page.goto(origin+`/requests/view/?id=${ledger.v2.requests.tables}`,{waitUntil:'domcontentloaded'});await page.locator('.ma-ocard').first().waitFor();await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${variant} ${width} page fits`);
   const cards=page.locator('.ma-ocard');const measurements=await cards.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),terms=el.querySelector('.offer-terms').getBoundingClientRect(),body=el.querySelector('.ma-ocard__body').getBoundingClientRect(),footer=el.querySelector('footer').getBoundingClientRect();return{height:r.height,width:r.width,factsHeight:terms.height,factsToBody:body.top-terms.bottom,bodyToFooter:footer.top-body.bottom,overflow:el.scrollWidth>el.clientWidth+1,body:el.querySelector('.ma-ocard__body').textContent,buttons:[...el.querySelectorAll('footer button,footer a')].filter(n=>n.checkVisibility()).map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height,left:n.getBoundingClientRect().left-r.left,right:r.right-n.getBoundingClientRect().right}))};}));
   assert(measurements.every(c=>!c.overflow&&c.buttons.every(b=>b.left>=0&&b.right>=-1)),`${variant} ${width} card/actions fit`);
   if(width<768&&!before)assert(measurements.every(c=>c.buttons.every(b=>b.height>=43)),`${variant} ${width} accessible controls`);
   await (variant==='long'?cards.filter({hasText:'დამატებითი პირობა:'}).first():cards.first()).screenshot({path:`${output}/${variant}-card-${width}.png`});report.push({variant,width,cards:measurements,pass:true});
  }
  if(!before){
   if(variant==='long')assert(await page.locator('.ma-ocard__body').filter({hasText:'დამატებითი პირობა:'}).count()>0,'full long body preserved');
   await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'შედარება',exact:true}).click();await page.locator('.offer-comparison__card').first().waitFor();
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${variant} comparison ${width} fits`);await page.locator('.offer-comparison').screenshot({path:`${output}/${variant}-comparison-${width}.png`});report.push({variant,width,comparison:true,cards:await page.locator('.offer-comparison__card').count(),pass:true});}
   await page.getByRole('button',{name:'სია',exact:true}).click();
  }
 }
 if(!before){
  const first=page.locator('.ma-ocard').first();await first.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();await page.locator('#choose[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#choose[open]').count(),0);
  await first.getByRole('button',{name:'შეატყობინე',exact:true}).click();await page.locator('dialog[open]').getByRole('heading',{name:'შეტყობინება',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  assert(await first.getByRole('link',{name:'კომპანიის ნახვა',exact:true}).getAttribute('href'),'company link preserved');
 }
 assert.deepEqual(state.blocked,[]);assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,readOnly:true,offerReadsMocked:!before,views:report.length,errors,report},null,2));console.log(`PASS ${report.length} offer card/comparison responsive states; ${before?'baseline':'default/long terms, actions and choice/report opening'}; no application writes.`);
}catch(error){console.error(safe(error.stack));process.exitCode=1;}finally{await browser.close();}
