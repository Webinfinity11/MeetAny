import fs from 'node:fs';
import {chromium} from 'playwright';
const origin='http://localhost:3711',auth='http://127.0.0.1:3721',user='d2517b00-554d-4e6b-929a-ef3da51f3b47';
const jwt=(await(await fetch(`${auth}/__mint?sub=${user}`)).json()).token;
const browser=await chromium.launch(),results=[];
try {
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
 await context.route(`${auth}/**`,route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:route.request().url().includes('/get-session')?{user:{id:user,email:'perf@local.test',name:'perf'}}:{token:jwt}}));
 await context.addInitScript(()=>localStorage.setItem('meetany.session','1'));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin/',{waitUntil:'networkidle'});
 for(const tab of ['content','reviews','deals','contacts','photos','audit']){
  await page.getByRole('button',{name:/ადმინის განყოფილება:/}).click();
  await page.locator(`a[href="/admin/?tab=${tab}"]`).first().click();
  await page.waitForLoadState('networkidle');await page.waitForTimeout(600);
  const body=await page.locator('main').innerText();
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
  await page.screenshot({path:`qa/CLEANUP-2026-10-14/shots/admin-${tab}-390.png`,fullPage:true});
  results.push({tab,url:page.url(),overflow,errors:[...errors],body});
 }
}finally{await browser.close();}
fs.writeFileSync('qa/CLEANUP-2026-10-14/code-admin.json',JSON.stringify(results,null,2));
if(results.some(r=>r.overflow||r.errors.length))process.exitCode=1;
