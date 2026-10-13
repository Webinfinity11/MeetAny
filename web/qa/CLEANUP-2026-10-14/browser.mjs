// Local fixture only. Read-only navigation; no production Auth calls.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out='qa/CLEANUP-2026-10-14', origin='http://localhost:3710', auth='http://127.0.0.1:3720';
const publicAuth=fs.readFileSync('.env.local','utf8').match(/^NEXT_PUBLIC_NEON_AUTH_BASE_URL=["']?([^\n"']+)/m)?.[1]?.trim() || auth;
const admin='d2517b00-554d-4e6b-929a-ef3da51f3b47';
fs.mkdirSync(`${out}/shots`,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=process.env.QA_RESUME ? JSON.parse(fs.readFileSync(`${out}/browser.json`,'utf8')) : [];
try {
 await Promise.all([1440,390,360].map(async width => {
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  let signedIn=false;
  const {token}=await (await fetch(`${auth}/__mint?sub=${admin}`)).json();
  await context.route(url=>url.href.startsWith(auth+'/') || url.href.startsWith(publicAuth+'/'),route=>{
   // Every browser Auth call is answered locally; server JWKS uses the fixture.
   return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt',...(signedIn?{'set-auth-jwt':token}:{})},json:route.request().url().includes('/get-session')?(signedIn?{user:{id:admin,email:'admin@gmail.com',name:'ადმინი'}}:null):{token:signedIn?token:null}});
  });
  const page=await context.newPage();
  const paths=[['home','/'],['requests','/requests/'],['companies','/companies/'],['request','/requests/view/?id=427e5d7d-fb9d-4de9-aa00-e05b8b7c8cfa'],['company','/companies/view/?id=74cc28fc-47de-45cb-9563-93735b86855e'],...['overview','users','requests','offers','reports','audit'].map(tab=>['admin-'+tab,tab==='overview'?'/admin/':`/admin/?tab=${tab}`])];
  for(const [name,path] of paths.filter(([name])=>!process.env.QA_ONLY || name.startsWith(process.env.QA_ONLY))){
   if(results.some(r=>r.name===name && r.width===width)) continue;
   if(name.startsWith('admin')&&!signedIn){ signedIn=true; await context.addInitScript(()=>{sessionStorage.removeItem('meetany.session.v1');localStorage.setItem('meetany.session','1');}); }
   const errors=[],serverErrors=[];
   const onError=e=>errors.push(e.message),onResponse=r=>{if(r.status()>=400 && r.url().startsWith(origin)) serverErrors.push({url:r.url(),status:r.status()});};
   page.on('pageerror',onError);page.on('response',onResponse);
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:120000});
   await page.locator('main').waitFor();
   await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]:not(.companies-map__canvas)'),{},{timeout:30000});
   await page.waitForTimeout(1500);
   if(name.startsWith('admin')) await page.locator('#admin-section-navigation').waitFor({state:'attached',timeout:30000});
   const metrics=await page.evaluate(()=>({overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),title:document.title,text:document.querySelector('main')?.innerText.slice(0,250)}));
   await page.screenshot({path:`${out}/shots/${name}-${width}.png`,fullPage:true,animations:'disabled'});
   results.push({name,path,width,status:response.status(),errors,serverErrors,...metrics});
   fs.writeFileSync(`${out}/browser.json`,JSON.stringify(results,null,2)+'\n');
   console.log(name,width,response.status(),metrics.text.slice(0,65),'errors',errors.length,'500',serverErrors.length,'overflow',metrics.overflow);
   page.off('pageerror',onError);page.off('response',onResponse);
  }
  // Exercise admin navigation via a real click (mobile section switcher then users).
  if(width<768) await page.getByRole('button',{name:/ადმინის განყოფილება/}).click();
  await page.locator('#admin-section-navigation a[href="/admin/?tab=users"]').click();
  await page.waitForURL('**/admin/?tab=users');
  await context.close();
 }));
} finally {await browser.close();fs.writeFileSync(`${out}/browser.json`,JSON.stringify(results,null,2)+'\n');}
if(results.length!==33||results.some(r=>r.status!==200||r.errors.length||r.serverErrors.length||r.overflow)) process.exitCode=1;
