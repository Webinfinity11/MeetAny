import fs from 'node:fs';
import {chromium} from 'playwright';
import {auth,credentials,assert,safe} from './e2e/lib.mjs';
import {guard} from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output='qa/shots/shared-navigation-local'+(process.env.QA_ROLE?'-'+process.env.QA_ROLE:'');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),report=[];
try{
 for(const [role,key] of [['guest',null],['company','wood'],['client','cafe'],['admin','owner_admin']].filter(([role])=>!process.env.QA_ROLE||process.env.QA_ROLE===role)){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),state={blocked:[],chat:null,interceptions:0},errors=[];await guard(context,state);page.on('pageerror',e=>errors.push(e.message));
  if(key){const r=await page.request.post(auth+'/sign-in/email',{data:credentials(key)});assert(r.ok(),`login ${role}`);}
  await page.goto(origin+(role==='admin'?'/admin/':'/'),{waitUntil:'domcontentloaded'});await page.getByRole('heading',{level:1}).waitFor();await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));
  const stamp=await page.evaluate(()=>{window.__qaIdentity=Math.random();return {identity:window.__qaIdentity,time:performance.timeOrigin};});
  assert.equal(await page.locator('.ma-toasts').count(),1);
  for(const route of role==='admin'?['/admin/?tab=companies','/admin/?tab=content','/','/companies/']:['/companies/','/requests/','/account/','/']){
   const link=page.locator(`a[href="${route}"]`).filter({visible:true}).first();if(!await link.count())continue;
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('meetany:toast',{detail:'ცვლილება შენახულია.'})));await link.click();await page.waitForURL(origin+route);await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));
   assert.deepEqual(await page.evaluate(()=>({identity:window.__qaIdentity,time:performance.timeOrigin})),stamp,`${role} client navigation persists`);
   assert.equal(await page.locator('.ma-toasts').count(),1);await page.locator('.ma-toast__text').filter({hasText:'ცვლილება შენახულია.'}).first().waitFor();assert.equal(await page.locator('.ma-navigation-progress').count(),0);
   for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)){await page.screenshot({path:`${output}/overflow-${role}-${width}.png`});console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>({class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,position:getComputedStyle(el).position})).filter(e=>e.right>innerWidth+1).slice(0,12))));assert.fail(`${role} ${route} ${width} overflow`);}report.push({role,route,width,pass:true});}await page.setViewportSize({width:1440,height:1000});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);await context.close();
 }
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,next:'16.3.8',pass:true,views:report.length,report},null,2));console.log(`PASS ${report.length} shared-root views; one toast layer, saved message survives navigation, document/auth state persists, navigation progress completes.`);
}catch(e){console.error(safe(e.stack));process.exitCode=1;}finally{await browser.close();}
