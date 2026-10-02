import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import nextEnv from '@next/env';
import { chromium } from 'playwright';
import { auth, credentials, rpc, safe, origin as apiOrigin } from './e2e/lib.mjs';
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.QA_ORIGIN || 'http://localhost:3004';
const url = process.env.MEETANY_LOCAL_DATABASE_URL;
assert(url && ['localhost','127.0.0.1'].includes(new URL(url).hostname) && /^\/meetany_preview_\d+$/.test(new URL(url).pathname), 'Isolated local preview required');
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
assert.equal(apiOrigin,origin,'Set QA_ORIGIN to the isolated local app for all UI and API reads');
const sql = new pg.Client({ connectionString: url }); await sql.connect();
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output = 'qa/shots/chat-workflow-local'; fs.mkdirSync(output,{recursive:true});
const steps = [], errors = [], messageIds = []; let views=0, generalId, requestConversationId;
async function pageFor(key) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/**',route=>{assert.equal(new URL(route.request().url()).origin,origin,'Application API stays local');return route.continue();});
 const response=await page.request.post(auth+'/sign-in/email',{data:credentials(key)}); assert(response.ok(),`Sign in ${key}: ${response.status()}`);
 return page;
}
async function go(page,path) { await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000}); }
async function messages(id) {return (await sql.query('select * from meetany_private.messages where conversation_id=$1 order by created_at',[id])).rows;}
async function waitSql(fn) {for(let i=0;i<100;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,150));}assert.fail('Local database assertion timed out');}
async function responsive(page,label,selector) {
 for(const width of [320,390,1440]) { await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);views++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${width} page overflow`);
  assert(await page.locator(selector).evaluate(node=>node.scrollWidth<=node.clientWidth+1),`${label} ${width} panel overflow`);
  await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:true});
 } await page.setViewportSize({width:1440,height:1000});
}
try {
 const client=await pageFor('hotel'),company=await pageFor('wood');
 const hotel=(await rpc(client,'my_profile'))[0],wood=(await rpc(company,'my_profile'))[0];assert(wood.verified,'Approved local company required');
 await company.setViewportSize({width:390,height:1000});await go(company,'/account/?tab=opportunities');
 await go(client,`/companies/view/?id=${wood.id}`);
 const contact=client.getByRole('button',{name:'მიწერა',exact:true}).filter({visible:true}).first();await contact.click();
 await client.locator('.ma-chat[open] .ma-chat__messages[aria-busy="false"]').waitFor();
 assert.equal(await client.locator('#ma-chat-title').innerText(),wood.company);
 assert.equal(await client.locator('#ma-chat-title a').getAttribute('href'),`/companies/view/?id=${wood.id}`);
 generalId=(await sql.query('select id from meetany_private.conversations where client_id=$1 and company_id=$2 and context_key=$3',[hotel.id,wood.id,'general'])).rows[0].id;
 const before=(await messages(generalId)).length;
 const intro='გამარჯობა, ოთხი მაგიდის დამზადება გვჭირდება.\nრა იქნება ჯამური ფასი და შესრულების ვადა?';
 const composer=client.locator('#ma-chat-body');await composer.fill(intro.split('\n')[0]);await composer.press('Shift+Enter');await composer.pressSequentially(intro.split('\n')[1]);
 assert.equal(await composer.inputValue(),intro);assert.equal((await messages(generalId)).length,before);await composer.press('Enter');
 const first=await waitSql(async()=>{const rows=await messages(generalId);return rows.length===before+1&&rows.at(-1);});assert.equal(first.body,intro);messageIds.push(first.id);await client.waitForFunction(()=>document.querySelector('#ma-chat-body')?.value==='');
 steps.push('Client starts general conversation from company profile; correct peer link; Shift+Enter adds newline and Enter sends once');
 await company.waitForFunction(()=>!!document.querySelector('.ma-chat-unread .ma-chat-badge'));
 const unread=(await rpc(company,'list_my_conversations')).find(c=>c.id===generalId);assert(unread.unread_count>0);
 await go(company,'/account/?tab=messages');const row=company.locator(`li[data-id="${generalId}"] .inbox-row`);assert.equal(await row.getAttribute('data-unread'),'true');await row.click();
 await company.locator('.inbox-log[aria-busy="false"]').waitFor();assert.equal(await company.locator('.inbox-head__name').innerText(),hotel.company||hotel.name);await company.locator('.inbox-msg p').filter({hasText:intro}).first().waitFor();
 await waitSql(async()=>((await messages(generalId)).find(m=>m.id===first.id)?.read_at));
 steps.push('Company receives unread badge and mobile Inbox row; opens correct client thread and marks message read');
 const reply='გამარჯობა, ოთხივე მაგიდის ფასი 1 400 ლარია. დამზადებას 7 სამუშაო დღე სჭირდება.';
 await company.locator('#inbox-body').fill(reply);await company.locator('#inbox-body').press('Enter');
 const second=await waitSql(async()=>{const rows=await messages(generalId);return rows.length===before+2&&rows.at(-1);});messageIds.push(second.id);
 await client.locator('.ma-chat__message p').getByText(reply,{exact:true}).last().waitFor();await waitSql(async()=>((await messages(generalId)).find(m=>m.id===second.id)?.read_at));
 steps.push('Company replies through Inbox; client popup receives reply and marks it read');
 // Respect the existing two-second per-sender conversation cooldown.
 await company.waitForTimeout(2100);
 let failOnce=true;await company.route('**/rpc/send_message',async route=>{if(failOnce){failOnce=false;return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});}await new Promise(r=>setTimeout(r,500));return route.continue();});
 const follow='მიწოდება თბილისში ფასში შედის. ზომებს შეთანხმების შემდეგ დავაზუსტებთ.';
 await company.locator('#inbox-body').fill(follow);await company.locator('#inbox-body').press('Enter');await company.locator('.inbox-compose [role="alert"]').waitFor();assert.equal(await company.locator('#inbox-body').inputValue(),follow);assert.equal((await messages(generalId)).length,before+2);
 await company.waitForFunction(()=>!document.querySelector('#inbox-body')?.readOnly);
 await company.locator('#inbox-body').press('Enter');await company.locator('#inbox-body').press('Enter');
 const third=await waitSql(async()=>{const rows=await messages(generalId);return rows.length===before+3&&rows.at(-1);});messageIds.push(third.id);await company.waitForFunction(()=>document.querySelector('#inbox-body')?.value==='');assert.equal((await messages(generalId)).filter(m=>m.body===follow&&m.id===third.id).length,1);
 steps.push('Injected local send failure retains draft; retry during double Enter sends exactly one message');
 await company.locator('.inbox-back').focus();await company.keyboard.press('Shift+Tab');assert(await company.evaluate(()=>!!document.activeElement?.closest('.inbox-thread--sheet')));
 await company.keyboard.press('Escape');await company.locator('.inbox-thread--sheet').waitFor({state:'hidden'});assert(await row.evaluate(node=>node===document.activeElement));await row.click();
 steps.push('Mobile Inbox traps keyboard focus; Escape returns to list and restores exact row focus');
 await responsive(client,'popup-general','.ma-chat[open]');await responsive(company,'inbox-general','.inbox-thread');
 await composer.fill('ზომებს ხვალ გამოგიგზავნით.');await composer.press('Escape');await client.locator('.ma-chat[open]').waitFor({state:'hidden'});await client.locator('.ma-chat-launcher').click();assert.equal(await composer.inputValue(),'ზომებს ხვალ გამოგიგზავნით.');await composer.fill('');
 steps.push('Popup collapse and reopen preserve unsent draft');
 const request=(await sql.query('select r.id,r.title from public.requests r join public.offers o on o.id=r.chosen_offer_id where r.owner_id=$1 and o.company_id=$2 order by r.created_at desc limit 1',[hotel.id,wood.id])).rows[0];assert(request,'Chosen request from local workflow required');
 await go(client,`/requests/view/?id=${request.id}`);await client.getByRole('button',{name:'მიწერა',exact:true}).filter({visible:true}).first().click();await client.locator('.ma-chat[open] .ma-chat__messages[aria-busy="false"]').waitFor();
 assert.equal(await client.locator('.ma-chat__context').innerText(),request.title);assert.equal(await client.locator('.ma-chat__context a').getAttribute('href'),`/requests/view/?id=${request.id}`);
 requestConversationId=(await sql.query('select id from meetany_private.conversations where client_id=$1 and company_id=$2 and context_key=$3',[hotel.id,wood.id,request.id])).rows[0].id;assert.notEqual(requestConversationId,generalId);
 const requestBody='ამ მოთხოვნის ზომები 70×70 სმ იქნება. ადგილზე აწყობაც გვჭირდება.';const requestBefore=(await messages(requestConversationId)).length;
 await client.locator('#ma-chat-body').fill(requestBody);await client.locator('#ma-chat-body').press('Enter');const fourth=await waitSql(async()=>{const rows=await messages(requestConversationId);return rows.length===requestBefore+1&&rows.at(-1);});messageIds.push(fourth.id);
 await responsive(client,'popup-request','.ma-chat[open]');
 await client.getByRole('link',{name:'მიმოწერის სრულად გახსნა',exact:true}).click();await client.waitForURL(url=>url.searchParams.get('c')===requestConversationId);await client.locator('.inbox-head__context').getByText(request.title,{exact:true}).waitFor();
 assert.equal(await client.locator(`li[data-id="${requestConversationId}"] .inbox-row`).getAttribute('aria-current'),'true');
 await client.evaluate(id=>window.history.pushState(null,'',`/account/?tab=messages&c=${id}`),generalId);await client.waitForFunction(id=>document.querySelector(`li[data-id="${id}"] .inbox-row`)?.getAttribute('aria-current')==='true',generalId);
 steps.push('Request conversation has actual title and link; full Inbox opens same thread; same-page c query switch selects correct general thread');
 await company.setViewportSize({width:390,height:1000});await go(company,'/account/?tab=messages');const requestRow=company.locator(`li[data-id="${requestConversationId}"] .inbox-row`);await requestRow.waitFor();assert.equal(await requestRow.locator('.inbox-row__context').innerText(),request.title);await requestRow.click();await company.locator('.inbox-msg p').getByText(requestBody,{exact:true}).last().waitFor();
 steps.push('Company sees separate general and request threads with distinct context and correct client');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,views,steps,messageIds,generalId,requestConversationId,errors,remoteApplicationWrites:0},null,2));console.log(`PASS ${steps.length} actual chat checks; ${views} responsive views; remote application writes 0`);
} catch(error) {console.error(safe(error.stack));for(const page of browser.contexts().flatMap(c=>c.pages()))await page.screenshot({path:`${output}/failure-${browser.contexts().findIndex(c=>c.pages().includes(page))}.png`,fullPage:true});fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:false,views,steps,messageIds,generalId,requestConversationId,error:safe(error.message),errors,remoteApplicationWrites:0},null,2));process.exitCode=1;}
finally {await browser.close();await sql.end();}
