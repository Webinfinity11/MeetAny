import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = path.join(import.meta.dirname, 'shots/ideal-0924');
fs.mkdirSync(out, { recursive:true });
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
// Left text edge of an element's first text, so padding/indent differences show up.
const textX=()=>{
 const x=e=>{if(!e)return null;const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()?1:3});const t=w.nextNode();if(!t)return null;const r=document.createRange();r.selectNodeContents(t);return Math.round(r.getClientRects()[0]?.left??0);};
 const rows=[...document.querySelectorAll('.supplier-row,.request-card')];
 return {
  h1:x(document.querySelector('.catalog-heading h1')),
  searchInput:Math.round(document.querySelector('.catalog-header .ma-input').getBoundingClientRect().left),
  firstTab:x(document.querySelector('.request-board-tabs a')),
  railTitle:x(document.querySelector('.filter-rail .ma-title')),
  plainRowTitle:x(rows.find(r=>!r.matches('.request-card--photo,.request-card--vip'))?.querySelector('h2,h3')),
  fullRowsInFold:rows.filter(r=>{const b=r.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;}).length,
  // Per row: kind, row left, title text x, offers/actions right edge, photo box, row height.
  rows:rows.map(r=>{const b=e=>e&&e.getBoundingClientRect().width?e.getBoundingClientRect():null;const img=b(r.querySelector('.request-card-visual'));const end=b(r.querySelector('.request-card-status>*'))||b(r.querySelector('.listing-actions'));
   return [(r.className.match(/request-card--(vip|top)/)||[])[1]||(r.matches('.request-card--photo')?'photo':'plain'),Math.round(r.getBoundingClientRect().left),x(r.querySelector('h2,h3')),end&&Math.round(end.right),img&&`${Math.round(img.left)}:${Math.round(img.width)}x${Math.round(img.height)}`,Math.round(r.getBoundingClientRect().height)];}),
 };
};
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
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,band:Math.round(document.querySelector('.catalog-header').getBoundingClientRect().height),controls:Math.round(document.querySelector('.r2-results-bar').getBoundingClientRect().height)}));
   Object.assign(metrics,await page.evaluate(textX));
   assert.equal(metrics.overflow,0);
   // Requests: a full-width VIP photo on mobile (T11.6) leaves one full row in the first screen.
   if(width===390)assert(metrics.fullRowsInFold>=(route==='requests'?1:2),`${route} 390: ${metrics.fullRowsInFold} full rows in the first screen`);
   await page.screenshot({path:path.join(out,`${route}-${width}.png`),fullPage:true});
   if(width===390)await page.screenshot({path:path.join(out,`${route}-390-fold.png`)});
   console.log(route,width,JSON.stringify(metrics));
   if(route==='companies'&&width===1440) {
    // The revealed number is masked before the reveal so it never reaches a screenshot or the log.
    await page.addStyleTag({content:'.ma-call__number{color:transparent!important;background:var(--bg-muted);border-radius:var(--radius-sm)}'});
    const row=page.locator('.supplier-row').first();
    const before=await page.evaluate(()=>[...document.querySelectorAll('.supplier-row')].map(r=>Math.round(r.getBoundingClientRect().height)));
    await row.locator('[data-contact-action=reveal]').click();
    const call=row.locator('[data-contact-action=call]');await call.waitFor();
    await page.mouse.move(0,0);
    const open=await call.evaluate(e=>({h:Math.round(e.getBoundingClientRect().height),w:Math.round(e.getBoundingClientRect().width),row:Math.round(e.closest('.supplier-row').getBoundingClientRect().height),overflow:document.documentElement.scrollWidth-innerWidth,clipped:e.scrollWidth>e.clientWidth}));
    assert.equal(open.h,44);assert.equal(open.clipped,false);assert.equal(open.overflow,0);
    const box=await page.locator('.companies-catalog .ma-proto-columns').boundingBox();
    await page.screenshot({path:path.join(out,'companies-1440-phone-open.png'),clip:{x:0,y:Math.max(0,box.y-16),width:1440,height:520}});
    console.log('phone-open',JSON.stringify({button:{h:open.h,w:open.w},rowBefore:before[0],rowAfter:open.row,others:before.slice(1)}));
   }
  }
 }
 assert.deepEqual(errors,[]);console.log('pageerror 0');
} finally {await browser.close();}
