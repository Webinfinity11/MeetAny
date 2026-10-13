import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='../components/Toasts')return {url:'data:text/javascript,export function toast() {}',shortCircuit:true};return next(specifier,context);}});
globalThis.sessionStorage=null;
globalThis.window=undefined;
process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL='https://auth.example.test/auth';
const {createMarketStore}=await import('../../app/lib/market-store.js');

test('company profile survives failed completion and reload, then retries without another signup',async t=>{
 const id='00000000-0000-4000-8000-000000000001';
 const input={role:'company',company:'სატესტო კომპანია',name:'საკონტაქტო პირი',phone:'+995 599 123 456',email:'company@example.test',city:'tbilisi',industry:'food_fresh',acceptTerms:true,password:'LocalFixture123!'};
 const storage=new Map();let session=false,me=null,fail=true,signups=0;
 const completions=[];
 t.mock.property(globalThis,'sessionStorage',{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
 t.mock.method(globalThis,'fetch',async(raw,options={})=>{
  const path=new URL(raw,'http://localhost').pathname;
  if(path.endsWith('/get-session'))return Response.json(session?{user:{id,email:input.email,name:input.name}}:null);
  if(path.endsWith('/sign-up/email')){session=true;signups++;return Response.json({user:{id,email:input.email}});}
  if(path.endsWith('/token'))return Response.json({token:`header.${Buffer.from(JSON.stringify({role:'authenticated',sub:id,exp:Date.now()/1000+3600})).toString('base64url')}.signature`});
  if(path.endsWith('/rpc/my_profile'))return Response.json(me);
  if(path.endsWith('/rpc/complete_profile')){
   const p=JSON.parse(options.body);completions.push(p);
   if(fail)return Response.json({message:'MA405: phone already registered',code:'P0001'},{status:400});
   me={id,role:p.p_role,name:p.p_name,company:p.p_company,email:input.email,phone:p.p_phone,city:p.p_city};return Response.json(me);
  }
  if(path.endsWith('/bootstrap'))return Response.json({me,requests:[],offers:[],companies:[],profiles:[],counts:[],companyStats:[],contacts:[],stats:null,capabilities:{engagement:true,emailDelivery:false},engagement:null});
  throw Error('Unexpected call: '+path);
 });
 const store=createMarketStore({background:false});await store.refresh();
 await assert.rejects(store.register(input));
 const {password,...expected}=input;
 assert.equal(store.needsProfile(),true);
 assert.deepEqual(store.pendingProfile(),expected);
 assert.deepEqual(JSON.parse(storage.get('meetany.pendingProfile')),expected);
 const reloaded=createMarketStore({background:false});await reloaded.refresh();
 assert.deepEqual(reloaded.pendingProfile(),expected);
 fail=false;await reloaded.register({...reloaded.pendingProfile(),password:''});
 assert.equal(signups,1);assert.equal(reloaded.currentUser().company,input.company);
 assert.equal(reloaded.needsProfile(),false);assert.equal(storage.size,0);
 assert(completions.length>=2);
 for(const payload of completions){
  assert.equal(payload.p_company,input.company);assert.equal(payload.p_name,input.name);
  assert.equal(payload.p_city,input.city);
  assert.equal(payload.p_industry,input.industry);assert(!JSON.stringify(payload).includes(password));
 }
});
