#!/usr/bin/env node
// პაროლები მხოლოდ OWNER_USER_PASSWORD / OWNER_ADMIN_PASSWORD / OWNER_COMPANY_PASSWORD env-ით; --verify კითხულობს ledger-ს.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md');
const LOCK = FILE + '.lock';
const BASE = process.env.DEMO_API_ORIGIN || 'http://localhost:3001';
const UPLOAD = BASE;
const VERIFY = process.argv.includes('--verify');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const AUTH = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
assert.equal(AUTH, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth', 'Wrong Neon Auth branch');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'Wrong database branch');
for (const origin of [BASE, UPLOAD]) assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use a local API connected to auth-probe');

const accounts = [
  {key:'owner_user', email:'user@gmail.com', role:'client', name:'სატესტო მომხმარებელი', label:'მფლობელის სატესტო კლიენტი', env:'OWNER_USER_PASSWORD'},
  {key:'owner_admin', email:'admin@gmail.com', role:'admin', name:'სატესტო ადმინი', label:'მფლობელის სატესტო ადმინი', env:'OWNER_ADMIN_PASSWORD'},
  {key:'owner_company', email:'company@gmail.com', role:'company', name:'სატესტო კომპანია', company:'სატესტო კომპანია', industry:'logistics', city:'tbilisi', about:'ვუზრუნველყოფთ ტვირთის გადაზიდვასა და დისტრიბუციას საქართველოს მასშტაბით.', label:'მფლობელის სატესტო კომპანია', env:'OWNER_COMPANY_PASSWORD'},
];
let state, changes = 0;
async function json(url, options={}) {
  let res;
  try { res = await fetch(url,{...options,signal:AbortSignal.timeout(45000)}); }
  catch(err) { throw new Error(`${new URL(url).pathname}: ${err.cause?.code || err.name}`); }
  const data = await res.json().catch(()=>null);
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).pathname}: HTTP ${res.status} (${data?.code || 'request failed'})`),{status:res.status,code:data?.code});
  return {data,res};
}
async function login(a) {
  const jar = new Map();
  async function auth(route, body, attempt=0) {
    let out;
    try { out = await json(AUTH+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined}); }
    catch(err) { // Neon Auth rate-limits sign-ins; ten accounts in a row hit it.
      if (err.status!==429 || attempt>=8) throw err;
      await new Promise(r=>setTimeout(r,30000));
      return auth(route, body, attempt+1);
    }
    for (const c of out.res.headers.getSetCookie()) {const pair=c.split(';')[0]; const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
    return out;
  }
  const input={email:a.email,password:state.accounts[a.key].password};
  try {await auth('/sign-in/email',input);}
  catch(err) {
    if (VERIFY || err.code!=='INVALID_EMAIL_OR_PASSWORD') throw err;
    await auth('/sign-up/email',{...input,name:a.name}); changes++; // Verification is off: sign-up creates the session.
  }
  const {data} = await auth('/token');
  assert(data?.token, 'Auth did not issue a JWT');
  a.jwt=data.token;
  a.id=JSON.parse(Buffer.from(a.jwt.split('.')[1],'base64url')).sub;
  if(state.accounts[a.key].id) assert.equal(a.id,state.accounts[a.key].id);
  state.accounts[a.key].id=a.id;

}
async function api(a, route, body) {
  return (await json(BASE+'/api/db/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(a?{Authorization:'Bearer '+a.jwt}:{})},body:body?JSON.stringify(body):undefined})).data;
}
const rpc=(a,name,args={})=>api(a,'rpc/'+name,args);

async function main() {
  fs.closeSync(fs.openSync(LOCK, 'wx', 0o600));
  try {
    let ledger = fs.readFileSync(FILE, 'utf8');
    state = JSON.parse(ledger.match(/```json\n([\s\S]*?)\n```/)[1]);
    for (const a of accounts) {
      const password = VERIFY ? state.accounts[a.key]?.password : process.env[a.env];
      assert(password && !/[|\r\n]/.test(password), 'Missing or invalid password env/ledger');
    }
    const sql = require('@neondatabase/serverless').neon(process.env.DATABASE_URL);
    const snapshot = () => sql`select id,role from public.profiles where email not in ('user@gmail.com','admin@gmail.com','company@gmail.com') order by id`;
    const before = await snapshot();
    const countAdmins = async () => Number((await sql`select count(*) n from public.profiles where role='admin'`)[0].n);
    const adminBefore = await countAdmins();
    let promotions = 0;
    for (const a of accounts) {
      state.accounts[a.key] = {...state.accounts[a.key], password:VERIFY ? state.accounts[a.key].password : process.env[a.env]};
      await login(a);
      let p = (await rpc(a,'my_profile'))[0];
      if (!p) {
        assert(!VERIFY, 'Profile missing');
        const [free] = await sql`select '+995 555 ' || lpad(n::text,6,'0') as digits from generate_series(1,99999) n where not exists (select 1 from public.profiles where phone = '+995 555 ' || substr(lpad(n::text,6,'0'),1,3) || ' ' || substr(lpad(n::text,6,'0'),4,3)) limit 1`;
        assert(free, 'No free demo phone');
        const phone = free.digits.slice(0,12)+' '+free.digits.slice(12);
        assert.equal((await sql`select id from public.profiles where phone=${phone}`).length,0,'Phone occupied');
        p = await rpc(a,'complete_profile',{p_role:a.role==='company'?'company':'client',p_name:a.name,p_company:a.company||a.name,p_phone:phone,p_city:a.city||'tbilisi',p_industry:a.industry||null});
        changes++;
      }
      assert.equal(p.id,a.id,'Profile id mismatch');
      if (a.key==='owner_admin' && p.role!=='admin') {
        assert(!VERIFY, 'Admin role missing');
        const rows = await sql`update public.profiles set role='admin' where id=${a.id}::uuid and email=${a.email} and role='client' returning id`;
        assert.equal(rows.length,1,'Admin promotion failed');
        changes++; promotions++;
      }
      p = (await rpc(a,'my_profile'))[0];
      assert.equal(p.role,a.role,'Unexpected role');
      if (a.role==='company') {
        assert(p.phone, 'Company phone missing; complete_profile cannot update an existing phone');
        assert.equal(p.blocked,false,'Company is blocked');
        const expected = {company:a.company,industry:a.industry,city:a.city,about:a.about};
        if (Object.entries(expected).some(([key,value])=>p[key]!==value)) {
          assert(!VERIFY,'Company profile needs updating');
          const before = p;
          await rpc(a,'update_my_profile',{
            p_name:p.name,p_company:a.company,p_city:a.city,p_industry:a.industry,p_about:a.about,
            p_offers:p.offers,p_seeks:p.seeks,p_service_cities:p.service_cities,
            p_address:p.address,p_lat:p.lat,p_lng:p.lng,p_logo_url:p.logo_url,
          });
          p = (await rpc(a,'my_profile'))[0];
          const unchanged = row => Object.fromEntries(Object.entries(row).filter(([key])=>!Object.hasOwn(expected,key)));
          assert.deepEqual(unchanged(p),unchanged(before),'Unrelated company profile fields changed');
          changes++;
        }
        for (const [key,value] of Object.entries(expected)) assert.equal(p[key],value,'Company '+key+' mismatch');
      }
      if (!VERIFY) {
        state.accounts[a.key] = {password:state.accounts[a.key].password,id:a.id,email:a.email,label:a.label,role:a.role};
        const row = `| ${a.label} | ${a.email} | ${state.accounts[a.key].password} | ${a.role} |`;
        const lines = ledger.split('\n');
        const existing = lines.findIndex(line=>line.startsWith('| ') && line.split(' | ')[1]===a.email);
        if (existing>=0) lines[existing]=row;
        else {
          let insert = lines.findIndex(line=>line.startsWith('|---'))+1;
          assert(insert>0,'Ledger table missing');
          while (lines[insert]?.startsWith('| ')) insert++;
          lines.splice(insert,0,row);
        }
        const next = lines.join('\n').replace(/```json\n[\s\S]*?\n```/,()=> '```json\n'+JSON.stringify(state,null,2)+'\n```');
        if (next!==ledger) {
          fs.copyFileSync(FILE,FILE+'.bak'); fs.chmodSync(FILE+'.bak',0o600);
          fs.writeFileSync(FILE,next,{mode:0o600}); fs.chmodSync(FILE,0o600);
          ledger=next; changes++;
        }
      }
      console.log(a.key,a.id,a.role,'OK');
    }
    assert.deepEqual(await snapshot(),before,'Existing profile ids/roles changed');
    assert.equal(await countAdmins(),adminBefore+promotions,'Admin count mismatch');
    // ცვლილებების რაოდენობა exit-independent metadata-ა; საიდუმლო მონაცემები არ იბეჭდება.
    console.log(JSON.stringify({changes,adminBefore,adminAfter:await countAdmins(),existingProfiles:before.length,OK:true}));
  } finally {fs.unlinkSync(LOCK);}
}
main().catch(err=>{console.error('FAIL', String(err.code || err.message).replace(/eyJ[\w.-]+/g,'[redacted]')); process.exitCode=1;});
