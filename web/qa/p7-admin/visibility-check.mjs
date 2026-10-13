import fs from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {chromium} from 'playwright';
const origin='http://localhost:3702',auth='http://127.0.0.1:3712';
const dsn=fs.readFileSync('.env.local','utf8').match(/^MEETANY_LOCAL_DATABASE_URL=(.+)$/m)[1].replace(/^['"]|['"]$/g,'');
assert.equal(new URL(dsn).pathname,'/meetany_preview_p7_admin');
const db=new pg.Client({connectionString:dsn});await db.connect();
const admin=(await db.query("select id from public.profiles where role='admin' limit 1")).rows[0].id;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
async function person(role,label){const id=randomUUID();await db.query('insert into neon_auth."user"(id,name,email) values($1,$2,$3)',[id,label,`${id}@qa.invalid`]);await db.query("insert into public.profiles(id,role,name,company,phone,email,city,industry,verified,onboarding_completed_at,verification_documents_status) values($1,$2,$3,$3,$4,$5,'tbilisi','other',true,now(),'approved')",[id,role,label,`+995 599 ${randomInt(100,999)} ${randomInt(100,999)}`,`${id}@qa.invalid`]);return id;}
async function rpc(id,name,args){const jwt=(await(await fetch(`${auth}/__mint?sub=${id}`)).json()).token,r=await fetch(`${origin}/api/db/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${jwt}`},body:JSON.stringify(args)}),v=await r.json();assert(r.ok,`${name}: ${JSON.stringify(v)}`);return v;}
async function context(id,width){const jwt=(await(await fetch(`${auth}/__mint?sub=${id}`)).json()).token,ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});await ctx.route(`${auth}/**`,route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'set-auth-jwt','set-auth-jwt':jwt},json:route.request().url().endsWith('/get-session')?{user:{id,email:'qa@qa.invalid',name:'QA'}}:{token:jwt}}));await ctx.addInitScript(()=>localStorage.setItem('meetany.session','1'));return ctx;}
const evidence=[];
try {
 for(const result of JSON.parse(fs.readFileSync('qa/p7-admin/results.json','utf8'))){
  const {width,ids:{buyer,seller}}=result;
  await rpc(admin,'admin_set_blocked',{p_user_id:seller,p_blocked:false,p_reason:null});
  await rpc(admin,'admin_set_company_hidden',{p_user_id:seller,p_hidden:true,p_reason:'საჯარო ხილვადობის შემოწმება'});
  const ctx=await context(buyer,width),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/companies/view/?id=${seller}`);await page.getByText('კომპანია ვერ მოიძებნა',{exact:true}).waitFor();await page.screenshot({path:`qa/p7-admin/shots/${width}-hidden-public.png`,animations:'disabled'});
  await rpc(admin,'admin_set_company_hidden',{p_user_id:seller,p_hidden:false,p_reason:'საჯარო ხილვადობის აღდგენა'});
  const conversation=(await db.query('select id from meetany_private.conversations where client_id=$1 and company_id=$2',[buyer,seller])).rows[0].id;
  await page.goto(`${origin}/account/?tab=messages&c=${conversation}`);await page.getByText('საუბრის მოქმედებები',{exact:true}).click();await page.getByRole('button',{name:'საჩივარი ადმინისტრაციას',exact:true}).click();await page.getByLabel('შეურაცხმყოფელი შინაარსი',{exact:true}).check();await page.waitForTimeout(350);await page.screenshot({path:`qa/p7-admin/shots/${width}-conversation-report.png`,animations:'disabled'});await page.locator('dialog[open]').getByRole('button',{name:'გაგზავნა',exact:true}).click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);assert.deepEqual(errors,[]);evidence.push({width,hiddenPublicPage:true,conversationReport:true,overflow:0,pageerrors:0});await ctx.close();
 }
 fs.writeFileSync('qa/p7-admin/visibility-results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} finally {await browser.close();await db.end();}
