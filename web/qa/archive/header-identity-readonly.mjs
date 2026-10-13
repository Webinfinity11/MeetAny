import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
process.env.QA_ORIGIN ||= 'http://localhost:3004';
const { auth, origin, credentials, rpc } = await import('./e2e/lib.mjs');
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local preview only');
const output='qa/shots/header-identity-readonly';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let checks=0;const errors=[];const check=(value,label)=>{assert(value,label);checks++;};
const identities={wood:['74cc28fc-47de-45cb-9563-93735b86855e','company'],owner_admin:['d2517b00-554d-4e6b-929a-ef3da51f3b47','admin']};
try {
 for(const [account,[id,role]] of Object.entries(identities)){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  check((await page.request.post(auth+'/sign-in/email',{data:credentials(account)})).ok(),'Existing sign-in');
  const me=(await rpc(page,'my_profile'))[0];check(me.id===id&&me.role===role,'Fixed identity');
  let logoMode='actual';let profileDelay=0;
  await context.route('**/api/db/rpc/*',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);
   if(name==='my_profile'&&profileDelay)await new Promise(resolve=>setTimeout(resolve,profileDelay));
   assert(!/^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|extend_|withdraw_|request_company_plan|cancel_company_plan|admin_(edit|manage|moderate|resolve|set|delete|save|reject|hide))/.test(name),'Unexpected mutation '+name);
   if(name==='my_profile'&&logoMode!=='actual'){
    const response=await route.fetch();const rows=await response.json();
    return route.fulfill({response,json:rows.map(row=>({...row,logo_url:logoMode==='logo'?'/assets/meetany-symbol-transparent.png':'/assets/header-missing-logo-readonly.png'}))});
   }
   return route.continue();
  });
  await page.goto(origin+(role==='admin'?'/admin/':'/account/?tab=offers'),{waitUntil:'domcontentloaded'});
  const trigger=page.locator('header [aria-controls="ma-account-menu"]');
  await trigger.filter({hasNot:page.locator('[aria-busy="true"]')}).waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('header [aria-controls="ma-account-menu"]')?.hasAttribute('aria-busy'));
  check(await trigger.getAttribute('aria-label')===(role==='admin'?'ადმინი':'პროფილი'),'Short meaningful trigger');
  if(role!=='admin'){
   check(await trigger.locator('.ma-header__avatar').count()===1,'Company avatar exists');
   check(await trigger.getAttribute('title')==='პროფილი','Accessible profile title');
   check(await trigger.locator('.ma-menu__label, :scope > .icon').count()===0,'No visible label or decorative chevron');
   check(await trigger.evaluate(el=>el.getBoundingClientRect().width===44&&el.getBoundingClientRect().height===44),'44px avatar-only click target');
   if(!me.logo_url)check((await trigger.locator('.ma-header__avatar').innerText()).trim()==='ხხ','Actual company initials fallback');
  } else check(await trigger.locator('.ma-header__avatar').count()===0,'Admin keeps shield');
  await trigger.focus();await page.keyboard.press('ArrowDown');
  check(await page.locator('#ma-account-menu').isVisible(),'Keyboard opens menu');
  check(await page.locator('#ma-account-menu .ma-menu__identity strong').innerText()===(me.company||me.name),'Actual identity in menu');
  check(await page.evaluate(()=>document.activeElement?.getAttribute('role')==='menuitem'),'Identity excluded from keyboard menu items');
  await page.keyboard.press('Escape');check(await trigger.evaluate(el=>document.activeElement===el),'Escape returns to trigger');
  await trigger.click();await page.waitForTimeout(350);await page.screenshot({path:`${output}/${account}-1440.png`});await page.keyboard.press('Escape');
  if(role!=='admin'){
   await page.setViewportSize({width:1100,height:1000});await page.waitForTimeout(250);
   check(await trigger.locator('.ma-header__avatar').isVisible(),'Compact tablet selector retains avatar');
   check(await trigger.locator('.ma-menu__label').count()===0,'Tablet has no text label');
  }
  await page.setViewportSize({width:320,height:900});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page no overflow');
  const opener=page.locator('.ma-header__menu-btn');await opener.click();
  check(await page.locator('#ma-mnav .ma-menu__identity strong').innerText()===(me.company||me.name),'Mobile drawer identity');
  check(await page.locator('#ma-mnav .ma-eyebrow').count()===0,'No decorative workspace caption');
  check(await page.locator('#ma-mnav').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Mobile drawer no overflow');
  await page.waitForTimeout(350);await page.screenshot({path:`${output}/${account}-320.png`});await page.keyboard.press('Escape');
  check(await opener.evaluate(el=>document.activeElement===el),'Mobile Escape restores opener');
  if(role!=='admin'){
   await page.setViewportSize({width:1440,height:1000});profileDelay=1500;await page.reload({waitUntil:'domcontentloaded'});
   const hint=page.locator('header .ma-menu__trigger[aria-busy="true"]');await hint.waitFor({timeout:6000});
   check(await hint.evaluate(el=>el.getBoundingClientRect().width===44&&el.getBoundingClientRect().height===44),'Hinted trigger preserves 44px geometry');
   check(await hint.locator('.ma-menu__label, :scope > .icon').count()===0,'Hinted trigger also has no label or chevron');
   profileDelay=0;await page.waitForFunction(()=>!document.querySelector('header [aria-controls="ma-account-menu"]')?.hasAttribute('aria-busy'));
   logoMode='logo';await page.reload({waitUntil:'domcontentloaded'});
   await trigger.locator('.ma-header__avatar img').waitFor({timeout:60000});
   await page.waitForFunction(()=>document.querySelector('header .ma-header__avatar img')?.style.opacity==='1');
   check(await trigger.locator('.ma-header__avatar img').getAttribute('src')==='/assets/meetany-symbol-transparent.png','Provided logo rendered directly without stock lookup');
   check(await trigger.locator('.ma-header__avatar').evaluate(el=>el.getBoundingClientRect().width===28),'Logo keeps reserved avatar size');
   await page.screenshot({path:`${output}/wood-logo-1440.png`});
   logoMode='failed';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('header .ma-header__avatar')?.textContent==='ხხ');
   check(await trigger.locator('.ma-header__avatar img').count()===0,'Broken supplied logo falls back to initials');
  }
  await context.close();
 }
 check(errors.length===0,'No runtime errors');fs.writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,origin,checks,applicationWrites:0,logoBranch:'readonly my_profile response override; actual company initials also checked',errors},null,2));console.log(`PASS ${checks} local header checks; application writes 0.`);
} catch(error){console.error(error.message);process.exitCode=1;}finally{await browser.close();}
