import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const ledger=JSON.parse(fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md',import.meta.url),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
try {
 const p=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const saved=new Set();let reads=0,failSave=false,emailOffers=false;
 const [request]=await (await p.request.get('http://localhost:3000/api/db/requests?select=*&order=created_at.desc&limit=1')).json();
 const notice={id:'11111111-1111-4111-8111-111111111111',kind:'offer_received',title:request.title,request_id:request.id,created_at:new Date().toISOString(),read_at:null};
 const items=()=>[...saved].map(id=>({company_id:id,company:'QA saved company',city:'tbilisi',industry:'furniture'}));
 await p.route('**/api/db/capabilities',r=>r.fulfill({json:{engagement:true,emailDelivery:false}}));
 await p.route('**/api/db/rpc/engagement_state',r=>r.fulfill({json:{version:1,savedIds:[...saved],unread:notice.read_at?0:1,notifications:{items:[notice],nextCursor:null},emailOffers}}));
 await p.route('**/api/db/rpc/set_saved_company',r=>{const d=r.request().postDataJSON();if(failSave)return r.fulfill({status:503,json:{message:'QA failure'}});if(d.p_saved)saved.add(d.p_company_id);else saved.delete(d.p_company_id);return r.fulfill({json:d.p_saved});});
 await p.route('**/api/db/rpc/list_saved_companies',r=>r.fulfill({json:{items:items(),nextCursor:null}}));
 await p.route('**/api/db/rpc/list_notifications',r=>r.fulfill({json:{items:[notice],nextCursor:null}}));
 await p.route('**/api/db/rpc/mark_notification_read',r=>{reads++;notice.read_at=new Date().toISOString();return r.fulfill({json:null});});
 await p.route('**/api/db/rpc/set_notification_email',r=>{emailOffers=r.request().postDataJSON().p_enabled;return r.fulfill({json:emailOffers});});
 await p.goto('http://localhost:3000/companies/');await p.getByRole('button',{name:'კომპანიის შენახვა',exact:true}).first().click();await p.waitForURL('**/account/?tab=saved');
 assert(await p.evaluate(()=>!!sessionStorage.getItem('meetany.saveIntent')));
 await p.locator('#login-email').fill('demo-wood@meetany.ge');await p.locator('#login-password').fill(ledger.accounts.wood.password);await p.locator('form button[type=submit]').click();
 await p.getByText('QA saved company',{exact:true}).waitFor({timeout:60000});assert.equal(saved.size,1);assert.equal(await p.evaluate(()=>sessionStorage.getItem('meetany.saveIntent')),null);
 await p.reload();await p.getByText('QA saved company',{exact:true}).waitFor();await p.setViewportSize({width:320,height:900});await p.screenshot({path:'/tmp/saved-account-final-320.png',fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.setViewportSize({width:1280,height:900});
 await p.getByRole('button',{name:'შენახვის გაუქმება',exact:true}).click();await p.getByText(/კომპანია ჯერ არ შეგინახავს/).waitFor();assert.equal(saved.size,0);
 await p.goto('http://localhost:3000/companies/');await p.getByRole('button',{name:'კომპანიის შენახვა',exact:true}).first().click();assert.equal(saved.size,1);
 failSave=true;await p.getByRole('button',{name:'შენახვის გაუქმება',exact:true}).first().click();await p.getByText('რაღაც ვერ შესრულდა. სცადე თავიდან.').waitFor();assert.equal(saved.size,1);failSave=false;
 for(const width of [1280,390,320]) {await p.setViewportSize({width,height:900});await p.screenshot({path:`/tmp/engagement-companies-${width}.png`,fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
 await p.getByRole('button',{name:/^შეტყობინებები, 1/}).click();await p.locator('#notification-list').waitFor();await p.screenshot({path:'/tmp/engagement-bell-320.png'});await p.keyboard.press('Escape');assert.equal(await p.locator('#notification-list').count(),0);
 await p.getByRole('button',{name:/^შეტყობინებები, 1/}).click();await p.locator('#notification-list').getByRole('link',{name:/ახალი შეთავაზება/}).click();await p.waitForURL('**/requests/view/**');await p.getByRole('button',{name:'შეტყობინებები',exact:true}).waitFor();assert.equal(reads,1);
 await p.goto('http://localhost:3000/account/?tab=notifications');await p.getByRole('checkbox').waitFor();assert(await p.getByRole('checkbox').isDisabled());assert.equal(await p.locator('article[data-unread="false"]').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS guest save intent, authenticated save/remove/reload, failed write, notifications/read/Escape, email disabled, 1280/390/320');
}finally{await browser.close();}
