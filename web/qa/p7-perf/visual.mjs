import fs from 'node:fs';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:3708',auth='http://127.0.0.1:3718';
const user='bacf1572-7493-4ac9-bfc7-95719e911c4c';
const browser=await chromium.launch();
const results=[];
try {
 for(const role of ['guest','client']) for(const width of [1440,390,360]) {
  const jwt=role==='client'?(await(await fetch(`${auth}/__mint?sub=${user}`)).json()).token:null;
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route(`${auth}/**`,route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true',...(jwt?{'set-auth-jwt':jwt}:{})},json:route.request().url().endsWith('/get-session')?(jwt?{user:{id:user,email:'perf@local.test',name:'perf'}}:null):{token:jwt}}));
  if(jwt)await context.addInitScript(()=>localStorage.setItem('meetany.session','1'));
  await context.addInitScript(()=>{window.__lcpElement=null;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcpElement={tag:e.element?.tagName,class:e.element?.className,text:e.element?.textContent?.slice(0,120),url:e.url,time:e.startTime};}).observe({type:'largest-contentful-paint',buffered:true});});
  const page=await context.newPage();
  for(const [name,path] of [['request',`/requests/view/?id=${role==='guest'?'012ca27c-5913-46e2-899f-254785bd3d23':'0101aaac-f4e6-4ed4-b1bd-5a52e0942db9'}`],['company','/companies/view/?id=74cc28fc-47de-45cb-9563-93735b86855e']]) {
   const errors=[]; const onError=e=>errors.push(e.message);page.on('pageerror',onError);
   await page.goto(origin+path,{waitUntil:'networkidle'});
   await page.locator('main h1').waitFor();
   await page.waitForTimeout(400);
   const data=await page.evaluate(()=>({title:document.querySelector('main h1')?.textContent,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),lcp:window.__lcpElement,busy:document.querySelectorAll('[aria-busy="true"],.ma-loading__panel,.ma-skel').length,body:document.querySelector('main')?.innerText}));
   await page.screenshot({path:`qa/p7-perf/shots/${role}-${name}-${width}.png`,fullPage:true});
   results.push({role,width,name,...data,errors});page.off('pageerror',onError);
  }
  await context.close();
 }
} finally {await browser.close();}
fs.writeFileSync('qa/p7-perf/visual.json',JSON.stringify(results,null,2));
if(results.some(r=>r.overflow||r.errors.length||r.busy))process.exitCode=1;
