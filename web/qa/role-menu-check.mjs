// Live role-menu and the owner's three presentation-account checks; no marketplace writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const origin=process.env.QA_ORIGIN || 'https://meet-any.vercel.app';
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];fs.mkdirSync('qa/shots/role-menus',{recursive:true});
const loaded=p=>p.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&(document.querySelector('main')?.innerText.length||0)>30,null,{timeout:45000});
try{
 for(const [key,label,expected] of [
  ['owner_admin','ადმინი',['ადმინის პანელი','გასვლა']],
  ['owner_company','ჩემი კომპანია',['ჩემი შეთავაზებები','ჩემი მოთხოვნები','მიმოწერები','შეტყობინებები','კომპანიის პროფილი','საჯარო პროფილი','გასვლა']],
  ['owner_user','ჩემი ანგარიში',['ჩემი მოთხოვნები','შენახული კომპანიები','მიმოწერები','შეტყობინებები','პროფილი','გასვლა']],
 ]){
  if(process.env.QA_ROLES && !process.env.QA_ROLES.split(",").includes(key)) continue;
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/account/');await loaded(p);
  const account=ledger.accounts[key];assert(account);
  await p.locator('#login-email').fill(key==='owner_company'?'Company@gmail.com':account.email);
  await p.locator('#login-password').fill(account.password);
  await p.locator('form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:45000});await loaded(p);
  if(key==='owner_admin'){await p.waitForURL(/\/admin\//);assert.equal(await p.locator('.ma-header__cta,.ma-header__updates').count(),0);}
  const trigger=p.getByRole('button',{name:label,exact:true}),menu=p.locator('#ma-account-menu');
  await trigger.click();assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),expected);
  const before=await menu.boundingBox();await p.waitForTimeout(500);assert.deepEqual(await menu.boundingBox(),before);
  const style=await menu.evaluate(el=>({animation:getComputedStyle(el).animationName,gap:getComputedStyle(el).gap}));assert.equal(style.animation,'none');assert.equal(style.gap,'4px');
  await p.screenshot({path:`qa/shots/role-menus/${key}-desktop.png`});
  await trigger.press('End');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'გასვლა');
  await p.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await trigger.press('ArrowDown');assert.equal(await p.evaluate(()=>document.activeElement.textContent),expected[0]);await p.keyboard.press('Escape');
  if(key==='owner_company'){
   await trigger.click();await menu.getByRole('menuitem',{name:'ჩემი მოთხოვნები',exact:true}).click();await p.waitForURL(/tab=requests/);await loaded(p);assert.equal(await p.getByRole('heading',{name:/ჩემი შეთავაზებები/}).count(),0);
   await trigger.click();await menu.getByRole('menuitem',{name:'ჩემი შეთავაზებები',exact:true}).click();await p.waitForURL(/tab=offers/);await loaded(p);assert.equal(await p.getByRole('heading',{name:'ჩემი მოთხოვნები',exact:true}).count(),0);
  }
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'მენიუ',exact:true}).click();
  const mobile=p.locator('#ma-mnav');for(const text of expected)assert(await mobile.getByText(text,{exact:true}).count()>0);
  if(key==='owner_admin')assert.equal(await mobile.getByText('ჩემი მოთხოვნები',{exact:true}).count(),0);
  await p.screenshot({path:`qa/shots/role-menus/${key}-mobile.png`});assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);
  await mobile.getByRole('button',{name:'გასვლა',exact:true}).click();await p.locator('.ma-header__account').waitFor({state:'detached'});await p.goto(origin+'/account/');await p.locator('#login-email').waitFor();
  console.log('PASS '+key+' login, correct menu, stable position, keyboard, mobile, logout');await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS zero browser errors');
}finally{await browser.close();}
