import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(), errors=[], sessions=[];
page.on('response',async r=>{if(r.url().endsWith('/get-session'))console.log('session response',r.status(),(await r.json())===null?'null':'object');});
page.on('requestfailed',r=>console.log('failed',new URL(r.url()).pathname,r.failure()));
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/get-session'))sessions.push(r.url());});
const origin='http://localhost:3701',key='meetany.session.v1';
const paths=['/','/requests/','/companies/','/how-it-works/','/terms/','/requests/view/?id=','/companies/view/?id=','/requests/','/','/companies/'];
const navigations=[];
try{
 for(const path of paths){
  await page.goto(origin+path,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__meetanySessionCache?.read()?.guest===true).catch(async e=>{console.log(await page.evaluate(()=>({cache:sessionStorage.getItem('meetany.session.v1'),preload:!!window.__meetanySessionCache})),sessions,errors);throw e;});
  navigations.push({path,calls:sessions.length});
 }
 assert(sessions.length<=2);const after=sessions.length;
 const second=await context.newPage();await second.goto(origin+'/terms/',{waitUntil:'networkidle'});
 await second.evaluate(()=>localStorage.setItem('meetany.session.v1.revision','x'));
 await page.waitForFunction(key=>sessionStorage.getItem(key)===null,key);
 const invalidated=true;await page.goto(origin+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__meetanySessionCache?.read()?.guest===true);
 assert.equal(sessions.length,after+1);await second.close();
 const widths=[];
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:1000});
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
  await page.screenshot({path:`qa/p7-session-cache/shots/home-${width}.png`,fullPage:true});
  widths.push({width,overflow});assert.equal(overflow,0);
 }
 assert.deepEqual(errors,[]);
 const result={before:10,after,afterInvalidation:sessions.length,invalidated,navigations,widths,pageerrors:errors};
 await writeFile('qa/p7-session-cache/browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
