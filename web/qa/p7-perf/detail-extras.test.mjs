import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='../components/Toasts')return {url:'data:text/javascript,export function toast(){}',shortCircuit:true};return next(s,c);}});
globalThis.window=undefined;globalThis.sessionStorage=null;
process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL='https://auth.example.test/auth';
const {createMarketStore}=await import('../../app/lib/market-store.js');
const id='00000000-0000-4000-8000-000000000001';
async function setup(t,{kind='request',missing=false,signedIn=false,hold=false,offers=[],waitForReady=true,holdBootstrap=false}={}) {
 const calls=[];let version=1,release,entered;const gate=new Promise(r=>{release=r;});const started=new Promise(r=>{entered=r;});let releaseBootstrap,enterBootstrap;const bootstrapGate=new Promise(r=>{releaseBootstrap=r;});const bootstrapStarted=new Promise(r=>{enterBootstrap=r;});
 t.mock.property(globalThis,'window',{location:{href:`http://localhost/${kind==='request'?'requests':'companies'}/view/?id=${id}`}});
 t.mock.method(console,'error',()=>{});
 t.mock.method(globalThis,'fetch',async(raw,options={})=>{
  const path=new URL(raw).pathname;calls.push(path);
  if(path.endsWith('/get-session'))return Response.json(signedIn?{user:{id,email:'local@test.invalid'}}:null);
  if(path.endsWith('/token'))return Response.json({token:`x.${Buffer.from(JSON.stringify({sub:id,exp:Date.now()/1000+3600})).toString('base64url')}.x`});
  if(path.endsWith('/sign-out')){signedIn=false;return Response.json({});}
  if(path.endsWith('/bootstrap')){enterBootstrap();if(holdBootstrap)await bootstrapGate;return Response.json({me:signedIn?{id,role:'client',name:'owner'}:null,requests:[],offers,companies:[],profiles:[],counts:[],companyStats:[],contacts:[],capabilities:{},engagement:null});}
  if(path.endsWith('_detail_extras')){const privateFor=signedIn?id:null;entered();if(hold)await gate;return missing?Response.json({code:'PGRST202',message:'missing'},{status:404}):Response.json({preferences:{version,...(privateFor?{privateFor}:{})},attachments:[{id:'file'}],offerAttachments:{},businessFeatures:[{id}],products:[{name:'product'}],reviews:{items:[],total:0},stats:{completedDeals:3}});}
  if(path.endsWith('/set_request_preferences')){version++;return Response.json({version});}
  if(path.endsWith('/request_preferences'))return Response.json({legacy:true});
  if(path.endsWith('/list_attachments'))return Response.json([{id:'legacy-file'}]);
  if(path.endsWith('/list_attachments_many'))return Response.json(Object.fromEntries(JSON.parse(options.body).p_targets.map(id=>[id,[]])));
  if(path.endsWith('/company_business_features'))return Response.json([{legacy:true}]);
  throw Error('Unexpected '+path+' '+options.body);
 });
 const store=createMarketStore();if(waitForReady)await store.ready();
 return {store,calls,release,started,releaseBootstrap,bootstrapStarted};
}
test('request sibling reads share one aggregate and preserve individual return shapes',async t=>{
 const {store,calls}=await setup(t);
 const [p,a,f]=await Promise.all([store.callRpc('request_preferences',{p_request_id:id}),store.listAttachments('request',id),store.companyBusinessFeatures()]);
 assert.deepEqual(p,{version:1});assert.deepEqual(a,[{id:'file'}]);assert.deepEqual(f,[{id}]);
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,1);
 assert.equal(calls.filter(x=>x.includes('/rpc/')).length,1);
});
test('company products reviews and stats share one aggregate',async t=>{
 const {store,calls}=await setup(t,{kind:'company'});
 const [p,r,s]=await Promise.all([store.companyProducts(id),store.companyReviews(id),store.callRpc('company_public_stats',{p_company_id:id})]);
 assert.equal(p[0].name,'product');assert.equal(r.total,0);assert.equal(s.completedDeals,3);
 assert.equal(calls.filter(x=>x.includes('/rpc/')).length,1);
});
test('PGRST202 falls back for every section and does not retry absent aggregate',async t=>{
 const {store,calls}=await setup(t,{missing:true});
 const [p,a]=await Promise.all([store.callRpc('request_preferences',{p_request_id:id}),store.listAttachments('request',id)]);
 assert.deepEqual(p,{legacy:true});assert.equal(a[0].id,'legacy-file');
 assert.deepEqual(await store.companyBusinessFeatures(),[{legacy:true}]);
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,1);
});
test('preference write invalidates the coalesced response immediately',async t=>{
 const {store,calls}=await setup(t);
 assert.equal((await store.callRpc('request_preferences',{p_request_id:id})).version,1);
 await store.callRpc('set_request_preferences',{p_request_id:id,p_preferences:{}});
 assert.equal((await store.callRpc('request_preferences',{p_request_id:id})).version,2);
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,2);
});
test('leaving detail page restores ordinary reads',async t=>{
 const {store,calls}=await setup(t);window.location.href='http://localhost/requests/';
 assert.deepEqual(await store.companyBusinessFeatures(),[{legacy:true}]);
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,0);
});

test('an aggregate started before logout cannot return private preferences after logout',async t=>{
 const {store,release,started}=await setup(t,{signedIn:true,hold:true});
 const old=store.callRpc('request_preferences',{p_request_id:id});await started;
 await store.logout();release();
 assert.deepEqual(await old,{legacy:true});
 assert.equal(store.currentUser(),null);
});

test('missing detail RPC retains the legacy offer-file micro-batcher',async t=>{
 const a='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003';
 const {store,calls}=await setup(t,{signedIn:true,missing:true,offers:[a,b].map(offer=>({id:offer,request_id:id,company_id:id}))});
 assert.deepEqual(await Promise.all([store.listAttachments('offer',a),store.listAttachments('offer',b)]),[[],[]]);
 assert.equal(calls.filter(x=>x.endsWith('/request_detail_extras')).length,1);
 assert.equal(calls.filter(x=>x.endsWith('/list_attachments_many')).length,1);
 assert.equal(calls.filter(x=>x.endsWith('/list_attachments')).length,0);
});

test('a product read before bootstrap joins later review/stat reads under the settled caller',async t=>{
 const {store,calls,releaseBootstrap,bootstrapStarted}=await setup(t,{kind:'company',holdBootstrap:true,waitForReady:false});
 const products=store.companyProducts(id);await bootstrapStarted;
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,0);
 releaseBootstrap();
 const [p,r,s]=await Promise.all([products,store.companyReviews(id),store.callRpc('company_public_stats',{p_company_id:id})]);
 assert.equal(p[0].name,'product');assert.equal(r.total,0);assert.equal(s.completedDeals,3);
 assert.equal(calls.filter(x=>x.endsWith('_detail_extras')).length,1);
});
