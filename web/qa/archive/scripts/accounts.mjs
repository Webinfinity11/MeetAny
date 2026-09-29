import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
const errors=[];
const safe = value => Object.values(ledger.accounts).reduce((text,a)=>text.replaceAll(a.password,"[redacted]"),String(value));
try {
  for(const key of ['hotel','wood','admin']) {
    const context=await browser.newContext();const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
    await page.goto('http://localhost:3000/account/');await page.locator('#login-email').fill(`demo-${key}@meetany.ge`);await page.locator('#login-password').fill(ledger.accounts[key].password);await page.locator('form button[type="submit"]').click();await page.locator('#login-email').waitFor({state:'hidden',timeout:60000});
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      if(key==='admin') {await page.goto('http://localhost:3000/admin/');await page.locator('.ma-stat').first().waitFor({timeout:60000});}
      else if(key==='hotel') {await page.getByRole('heading',{name:'ჩემი მოთხოვნები'}).waitFor();assert(await page.locator('main article').first().isVisible());}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(root,`qa/shots/${key==='admin'?'admin-live':key==='hotel'?'account-client':'account-company'}-${width}.png`),fullPage:true});
    }
    await page.goto('http://localhost:3000/account/?tab=profile');await page.locator('#name').waitFor({timeout:60000});
    await page.screenshot({path:path.join(root,`qa/shots/profile-${key}-390.png`),fullPage:true});
    await context.close();console.log('PASS account',key);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'qa/accounts-report.json'),JSON.stringify({roles:['client','company','admin'],widths:[1280,390],errors},null,2));
}catch(err){throw new Error(safe(err.message));}finally{await browser.close();}
