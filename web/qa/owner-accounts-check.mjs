// მხოლოდ შესვლა და უფლებების წაკითხვის შემოწმება; ledger/ტოკენები არასოდეს იბეჭდება.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname,'..');
const base = process.env.DEMO_API_ORIGIN || 'http://localhost:3001';
assert.equal(base,'http://localhost:3001','Use the authorized local server');
for (const line of fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
assert.equal(process.env.NEON_AUTH_BASE_URL?.replace(/\/$/,''),'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth');
assert.match(new URL(process.env.DATABASE_URL).hostname,/^ep-withered-glade-b54ts1g5(?:-pooler)?\./);
const state = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const out = path.join(root,'qa/shots/owner-accounts');
fs.mkdirSync(out,{recursive:true});
const report = {accounts:{},checks:[]};
const check = (name,ok) => {report.checks.push({name,pass:!!ok}); console.log(ok?'PASS':'FAIL',name);};
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const loaded = p => p.waitForFunction(()=> (document.querySelector('main')?.innerText.length||0)>20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
async function shot(p,name) {
  assert.equal(await p.locator('#login-password').count(),0,'Never capture password form');
  await p.evaluate(()=>document.fonts.ready);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.screenshot({path:path.join(out,name),fullPage:true});
}
try {
  for (const key of ['owner_user','owner_admin','owner_company']) {
    const account=state.accounts[key];
    assert(account?.id && account?.password,'Missing ledger account');
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
    try {
      const p=await ctx.newPage();
      let jwt;
      p.on('request',req=>{
        if (!req.url().startsWith(base+'/api/db/')) return;
        const token=req.headers().authorization?.replace(/^Bearer /,'');
        try {if (token && JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub===account.id) jwt=token;} catch { /* anonymous request */ }
      });
      await p.goto(base+'/account/',{waitUntil:'networkidle'});
      await p.locator('#login-email').fill(account.email);
      await p.locator('#login-password').fill(account.password);
      await p.locator('form button[type="submit"]').click();
      await p.locator('#login-email').waitFor({state:'detached',timeout:60000});
      await loaded(p);
      if (key==='owner_admin') {
        await p.waitForURL('**/admin/');
        await loaded(p);
        check(key+' admin redirect',new URL(p.url()).pathname==='/admin/' && await p.locator('#login-email').count()===0);
      } else {
        check(key+' account',new URL(p.url()).pathname==='/account/' && await p.locator('.account-main').count()>0);
      }
      assert(jwt,'Authenticated API token not observed');
      const result=report.accounts[key]={id:account.id,role:account.role,rpc:{}};
      if (key==='owner_user') await shot(p,'user-account-1440.png');
      for (const fn of ['admin_stats','admin_list_users']) {
        const res=await ctx.request.post(base+'/api/db/rpc/'+fn,{headers:{Authorization:'Bearer '+jwt},data:{}});
        const data=await res.json();
        result.rpc[fn]={status:res.status(),code:data?.code||null,hint:data?.hint||null};
        check(key+' '+fn,key==='owner_admin'?res.status()===200:res.status()===400 && data?.code==='P0001' && data?.hint==='MA003');
      }
      await p.goto(base+'/admin/',{waitUntil:'networkidle'});
      await loaded(p);
      if (key==='owner_admin') {
        await p.locator('a[href="/admin/?tab=users"]').click();
        await p.waitForURL('**/admin/?tab=users');
        await loaded(p);
        await p.locator('main .ma-table tbody tr').first().waitFor({timeout:60000});
        result.admin={url:p.url(),rows:await p.locator('main .ma-table tbody tr').count()};
        check(key+' admin users loaded',result.admin.rows>0);
        await shot(p,'admin-panel-1440.png');
      } else {
        const message='ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.';
        result.admin={url:p.url(),message:await p.locator('main .ma-empty__text').innerText(),tableCount:await p.locator('main .ma-table').count()};
        check(key+' admin denied',result.admin.message===message && result.admin.tableCount===0);
        await shot(p,key+'-admin-denied-1440.png');
      }
    } finally {await ctx.close();}
  }
} catch {
  // Playwright exceptions may include filled values in call logs: never output them.
  check('execution completed',false);
  process.exitCode=1;
} finally {
  await browser.close();
  report.pass=report.checks.length===12 && report.checks.every(c=>c.pass);
  fs.writeFileSync(path.join(root,'qa/owner-accounts-report.json'),JSON.stringify(report,null,2)+'\n');
  if (!report.pass) process.exitCode=1;
}
