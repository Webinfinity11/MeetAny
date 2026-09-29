import {reuseAnonymousToken} from "./site-walk-a-auth.mjs";
import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';
process.env.QA_ORIGIN||='http://localhost:3002';
const {root,origin,assert,safe}=await import('./e2e/lib.mjs');const {readRPCs}=await import('./visual/lib/browser.mjs');
const phase=process.argv[2]||'before',dir=path.join(root,'qa/shots/final-2026-09-29/public'),out={checks:[],blocked:[],errors:[]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});let current='';
const save=()=>fs.writeFileSync(path.join(dir,phase+'-details.json'),safe(JSON.stringify(out,null,2)));
async function test(name,fn){try{out.checks.push({page:current,name,status:'PASS',evidence:await fn()});}catch(e){out.checks.push({page:current,name,status:'FAIL',reason:safe(e.message)});}save();console.log(current,name,out.checks.at(-1).status);}
async function go(p,url){await p.goto(origin+url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main [aria-busy=true]'));await p.locator('.ma-header__session-placeholder').waitFor({state:'hidden',timeout:20000});await p.locator('main [aria-busy=true]').first().waitFor({state:'hidden',timeout:20000});await p.waitForTimeout(600);}
async function shot(p,name){if(!await p.locator("dialog[open]").count())await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(dir,`${phase}-${current}-${name}.png`),fullPage:!await p.locator('dialog[open]').count(),animations:'disabled'});}
async function invalid(p,submit){await submit.click();const errors=await p.locator('[aria-invalid=true]').count();assert(errors>0);assert(await p.evaluate(()=>document.activeElement.getAttribute('aria-invalid')==='true'));return errors;}
try{for(const role of ['guest','owner_user','owner_company']){
const session=`/tmp/meetany-flows-${role}.json`;if(role!=='guest'&&!fs.existsSync(session)){out.checks.push({page:role,status:'SKIP',name:'session not ready'});continue;}
const ctx=await browser.newContext(role==='guest'?{}:{storageState:session});await reuseAnonymousToken(ctx);const p=await ctx.newPage();p.setDefaultTimeout(8000);p.setDefaultNavigationTimeout(30000);
await ctx.route('**/api/**',async r=>{const req=r.request(),rpc=new URL(req.url()).pathname.split('/rpc/')[1];if(['GET','OPTIONS','HEAD'].includes(req.method())||(readRPCs.has(rpc)&&rpc!=='mark_read'))return r.continue();out.blocked.push({page:current,rpc});return r.abort();});
for(const width of [1440,390]){current=`${role}-${width}`;await p.setViewportSize({width,height:width===390?844:1000});
if(role==='guest'){
 await go(p,'/account/');await test('login validation',()=>invalid(p,p.locator('main form button[type=submit]')));await shot(p,'login-errors');
 for(const regRole of ['client','company']){await go(p,'/account/?tab=register&role='+regRole);await test('registration '+regRole+' validation',()=>invalid(p,p.locator('main form button[type=submit]')));await shot(p,'register-'+regRole+'-errors');}
 await test('CustomSelect mouse/keyboard/Escape',async()=>{const b=p.locator('#reg-city');await b.click();await p.getByRole('option',{name:'ბათუმი',exact:true}).click();assert.match(await b.innerText(),/ბათუმი/);await b.focus();await b.press('Space');await b.press('Home');await b.press('ArrowDown');await b.press('Enter');assert.equal(await b.getAttribute('aria-expanded'),'false');await b.press('ArrowDown');await b.press('Escape');assert(await b.evaluate(x=>x===document.activeElement));});
 await go(p,'/requests/new/');await test('guest new request sign-in next',async()=>{const a=p.locator('#new-request a[href*="next="]').first();const href=await a.getAttribute('href');assert(new URL(href,origin).searchParams.get('next')?.startsWith('/requests/new'));await a.click();await p.locator('#login-email').waitFor();assert(new URL(p.url()).searchParams.get('next')?.startsWith('/requests/new'));});
}else{
 await go(p,'/account/?tab=profile');
 await test('profile validation',async()=>{const name=p.locator('#name');await name.fill('');return invalid(p,p.locator('main form').first().locator('button[type=submit]'));});await shot(p,'profile-errors');
 await test('password required validation',()=>invalid(p,p.locator('#account-password button[type=submit]')));
 await test('password mismatch validation',async()=>{await p.locator('#password-current').fill('validation-only');await p.locator('#password-new').fill('Validation-only-999');await p.locator('#password-repeat').fill('different');await p.locator('#account-password button[type=submit]').click();assert.equal(await p.locator('#password-repeat').getAttribute('aria-invalid'),'true');await p.locator('#password-current').fill('');await p.locator('#password-new').fill('');await p.locator('#password-repeat').fill('');});await shot(p,'password-errors');
 await go(p,'/requests/new/');
 await test('request validation',()=>invalid(p,p.locator('button[form=new-request-form]')));await shot(p,'request-errors');
 await test('date validation and shortcut',async()=>{await p.locator('#neededBy').fill('31.02.2027');await p.locator('button[form=new-request-form]').click();assert.equal(await p.locator('#neededBy').getAttribute('aria-invalid'),'true');const b=p.getByRole('button',{name:'ერთ კვირაში',exact:true});await b.click();assert.match(await p.locator('#neededBy').inputValue(),/^\d{2}\.\d{2}\.\d{4}$/);});
 await test('request select nested Escape',async()=>{await p.locator('#category').click();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.locator('#category').click();await p.keyboard.press('Escape');assert.equal(await p.locator('#category').getAttribute('aria-expanded'),'false');assert(await p.locator('#new-request').isVisible());});
 await p.keyboard.press('Escape');
 await go(p,'/requests/view/?id=fb2d9c2f-acef-4cde-be59-f1686aaf14ad');
 if(role==='owner_user')await test('ChooseOfferSheet cancel/focus/Tab',async()=>{const b=p.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).first();await b.click();await p.locator('#choose[open]').waitFor();const last=p.locator('#choose').getByRole('button',{name:'გაუქმება',exact:true});await last.focus();await p.keyboard.press('Tab');const trapped=await p.evaluate(()=>!!document.activeElement.closest('#choose'));await shot(p,'choose');await p.keyboard.press('Escape');await p.locator('#choose[open]').waitFor({state:'hidden'});assert(await b.evaluate(x=>x===document.activeElement));assert(trapped,'Tab leaves dialog');});
 if(role==='owner_company')await test('offer edit validation without save',async()=>{await p.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).click();await p.locator('#of-body').fill('');await p.locator('#of-days').fill('');await p.locator('#of-body').locator('xpath=ancestor::form').locator('button[type=submit]').click();assert(await p.locator('[aria-invalid=true]').count()>0);await shot(p,'offer-errors');});
 await go(p,'/account/');
 if(width===1440)await test('account menu arrows/Escape',async()=>{const b=p.locator('.ma-menu__trigger');await b.focus();await b.press('ArrowDown');assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('role')),'menuitem');await p.keyboard.press('End');await p.keyboard.press('Escape');assert(await b.evaluate(x=>x===document.activeElement));});
 if(width===1440)await test('notification popover Escape/focus',async()=>{const b=p.getByRole('button',{name:/^შეტყობინებები(?:,|$)/});await b.click();await p.locator('#notification-list').waitFor();await p.keyboard.press('Escape');assert(await b.evaluate(x=>x===document.activeElement));});
}
}
await ctx.close();}
}finally{await browser.close();save();}
