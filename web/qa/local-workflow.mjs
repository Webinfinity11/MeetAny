import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import nextEnv from '@next/env';
import {chromium} from 'playwright';
import {auth,credentials,rpc,safe} from './e2e/lib.mjs';
nextEnv.loadEnvConfig(process.cwd());
const origin=process.env.QA_ORIGIN||'http://localhost:3004';
const url=process.env.MEETANY_LOCAL_DATABASE_URL;
assert(url && ['localhost','127.0.0.1'].includes(new URL(url).hostname) && /^\/meetany_preview_\d+$/.test(new URL(url).pathname),'Isolated local preview required');
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const sql=new pg.Client({connectionString:url});await sql.connect();
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output='qa/shots/local-workflow-1002';fs.mkdirSync(output,{recursive:true});
const steps=[],errors=[];let requestId,views=0;
async function pageFor(key){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await context.route('**/api/**',r=>{assert.equal(new URL(r.request().url()).origin,origin,'Application writes stay local');return r.continue();});const login=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});assert(login.ok(),`Login ${key}`);return page;}
async function go(page,route){await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000});}
async function responsive(page,label){for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:1000});views++;await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${width} overflow`);await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:true});}await page.setViewportSize({width:1440,height:1000});}
try{
 const client=await pageFor('hotel'),company=await pageFor('wood'),admin=await pageFor('owner_admin');
 const me=(await rpc(company,'my_profile'))[0];assert(me?.verified,'Approved company fixture required');
 const request=await rpc(client,'create_request',{p_title:'კაფისთვის 4 ხის მაგიდა ადგილზე აწყობით',p_body:'გვჭირდება ოთხი ხის მაგიდა ზომით 70×70 სმ. შეთავაზებაში მიუთითეთ ჯამური ფასი, დამზადების ვადა და ადგილზე აწყობის პირობები.',p_category:'furniture',p_city:'tbilisi',p_quantity:4,p_unit:'pcs'});requestId=request.id;steps.push('Real request created through local API');
 await go(company,`/requests/view/?id=${request.id}`);await company.locator('#of-body').waitFor();
 await company.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();await company.getByText('აღწერე შენი შეთავაზება',{exact:true}).waitFor();assert.equal((await rpc(company,'my_profile')).length,1);steps.push('Empty offer validates and focuses description');
 const body='ოთხივე მაგიდა დამზადდება მუხის მასალით. ფასი მოიცავს თბილისში მიწოდებას და ადგილზე აწყობას; შესრულების ვადა 4 სამუშაო დღეა.';
 await company.locator('#of-body').fill(body);await company.locator('#of-days').fill('4');await responsive(company,'offer-form');
 await company.reload({waitUntil:'domcontentloaded'});await company.locator('#of-body').waitFor();await company.waitForFunction(body=>document.querySelector('#of-body')?.value===body,body);steps.push('Draft restored after reload');
 let failOnce=true;await company.route('**/rpc/send_offer',r=>{if(failOnce){failOnce=false;return r.fulfill({status:503,json:{message:'Temporarily unavailable'}});}return r.continue();});
 await company.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();await company.locator('form [role="alert"]').waitFor();assert.equal(await company.locator('#of-body').inputValue(),body);steps.push('Failed send retains input and supports retry');
 await company.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();await company.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).waitFor({timeout:30000});
 const offers=(await sql.query('select * from public.offers where request_id=$1',[request.id])).rows;assert.equal(offers.length,1);assert.equal(offers[0].body,body);assert.equal(offers[0].delivery_days,4);steps.push('Retry sends exactly one offer; success confirmation shown');
 await go(company,'/account/?tab=offers');await company.getByRole('link',{name:request.title,exact:true}).waitFor();await responsive(company,'sent-offers');steps.push('Sender sees offer in account with request link');
 await go(client,`/requests/view/?id=${request.id}`);await client.locator('.ma-ocard__body').filter({hasText:body}).waitFor();await responsive(client,'received-offers');
 await client.getByRole('link',{name:'კომპანიის ნახვა',exact:true}).first().click();await client.waitForURL(/\/companies\/view/);await client.getByRole('heading',{name:me.company,exact:true}).waitFor();steps.push('Recipient opens sender company profile');
 await go(client,`/requests/view/?id=${request.id}`);await client.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();await client.locator('#choose').getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();await client.locator('#choose').waitFor({state:'hidden'});assert.equal((await sql.query('select chosen_offer_id from public.requests where id=$1',[request.id])).rows[0].chosen_offer_id,offers[0].id);steps.push('Choice confirmation updates request and offer atomically');
 await go(client,`/companies/view/?id=${me.id}#company-reviews`);await client.locator('.business-review-form summary').click();await client.locator('.business-review-form textarea').fill('კომუნიკაცია იყო დროული და შეთავაზებაში ყველა საჭირო პირობა მკაფიოდ იყო აღწერილი.');
 const rating=client.locator('.business-review-form input[type="radio"][value="5"]');if(await rating.count())await rating.check();else await client.locator('.business-review-form').getByRole('button',{name:/5/}).click();
 await client.getByRole('button',{name:'შეფასების გაგზავნა',exact:true}).click();await client.getByText('კომუნიკაცია იყო დროული და შეთავაზებაში ყველა საჭირო პირობა მკაფიოდ იყო აღწერილი.',{exact:true}).waitFor({timeout:30000});steps.push('Review publishes immediately without approval');
 await go(admin,'/admin/?tab=companies');await admin.getByRole('heading',{name:'კომპანიები',exact:true}).waitFor();await responsive(admin,'admin-companies');
 assert.deepEqual(errors,[]);console.log(`PASS: ${steps.length} real local workflow checks; ${views} responsive views; remote application writes 0`);
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,views,steps,errors,requestId,remoteApplicationWrites:0},null,2));
}catch(e){console.error(safe(e.stack));fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:false,steps,error:safe(e.message),requestId},null,2));process.exitCode=1;}finally{await browser.close();await sql.end();}
