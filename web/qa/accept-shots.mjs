import { chromium } from 'playwright';
import fs from 'node:fs';
const base='http://localhost:3001', out='qa/shots/accept-0924';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function ready(p){await p.waitForFunction(()=>(document.querySelector('main')?.innerText.length||0)>20&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება'),null,{timeout:60000});await p.evaluate(()=>document.fonts.ready);await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('main img')].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}))});await p.waitForTimeout(600);}
const info={};
for(const [w,h] of [[1440,1000],[390,844]]){
 const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();
 await p.goto(base+'/requests/');await ready(p);
 await p.screenshot({path:`${out}/requests-${w}.png`,fullPage:true});
 info['list'+w]=await p.evaluate(()=>{const m=document.querySelector('main');return {h:document.documentElement.scrollHeight,text:m.innerText.slice(0,3500),links:[...document.querySelectorAll('a[href*="/requests/view"]')].slice(0,3).map(a=>a.href),
 rows:[...document.querySelectorAll('main a[href*="/requests/view"], main article')].slice(0,12).map(e=>{const r=e.getBoundingClientRect();return [e.className.slice(0,40),Math.round(r.x),Math.round(r.y+scrollY),Math.round(r.width),Math.round(r.height)]})}});
 const href=info['list'+w].links[0];
 if(href){await p.goto(href);await ready(p);await p.screenshot({path:`${out}/request-view-${w}.png`,fullPage:true});
  info['view'+w]=await p.evaluate(()=>({h:document.documentElement.scrollHeight,url:location.href,text:document.querySelector('main').innerText.slice(0,3500)}));}
 if(w==1440){
  await p.goto(base+'/requests/');await ready(p);
  const tab=p.getByRole('tab',{name:/ახალი/}).or(p.getByRole('button',{name:/^ახალი/})).first();
  if(await tab.count()){await tab.click();await p.waitForTimeout(800);await p.screenshot({path:`${out}/requests-new-tab-1440.png`,fullPage:true});}
  await p.goto(base+'/requests/');await ready(p);
  const s=p.locator('input[type=search],input[placeholder*="ძიებ"],input[type=text]').first();
  if(await s.count()){await s.fill('ქსქსქს');await p.waitForTimeout(1200);await p.screenshot({path:`${out}/requests-empty-1440.png`,fullPage:true});info.empty=await p.evaluate(()=>document.querySelector('main').innerText.slice(0,800));}
  await p.goto(base+'/requests/');await ready(p);
  const sel=p.locator('main select').first();
  if(await sel.count()){const opts=await sel.locator('option').allTextContents();info.opts=opts;await sel.selectOption({index:Math.min(2,opts.length-1)});await p.waitForTimeout(1000);await p.screenshot({path:`${out}/requests-filter-1440.png`,fullPage:true});}
  const c2=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const p2=await c2.newPage();await p2.goto(base+'/requests/');await ready(p2);await p2.screenshot({path:`${out}/requests-reduced-1440.png`});
 }
}
fs.writeFileSync(`${out}/info.json`,JSON.stringify(info,null,1));
await b.close();
