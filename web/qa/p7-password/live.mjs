// Explicitly authorized same-value password change; credentials are read only from the local ledger.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const row=fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').split('\n').find(l=>l.includes('| demo-hotel@meetany.ge |'));
const parts=row.split('|').map(x=>x.trim().replace(/^`|`$/g,'')),email=parts[2],password=parts[3];
const results={account:'demo client (hotel)',responses:[],pageerrors:[],stage:'start'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
page.on('pageerror',e=>results.pageerrors.push(e.name));
const responseTasks=[];page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.endsWith('/sign-in/email')||path.endsWith('/change-password'))responseTasks.push((async()=>{const data=await r.json().catch(()=>({}));results.responses.push({path,status:r.status(),...(r.ok()?{}:{code:data.code,message:data.message})});})());});
try {
 results.stage='login';await page.goto('http://localhost:3707/account/?tab=profile');
 await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);
 await page.locator('form').filter({has:page.locator('#login-email')}).locator('button[type=submit]').click();
 await page.locator('#password-current').waitFor({timeout:30000});
 await context.storageState({path:'/tmp/p7-password-client.json'});fs.chmodSync('/tmp/p7-password-client.json',0o600);
 results.stage='same-value change';
 for(const id of ['current','new','repeat'])await page.locator(`#password-${id}`).fill(password);
 await page.locator('#account-password button[type=submit]').click();
 await page.getByText('პაროლი შეიცვალა.',{exact:true}).waitFor({timeout:20000});
 results.toast=true;for(const id of ['current','new','repeat'])assert.equal(await page.locator(`#password-${id}`).inputValue(),'');results.fieldsCleared=true;
 assert.ok(await page.locator('header [aria-controls=ma-account-menu]').isVisible());results.headerSignedIn=true;
 await page.screenshot({path:'qa/p7-password/shots/live-success-1440.png',fullPage:true});
 results.stage='refresh';await page.reload();await page.locator('#password-current').waitFor();assert.ok(await page.locator('header [aria-controls=ma-account-menu]').isVisible());results.signedInAfterRefresh=true;
 results.stage='wrong-current';await page.locator('#password-current').fill('deliberately-wrong-current');await page.locator('#password-new').fill(password);await page.locator('#password-repeat').fill(password);
 await page.locator('#account-password button[type=submit]').click();await page.locator('#password-current-error').waitFor({timeout:20000});
 assert.equal(await page.locator('#password-current-error').innerText(),'მიმდინარე პაროლი არასწორია.');await page.waitForFunction(()=>document.activeElement.id==='password-current');results.wrongCurrentInline=true;results.focus=true;
 await page.screenshot({path:'qa/p7-password/shots/live-invalid-1440.png',fullPage:true});
 results.overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));results.stage='complete';
} catch(e){results.failure={name:e.name,stage:results.stage};process.exitCode=1;}
finally{await Promise.all(responseTasks);fs.writeFileSync('qa/p7-password/live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();}
