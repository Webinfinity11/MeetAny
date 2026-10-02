import fs from 'node:fs';
import {chromium} from 'playwright';
import {auth,credentials,assert,safe} from './e2e/lib.mjs';
import {guard} from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const menusOnly=process.env.QA_MENUS_ONLY==='1';
const output=menusOnly?'qa/shots/layout-professional-menus-local':'qa/shots/layout-professional-local';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const views=[],focusChecks=[],errors=[];
const widths=[320,390,768,1024,1440];
async function settled(page,route){
 await page.goto(origin+route,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]')&&!document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
 assert(!(await page.locator('main').innerText()).includes('სერვისი დროებით მიუწვდომელია'),'service error');
}
async function layout(page,label,width){
 const measurement=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({width:d.clientWidth,scrollWidth:d.scrollWidth,left:d.getBoundingClientRect().left,right:d.getBoundingClientRect().right,bottom:d.getBoundingClientRect().bottom}))}));
 assert(measurement.scrollWidth<=width+1,`${label} ${width}: page overflow`);
 assert(measurement.dialogs.every(d=>d.scrollWidth<=d.width+1&&d.left>=-1&&d.right<=width+1&&d.bottom<=1001),`${label} ${width}: dialog geometry ${JSON.stringify(measurement.dialogs)}`);
 if([320,390,1440].includes(width))await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:!/(detail|edit|header-menu)/.test(label)});
 views.push({label,...measurement,pass:true});
}
async function focusGeometry(page,selector,label){
 const target=page.locator(selector).first();if(!(await target.count())||!await target.isVisible())return;
 await page.keyboard.press('Tab');await target.focus();
 await page.waitForTimeout(150);
 const check=await target.evaluate(el=>{
  const r=el.getBoundingClientRect(),clipped=[];let parent=el.parentElement;
  while(parent&&parent!==document.body){const c=getComputedStyle(parent),p=parent.getBoundingClientRect();const x=['auto','scroll','hidden','clip'].includes(c.overflowX),y=['auto','scroll','hidden','clip'].includes(c.overflowY);if((x&&(r.left-4<p.left-.5||r.right+4>p.right+.5))||(y&&(r.top-4<p.top-.5||r.bottom+4>p.bottom+.5)))clipped.push({class:parent.className,x,y,clearance:{left:r.left-p.left,right:p.right-r.right,top:r.top-p.top,bottom:p.bottom-r.bottom}});parent=parent.parentElement;}
  return {focusVisible:el.matches(':focus-visible'),boxShadow:getComputedStyle(el).boxShadow,clipped};
 });
 focusChecks.push({label,width:await page.evaluate(()=>innerWidth),...check});
 if([320,1440].includes(await page.evaluate(()=>innerWidth)))await page.screenshot({path:`${output}/${label}-focus-${await page.evaluate(()=>innerWidth)}.png`,fullPage:true});
}
try{
 for(const [role,key,routes]of[
  ['guest',null,['/','/account/','/account/?tab=register&role=company','/requests/','/companies/']],
  ['company','linen',['/account/','/account/?tab=offers','/account/?tab=messages','/account/?tab=saved','/account/?tab=profile','/account/?tab=profile&section=products','/account/?tab=profile&section=distribution','/account/?tab=business']],
  ['client','cafe',['/account/','/account/?tab=messages','/account/?tab=profile']],
  ['admin','owner_admin',['/admin/','/admin/?tab=companies','/admin/?tab=requests','/admin/?tab=users','/admin/?tab=offers','/admin/?tab=reviews','/admin/?tab=plans','/admin/?tab=content']]
 ]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),state={blocked:[],chat:null,interceptions:0};await guard(context,state);
  await context.route('**/api/analytics/registration',r=>r.request().method()==='POST'?r.fulfill({status:202,json:{ok:true,enabled:false}}):r.continue());
  page.on('pageerror',e=>errors.push({role,message:e.message}));
  if(key){let logged=false;for(let n=0;n<6;n++){const response=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});if(response.ok()){logged=true;break;}assert.equal(response.status(),429);await new Promise(resolve=>setTimeout(resolve,20000));}assert(logged,`sign in ${role}`);}
  for(const route of menusOnly?[]:routes){
   await settled(page,route);const slug=role+'-'+(route.includes('tab=')?new URL(origin+route).searchParams.get('tab')+(new URL(origin+route).searchParams.get('section')||''):route==='/account/'?'account':route.replaceAll('/','')||'home');
   for(const width of widths){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);await layout(page,slug,width);if(role==='company'&&route==='/account/')await focusGeometry(page,'.account-nav__list [aria-current="page"]','company-active-tab');if(role==='admin'&&route==='/admin/'&&width>=1024)await focusGeometry(page,'#admin-section-navigation [aria-current="page"]','admin-active-tab');}
  }
  if(role==='admin'&&!menusOnly){
   for(const tab of ['companies','requests']){
    await page.setViewportSize({width:1440,height:1000});await settled(page,'/admin/?tab='+tab);await page.locator('tbody tr').first().getByRole('button',{name:'დეტალები',exact:true}).click();const dialog=page.locator('dialog[open]');await dialog.getByRole('button',{name:'რედაქტირება',exact:true}).waitFor();
    for(const width of widths){await page.setViewportSize({width,height:1000});await layout(page,`admin-${tab}-detail`,width);
     const footer=dialog.locator('.ma-sheet__footer');const bounds=await footer.evaluate(f=>{const p=f.getBoundingClientRect();return [...f.querySelectorAll('button,a')].filter(el=>el.checkVisibility()).map(el=>{const r=el.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right+1&&r.top>=p.top&&r.bottom<=p.bottom+1;});});assert(bounds.every(Boolean),`drawer footer controls fit ${tab} ${width}`);
     await dialog.getByRole('button',{name:'დახურვა',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>!!document.activeElement?.closest('dialog[open]')),'drawer focus trap backwards');
    }
    await dialog.getByRole('button',{name:'რედაქტირება',exact:true}).click();
    for(const width of widths){await page.setViewportSize({width,height:1000});await layout(page,`admin-${tab}-edit`,width);}
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0,'Escape closes drawer');
   }
  }
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:1000});await settled(page,role==='admin'?'/admin/':role==='guest'?'/':'/account/');
   const opener=page.getByRole('button',{name:'მენიუ',exact:true});await opener.click();const menu=page.locator('#ma-mnav[open]');await menu.waitFor();await page.waitForTimeout(250);await layout(page,`${role}-header-menu`,width);
   await menu.getByRole('button',{name:'მენიუს დახურვა',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>!!document.activeElement?.closest('#ma-mnav[open]')),'mobile menu focus trap');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#ma-mnav[open]').count(),0);assert(await opener.evaluate(el=>document.activeElement===el),'mobile Escape restores menu trigger');
   if(role==='admin'){
    const trigger=page.locator('[aria-controls="admin-section-navigation"]');await trigger.click();await focusGeometry(page,'#admin-section-navigation [aria-current="page"]','admin-active-tab');await layout(page,'admin-sidebar-expanded',width);await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
   }
  }
  if(role!=='guest')for(const width of [1024,1440]){
   await page.setViewportSize({width,height:1000});const trigger=page.locator('[aria-controls="ma-account-menu"]');await trigger.focus();await page.keyboard.press('ArrowDown');await page.locator('#ma-account-menu:not([hidden])').waitFor();assert(await page.evaluate(()=>document.activeElement?.getAttribute('role')==='menuitem'),'account menu arrow opens and focuses');await layout(page,`${role}-account-menu`,width);await page.keyboard.press('Escape');assert(await trigger.evaluate(el=>document.activeElement===el),'account menu Escape restores trigger');
  }
  assert.deepEqual(state.blocked,[]);await context.close();console.log(`PASS ${role} responsive layouts`);
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,views:views.length,pass:true,readOnly:true,errors,focusChecks,report:views},null,2));
 console.log(`PASS ${views.length} readonly responsive views, drawer footers and keyboard trap; focus observations saved.`);
}catch(error){console.error(safe(error.stack));process.exitCode=1;}finally{await browser.close();}
