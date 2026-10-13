import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:3708',auth='http://127.0.0.1:3718',user='bacf1572-7493-4ac9-bfc7-95719e911c4c';
const b=await chromium.launch();const checks=[];let companyBody;
try {
 for(const fallback of [false,true]) {
  const c=await b.newContext({viewport:{width:390,height:844}});
  const jwt=(await(await fetch(`${auth}/__mint?sub=${user}`)).json()).token;
  await c.route(`${auth}/**`,r=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','set-auth-jwt':jwt},json:r.request().url().endsWith('/get-session')?{user:{id:user,email:'perf@local.test'}}:{token:jwt}}));
  await c.addInitScript(()=>localStorage.setItem('meetany.session','1'));
  if(fallback)await c.route('**/api/db/rpc/*_detail_extras',r=>r.fulfill({status:404,json:{code:'PGRST202',message:'missing fixture RPC'}}));
  const p=await c.newPage();const errors=[],rpc=[],scripts=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url().replace(origin,''));if(r.url().includes('/api/db/rpc/'))rpc.push(r.url().split('/').pop());});
  await p.goto(origin+'/requests/view/?id=0101aaac-f4e6-4ed4-b1bd-5a52e0942db9',{waitUntil:'networkidle'});
  await p.locator('#request-offers-title').waitFor();
  const body=await p.locator('main').innerText();
  if(!body.includes('შეთავაზებ'))throw Error('Owner offers absent');
  const choose=p.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).first();
  await choose.click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');
  checks.push({fallback,chooseOpened:true});
  const preferences=p.getByRole('heading',{name:'დამატებითი პირობები',exact:true}).locator('..').getByRole('button',{name:'შეცვლა',exact:true});
  await preferences.click();await p.getByRole('button',{name:'დახურვა',exact:true}).click();
  checks.push({fallback,preferencesOpened:true});
  // Opening the header's list exercises the first lazy load; no message is sent.
  const chat=p.getByRole('button',{name:/^მიმოწერები/});
  if(await chat.count()) {const before=scripts.length;await chat.first().click();await p.locator('dialog[open]').waitFor();const lazyScripts=scripts.slice(before);assert(lazyScripts.length>0);await p.keyboard.press('Escape');await chat.first().click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');checks.push({fallback,chatOpened:true,chatReopened:true,lazyScripts});}
  await p.goto(origin+'/requests/view/?id=9bb4fc42-e88b-4fe9-bc80-13d142899365',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'რედაქტირება',exact:true}).click();
  await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');
  checks.push({fallback,editOpened:true});
  await p.goto(origin+'/companies/view/?id=74cc28fc-47de-45cb-9563-93735b86855e',{waitUntil:'networkidle'});
  const product=p.getByRole('button',{name:/— პროდუქტის ნახვა/}).first();
  if(await product.count()){await product.click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');checks.push({fallback,productOpened:true});}
  const gallery=p.getByRole('button',{name:/— ფოტო 1 \//}).first();
  if(await gallery.count()){await gallery.click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');checks.push({fallback,galleryOpened:true});}
  if(errors.length)throw Error(errors.join(';'));
  const text=await p.locator('main').innerText();
  assert(!text.includes('ვერ ჩაიტვირთა'));
  if(fallback)assert.equal(text,companyBody);else companyBody=text;
  checks.push({fallback,errors,rpc,companyBody:text});
  await c.close();
 }
} finally {await b.close();fs.writeFileSync('qa/p7-perf/interactions.json',JSON.stringify(checks,null,2));}
