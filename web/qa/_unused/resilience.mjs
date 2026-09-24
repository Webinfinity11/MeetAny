import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://localhost:3000/companies/');await p.locator('.listing-heading h3 a').first().waitFor();const companies=await p.locator('.listing-heading h3 a').evaluateAll(es=>es.slice(0,2).map(e=>({href:e.getAttribute('href'),name:e.textContent})));assert.equal(companies.length,2);
 await p.goto('http://localhost:3000'+companies[0].href);await p.locator('.company-profile-contact button').click();await p.locator('.company-profile-contact a').waitFor();const oldPhone=await p.locator('.company-profile-contact a').getAttribute('href');
 let release;const gate=new Promise(r=>release=r);let delayed=false;
 await p.route('**/api/db/profiles?**',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('select')==='id,phone'){delayed=true;await gate;}await route.continue();});
 await p.evaluate(href=>history.pushState(null,'',href),companies[1].href);await p.getByRole('heading',{name:companies[1].name,exact:true}).waitFor();assert.equal(await p.locator('.company-profile-contact a').count(),0);release();await p.locator('.company-profile-contact button').click();await p.locator('.company-profile-contact a').waitFor();assert(delayed);assert.notEqual(await p.locator('.company-profile-contact a').getAttribute('href'),oldPhone);await p.unrouteAll({behavior:'wait'});
 await p.goto('http://localhost:3000/companies/view/?id=missing');await p.getByRole('heading',{name:'კომპანია ვერ მოიძებნა'}).waitFor();assert.equal(await p.locator('main a[href^="tel:"]').count(),0);console.log('PASS contact cannot leak across profile navigation, missing profile');
 await p.route('**/api/db/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA temporary failure'})}));await p.goto('http://localhost:3000/requests/');await p.getByRole('alert').filter({hasText:'სერვისი დროებით მიუწვდომელია'}).waitFor();await p.unrouteAll({behavior:'wait'});await p.getByRole('button',{name:'ხელახლა ცდა',exact:true}).click();await p.locator('main article').first().waitFor();console.log('PASS unavailable service retry recovers');assert.deepEqual(errors,[]);
}finally{await browser.close();}
