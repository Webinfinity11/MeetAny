// Run against the local fixture at 4407 and Next at 3407 (never a remote auth service).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {chromium} from 'playwright';
const db=new pg.Client({connectionString:'postgresql://localhost/meetany_preview_1791892006000'});await db.connect();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:390,height:900}});const p=await context.newPage();
const stamp=Date.now(),email=`e2e+${stamp}@meetany.local`;let created;
try {
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname)&&route.request().method()!=='GET')throw new Error('Remote mutation forbidden');return route.continue();});
 await p.goto('http://localhost:3407/account/?tab=register&role=company',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('#reg-company').waitFor();
 await p.locator('#reg-company').fill('QA რეგისტრაცია '+stamp);await p.locator('#reg-name').fill('სატესტო პირი');await p.locator('#reg-phone').fill('+995 5'+String(stamp).slice(-8));await p.locator('#reg-email').fill(email);await p.locator('#reg-password').fill('local-e2e-password');
 await p.locator('#reg-city').click();await p.locator('#reg-city-options').getByRole('option',{name:'თბილისი',exact:true}).click();await p.locator('#reg-industry [role=radio]').first().click();await p.locator('#reg-terms').check();
 await p.locator('.auth-register button[type=submit]').click();await p.waitForURL('**/onboarding/?step=type',{timeout:60000});
 // Reloading the registration URL exercises the parent guard without a mounted submit callback.
 await p.goto('http://localhost:3407/account/?tab=register&role=company',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForURL('**/onboarding/?step=type',{timeout:60000});
 created=(await db.query('select id,role,company from public.profiles where email=$1',[email])).rows[0];assert.equal(created?.role,'company');
 await p.getByRole('heading').first().waitFor();await p.screenshot({path:'qa/QA-2026-10-13/shots/auth-profile/registered-onboarding-390.png',fullPage:true});
 fs.writeFileSync('qa/QA-2026-10-13/shots/auth-profile/registration-result.json',JSON.stringify({email,id:created.id,role:created.role,url:p.url(),localAuthFixture:true,parentRedirectAfterReload:true},null,2));
 console.log('PASS real local registration → onboarding type; registration URL reload → onboarding type');
} finally {await browser.close();await db.query('delete from neon_auth."user" where email=$1',[email]);await db.end();}
