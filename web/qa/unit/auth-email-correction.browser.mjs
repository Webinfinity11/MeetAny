// UI regression for an unverified signup; auth responses are intercepted, no remote account is created.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:390,height:900}});
const pending={role:'company',company:'სატესტო კომპანია',name:'საკონტაქტო პირი',phone:'+995 599 123 456',email:'typo@example.test',city:'tbilisi',industry:'food_fresh',acceptTerms:true};
const submissions=[];
try {
 await context.addInitScript(p=>{if(!sessionStorage.getItem('qa-email-seeded')){sessionStorage.setItem('meetany.pendingProfile',JSON.stringify(p));sessionStorage.setItem('qa-email-seeded','1');}},pending);
 await context.route('**/get-session',r=>r.fulfill({json:null}));
 await context.route('**/sign-up/email',r=>{submissions.push(r.request().postDataJSON());return r.fulfill({json:{user:{id:'pending-user',email:submissions.at(-1).email}}});});
 const page=await context.newPage();
 await page.goto('http://localhost:3407/account/?tab=register&role=company');
 await page.getByText('typo@example.test',{exact:true}).waitFor();
 await page.getByRole('button',{name:'შეცვალეთ ელფოსტა',exact:true}).click();
 assert.equal(await page.locator('#reg-company').inputValue(),pending.company);
 assert.equal(await page.locator('#reg-name').inputValue(),pending.name);
 assert.equal(await page.locator('#reg-phone').inputValue(),pending.phone);
 assert.equal(await page.locator('#reg-email').inputValue(),pending.email);
 assert.equal(await page.locator('#reg-email').isDisabled(),false);
 assert.equal(await page.locator('#reg-terms').isChecked(),true);
 assert.equal(await page.locator('#reg-industry [aria-checked=true]').count(),1);
 assert.match(await page.locator('#reg-city').innerText(),/თბილისი/);
 await page.locator('#reg-email').fill('correct@example.test');
 await page.locator('#reg-password').fill('NewLocalPassword123!');
 await page.getByRole('button',{name:'დარეგისტრირდით',exact:true}).click();
 await page.getByText('correct@example.test',{exact:true}).waitFor();
 assert.equal(submissions.length,1);assert.equal(submissions[0].email,'correct@example.test');
 await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 await page.screenshot({path:'qa/QA-2026-10-13/shots/auth-profile/email-corrected-code-390.png',fullPage:true});
 await page.getByRole('button',{name:'შეცვალეთ ელფოსტა',exact:true}).click();
 assert.equal(await page.locator('#reg-company').inputValue(),pending.company);
 assert.equal(await page.locator('#reg-email').inputValue(),'correct@example.test');
 console.log('PASS verification recipient, email correction, preserved company fields, corrected signup recipient');
} finally {await browser.close();}
