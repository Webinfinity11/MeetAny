// Local QA only. Keep credentials and the reusable session outside reports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
export const origin=process.env.BASE||process.env.QA_ORIGIN||'http://localhost:3003';
const base=origin;
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).flatMap(line=>{const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];}));
export const auth=env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
const ledgerPaths=[new URL('../DEMO-ACCOUNTS.local.md',import.meta.url),new URL('../../DEMO-ACCOUNTS.local.md',import.meta.url)];
const ledger=JSON.parse(fs.readFileSync(ledgerPaths.find(p=>fs.existsSync(p)),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
export async function token(page){const response=await page.request.get(auth+'/token');assert(response.ok(),'Auth token response');return (await response.json()).token;}
export async function adminSession(browser,key){
 const file=`/tmp/meetany-admin-${new URL(base).port}-${key}.json`;
 const context=await browser.newContext({...(fs.existsSync(file)?{storageState:file}:{}),viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 let jwt=fs.existsSync(file)?await token(page).catch(()=>null):null;
 if(!jwt){const account=ledger.accounts[key];const login=await page.request.post(auth+'/sign-in/email',{data:{email:account.email,password:account.password}});assert(login.ok(),`Admin login HTTP ${login.status()}`);jwt=await token(page);}
 const profile=await page.request.post(base+'/api/db/rpc/my_profile',{headers:{Authorization:`Bearer ${jwt}`},data:{}});assert(profile.ok(),`Local profile HTTP ${profile.status()}: ${profile.ok()?'':safe(await profile.text())}`);const data=await profile.json(),me=Array.isArray(data)?data[0]:data;assert(me&&!me.blocked,'Active local profile');if(key==='owner_admin')assert.equal(me.role,'admin');
 await context.storageState({path:file});fs.chmodSync(file,0o600);
 return {context,page};
}

export {assert};
export const credentials=key=>({email:ledger.accounts[key].email,password:ledger.accounts[key].password});
export const safe=value=>Object.values(ledger.accounts).reduce((text,account)=>account.password?text.replaceAll(account.password,"[redacted]"):text,String(value).replace(/Bearer\s+[^\s"']+/g,"Bearer [redacted]"));
export async function rpc(page,name,args={}){const jwt=await token(page);const response=await page.request.post(base+"/api/db/rpc/"+name,{headers:{Authorization:`Bearer ${jwt}`},data:args});assert(response.ok(),`${name}: HTTP ${response.status()}`);return response.json();}
