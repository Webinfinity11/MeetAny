// Real local content publication; restore the exact starting content in finally.
import {chromium} from 'playwright';
import {adminSession,rpc,assert,origin,safe} from './admin-session.mjs';
import fs from 'node:fs';
const out='qa/QA-2026-10-13/shots/admin';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let page,original;
try {
 ({page}=await adminSession(browser,'owner_admin'));page.setDefaultTimeout(60000);
 original=await rpc(page,'site_content');
 await rpc(page,'admin_save_site_content',{p_content:{...original,businessImage1:'/assets/photos/cover/trucks.jpg'}});
 await page.goto(origin+'/admin/?tab=content',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'საწყისი ფოტოს დაბრუნება',exact:true}).first().click();
 await page.getByRole('button',{name:'გამოქვეყნება',exact:true}).click();
 await page.getByRole('link',{name:'ნახეთ კატალოგში',exact:true}).waitFor();
 const saved=await rpc(page,'site_content');assert.notEqual(saved.businessImage1,'/assets/photos/cover/trucks.jpg');
 const guest=await browser.newContext({reducedMotion:'reduce'});const publicPage=await guest.newPage();
 for(const width of [1440,390]) {
  await publicPage.setViewportSize({width,height:width===390?844:1000});
  await publicPage.goto(origin+'/companies/',{waitUntil:'domcontentloaded'});
  const image=publicPage.locator('[data-catalog-cover] img').first();await image.waitFor();
  await publicPage.waitForFunction(()=>{const n=document.querySelector('[data-catalog-cover] img');return n?.complete&&n.naturalWidth>0;});
  assert(decodeURIComponent(await image.getAttribute('src')).includes(saved.businessImage1));
  assert(await image.isVisible());assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await publicPage.screenshot({path:`${out}/QA-03-catalog-${width}.png`});
 }
 console.log('PASS QA-03 real publish → guest catalog 1440/390');
} catch(e){console.error(safe(e.stack));process.exitCode=1;}
finally {if(page&&original){await rpc(page,'admin_save_site_content',{p_content:original});assert.deepEqual(await rpc(page,'site_content'),original);console.log('RESTORED original catalog content');}await browser.close();}
