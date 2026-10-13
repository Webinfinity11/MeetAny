// Local integration check. Uses demo credentials in memory, restores profile writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin = process.env.QA_ORIGIN || 'http://localhost:3407';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const dir = 'qa/QA-2026-10-13/shots/auth-profile';
fs.mkdirSync(dir,{recursive:true});
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
console.log('START local profile browser');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
console.log('BROWSER ready');
const context=await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
context.setDefaultTimeout(60000);
const p=await context.newPage();console.log('PAGE ready'); const goto=p.goto.bind(p); p.goto=(url,options={})=>goto(url,{waitUntil:'domcontentloaded',...options}); const errors=[];p.on('pageerror',e=>errors.push(e.message));
const marker='e2e-contact-'+Date.now(); let originalAbout, originalPosition;
let writes=0;p.on('request',r=>{if(r.url().endsWith('/rpc/update_my_profile'))writes++;});
async function shot(name,width,fullPage=true){
 await p.setViewportSize({width,height:900});await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await p.screenshot({path:`${dir}/${name}-${width}.png`,fullPage,animations:"disabled"});
 const overflow=await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
 if(overflow)console.log('OVERFLOW',name,width,await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).slice(0,15).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))));
 assert.equal(overflow,0,name+' overflow');
}
try {
 if (!process.env.PROFILE_ONLY) {
 for(const width of [1440,390,360]) for(const role of ['client','company']){
  await p.setViewportSize({width,height:900});await p.goto(origin+`/account/?tab=register&role=${role}`);
  await p.locator('.auth-register').waitFor();await p.locator('.auth-register button[type=submit]').click();await p.locator('.auth-error-summary').waitFor();
  await p.waitForFunction(()=>document.activeElement?.classList.contains('auth-error-summary'));
  assert(await p.locator('#reg-city-error').isVisible());await shot(`register-${role}-empty`,width);
 }
 await p.locator('#reg-name').fill('სატესტო პირი');await p.locator('#reg-email').fill('kept@example.test');
 await p.getByRole('button',{name:'ვეძებ მომწოდებელს',exact:true}).click();assert.equal(await p.locator('#reg-name').inputValue(),'სატესტო პირი');
 await p.getByRole('button',{name:'კომპანია ვარ',exact:true}).click();assert.equal(await p.locator('#reg-email').inputValue(),'kept@example.test');
 await p.goto(origin+'/account/?role=company&next=/offers/new/?requestId=x');await p.locator('#login-email').waitFor();await shot('role-company-login',390);
 await p.goto(origin+'/account/?intent=offer&context='+encodeURIComponent('სატესტო მოთხოვნის სათაური')+'&next=/offers/new/?requestId=x');await p.locator('#login-email').waitFor();
 assert.equal(await p.locator('#auth-title').innerText(),'შედით, რომ გაგზავნოთ შეთავაზება');await shot('offer-context-login',390);
 await p.locator('.auth-registration').getByRole('button',{name:'დაარეგისტრირეთ კომპანია',exact:true}).click();await p.locator('#reg-company').waitFor();assert(new URL(p.url()).searchParams.get('next'));
 console.log('PASS registration validation, role retention, login mode, offer context');
 }
 if(process.env.PROFILE_ONLY) await context.request.post('http://localhost:4407/sign-in/email',{data:{email:ledger.accounts.owner_company.email,password:'local-test-only'}});
 else { await p.goto(origin+'/account/');await p.locator('#login-email').fill(ledger.accounts.owner_company.email);await p.locator('#login-password').fill(ledger.accounts.owner_company.password);await p.locator('form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:60000});}

 console.log('PROFILE open');await p.goto(origin+'/account/?tab=profile');await p.locator('#about').waitFor();
 const original=originalAbout=await p.locator('#about').inputValue();
 for(const width of [1440,390,360]){await p.evaluate(()=>scrollTo(0,0));await shot('profile',width);const box=await p.locator('.ma-form-bar').boundingBox();assert(box.y+box.height<=901,'save bar in viewport');}
 const before=writes;await p.locator('.ma-form-bar button').click();assert.equal(writes,before,'unchanged profile makes no write');
 await p.locator('#about').fill(original+' QA');await p.locator('.company-profile-sections').getByRole('link',{name:'პროდუქტები',exact:true}).click();await p.locator('#profile-unsaved[open]').waitFor();await shot('unsaved-sheet',390,false);
 await p.locator('#profile-unsaved').getByRole('button',{name:'დარჩით',exact:true}).click();await p.locator('#profile-unsaved[open]').waitFor({state:'hidden'});assert.equal(await p.locator('#about').inputValue(),original+' QA');
 await p.getByRole('navigation',{name:'ანგარიშის განყოფილებები'}).getByRole('link',{name:'დაფა',exact:true}).click();await p.locator('#profile-unsaved[open]').waitFor();await p.locator('#profile-unsaved').getByRole('button',{name:'უარყავით',exact:true}).click();await p.locator('#about').waitFor({state:'hidden'});
 await p.goto(origin+'/account/?tab=profile');await p.locator('#about').waitFor();assert.equal(await p.locator('#about').inputValue(),original);
 await p.locator('#about').fill(original+' QA');await p.locator('.ma-form-bar button').click();await p.getByRole('status').filter({hasText:'შენახულია'}).first().waitFor();await shot('profile-saved',390);
 await p.locator('#about').fill(original);await p.locator('.company-profile-sections').getByRole('link',{name:'იურიდიული მონაცემები',exact:true}).click();await p.locator('#profile-unsaved[open]').waitFor();await p.locator('#profile-unsaved').getByRole('button',{name:'შეინახეთ',exact:true}).click();await p.locator('#legal-legal_name').waitFor();
 for(const width of [1440,390,360]) await shot('legal',width);
 const position=originalPosition=await p.locator('#legal-contact_position').inputValue();await p.locator('#legal-contact_position').fill(position+' QA');await p.locator('.ma-form-bar button').click();await p.getByRole('status').filter({hasText:'შენახულია'}).first().waitFor();await p.locator('#legal-contact_position').fill(position);await p.locator('.ma-form-bar button').click();await p.getByRole('status').filter({hasText:'შენახულია'}).first().waitFor();
 await p.locator('.company-profile-sections').getByRole('link',{name:'დოკუმენტები',exact:true}).click();await p.getByRole('heading',{name:'რეგისტრაციის ამონაწერი',exact:true}).waitFor();await shot('documents',390);
 await p.locator('.company-profile-sections').getByRole('link',{name:'მონაცემები და ფოტოები',exact:true}).click();await p.locator('#about').waitFor();await p.getByRole('button',{name:'შეცვალეთ კონტაქტი',exact:true}).click();await p.locator('#contact-email').waitFor();await shot('contact-sheet',390,false);
 await p.locator('#contact-email').fill(marker+'@meetany.local');await p.getByRole('button',{name:'გაგზავნეთ მოთხოვნა',exact:true}).click();await p.getByRole('status').filter({hasText:'მოთხოვნა გაგზავნილია'}).waitFor();
 await p.getByRole('button',{name:'შეცვალეთ კონტაქტი',exact:true}).click();await p.locator('#contact-email').fill('e2e-contact-again@meetany.local');await p.getByRole('button',{name:'გაგზავნეთ მოთხოვნა',exact:true}).click();await p.getByRole('alert').filter({hasText:'მოთხოვნა უკვე გაგზავნილია'}).waitFor();await shot('contact-duplicate',390,false);
 assert.deepEqual(errors,[]);console.log('PASS profile guard stay/discard/save, no-op, legal save, documents, contact request/duplicate');
} finally {
 await browser.close();
 const {default:pg}=await import('pg'); const sql=new pg.Client({connectionString:'postgresql://localhost/meetany_preview_1791892006000'}); await sql.connect();
 try {
  await sql.query("delete from meetany_private.reports where target_kind='contact_change' and reporter_id=(select id from public.profiles where email=$1) and body like $2",[ledger.accounts.owner_company.email,'%'+marker+'%']);
  if(originalAbout!==undefined)await sql.query('update public.profiles set about=$1 where email=$2 and about=$3',[originalAbout,ledger.accounts.owner_company.email,originalAbout+' QA']);
  if(originalPosition!==undefined)await sql.query('update public.profiles set contact_position=$1 where email=$2 and contact_position=$3',[originalPosition||null,ledger.accounts.owner_company.email,(originalPosition+' QA').trim()]);
 } finally {await sql.end();}
}

