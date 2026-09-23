import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const env=fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8');const url=env.match(/^DATABASE_URL=["']?([^\n"']+)/m)?.[1];assert(url&&/^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(url).hostname),'Only auth-probe');
const ledger=JSON.parse(fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md',import.meta.url),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
let id;let p;
try {
 p=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:3000/account/');await p.locator('#login-email').fill('demo-hotel@meetany.ge');await p.locator('#login-password').fill(ledger.accounts.hotel.password);await p.locator('form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:60000});
 await p.goto('http://localhost:3000/companies/');const button=p.getByRole('button',{name:'კომპანიის შენახვა',exact:true}).first();await button.waitFor();
 const card=button.locator('xpath=ancestor::article');id=new URL(await card.locator('a.listing-profile-link').getAttribute('href'),'http://localhost').searchParams.get('id');await button.click();await p.locator(`a.listing-profile-link[href*="${id}"]`).locator('xpath=ancestor::article').getByRole('button',{name:'შენახვის გაუქმება',exact:true}).waitFor();
 await p.reload();await p.locator(`a.listing-profile-link[href*="${id}"]`).locator('xpath=ancestor::article').getByRole('button',{name:'შენახვის გაუქმება',exact:true}).waitFor();
 for(const width of [1280,390,320]){await p.setViewportSize({width,height:900});await p.addStyleTag({content:'nextjs-portal {display:none}'});await p.screenshot({path:`/tmp/saved-live-${width}.png`,fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const cta=p.locator('.ma-header__actions .ma-header__cta');assert(await cta.evaluate(el=>el.scrollWidth<=el.clientWidth+2),'CTA text clipped');}
 await p.goto('http://localhost:3000/account/?tab=saved');await p.locator(`main a[href*="${id}"]`).waitFor();await p.screenshot({path:'/tmp/saved-account-320.png',fullPage:true});
 await p.goto('http://localhost:3000/companies/view/?id='+id);await p.getByRole('button',{name:'შენახვის გაუქმება',exact:true}).waitFor();await p.screenshot({path:'/tmp/saved-profile-320.png',fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.getByRole('button',{name:'შენახვის გაუქმება',exact:true}).click();await p.getByRole('button',{name:'კომპანიის შენახვა',exact:true}).waitFor();id=null;assert.deepEqual(errors,[]);console.log('PASS real auth-probe save, reload, account list, profile remove, 1280/390/320 and CTA text; test save removed');
} finally {
 if(id&&p){try{await p.goto('http://localhost:3000/companies/view/?id='+id);const b=p.getByRole('button',{name:'შენახვის გაუქმება',exact:true});await b.waitFor({timeout:15000});await b.click();await p.getByRole('button',{name:'კომპანიის შენახვა',exact:true}).waitFor();}catch{console.error('QA saved cleanup requires follow-up');}}
 await browser.close();
}
