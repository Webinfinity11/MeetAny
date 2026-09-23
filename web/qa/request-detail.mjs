import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 const response=await p.request.get('http://localhost:3000/api/db/requests?select=*&order=created_at.desc&limit=1');assert(response.ok());const [target]=await response.json();assert(target);
 let detailReads=0;
 await p.route('**/api/db/requests?**',async route=>{const url=new URL(route.request().url());if(url.searchParams.has('id')){detailReads++;return route.continue();}const response=await route.fetch();const rows=await response.json();await route.fulfill({response,json:rows.filter(row=>row.id!==target.id)});});
 await p.goto('http://localhost:3000/requests/view/?id='+target.id);await p.getByRole('heading',{name:target.title,exact:true}).waitFor();assert(detailReads>0);await p.locator('.ma-call').first().waitFor();console.log('PASS request absent from catalog cache opens via authorized detail query');
 await p.unrouteAll({behavior:'wait'});await p.route('**/api/db/requests?**',route=>new URL(route.request().url()).searchParams.has('id')?route.fulfill({status:503,contentType:'application/json',body:'{"message":"QA temporary failure"}'}):route.continue());await p.reload();await p.getByRole('button',{name:'ხელახლა ცდა',exact:true}).waitFor();await p.unrouteAll({behavior:'wait'});await p.getByRole('button',{name:'ხელახლა ცდა',exact:true}).click();await p.getByRole('heading',{name:target.title,exact:true}).waitFor();
 await p.goto('http://localhost:3000/requests/view/?id=missing');await p.getByRole('heading',{name:'მოთხოვნა ვერ მოიძებნა'}).waitFor();assert.deepEqual(errors,[]);console.log('PASS failed detail retry, invalid ID not-found, no page errors');
}finally{await browser.close();}
