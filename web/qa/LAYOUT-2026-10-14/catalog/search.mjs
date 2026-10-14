import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:3441', AUTH='http://127.0.0.1:4441';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}), context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route(`${AUTH}/**`,r=>r.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true'},json:r.request().url().includes('get-session')?null:{token:null}}));
await context.route(/https:\/\/.*\/auth\//,r=>r.abort());const p=await context.newPage();const result=[];
try{
 for(const slug of ['requests','companies']){
  await p.goto(`${BASE}/${slug}/`);const cards=p.locator('.catalog-main article');await cards.first().waitFor();const title=await cards.first().locator('h3').innerText();const query=p.locator(slug==='requests'?'#query':'#company-query');await query.fill(title);await p.waitForURL(u=>u.searchParams.get('q')===title);await p.waitForFunction(()=>document.querySelectorAll('.catalog-main article').length===1);await query.fill('');await p.waitForURL(u=>!u.searchParams.has('q'));await p.waitForFunction(()=>document.querySelectorAll('.catalog-main article').length>1);
  if(slug==='requests'){await p.getByRole('button',{name:'სია',exact:true}).click();assert.equal(await cards.evaluateAll(es=>new Set(es.map(e=>e.getBoundingClientRect().x)).size),1);await p.getByRole('button',{name:'ბადე',exact:true}).click();assert.equal(await cards.evaluateAll(es=>new Set(es.map(e=>e.getBoundingClientRect().x)).size),2)}
  result.push(`${slug}: search query/filter/clear and URL state pass${slug==='requests'?'; desktop grid/list pass':''}`);
 }
 fs.writeFileSync('qa/LAYOUT-2026-10-14/catalog/after/search.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close()}
