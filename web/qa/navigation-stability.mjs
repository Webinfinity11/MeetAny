import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {auth,credentials,root,assert,safe,db} from './e2e/lib.mjs';
import {guard} from './visual/lib/browser.mjs';
const origin=process.env.QA_ORIGIN||'http://localhost:3004';assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output='qa/shots/navigation-stability-local';fs.mkdirSync(output,{recursive:true});
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],report=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),state={blocked:[],chat:null,interceptions:0};await guard(context,state);page.on('pageerror',e=>errors.push(e.message));
 let signedIn=false;for(let n=0;n<6;n++){const response=await page.request.post(auth+'/sign-in/email',{data:credentials('owner_admin')});if(response.ok()){signedIn=true;break;}assert.equal(response.status(),429);await new Promise(resolve=>setTimeout(resolve,20000));}assert(signedIn,'admin signin');
 await page.goto(origin+'/admin/?tab=requests',{waitUntil:'domcontentloaded'});await page.locator('tbody tr').first().waitFor();await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));
 await page.evaluate(()=>{
  const table=document.querySelector('main table');const state={samples:0,skeletons:0,emptyTables:0,remounts:0};window.__qaStability=state;
  const timer=setInterval(()=>{state.samples++;if([...document.querySelectorAll('main .ma-skel,main [aria-busy=true]')].some(el=>el.checkVisibility()))state.skeletons++;if(!document.querySelector('main tbody tr'))state.emptyTables++;if(document.querySelector('main table')!==table)state.remounts++;},50);window.__qaStabilityTimer=timer;
 });
 await page.waitForTimeout(45000);
 const steady=await page.evaluate(()=>{clearInterval(window.__qaStabilityTimer);return window.__qaStability;});assert(steady.samples>=800,'45sec sampling');assert.equal(steady.skeletons,0,'steady admin no skeleton flashes');assert.equal(steady.emptyTables,0,'steady admin list remains');assert.equal(steady.remounts,0,'steady admin table remains mounted');report.push({check:'admin-polling-45-seconds',...steady,pass:true});await context.close();

 const guest=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'}),detail=await guest.newPage(),guestState={blocked:[],chat:null,interceptions:0};await guard(guest,guestState);detail.on('pageerror',e=>errors.push(e.message));
 const fixture=(await db(detail,`requests?select=*&id=eq.${ledger.v2.requests.tables}&limit=1`))[0];assert(fixture,'existing source request for readonly fixture');
 // The server already seeds every public request in HTML. A fresh mock id ensures this test
 // actually takes the uncached detail path rather than passing from that initial snapshot.
 const requestId='00000000-0000-4000-8000-000000005002';let delayed=0;
 await guest.route('**/api/db/requests?**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('id')===`eq.${requestId}`){delayed++;await new Promise(resolve=>setTimeout(resolve,900));return route.fulfill({json:[{...fixture,id:requestId}]});}
  return route.continue();
 });
 await detail.addInitScript(()=>{window.__qaPrematureNotFound=0;new MutationObserver(()=>{if(document.querySelector('main')?.innerText.includes('მოთხოვნა ვერ მოიძებნა'))window.__qaPrematureNotFound++;}).observe(document,{childList:true,subtree:true,characterData:true});});
 await detail.goto(origin+`/requests/view/?id=${requestId}`,{waitUntil:'domcontentloaded'});await detail.locator('.request-detail-facts').waitFor({timeout:60000});
 assert(delayed>0,'uncached request detail read artificially delayed');assert.equal(await detail.evaluate(()=>window.__qaPrematureNotFound),0,'no premature not found while detail loads');assert(await detail.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile detail fits');
 await detail.screenshot({path:`${output}/delayed-request-390.png`,fullPage:true});report.push({check:'request-uncached-900ms-detail',delayed,readResponseMocked:true,prematureNotFound:0,pass:true});assert.deepEqual(guestState.blocked,[]);await guest.close();
 assert.deepEqual(state.blocked,[]);assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,readOnly:true,errors,report},null,2));console.log('PASS: admin steady list 45s and uncached mobile request 900ms delay; no skeleton flash/remount/premature404/runtime errors.');
}catch(error){console.error(safe(error.stack));process.exitCode=1;}finally{await browser.close();}
