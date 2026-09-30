// Chat writes are intercepted fixtures; no messages/read receipts reach the database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.env.QA_ORIGIN || 'http://localhost:3001';
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(), errors=[];
page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('qa/shots/chat-dock',{recursive:true});
let unread=2,reads=0,fetches=0,sends=0,starts=0,failSend=false;
const stamp='2026-09-30T10:00:00Z';
const messages=[{id:'message-1',conversation_id:'conversation-1',sender_id:'peer',body:'გამარჯობა, დეტალები შეგვიძლია აქ განვიხილოთ.',created_at:stamp,read_at:null}];
const conversation=()=>({id:'conversation-1',client_id:'fixture-client',company_id:'peer',other_id:'peer',other_company:'სატესტო პარტნიორი',context_key:'general',request_id:null,created_at:stamp,last_message_at:stamp,last_message:messages.at(-1),unread_count:unread});
await context.route('**/api/db/rpc/*',async route=>{
 const name=new URL(route.request().url()).pathname.split('/').at(-1);
 let json;
 switch(name){
 case 'unread_message_count':json=unread;break;
 case 'list_my_conversations':json=[conversation()];break;
 case 'list_messages':fetches++;json=messages;break;
 case 'mark_read':reads++;json={marked:unread,read_at:stamp};unread=0;messages.forEach(m=>m.read_at=stamp);break;
 case 'start_conversation':starts++;json=conversation();break;
 case 'send_message':{
  sends++;if(failSend){await route.fulfill({status:400,json:{message:'MA506'}});return;}
  const body=route.request().postDataJSON();json={id:`sent-${sends}`,conversation_id:'conversation-1',sender_id:'fixture-client',body:body.p_body,created_at:'2026-09-30T10:01:00Z',read_at:null};messages.push(json);break;
 }
 default:await route.continue();return;
 }
 await route.fulfill({json});
});
const opened=()=>page.locator('dialog.ma-chat[open]');
try{
 await page.goto(origin+'/account/',{waitUntil:'domcontentloaded'});
 await page.locator('#login-email').waitFor();
 assert.equal(await page.locator('.ma-chat-launcher').count(),0);
 const account=ledger.accounts.owner_user;
 await page.locator('#login-email').fill(account.email);await page.locator('#login-password').fill(account.password);
 await page.locator('form button[type=submit]').click();await page.locator('#login-email').waitFor({state:'hidden',timeout:45000});
 const launcher=page.locator('.ma-chat-launcher');await launcher.waitFor();
 await page.waitForFunction(()=>document.querySelector('.ma-chat-launcher .ma-chat-badge')?.textContent==='2');
 await page.getByRole('button',{name:'ჩემი ანგარიში',exact:true}).click();
 assert.deepEqual(await page.locator('#ma-account-menu [role=menuitem]').allTextContents(),['ანგარიშის პარამეტრები','გასვლა']);
 await page.keyboard.press('Escape');
 await page.locator('.ma-chat-unread').click();await opened().locator('.ma-chat-list__row').waitFor();
 assert.equal(reads,0);assert.equal(starts,0);
 await page.screenshot({path:'qa/shots/chat-dock/desktop-list.png'});
 await opened().locator('.ma-chat-list__row').click();await opened().getByText(messages[0].body,{exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.ma-chat-launcher .ma-chat-badge'));
 assert.equal(starts,0);assert.equal(reads,1);
 await opened().locator('textarea').fill('ჩაკეცვისას ტექსტი რჩება');
 await opened().getByRole('button',{name:'მიმოწერის ჩაკეცვა'}).click();assert.equal(await opened().count(),0);
 const previous=fetches;await page.waitForTimeout(5500);assert.equal(fetches,previous,'Minimized thread must stop polling');
 await launcher.click();assert.equal(await opened().locator('textarea').inputValue(),'ჩაკეცვისას ტექსტი რჩება');
 await opened().getByRole('button',{name:'ყველა მიმოწერა'}).click();await opened().locator('.ma-chat-list__row').click();
 assert.equal(await opened().locator('textarea').inputValue(),'ჩაკეცვისას ტექსტი რჩება');
 failSend=true;await opened().getByRole('button',{name:'გაგზავნა',exact:true}).click();await opened().locator('.ma-field__error').waitFor();assert.equal(await opened().locator('textarea').inputValue(),'ჩაკეცვისას ტექსტი რჩება');
 failSend=false;await opened().getByRole('button',{name:'გაგზავნა',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog[open] textarea')?.value==='');assert.equal(sends,2);
 await page.screenshot({path:'qa/shots/chat-dock/desktop-thread.png'});
 await page.keyboard.press('Escape');assert.equal(await opened().count(),0);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await launcher.click();
  assert.equal(await opened().evaluate(el=>el.matches(':modal')),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='TEXTAREA'),false);
  const bounds=await opened().boundingBox();assert.equal(bounds.x,0);assert.equal(bounds.width,width);assert(bounds.height<=844);
  assert.equal(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);
  await opened().locator('textarea').fill('მობილური ტექსტი');
  await page.screenshot({path:`qa/shots/chat-dock/mobile-${width}.png`});
  await opened().getByRole('button',{name:'მიმოწერის ჩაკეცვა'}).click();
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const path of ['/','/companies/','/requests/']){
  await page.goto(origin+path,{waitUntil:'domcontentloaded'});await launcher.waitFor({timeout:45000});await launcher.click();await opened().locator('.ma-chat-list__row').waitFor();await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS guest visibility, account menu, unread badge, header launch, list/thread, minimize draft, stopped polling, send retry, keyboard, mobile 390/320 and all public pages; chat writes mocked');
}finally{await browser.close();}
