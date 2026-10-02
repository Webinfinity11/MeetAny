import fs from 'node:fs';
import {chromium} from 'playwright';
import {auth,credentials,assert,safe} from './e2e/lib.mjs';
import {guard,readRPCs} from './visual/lib/browser.mjs';

// Visible review of the published website. No application mutations are allowed.
const origin='https://meet-any.vercel.app';
const output='qa/shots/live-visible';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000']});
const context=await browser.newContext({viewport:null});
const page=await context.newPage(),state={blocked:[],chat:null,interceptions:0},checks=[],errors=[];
await guard(context,state);
// Even read acknowledgements are intercepted in this production inspection.
await page.route('**/api/**',route=>{
 const request=route.request(),url=new URL(request.url()),rpc=url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
 if(['GET','HEAD','OPTIONS'].includes(request.method())||rpc&&readRPCs.has(rpc)&&rpc!=='mark_read')return route.fallback();
 if(/\/api\/auth\//.test(url.pathname)&&/\/(sign-in|session|get-session|token)/.test(url.pathname))return route.fallback();
 state.blocked.push(`${request.method()} ${url.pathname}`);return route.abort('blockedbyclient');
});
page.on('pageerror',e=>errors.push(e.message));
async function stage(name){console.log(`LIVE: ${name}`);checks.push(name);await page.screenshot({path:`${output}/${String(checks.length).padStart(2,'0')}.png`,fullPage:true});await page.waitForTimeout(2400);}
async function ready(){await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000});await page.evaluate(()=>document.fonts.ready);}
try{
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await ready();await stage('მთავარი გვერდი');
 await page.locator('header a[href="/companies/"]').filter({visible:true}).first().click();await page.waitForURL(origin+'/companies/');await ready();await stage('კომპანიების კატალოგი');
 const links=await page.locator('main a[href^="/companies/view/?id="]').evaluateAll(nodes=>[...new Map(nodes.map(n=>[n.getAttribute('href'),{href:n.getAttribute('href'),title:n.getAttribute('aria-label')||n.textContent.trim()}])).values()]);
 assert(links.length>=2,'Two real company links required');
 const first=links[0],second=links[1];
 await page.locator(`main a[href="${first.href}"]`).first().click();await page.waitForURL(origin+first.href);await ready();
 const firstName=await page.locator('main h1').innerText();await stage(`სხვა კომპანიის პროფილი: ${firstName}`);
 await page.goto(origin+second.href,{waitUntil:'domcontentloaded'});await ready();const secondName=await page.locator('main h1').innerText();assert.notEqual(firstName,secondName,'Different company IDs render different profiles');await stage(`მეორე კომპანიის პროფილი: ${secondName}`);
 await page.locator('header a[href="/requests/"]').filter({visible:true}).first().click();await page.waitForURL(origin+'/requests/');await ready();await stage('მოთხოვნების სია');
 const request=page.locator('main a[href^="/requests/view/?id="]').first();assert(await request.count(),'Real request link');await request.click();await page.waitForURL(/\/requests\/view/);await ready();await stage('მოთხოვნის დეტალები');
 const response=await page.request.post(auth+'/sign-in/email',{data:credentials('wood')});assert(response.ok(),`Existing company sign-in ${response.status()}`);
 await page.goto(origin+'/companies/',{waitUntil:'domcontentloaded'});await ready();await page.locator('button[aria-controls="notification-list"]').waitFor({timeout:30000});await stage('შესული კომპანიის კატალოგი');
 await page.locator(`main a[href="${first.href}"]`).first().click();await page.waitForURL(origin+first.href);await ready();assert.equal(await page.locator('main h1').innerText(),firstName,'Signed-in viewer opens selected public profile');await stage('პროფილის ბმული შესული ანგარიშიდანაც');
 await page.locator('button[aria-controls="notification-list"]').click();await page.locator('#notification-list').waitFor();await stage('შეტყობინებების ფანჯარა');await page.keyboard.press('Escape');
 await page.goto(origin+'/account/?tab=offers',{waitUntil:'domcontentloaded'});await ready();await stage('გაგზავნილი შეთავაზებები ანგარიშში');
 assert.deepEqual(errors,[]);assert.deepEqual(state.blocked,[]);
 console.log(`PASS: ${checks.length} visible live checks; business writes 0. Browser remains open for inspection.`);
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:true,checks,first:{href:first.href,name:firstName},second:{href:second.href,name:secondName},errors,blocked:state.blocked,businessWrites:0},null,2));
}catch(e){console.error(safe(e.stack));fs.writeFileSync(`${output}/report.json`,JSON.stringify({origin,pass:false,checks,error:safe(e.message),errors,blocked:state.blocked,businessWrites:0},null,2));process.exitCode=1;}
// Keep the user-visible browser open; closing its window completes this session.
await new Promise(resolve=>browser.once('disconnected',resolve));
