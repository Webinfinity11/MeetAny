// Default is read-only. Applies only the exact reviewed plan to existing fixture records.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {request} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const origin='https://meet-any.vercel.app';
const approvedHash='000bfb89757e11f45300107c77c7c99c288096f7630ca7fb63d7063dcea37980';
const args=process.argv.slice(2),apply=args.includes('--apply');
assert(args.every(a=>a==='--apply'||a===`--expect-plan=${approvedHash}`),'Unsupported argument');
assert(!apply||args.includes(`--expect-plan=${approvedHash}`),'Reviewed hash required');
const plan=JSON.parse(fs.readFileSync(path.join(root,'qa/shots/fixture-copy-audit/plan.json'),'utf8'));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(digest(plan.adminRpcPlan),approvedHash,'Reviewed admin plan changed');
assert.equal(plan.adminRpcPlan.length,9);assert.equal(plan.actorOfferProposals.length,3);
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).flatMap(l=>{const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[]}));
assert(['ep-withered-glade-b54ts1g5-pooler.c-7.us-east-2.aws.neon.tech','ep-withered-glade-b54ts1g5.c-7.us-east-2.aws.neon.tech'].includes(new URL(env.DATABASE_URL).hostname),'Unexpected database');
const auth='https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
assert.equal(env.NEON_AUTH_BASE_URL.replace(/\/$/,''),auth);
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const journal=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-FEATURES.local.json'),'utf8'));
const fixtureRequests={...ledger.v2.requests,...journal.requests};
const offerIds=new Set(['c11289df-9e83-4c1b-b94c-0b36fbe7a0c8','6b8d74f3-0235-42e0-b728-aa2fe75fd87d','a760207e-6b10-461a-9b5a-ce6e14bfa902']);
for(const change of plan.adminRpcPlan){assert.equal(change.id,change.kind==='profile'?ledger.accounts[change.key]?.id:fixtureRequests[change.key]);assert(Object.keys(change.patch).every(k=>change.kind==='profile'?k==='about':['title','body'].includes(k)));}
for(const change of plan.actorOfferProposals){assert(offerIds.has(change.id));assert.equal(change.company_id,ledger.accounts[change.actor]?.id);assert.equal(change.request_id,ledger.v2.requests.tables);assert.equal(change.status,'sent');}
const sql=neon(env.DATABASE_URL),query=(text,values=[])=>{assert(/^select\b/i.test(text),'Only SQL reads allowed');return sql.query(text,values);};
const report={origin,mode:apply?'approved apply':'read-only',reviewHash:approvedHash,completed:[],pass:false};
const output=path.join(root,'qa/shots/fixture-copy-audit/apply-report.json');
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600});
const sessions=new Map();
let beforeSnapshots;
async function session(key){
 if(sessions.has(key))return sessions.get(key);
 const context=await request.newContext({timeout:20000});sessions.set(key,{context});const account=ledger.accounts[key];
 const login=await context.post(auth+'/sign-in/email',{data:{email:account.email||`demo-${key}@meetany.ge`,password:account.password}});assert(login.ok(),`Sign in ${key}: HTTP ${login.status()}`);
 const tokenResponse=await context.get(auth+'/token');assert(tokenResponse.ok(),`Token ${key} unavailable`);const jwt=(await tokenResponse.json()).token;assert(jwt);
 const rpc=async(name,data={})=>{assert(['my_profile','admin_edit_profile','admin_edit_request','send_offer'].includes(name));const result=await context.post(origin+'/api/db/rpc/'+name,{headers:{Authorization:'Bearer '+jwt},data});assert(result.ok(),`${key} ${name}: HTTP ${result.status()}`);return result.json();};
 const me=(await rpc('my_profile'))[0];assert.equal(me?.id,account.id);assert.equal(me?.role,key==='owner_admin'?'admin':'company');assert(!me.blocked);const session={context,rpc};sessions.set(key,session);return session;
}
const tableFor=change=>change.kind==='profile'?'profiles':change.kind==='request'?'requests':'offers';
async function row(table,id){assert(['profiles','requests','offers'].includes(table));return(await query(`select * from public.${table} where id=$1::uuid`,[id]))[0];}
function assertFields(current,expected,label){for(const[k,v]of Object.entries(expected))assert.equal(digest(current[k]),digest(v),`${label}: ${k} changed`);}
async function snapshotDigests(){const result={};for(const table of ['profiles','requests','offers'])result[table]=await query(`select id,md5(t::text) as digest from public.${table} t order by id`);return result;}
async function verifyOtherRows(){const afterSnapshots=await snapshotDigests();for(const table of Object.keys(beforeSnapshots)){const allowed=new Set(report.completed.filter(c=>tableFor(c)===table).map(c=>c.id));assert.equal(beforeSnapshots[table].length,afterSnapshots[table].length,`${table} count changed`);const after=new Map(afterSnapshots[table].map(r=>[r.id,r.digest]));for(const old of beforeSnapshots[table])assert(after.has(old.id)&&(allowed.has(old.id)||after.get(old.id)===old.digest),`${table} other record changed`);}report.preservedOtherRows=true;}
try{
 beforeSnapshots=await snapshotDigests();
 if(apply)fs.writeFileSync(path.join(root,'qa/shots/fixture-copy-audit/baseline-digests.json'),JSON.stringify(beforeSnapshots,null,2),{mode:0o600});
 const changes=plan.adminRpcPlan.map(c=>({...c,table:tableFor(c)}));
 for(const change of changes){change.beforeRow=await row(change.table,change.id);assert(change.beforeRow);assertFields(change.beforeRow,change.identity,change.key);assertFields(change.beforeRow,change.before,change.key);}
 const offers=[];
 for(const proposal of plan.actorOfferProposals){const before=await row('offers',proposal.id);assertFields(before,{request_id:proposal.request_id,company_id:proposal.company_id,status:'sent',body:proposal.before,...proposal.existingTerms},proposal.actor);const req=await row('requests',proposal.request_id);assert.equal(req.owner_id,ledger.accounts.cafe.id);assert.equal(req.status,'open');assert(!req.hidden&&!req.chosen_offer_id);assert(Date.parse(req.expires_at)>Date.now());offers.push({proposal,before});}
 if(apply){
  // Authenticate every existing actor before the first mutation.
  for(const key of ['owner_admin',...offers.map(o=>o.proposal.actor)])await session(key);
  const admin=await session('owner_admin');
  for(const change of changes){const fresh=await row(change.table,change.id);assert.equal(digest(fresh),digest(change.beforeRow),`${change.key} concurrent edit`);await admin.rpc(change.rpc,{p_id:change.id,p_patch:change.patch});const updated=await row(change.table,change.id);assertFields(updated,{...fresh,...change.patch},change.key);report.completed.push({kind:change.kind,key:change.key,id:change.id,changedFields:Object.keys(change.patch)});persist();console.log(`Verified ${change.kind} ${change.key}`);}
  for(const {proposal:p,before}of offers){const fresh=await row('offers',p.id);assert.equal(digest(fresh),digest(before),`${p.actor} concurrent offer edit`);const req=await row('requests',p.request_id);assert.equal(req.owner_id,ledger.accounts.cafe.id);assert(!req.hidden&&!req.chosen_offer_id&&req.status==='open');const actor=await session(p.actor);const returned=await actor.rpc('send_offer',{p_request_id:p.request_id,p_body:p.proposed,p_price:before.price,p_price_type:before.price_type,p_vat_included:before.vat_included,p_delivery_days:before.delivery_days,p_delivery_included:before.delivery_included});assert.equal(returned.id,p.id);const updated=await row('offers',p.id);assertFields(updated,Object.fromEntries(Object.entries({...before,body:p.proposed}).filter(([k])=>k!=='updated_at')),p.actor);report.completed.push({kind:'offer',key:p.actor,id:p.id,changedFields:['body','updated_at']});persist();console.log(`Verified offer ${p.actor}`);}
  await verifyOtherRows();
 }
 report.pass=true;report.preservedOtherRows=true;report.chosenOffersUntouched=plan.keptChosenOffers.map(o=>o.id);persist();console.log(`PASS ${apply?report.completed.length:changes.length+offers.length} bounded fixture copies; no SQL mutations; counts and other rows preserved`);
}catch(error){report.error=error?.code==='ERR_ASSERTION'?error.message:'Operation failed; inspect privately without logging credentials';if(beforeSnapshots){try{await verifyOtherRows();}catch{report.preservedOtherRows=false;}}persist();console.error(report.error);process.exitCode=1;}
finally{for(const{context}of sessions.values())await context.dispose();}
