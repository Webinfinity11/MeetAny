// Public layout, theme and header checks; loopback JWT fixture only, no database writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require=createRequire(import.meta.url);
const BASE=process.env.BASE||'http://127.0.0.1:3442';
const AUTH=process.env.AUTH||'http://127.0.0.1:4442';
assert([BASE,AUTH].every(x=>['127.0.0.1','localhost'].includes(new URL(x).hostname)));
const OUT='qa/LAYOUT-2026-10-14/home/after';
const homeOnly=process.env.HOME_ONLY==='1';
const reportFile=homeOnly?'verify-home.json':'verify.json';
const report={pages:[],overlays:[],checks:[],pageErrors:[]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function context(role='guest',theme='blue'){
 const id='74cc28fc-47de-45cb-9563-93735b86855e';
 const token=role==='guest'?null:(await(await fetch(`${AUTH}/__mint?sub=${id}`)).json()).token;
 const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await c.route(`${AUTH}/**`,r=>r.request().url().includes('/.well-known/')?r.continue():r.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt',...(token?{'set-auth-jwt':token}:{})},json:r.request().url().includes('/get-session')?(token?{user:{id,email:'qa@local.test',name:'QA'}}:null):{token}}));
 await c.route(/https:\/\/.*\/auth\//,r=>r.abort());
 await c.addInitScript(({signedIn,theme})=>{if(signedIn)localStorage.setItem('meetany.session','1');if(!localStorage.getItem('meetany.theme'))localStorage.setItem('meetany.theme',theme)}, {signedIn:!!token,theme});
 return c;
}
async function goto(p,path){
 await p.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
 await p.locator('main').waitFor();
 await p.waitForFunction(()=>[...document.querySelectorAll('header a[href="/account/"]')].some(e=>e.textContent.includes('შესვლა'))||document.querySelector('header button[aria-controls="ma-account-menu"]'),null,{timeout:30000});
 await p.evaluate(()=>document.fonts.ready);
 await p.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
 await p.addStyleTag({content:'nextjs-portal{display:none}'});
}
async function axe(p){
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 return p.evaluate(async()=> (await window.axe.run({runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
}
async function menu(p,width,role){
 // IDs are read from the visible controls so mobile drawer naming stays implementation-owned.
 const openers=width<768?p.locator('header button[aria-haspopup="dialog"]'):p.locator('header button[aria-controls="notification-list"],header button[aria-controls="ma-account-menu"]');
 for(const opener of await openers.all()){
  if(!await opener.isVisible())continue;
  const id=await opener.getAttribute('aria-controls');
  await opener.focus();await p.keyboard.press('Enter');
  const panel=p.locator(`#${id}`);await panel.waitFor({state:'visible'});
  await p.waitForTimeout(300);
  const hits=await panel.evaluate(el=>{const r=el.getBoundingClientRect(),hits=new Set();for(let y=r.top+8;y<Math.min(innerHeight,r.bottom)-4;y+=14)for(let x=r.left+8;x<Math.min(innerWidth,r.right)-4;x+=24){const hit=document.elementFromPoint(x,y);if(hit&&!el.contains(hit))hits.add(hit.tagName+'.'+String(hit.className).slice(0,50))}return [...hits]});
  assert.equal(hits.length,0,`overlay ${id}: ${hits}`);
  const modal=await panel.evaluate(el=>el.matches(':modal'));
  if(modal){
   const count=await panel.locator('a[href],button,input,select,[tabindex="0"]').count();
   for(let i=0;i<count+2;i++){await p.keyboard.press('Tab');assert(await panel.evaluate(el=>el.contains(document.activeElement)),'drawer focus containment');}
   await p.keyboard.press('Shift+Tab');assert(await panel.evaluate(el=>el.contains(document.activeElement)));
  }
  const violations=await axe(p);assert.equal(violations.length,0,JSON.stringify(violations));
  if(width===390)await p.screenshot({path:`${OUT}/menu-${role}-${id}-390.png`});
  await p.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  assert(await opener.evaluate(el=>el===document.activeElement)),'focus returns';
  report.overlays.push({role,width,id,overlaps:hits.length,keyboard:true});
 }
}
try{
 for(const theme of ['blue','classic']){
  const c=await context('guest',theme);const p=await c.newPage();
  p.on('pageerror',e=>report.pageErrors.push(e.message));
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:width<768?844:1000});
   for(const path of (homeOnly?['/']:['/','/how-it-works/','/terms/','/ideas/','/density-missing-page/'])){
    await goto(p,path);
    const dimensions=await p.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),heroStatsBottom:document.querySelector('[aria-label="MeetAny რიცხვებში"]')?.getBoundingClientRect().bottom}));
    assert.equal(dimensions.overflow,0,`${width} ${path} overflow`);
    const violations=await axe(p);assert.equal(violations.length,0,JSON.stringify({width,path,violations}));
    report.pages.push({theme,width,path,...dimensions,seriousCritical:violations.length});
    console.log(theme,width,path,dimensions.height);
    if(theme==='blue'&&width===390&&path==='/ideas/'){const href=await p.locator('.idea-card h2 a').first().getAttribute('href');await goto(p,href);assert.equal((await axe(p)).length,0);assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);await p.screenshot({path:`${OUT}/idea-detail-390.png`,fullPage:true});report.checks.push('idea detail: link, axe, overflow');}
    if(theme==='blue'&&width===390&&path==='/'){
     assert(dimensions.heroStatsBottom<=844,'real counters in first screen');
     await p.screenshot({path:`${OUT}/hero-390.png`});
     await menu(p,width,'guest');
    }
   }
  }
  await goto(p,'/');
  const toggle=p.locator('footer .ma-theme-toggle');
  const before=await p.locator('html').getAttribute('data-theme');
  await toggle.focus();await p.keyboard.press('Enter');
  await p.waitForFunction(prev=>document.documentElement.dataset.theme!==prev,before);
  const after=await p.locator('html').getAttribute('data-theme');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(t=>document.documentElement.dataset.theme===t,after);
  report.checks.push(`${theme}: keyboard toggle and reload preserve ${after}`);
  if(!homeOnly){await goto(p,'/how-it-works/');
  await p.locator('nav a[href="#suppliers"]').click();await p.waitForURL('**/how-it-works/#suppliers');
  assert.equal(new URL(p.url()).hash,'#suppliers');
  await p.locator('details summary').first().click();assert(await p.locator('details').first().getAttribute('open')!==null);
  await goto(p,'/terms/');await p.locator('nav a[href="#privacy"]').click();await p.waitForURL('**/terms/#privacy');assert.equal(new URL(p.url()).hash,'#privacy');
  report.checks.push(`${theme}: how/terms anchors and FAQ`);}
  if(theme==='classic'){await p.setViewportSize({width:1440,height:1000});await goto(p,'/companies/');await p.locator('header a[href="/account/"]').filter({hasText:'შესვლა'}).waitFor({timeout:30000});assert.equal((await axe(p)).length,0);report.checks.push('classic 1440 companies: standard audit timeout retry passed');}
  await c.close();
 }
 if(!homeOnly){const c=await context('company');const p=await c.newPage();p.on('pageerror',e=>report.pageErrors.push(e.message));
 for(const width of [390,980,1440]){
  await p.setViewportSize({width,height:844});
  for(const path of ['/','/how-it-works/','/terms/']){
   await goto(p,path);await p.locator('header button[aria-controls="ma-account-menu"]').waitFor({state:'attached'});await menu(p,width,'company');
  }
 }
 await c.close();}assert.equal(report.pageErrors.length,0);
 console.log('overlaps: 0; serious/critical: 0; overflow: 0; pageerror: 0');
}finally{fs.writeFileSync(`${OUT}/${reportFile}`,JSON.stringify(report,null,2)+'\n');await browser.close();}
