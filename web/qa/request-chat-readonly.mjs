// Real existing accounts/conversation reads; all conversation starts, receipts and sends intercepted.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
process.env.QA_ORIGIN ||= 'http://localhost:3004';
const {auth,origin,credentials,rpc,db}=await import('./e2e/lib.mjs');
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local preview only');
const ids={wood:'74cc28fc-47de-45cb-9563-93735b86855e',hotel:'bacf1572-7493-4ac9-bfc7-95719e911c4c'};
const output='qa/shots/request-chat-readonly';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let checks=0,interceptedStarts=0,mockedSends=0,mockedReceipts=0;const errors=[],bounds=[],iconStyles=[];
const check=(v,label)=>{assert(v,label);checks++;};
try{
 for(const account of ['wood','hotel']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  check((await page.request.post(auth+'/sign-in/email',{data:credentials(account)})).ok(),'Existing account sign-in');
  const me=(await rpc(page,'my_profile'))[0];check(me.id===ids[account],'Fixed account identity');
  const all=await rpc(page,'list_my_conversations');const conversation=all.find(c=>c.company_id===ids.wood&&c.client_id===ids.hotel&&c.request_id);check(!!conversation,'Existing shared request conversation required');
  const request=(await db(page,`requests?select=*&id=eq.${conversation.request_id}`))[0];check(request.owner_id===ids.hotel,'Request owned by allowed client');
  const fixtureMessages=[];let lastStart;
  await context.route('**/api/db/rpc/*',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);const args=route.request().postDataJSON()||{};
   if(name==='start_conversation'){interceptedStarts++;lastStart=args;check(args.p_company_id===ids.wood&&args.p_request_id===request.id,'Offer action preserves company and request context');return route.fulfill({json:conversation});}
   if(name==='mark_read'){mockedReceipts++;return route.fulfill({json:{marked:0,read_at:new Date().toISOString()}});}
   if(name==='send_message'){mockedSends++;check(args.p_conversation_id===conversation.id,'Composer sends to same existing conversation');const message={id:crypto.randomUUID(),conversation_id:conversation.id,sender_id:me.id,body:args.p_body,created_at:new Date().toISOString(),read_at:null};fixtureMessages.push(message);return route.fulfill({json:message});}
   if(name==='list_messages'){const response=await route.fetch();return route.fulfill({response,json:[...await response.json(),...fixtureMessages]});}
   assert(!/^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|extend_|withdraw_|request_company_plan|cancel_company_plan|admin_(edit|manage|moderate|resolve|set|delete|save|reject|hide))/.test(name),'Unexpected business mutation '+name);return route.continue();
  });
  await page.goto(origin+`/requests/view/?id=${request.id}`,{waitUntil:'domcontentloaded'});
  const card=page.locator('.ma-ocard').filter({has:page.locator(`a.ma-ocard__name[href="/companies/view/?id=${ids.wood}"]`)});
  await card.waitFor({timeout:60000});await card.getByRole('button',{name:'მიწერა',exact:true}).waitFor();
  check(await card.getByRole('button',{name:'მიწერა',exact:true}).count()===1,'Direct contextual message action on offer');
  await card.getByRole('button',{name:'მიწერა',exact:true}).click();
  const dialog=page.locator('dialog.ma-chat[open]');await dialog.locator('.ma-chat__messages[aria-busy="false"]').waitFor({timeout:60000});
  check(!!lastStart,'Contextual action reached existing start API');
  check(await dialog.locator('#ma-chat-title').innerText()===(conversation.other_company||conversation.other_name),'Actual other participant identity');
  check(await dialog.locator('.ma-chat__context a').getAttribute('href')===`/requests/view/?id=${request.id}`,'Request context link');
  check(await dialog.locator('.ma-chat__context a').getAttribute('title')===request.title,'Full context title available despite ellipsis');
  const input=dialog.getByRole('textbox',{name:'შეტყობინება',exact:true});await input.fill('ზომები და მიწოდების პირობები დავაზუსტოთ.');await input.press('Shift+Enter');check((await input.inputValue()).endsWith('\n'),'Shift Enter retains multiline composition');
  check(await dialog.getByRole('button',{name:'გაგზავნა',exact:true}).isEnabled(),'Composer ready after loaded thread');
  for(const [width,height,label] of [[1440,1000,'1440'],[768,900,'768'],[390,844,'390'],[320,740,'320'],[720,500,'zoom-200-equivalent'],[390,430,'mobile-short-viewport']]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
   if(label==='1440')iconStyles.push({account,icons:await dialog.locator('.icon').evaluateAll(els=>els.map(el=>({name:el.dataset.icon,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,color:getComputedStyle(el).color,stroke:getComputedStyle(el).stroke,fill:getComputedStyle(el).fill,opacity:getComputedStyle(el).opacity,display:getComputedStyle(el).display,bbox:{width:el.getBBox().width,height:el.getBBox().height}}))) });
   const box=await dialog.boundingBox();bounds.push({account,label,box,viewport:{width,height}});
   check(box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'Entire chat visible '+account+' '+label);
   check(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog no horizontal overflow '+label);
   for(const selector of ['.ma-chat__head','.ma-chat__composer','#ma-chat-body','.ma-chat__composer button[type=submit]']){const part=await dialog.locator(selector).boundingBox();check(part.x>=box.x-1&&part.y>=box.y-1&&part.x+part.width<=box.x+box.width+1&&part.y+part.height<=box.y+box.height+1,'Header/input/send contained '+selector+' '+label);}
   if(width<768)check(await dialog.evaluate(el=>el.matches(':modal')),'Mobile chat is modal '+label);
   if(width===320){check(await dialog.locator('#ma-chat-title').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),'Fixture participant name fully readable at 320');check(await dialog.locator('.ma-chat__context').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Fixture request title fully readable at 320');}
   await page.screenshot({path:`${output}/${account}-${label}.png`});
  }
  await page.setViewportSize({width:390,height:844});await input.focus();await page.keyboard.press('Tab');check(await dialog.evaluate(el=>el.contains(document.activeElement)),'Mobile focus remains in dialog');
  await page.keyboard.press('Escape');check(await page.locator('dialog.ma-chat[open]').count()===0,'Escape minimizes');await page.locator('.ma-chat-launcher').click();check((await input.inputValue()).startsWith('ზომები და მიწოდების პირობები'),'Minimize retains draft');
  await input.fill('ზომები და მიწოდების პირობები დავაზუსტოთ.');await dialog.getByRole('button',{name:'გაგზავნა',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#ma-chat-body')?.value==='');check(await dialog.locator('.ma-chat__message--mine p').getByText('ზომები და მიწოდების პირობები დავაზუსტოთ.',{exact:true}).count()===1,'Intercepted send clears draft and renders saved result');
  if(account==='hotel'){
   await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
   const requests=await db(page,'requests?select=*'),offers=await db(page,'offers?select=*');
   const candidate=requests.find(r=>r.owner_id===me.id&&r.id!==request.id&&!r.chosen_offer_id&&offers.filter(o=>o.request_id===r.id).length>1);
   check(!!candidate,'Existing unchosen multiple-offer request for comparison');
   await page.goto(origin+`/requests/view/?id=${candidate.id}`,{waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'შედარება',exact:true}).waitFor({timeout:60000});
   check(await page.locator('.request-offer-list .ma-ocard').count()>1,'Multiple real offers before choosing');
   for(const offer of await page.locator('.request-offer-list .ma-ocard').all())check(await offer.getByRole('button',{name:'მიწერა',exact:true}).count()===1,'Every supplier can be contacted before choice');
   await page.getByRole('button',{name:'შედარება',exact:true}).click();
   const cards=page.locator('.offer-comparison__card');check(await cards.count()>1,'Comparison view opens');
   for(const offer of await cards.all())check(await offer.getByRole('button',{name:'მიწერა',exact:true}).count()===1,'Comparison preserves direct communication');
   await page.locator('.offer-comparison').screenshot({path:`${output}/hotel-comparison.png`});
  }
  await context.close();
 }
 check(errors.length===0,'No runtime errors');fs.writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,origin,checks,applicationWrites:0,interceptedStarts,mockedSends,mockedReceipts,zoom:'Reduced CSS viewport equivalent; native browser zoom and device keyboard not automated',bounds,iconStyles,errors},null,2));console.log(`PASS ${checks} local real-account request chat checks; business writes 0; ${interceptedStarts} starts/${mockedSends} sends intercepted.`);
}catch(error){console.error(error.message);fs.writeFileSync(`${output}/report.json`,JSON.stringify({pass:false,checks,error:error.message,bounds,applicationWrites:0},null,2));process.exitCode=1;}finally{await browser.close();}
