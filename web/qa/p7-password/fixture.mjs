import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='http://localhost:3707',auth='http://127.0.0.1:3717';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try {
for(const [role,id] of [['client','0fe9dce5-6923-491b-8dc5-56121654858d'],['company','003019b7-b095-4c4c-b272-9dbeb750a473']]){
 const jwt=(await(await fetch(`${auth}/__mint?sub=${id}`)).json()).token;
 const context=await browser.newContext();let code=null,calls=0;
 await context.route(`${auth}/**`,route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.includes('/.well-known/'))return route.continue();
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt};
  if(route.request().method()==='OPTIONS')return route.fulfill({headers:{...headers,'Access-Control-Allow-Headers':'content-type'},status:204});
  if(path==='/change-password'){calls++;return route.fulfill({status:code?400:200,headers,json:code?{code,message:'Fixture rejection'}:{success:true}});}
  return route.fulfill({headers,json:path==='/get-session'?{user:{id,email:'qa@local.test',name:'QA'}}:{token:jwt}});
 });
 await context.addInitScript(()=>localStorage.setItem('meetany.session','1'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});
  await page.goto(`${origin}/account/?tab=profile${role==='company'?'&section=security':''}`);
  await page.locator('#password-current').waitFor();
  await page.locator('#account-password').scrollIntoViewIfNeeded();
  await page.screenshot({path:`qa/p7-password/shots/${role}-${width}-initial.png`,fullPage:true});
  await page.locator('#password-new').fill('short');await page.locator('#password-repeat').fill('different');
  const before=calls;await page.locator('#account-password button[type=submit]').click();
  for(const field of ['current','new','repeat'])assert.ok(await page.locator(`#password-${field}-error`).isVisible());
  assert.equal(calls,before);assert.equal(await page.evaluate(()=>document.activeElement.id),'password-current');
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));assert.equal(overflow,0);
  await page.screenshot({path:`qa/p7-password/shots/${role}-${width}-validation.png`,fullPage:true});
  results.push({role,width,overflow,pageerrors:errors.length,clientErrors:3,passwordRequests:calls-before});
 }
 for(const [serverCode,field] of [['INVALID_PASSWORD','current'],['PASSWORD_TOO_SHORT','new'],['PASSWORD_TOO_LONG','new']]){
  code=serverCode;
  await page.locator('#password-current').fill('fixture-current');await page.locator('#password-new').fill('fixture-password');await page.locator('#password-repeat').fill('fixture-password');
  await page.locator('#account-password button[type=submit]').click();await page.locator(`#password-${field}-error`).waitFor();
  await page.waitForFunction(id=>document.activeElement?.id===id,`password-${field}`);
  assert.equal(await page.locator(`#password-${field}`).getAttribute('aria-invalid'),'true');
  results.push({role,code,field,focus:true,message:await page.locator(`#password-${field}-error`).innerText()});
 }
 code='UNKNOWN';await page.locator('#account-password button[type=submit]').click();await page.locator('#account-password > [role=alert]').waitFor();
 results.push({role,unknownErrorAtFormEnd:true});
 code=null;await page.locator('#account-password button[type=submit]').click();await page.getByText('პაროლი შეიცვალა.',{exact:true}).waitFor();
 for(const field of ['current','new','repeat'])assert.equal(await page.locator(`#password-${field}`).inputValue(),'');
 assert.deepEqual(errors,[]);await context.close();
}
fs.writeFileSync('qa/p7-password/fixture-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
