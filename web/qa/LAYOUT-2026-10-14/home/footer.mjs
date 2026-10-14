// Reproduce old footer geometry in-page, then measure the live footer. No app or database writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE=process.env.BASE || 'http://127.0.0.1:3442';
const OUT='qa/LAYOUT-2026-10-14/home/after';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result=[];
try {
 for(const width of [1440,390,360,320]) {
  const page=await browser.newPage({viewport:{width,height:width<768?844:1000}});
  await page.route(/https:\/\/.*\/auth\//,r=>r.abort());
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'nextjs-portal{display:none}'});
  const footer=page.locator('footer').last();
  const beforeStyle=await page.addStyleTag({content:`footer [class*="_top_"]{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;grid-template-areas:none;gap:48px;padding-block:56px} footer [class*="_top_"]>*{grid-area:auto!important} footer [class*="_brand_"] p{margin-top:16px} footer [class*="_bottom_"]{padding-block:20px} footer [class*="_bottom_"]>div{flex-wrap:wrap;gap:8px 24px} footer [class*="_bottom_"]>div>span{max-width:none}@media(max-width:767px){footer [class*="_top_"]{grid-template-columns:1fr;gap:32px}}`});
  const before=Math.round((await footer.boundingBox()).height);
  await beforeStyle.evaluate(el=>el.remove());
  const after=Math.round((await footer.boundingBox()).height);
  const links=await footer.locator('a').evaluateAll(els=>els.map(el=>({text:el.textContent,height:el.getBoundingClientRect().height})));
  assert(links.every(x=>x.height>=44),'footer touch targets');
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
  assert.equal(overflow,0);
  await footer.screenshot({path:`${OUT}/footer-${width}.png`});
  if(width===390){
   const toggle=footer.locator('.ma-theme-toggle');
   await toggle.click();
   await page.waitForFunction(()=>document.documentElement.dataset.theme==='classic');
   await footer.screenshot({path:`${OUT}/footer-classic-390.png`});
  }
  result.push({width,before,after,overflow,links});
  await page.close();
 }
 fs.writeFileSync(`${OUT}/footer.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result.map(({width,before,after,overflow})=>({width,before,after,overflow})),null,2));
} finally {await browser.close();}
