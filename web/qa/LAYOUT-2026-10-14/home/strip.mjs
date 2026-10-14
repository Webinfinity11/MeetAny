// Keyboard access to all five home requests, including cards outside the horizontal viewport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result=[];
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width<768?844:1000},reducedMotion:'reduce'});
  await page.route('http://127.0.0.1:4442/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:3442','Access-Control-Allow-Credentials':'true'},json:r.request().url().includes('get-session')?null:{token:null}}));
  await page.goto('http://127.0.0.1:3442/',{waitUntil:'domcontentloaded',timeout:60000});await page.evaluate(()=>document.fonts.ready);await page.locator('.home-opportunities article h3 a').last().waitFor();
  await page.addStyleTag({content:'nextjs-portal{display:none}'});
  const links=page.locator('.home-opportunities article h3 a');assert.equal(await links.count(),5);
  await links.first().focus();
  let lastIndex=-1;
  for(let i=0;i<10;i++){
   lastIndex=await links.evaluateAll(els=>els.findIndex(el=>el===document.activeElement));
   if(lastIndex===4)break;
   await page.keyboard.press('Tab');
  }
  assert.equal(lastIndex,4,'keyboard reaches the last request');
  const visible=await links.last().evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth});assert(visible,'focus scrolls the final request into view');
  assert.equal(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);
  const strip=page.locator('.home-opportunities');await strip.evaluate(el=>el.scrollLeft=0);await page.evaluate(()=>document.activeElement?.blur());
  await strip.screenshot({path:`qa/LAYOUT-2026-10-14/home/after/requests-strip-${width}.png`});
  if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'qa/LAYOUT-2026-10-14/home/after/hero-390.png'});}
  result.push({width,requests:5,keyboard:true,focusVisible:true,overflow:0});await page.close();
 }
 fs.writeFileSync('qa/LAYOUT-2026-10-14/home/after/strip.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await browser.close();}
