// Mutates only the dedicated local database; removes requests it creates.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3444', AUTH='http://127.0.0.1:4444';
const ids={client:'bacf1572-7493-4ac9-bfc7-95719e911c4c',company:'74cc28fc-47de-45cb-9563-93735b86855e'};
const db=new pg.Client({connectionString:'postgresql://localhost/meetany_layout_post'});
await db.connect();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={checks:[],created:[],errors:[]};
const check=name=>{report.checks.push(name);console.log(name);};
const date=new Date(Date.now()+10*864e5).toISOString().slice(0,10);
async function contextFor(role) {
  const jwt=(await(await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route(`${AUTH}/**`,route=>{const url=route.request().url();if(url.includes('/.well-known/'))return route.continue();return route.fulfill({headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:url.includes('/get-session')?{user:{id:ids[role],email:'qa@local.test',name:'QA'}}:{token:jwt}});});
  await context.route(/https:\/\/.*\/auth\//,route=>route.abort());
  await context.addInitScript(()=>{localStorage.setItem('meetany.session','1');localStorage.setItem('meetany.theme','blue');});
  return context;
}
async function goto(page,path) {await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('button[aria-controls="ma-account-menu"]').waitFor({state:'attached',timeout:30000});await page.evaluate(()=>document.fonts.ready);}
async function next(page) {await page.locator('button.post-actions__next[type=submit]').click();}
try {
  for(const role of ['client','company']) {
    const context=await contextFor(role),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    await goto(page,'/requests/new/?step=1');
    await page.locator('#title').fill('');await next(page);
    await page.locator('#post-errors').waitFor();assert.equal(await page.locator('#title').getAttribute('aria-invalid'),'true');check(`${role}: required validation and error summary`);
    const title=`ხის მაგიდების შესყიდვა ${Date.now()}`;
    await page.locator('#title').fill(title);await page.locator('#body').fill('ლოკალური შემოწმება — სასტუმროსთვის საჭიროა 20 ხის მაგიდა მიწოდებით თბილისში.');await page.locator('#quantity').fill('20');
    await page.locator('#category').click();await page.getByRole('option',{name:'ავეჯი',exact:true}).click();
    // Select a local photo, then remove it before publishing: no remote Blob upload.
    await page.getByLabel('მოთხოვნის ფოტოს არჩევა').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5qkAAAAASUVORK5CYII=','base64')});
    await page.getByRole('button',{name:'ფოტოს წაშლა'}).waitFor();assert.match(await page.locator('[data-request-id="draft-preview"] img').getAttribute('src'),/^blob:/);
    await page.getByRole('button',{name:'ფოტოს წაშლა'}).click();check(`${role}: local photo preview and removal`);
    await page.getByRole('button',{name:'მონახაზად შენახვა',exact:true}).click();await page.getByText('მონახაზი შენახულია',{exact:true}).waitFor();
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('#title').waitFor();assert.equal(await page.locator('#title').inputValue(),title);check(`${role}: browser draft restored after reload`);
    // A fresh tab has no sessionStorage draft; the same account restores from the server.
    const serverPage=await context.newPage();await goto(serverPage,'/requests/new/?step=1');
    await serverPage.waitForFunction(title=>document.querySelector('#title')?.value===title,title);await serverPage.close();check(`${role}: server draft restored in a fresh tab`);
    await next(page);await page.locator('#neededBy').waitFor();await page.locator('#neededBy').fill('');await next(page);assert.equal(await page.locator('#neededBy').getAttribute('aria-invalid'),'true');
    await page.locator('#neededBy').fill(date);await next(page);await page.getByText('მოთხოვნის დეტალები',{exact:true}).waitFor();
    const primary=page.locator('aside button[form="post-request-form"]');await page.evaluate(()=>scrollTo(0,0));assert.ok((await primary.boundingBox()).y<500);check(`${role}: review primary action visible without scrolling`);
    await primary.click();await page.getByRole('heading',{name:'მოთხოვნა გამოქვეყნდა',exact:true}).waitFor({timeout:30000});
    const row=(await db.query('select id from requests where owner_id=$1 and title=$2',[ids[role],title])).rows[0];assert.ok(row);report.created.push(row.id);check(`${role}: three steps → real local publication`);
    await goto(page,`/requests/?q=${encodeURIComponent(title)}`);await page.locator(`main a[href="/requests/view/?id=${row.id}"]`).first().waitFor();check(`${role}: published request visible in catalog`);
    await goto(page,'/account/?tab=requests');
    const requestLink=page.locator(`main a[href="/requests/view/?id=${row.id}"]`).first();await requestLink.waitFor();check(`${role}: published request visible in account`);
    // Follow the account link and exercise the existing edit sheet (no new ?id= mode).
    await requestLink.click();await page.getByRole('button',{name:'რედაქტირება',exact:true}).click();
    let dialog=page.locator('dialog[open]');await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'რედაქტირება',exact:true}).click();dialog=page.locator('dialog[open]');await dialog.locator('#title').fill(`${title} განახლებული`);await dialog.getByRole('button',{name:'შენახვა',exact:true}).click();await dialog.waitFor({state:'hidden'});
    assert.equal((await db.query('select title from requests where id=$1',[row.id])).rows[0].title,`${title} განახლებული`);check(`${role}: account → edit sheet open, close, save`);
    if(role==='client') {
      await goto(page,'/requests/new/?step=1');await page.getByText(/თქვენ გაქვთ 5 ღია მოთხოვნა/).waitFor();check('client: five-open-request notice and account link');
      await goto(page,'/account/?tab=profile#company-upgrade');await page.locator('#upgrade-company').fill('');await page.locator('#company-upgrade [data-form-footer] button[type=submit]').click();assert.equal(await page.locator('#upgrade-company').getAttribute('aria-invalid'),'true');
      await page.locator('#upgrade-company').fill('სატესტო კომპანია');await page.locator('#upgrade-industry').click();await page.getByRole('option',{name:'ავეჯი',exact:true}).click();await page.locator('#company-upgrade [data-form-footer]').getByRole('button',{name:'უკან',exact:true}).click();await page.getByRole('button',{name:'დაამატეთ კომპანიის პროფილი'}).click();assert.equal(await page.locator('#upgrade-company').inputValue(),'სატესტო კომპანია');check('CompanyUpgrade: validation, close/reopen, entered values retained');
    }
    await context.close();
  }
} catch(error) {report.errors.push(error.stack);throw error;}
finally {for(const id of report.created)await db.query('delete from requests where id=$1',[id]);report.cleaned=report.created.length;await browser.close();await db.end();fs.writeFileSync('qa/LAYOUT-2026-10-14/post/flow.json',JSON.stringify(report,null,2));}
assert.equal(report.errors.length,0);
