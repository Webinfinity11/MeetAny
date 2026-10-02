import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
process.env.QA_ORIGIN ||= 'http://localhost:3004';
const { auth, origin, credentials, rpc, db } = await import('./e2e/lib.mjs');
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local preview only');
const output='qa/shots/account-offers-readonly';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
try{
  check((await page.request.post(auth+'/sign-in/email',{data:credentials('wood')})).ok(),'Existing wood sign-in');
  const me=(await rpc(page,'my_profile'))[0];check(me.id==='74cc28fc-47de-45cb-9563-93735b86855e'&&me.role==='company','Fixed company identity');
  const offers=await db(page,'offers?select=*');check(offers.length>0,'Existing offers required');
  await context.route('**/api/db/rpc/*',route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);assert(!/^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|extend_|withdraw_|request_company_plan|cancel_company_plan|admin_(edit|manage|moderate|resolve|set|delete|save|reject|hide))/.test(name),'Unexpected mutation '+name);return route.continue();});
  await page.goto(origin+'/account/?tab=offers',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(count=>document.querySelectorAll('.account-offer').length===count,offers.length,{timeout:60000});
  for(const offer of offers){
    const row=page.locator('.account-offer').filter({has:page.locator(`.account-row__link[href="/requests/view/?id=${offer.request_id}"]`)});
    check(await row.count()===1,'Stable request ID link, including duplicate titles');
    const expected=offer.price==null||offer.price_type==='negotiable'?'შეთანხმებით':`${new Intl.NumberFormat('ka-GE',{maximumFractionDigits:2}).format(Number(offer.price))} ₾`;
    check(await row.locator('.account-offer__terms strong').innerText()===expected,'Actual stored amount');
    check(await row.locator('.account-offer__actions a').getAttribute('href')===`/requests/view/?id=${offer.request_id}`,'Detail action opens same request');
    if(offer.delivery_days!=null)check((await row.locator('.account-offer__terms').innerText()).includes(`მიწოდება: ${offer.delivery_days} დღე`),'Actual lead time');
  }
  for(const [status,label] of [['sent','გაგზავნილი'],['chosen','არჩეული'],['declined','არ აირჩიეს']]){
    await page.getByRole('group',{name:'შეთავაზების სტატუსი',exact:true}).getByRole('button',{name:label,exact:true}).click();
    const expected=offers.filter(o=>o.status===status).length;
    check(await page.locator('.account-offer').count()===expected,'Status filter uses actual data');
    check((await page.locator('.account-offers__total').innerText())===`${expected} შეთავაზება`,'Filtered count updates');
  }
  await page.getByRole('group',{name:'შეთავაზების სტატუსი',exact:true}).getByRole('button',{name:'ყველა',exact:true}).click();
  for(const width of [1440,820,390,320]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);
    check(await page.locator('.account-offers').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No offer panel overflow '+width);
    await page.screenshot({path:`${output}/offers-${width}.png`,fullPage:true});
  }
  const filter=page.getByRole('group',{name:'შეთავაზების სტატუსი',exact:true}).getByRole('button',{name:'არჩეული',exact:true});await filter.focus();await page.keyboard.press('Enter');check(await filter.getAttribute('aria-pressed')==='true','Keyboard activates filter');
  await page.getByRole('group',{name:'შეთავაზების სტატუსი',exact:true}).getByRole('button',{name:'ყველა',exact:true}).click();
  const first=page.locator('.account-offer__actions a').first();const href=await first.getAttribute('href');await first.click();await page.waitForURL(origin+href);await page.locator('main h1').waitFor({timeout:60000});check(await page.locator('main h1').count()===1,'Detail action navigates to request');check(errors.length===0,'No runtime errors');
  fs.writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,origin,checks,offers:offers.length,applicationWrites:0,errors},null,2));console.log(`PASS ${checks} local actual-data offers checks; four widths; application writes 0.`);
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await browser.close();}
