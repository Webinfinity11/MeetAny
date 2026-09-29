import { chromium } from 'playwright';
import fs from 'node:fs';
const base='http://localhost:3001', out='qa/shots/accept-0924/v2';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function ready(p){await p.waitForFunction(()=>(document.querySelector('main')?.innerText.length||0)>20&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება'),null,{timeout:60000});await p.evaluate(()=>document.fonts.ready);await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('main img')].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}))});await p.waitForTimeout(800);}
const mask=p=>p.evaluate(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(/\+?\d[\d\s\-()]{6,}/.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/\d/g,'•')}document.querySelectorAll('a[href^="tel:"]').forEach(a=>a.setAttribute('href','tel:•'))});
const geo=()=>{const m=document.querySelector('main');const rows=[...m.querySelectorAll('article,a[href*="/requests/view"]')].slice(0,14).map(e=>{const r=e.getBoundingClientRect();return [e.tagName,Math.round(r.x),Math.round(r.y+scrollY),Math.round(r.width),Math.round(r.height)]});
 const bg=new Set(),rad=new Set(),sh=new Set();let grad=0,eyebrow=[];m.querySelectorAll('*').forEach(e=>{const s=getComputedStyle(e);if(s.backgroundImage.includes('gradient'))grad++;if(s.borderRadius!=='0px')rad.add(s.borderRadius);if(s.boxShadow!=='none')sh.add(s.boxShadow.slice(0,50));if(s.backgroundColor!=='rgba(0, 0, 0, 0)')bg.add(s.backgroundColor)});
 return {h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,vw:innerWidth,rows,grad,rad:[...rad],sh:[...sh],bg:[...bg],font:getComputedStyle(document.body).fontFamily.slice(0,40),tabnum:getComputedStyle(m).fontVariantNumeric,
 h1:(()=>{const e=document.querySelector('h1');if(!e)return null;const r=e.getBoundingClientRect();return [e.innerText.slice(0,60),Math.round(r.x),Math.round(r.y)]})(),text:m.innerText.replace(/\d{6,}/g,'•').slice(0,3800)}};
const info={};const _g=async(p,u)=>p.goto(u,{waitUntil:'domcontentloaded',timeout:120000});
for(const [w,h] of [[1440,1000],[390,844]]){
 const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();
 // requests
 await _g(p,base+'/requests/');await ready(p);
 await p.screenshot({path:`${out}/requests-${w}.png`,fullPage:true});
 info['requests'+w]=await p.evaluate(geo);
 const href=await p.evaluate(()=>document.querySelector('main a[href*="/requests/view"]')?.href);
 info['reqHref']=href;
 await _g(p,href);await ready(p);await mask(p);
 await p.screenshot({path:`${out}/request-view-${w}.png`,fullPage:true});info['reqview'+w]=await p.evaluate(geo);
 await _g(p,base+'/requests/');await ready(p);
 const tab=p.getByRole('tab',{name:/ახალი/}).or(p.getByRole('button',{name:/^ახალი/})).first();
 if(await tab.count()){await tab.click();await p.waitForTimeout(900);await p.screenshot({path:`${out}/requests-new-tab-${w}.png`,fullPage:true});info['reqnew'+w]=await p.evaluate(geo);}
 await _g(p,base+'/requests/');await ready(p);
 const s=p.locator('main input[type=search],main input[type=text],main input:not([type])').first();
 if(await s.count()){await s.fill('ქსქსქს');await p.waitForTimeout(1300);await p.screenshot({path:`${out}/requests-empty-${w}.png`,fullPage:true});info['reqempty'+w]=await p.evaluate(()=>document.querySelector('main').innerText.slice(0,800));}
 // companies
 await _g(p,base+'/companies/');await ready(p);
 await p.screenshot({path:`${out}/companies-${w}.png`,fullPage:true});
 info['companies'+w]=await p.evaluate(geo);
 const chref=await p.evaluate(()=>document.querySelector('main a[href*="/companies/view"]')?.href);info.compHref=chref;
 if(w==1440){
  const call=p.getByRole('button',{name:/ნომრის ნახვა/}).first();info.hasCall=await call.count();
  if(info.hasCall){await call.click();await p.waitForTimeout(1500);await mask(p);await p.screenshot({path:`${out}/companies-phone-open-1440.png`,fullPage:true});info.phoneRow=await p.evaluate(()=>document.querySelector('main article')?.innerText.replace(/\d/g,'•'));}
  await _g(p,base+'/companies/');await ready(p);
  const f=p.locator('main button:visible, main a:visible').filter({hasText:/^\s*მშენებლობა/}).first();
  if(await f.count()){await f.click();await p.waitForTimeout(1200);await p.screenshot({path:`${out}/companies-filter-1440.png`,fullPage:true});info.filter=await p.evaluate(geo);}
 }
 if(w==390){
  await _g(p,base+'/companies/');await ready(p);
  const trig=p.locator('main button:visible').filter({hasText:/ფილტრ/}).first();info.trig=await trig.count();
  if(info.trig){await trig.click();await p.waitForTimeout(900);await p.screenshot({path:`${out}/companies-sheet-390.png`});info.sheet=await p.evaluate(()=>document.querySelector('[role=dialog]')?.innerText.slice(0,900)||'no dialog');}
 }
 await _g(p,base+'/companies/');await ready(p);
 const s2=p.locator('main input').first();
 if(await s2.count()){await s2.fill('ქსქსქს');await p.waitForTimeout(1300);await p.screenshot({path:`${out}/companies-empty-${w}.png`,fullPage:true});info['compempty'+w]=await p.evaluate(()=>document.querySelector('main').innerText.slice(0,800));}
 await _g(p,chref);await ready(p);await mask(p);
 await p.screenshot({path:`${out}/company-view-${w}.png`,fullPage:true});info['compview'+w]=await p.evaluate(geo);
 await ctx.close();
}
fs.writeFileSync(`${out}/info.json`,JSON.stringify(info,null,1));
await b.close();
