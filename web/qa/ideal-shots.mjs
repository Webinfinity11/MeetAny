import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = path.join(import.meta.dirname, 'shots/ideal-0924');
fs.mkdirSync(out, { recursive:true });
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try {
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 for(const route of process.argv.slice(2).length ? process.argv.slice(2) : ['companies','requests']) {
  for(const [width,height] of [[1440,1000],[390,844]]) {
   await page.setViewportSize({width,height});
   await page.goto(`http://localhost:3001/${route}/`,{waitUntil:'networkidle'});
   await page.locator(route==='companies'?'.supplier-row':'.request-card').first().waitFor();
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));});
   await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
   await page.waitForTimeout(700);
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,band:document.querySelector('.catalog-header').getBoundingClientRect().height}));
   assert.equal(metrics.overflow,0);
   await page.screenshot({path:path.join(out,`${route}-${width}.png`),fullPage:true});
   if(width===390)await page.screenshot({path:path.join(out,`${route}-390-fold.png`)});
   console.log(route,width,metrics);
  }
 }
 assert.deepEqual(errors,[]);console.log('pageerror 0');
} finally {await browser.close();}
