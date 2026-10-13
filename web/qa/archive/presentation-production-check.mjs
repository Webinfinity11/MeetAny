// Production presentation checks; existing demo accounts only, no marketplace writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin='https://meet-any.vercel.app';
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).flatMap(l=>{const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[]}));
const auth=env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
const out='qa/shots/presentation-production';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={origin,checks:[],errors:[]};
async function loaded(p){await p.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]') && (document.querySelector('main')?.innerText.length||0)>30,null,{timeout:60000});assert(!(await p.locator('main').innerText()).includes('სერვისი დროებით მიუწვდომელია'));}
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`});assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);}
try {
 const guest=await browser.newContext({viewport:{width:1440,height:1000}}),p=await guest.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));
 const counts={};
 for(const table of ['profiles','requests']){const r=await p.request.get(origin+`/api/db/${table}?select=id&limit=1000`);assert.equal(r.status(),200);counts[table]=(await r.json()).length;assert(counts[table]>0);}
 report.counts=counts;
 await p.goto(origin+'/requests/');await loaded(p);await p.locator('.request-card').first().waitFor();
 const detail=await p.locator('.card-main-link').first().getAttribute('href');
 await shot(p,'requests');
 const photos=await p.locator('.request-card img').evaluateAll(nodes=>nodes.map(n=>n.src));
 for(const url of photos.slice(0,3)){const r=await p.request.get(url);assert.equal(r.status(),200);}
 await p.goto(origin+'/companies/');await loaded(p);await p.locator('.supplier-row').first().waitFor();await shot(p,'companies');
 pass('public requests, companies and photos');await guest.close();
 for(const [key,role] of [['owner_admin','admin'],['owner_user','client'],['wood','company']]){
  const c=await browser.newContext({viewport:{width:1440,height:1000}}),page=await c.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  const account=ledger.accounts[key];
  await page.goto(origin+'/account/');await loaded(page);
  await page.locator('#login-email').fill(account.email || `demo-${key}@meetany.ge`);
  await page.locator('#login-password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.locator('#login-email').waitFor({state:'hidden',timeout:45000});await loaded(page);
  const tokenResponse=await page.request.get(auth+'/token');assert.equal(tokenResponse.status(),200);
  const token=(await tokenResponse.json()).token;assert(token);
  const rpc=async(name,args={})=>{const r=await page.request.post(origin+'/api/db/rpc/'+name,{headers:{Authorization:'Bearer '+token},data:args});assert.equal(r.status(),200,role+' '+name);return r.json();};
  const [me]=await rpc('my_profile');assert.equal(me.role,role);assert(!me.blocked);
  await rpc('list_my_conversations');await rpc('engagement_state');
  if(role==='admin'){
   const stats=await rpc('admin_stats');report.adminStats=stats;
   for(const tab of ['users','requests','audit','contacts']){await page.goto(origin+'/admin/?tab='+tab);await loaded(page);await page.locator('[aria-label="ადმინისტრირების განყოფილებები"]').waitFor();assert.equal(await page.locator('main [role="alert"]').count(),0);}
   await page.goto(origin+'/admin/?tab=users');await loaded(page);await shot(page,'admin');
  }else{
   await page.goto(origin+'/account/?tab=profile');await loaded(page);await page.locator('#profile-city').waitFor();await shot(page,role+'-profile');
   await page.goto(origin+detail);await loaded(page);await page.locator('.request-description').waitFor();
   if(role==='company') assert(await page.getByRole('heading',{name:/შეთავაზებ/}).count()>0);
   await page.goto(origin+'/admin/');await loaded(page);assert.equal(await page.locator('main table').count(),0);
  }
  await page.goto(origin+'/account/');await loaded(page);await page.reload();await loaded(page);assert.equal(await page.locator('#login-email').count(),0);
  pass(role+' login, session, role access and account data');await c.close();
 }
 assert.deepEqual(report.errors,[]);pass('zero browser runtime errors');
} catch(error){report.failure=String(error.message);console.error(report.failure);process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
