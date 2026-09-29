import { chromium } from 'playwright';
import fs from 'node:fs';
const base='http://localhost:3001', out='qa/shots/accept-0924';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function ready(p){await p.waitForFunction(()=>(document.querySelector('main')?.innerText.length||0)>20&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება'),null,{timeout:60000});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);}
// ნომრის დაფარვა: ყველა ციფრი ტექსტში/ატრიბუტში იცვლება (მხოლოდ კადრისთვის)
const mask=p=>p.evaluate(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(/\+?\d[\d\s\-()]{6,}/.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/\d/g,'•')}});
const info={};
const geo=()=>({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,
 rows:[...document.querySelectorAll('main article')].map(a=>{const r=a.getBoundingClientRect();const q=s=>{const e=a.querySelector(s);if(!e)return null;const x=e.getBoundingClientRect();return [Math.round(x.x),Math.round(x.y-r.y),Math.round(x.width),Math.round(x.height)]};
  const btns=[...a.querySelectorAll('button,a')].map(e=>{const x=e.getBoundingClientRect();return [(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,14),Math.round(x.x),Math.round(x.y-r.y),Math.round(x.width),Math.round(x.height)]});
  const av=a.querySelector('[class*=avatar],[class*=Avatar]');return {x:Math.round(r.x),y:Math.round(r.y+scrollY),w:Math.round(r.width),h:Math.round(r.height),av:av?[...av.getBoundingClientRect().toJSON? [Math.round(av.getBoundingClientRect().x),Math.round(av.getBoundingClientRect().width)]:[],getComputedStyle(av).backgroundColor,getComputedStyle(av).color]:null,h3:q('h3'),btns}}),
 fonts:[...new Set([...document.querySelectorAll('main *')].slice(0,300).map(e=>getComputedStyle(e).fontFamily.split(',')[0]))],
 h1:(()=>{const e=document.querySelector('h1');if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),getComputedStyle(e).fontSize]})()});
for(const [w,h] of [[1440,1000],[390,844]]){
 const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();
 await p.goto(base+'/companies/');await ready(p);
 await p.screenshot({path:`${out}/companies-${w}.png`,fullPage:true});
 info['list'+w]=await p.evaluate(geo);
 info['text'+w]=await p.evaluate(()=>document.querySelector('main').innerText.slice(0,1800));
 const href=await p.evaluate(()=>document.querySelector('main a[href*="/companies/view"]')?.href);
 if(w==1440){
  // ნომრის გახსნა
  const call=p.getByRole('button',{name:/ნომრის ნახვა/}).first();await call.click();await p.waitForTimeout(1500);await mask(p);
  await p.screenshot({path:`${out}/companies-phone-open-1440.png`,fullPage:true});
  info.phoneRow=await p.evaluate(()=>{const a=document.querySelector('main article');return a.innerText.replace(/\d/g,'•')});
  // ფილტრი
  await p.goto(base+'/companies/');await ready(p);
  const fac=p.locator('main').getByText('მშენებლობა',{exact:false}).first();
  await p.locator('main button:visible, main a:visible').filter({hasText:/^\s*მშენებლობა/}).first().click();await p.waitForTimeout(1200);
  await p.screenshot({path:`${out}/companies-filter-1440.png`,fullPage:true});info.filter=await p.evaluate(()=>({url:location.href,text:document.querySelector('main').innerText.slice(0,700)}));
  // ცარიელი
  await p.goto(base+'/companies/');await ready(p);
  const s=p.locator('main input').first();await s.fill('ქსქსქს');await p.waitForTimeout(1500);
  await p.screenshot({path:`${out}/companies-empty-1440.png`,fullPage:true});info.empty=await p.evaluate(()=>document.querySelector('main').innerText.slice(0,900));
 }
 if(w==390){
  const trig=p.locator('main button:visible').filter({hasText:/ფილტრ/}).first();
  info.trig=await trig.count();
  if(info.trig){await trig.click();await p.waitForTimeout(900);await p.screenshot({path:`${out}/companies-sheet-390.png`});info.sheet=await p.evaluate(()=>document.querySelector('[role=dialog]')?.innerText.slice(0,900)||'no dialog');}
 }
 if(href){await p.goto(href);await ready(p);await mask(p);await p.screenshot({path:`${out}/company-view-${w}.png`,fullPage:true});
  info['view'+w]=await p.evaluate(()=>({url:location.href,h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,text:document.querySelector('main').innerText.replace(/\d{6,}/g,'•').slice(0,3000),
   els:[...document.querySelectorAll('main h1,main h2,main h3,main button,main a')].slice(0,40).map(e=>{const r=e.getBoundingClientRect();return [e.tagName,(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,24),Math.round(r.x),Math.round(r.y+scrollY),Math.round(r.width),Math.round(r.height)]})}));}
 await ctx.close();
}
fs.writeFileSync(`${out}/companies-info.json`,JSON.stringify(info,null,1));
await b.close();
