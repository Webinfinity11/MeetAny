import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='../components/Toasts')return {url:'data:text/javascript,export function toast() {}',shortCircuit:true};return next(specifier,context);}});
globalThis.sessionStorage=null;
globalThis.window=undefined;
process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL='https://auth.example.test/auth';
const {createMarketStore}=await import('../../app/lib/market-store.js');
const id='00000000-0000-4000-8000-000000000001';
const input={role:'client',name:'ახალი მომხმარებელი',phone:'+995 599 123 456',email:'new@example.test',city:'tbilisi',password:'LocalFixture123!',acceptTerms:true};
function setup(t,{signedIn=false,pending=null,holdInitial=false,beforeComplete=null}={}){
 let session=signedIn,me=null,fail=false;const calls=[],storage=new Map(pending?[['meetany.pendingProfile',JSON.stringify(pending)]]:[]);
 let releaseInitial,sessionReads=0,signUpDone;const signedUp=new Promise(resolve=>{signUpDone=resolve;});
 let holdBootstrap=false,releaseBootstrap,bootstrapEntered,failGuest=false;
 t.mock.property(globalThis,'sessionStorage',{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
 t.mock.method(globalThis,'fetch',async(raw,options={})=>{
  const path=new URL(raw,'http://localhost').pathname;calls.push(path);
  if(path.endsWith('/get-session')){const before=session;if(++sessionReads===1&&holdInitial)await new Promise(resolve=>{releaseInitial=resolve;});return Response.json(before?{user:{id,email:input.email,name:input.name}}:null);}
  if(path.endsWith('/sign-up/email')){session=true;signUpDone();return Response.json({user:{id,email:input.email}});}
  if(path.endsWith('/email-otp/verify-email')){session=true;return Response.json({user:{id,email:input.email}});}
  if(path.endsWith('/sign-out')){session=false;return Response.json({success:true});}
  if(path.endsWith('/token'))return Response.json({token:`header.${Buffer.from(JSON.stringify({role:'authenticated',sub:id,exp:Date.now()/1000+3600})).toString('base64url')}.signature`});
  if(path.endsWith('/rpc/my_profile'))return Response.json(me);
  if(path.endsWith('/rpc/complete_profile')){
   if(beforeComplete)await beforeComplete();
   if(fail)return Response.json({message:'MA405: phone already registered',code:'P0001'},{status:400});
   const p=JSON.parse(options.body);me={id,role:p.p_role,name:p.p_name,company:p.p_company,email:input.email,phone:p.p_phone,city:p.p_city};return Response.json(me);
  }
  if(path.endsWith('/bootstrap')){
   const authenticated=!!options.headers?.Authorization,profile=authenticated?me:null;
   const data={me:profile,requests:[],offers:profile?[{id:'sealed',company_id:id,request_id:'private',body:'Private offer',price:500}]:[],companies:[],profiles:[],counts:[],companyStats:[],contacts:[],stats:null,capabilities:{engagement:true,emailDelivery:false},engagement:profile?{savedIds:[],unread:0,notifications:{items:[],nextCursor:null}}:null};
   if(holdBootstrap&&authenticated){holdBootstrap=false;bootstrapEntered();await new Promise(resolve=>{releaseBootstrap=resolve;});}
   if(failGuest&&!authenticated)return Response.json({message:'offline'},{status:503});
   return Response.json(data);
  }
  throw Error('Unexpected call: '+path);
 });
 return {calls,storage,setFail:v=>{fail=v;},signedUp,releaseInitial:()=>releaseInitial(),holdBootstrap:()=>{holdBootstrap=true;return new Promise(resolve=>{bootstrapEntered=resolve;});},releaseBootstrap:()=>releaseBootstrap(),failGuest:()=>{failGuest=true;}};
}
test('guest bootstrap needs no anonymous token and no dependent catalog requests',async t=>{
 const f=setup(t),store=createMarketStore({background:false});await store.refresh();
 assert.equal(store.isAvailable(),true);assert.equal(store.currentUser(),null);
 assert.deepEqual(f.calls,['/auth/get-session','/api/db/bootstrap']);
});
test('failed first session/bootstrap read exposes a recoverable state even with a public seed',async t=>{
 const f=setup(t);f.failGuest();t.mock.method(console,'error',()=>{});
 const store=createMarketStore({initial:{requests:[],companies:[],profiles:[],companyStats:[],counts:[]},background:false});
 await store.refresh();
 assert.equal(store.isSessionReady(),true);assert(store.sessionLoadError());
 assert.equal(store.needsProfile(),false);assert.equal(store.currentUser(),null);
});
test('a valid session without a market profile finishes loading and requests profile completion',async t=>{
 setup(t,{signedIn:true});const store=createMarketStore({background:false});await store.refresh();
 assert.equal(store.isSessionReady(),true);assert.equal(store.sessionLoadError(),null);
 assert.equal(store.hasSession(),true);assert.equal(store.needsProfile(),true);
});
test('logout clears private data even when an old signed-in response arrives and guest refresh fails',async t=>{
 const f=setup(t),store=createMarketStore({background:false});await store.refresh();await store.register(input);
 assert.equal(store.myOffers().length,1);
 const entered=f.holdBootstrap(),old=store.refresh();await entered;f.failGuest();t.mock.method(console,'error',()=>{});
 const logout=store.logout();assert.equal(store.currentUser(),null);assert.equal(store.myOffers().length,0);
 f.releaseBootstrap();await old;await logout;
 assert.equal(store.currentUser(),null);assert.equal(store.myOffers().length,0);assert.equal(store.hasSession(),false);
});
test('registration completes with session email when JWT omits email, without a second form',async t=>{
 const f=setup(t),store=createMarketStore({background:false});await store.refresh();
 const states=[];store.subscribe(()=>states.push(store.needsProfile()));
 await store.register(input);
 assert.equal(store.currentUser().email,input.email);assert.equal(store.currentUser().name,input.name);
 assert.equal(store.needsProfile(),false);assert(!states.includes(true));
 assert.equal(f.calls.filter(p=>p.endsWith('/sign-up/email')).length,1);
 assert.equal(f.calls.filter(p=>p.endsWith('/complete_profile')).length,1);
 assert.equal(f.storage.has('meetany.pendingProfile'),false);
});
test('profile conflict retains submitted fields and retry completes existing account',async t=>{
 const f=setup(t),store=createMarketStore({background:false});await store.refresh();f.setFail(true);
 await assert.rejects(store.register(input));
 assert.equal(store.needsProfile(),true);assert.equal(store.pendingProfile().email,input.email);
 assert.equal(store.pendingProfile().name,input.name);assert.equal(store.pendingProfile().phone.replaceAll(' ',''),'+995599123456');
 assert.equal(store.pendingProfile().acceptTerms,true);assert(store.profileCompletionError());
 f.setFail(false);await store.register({...input,password:''});
 assert.equal(store.needsProfile(),false);assert.equal(f.calls.filter(p=>p.endsWith('/sign-up/email')).length,1);
});
test('reload resumes a submitted profile without storing or asking for the password',async t=>{
 const pending={...input};delete pending.password;const f=setup(t,{signedIn:true,pending}),store=createMarketStore({background:false});await store.refresh();
 assert.equal(store.currentUser().name,input.name);assert.equal(store.needsProfile(),false);
 assert.equal(f.calls.filter(p=>p.endsWith('/complete_profile')).length,1);assert.equal(f.storage.size,0);
});
test('registration ignores a guest session response started before sign-up',async t=>{
 const f=setup(t,{holdInitial:true}),store=createMarketStore({background:false});
 const initial=store.refresh(),registration=store.register(input);
 await f.signedUp;f.releaseInitial();await registration;await initial;
 assert.equal(store.currentUser().email,input.email);assert.equal(store.needsProfile(),false);assert.equal(store.pendingEmail(),null);
 assert.equal(f.calls.filter(p=>p.endsWith('/complete_profile')).length,1);
 assert.equal(f.calls.filter(p=>p.endsWith('/sign-up/email')).length,1);
});
test('email verification keeps the code screen during a concurrent unfinished-profile refresh',async t=>{
 const pending={...input};delete pending.password;
 let release,entered;
 const gate=new Promise(resolve=>{release=resolve;});
 const completing=new Promise(resolve=>{entered=resolve;});
 const f=setup(t,{pending,beforeComplete:()=>{entered();return gate;}});
 const store=createMarketStore({background:false});await store.refresh();
 const verification=store.verifyEmailCode('123456');
 try{
  await completing;
  await store.refresh();
  assert.equal(store.currentUser(),null);
  assert.equal(store.needsProfile(),false);
  assert.equal(store.pendingEmail(),input.email);
  assert.equal(f.calls.filter(p=>p.endsWith('/complete_profile')).length,1);
 }finally{release();}
 await verification;
 assert.equal(store.currentUser().email,input.email);
 assert.equal(store.pendingEmail(),null);
 assert.equal(store.needsProfile(),false);
 assert.equal(f.storage.size,0);
});

test('early session response is consumed once without a second Auth request',async t=>{
 const f=setup(t);t.mock.property(globalThis,'window',{__meetanySessionPreload:Promise.resolve({data:null,jwt:null})});
 const store=createMarketStore({background:false});await store.refresh();
 assert.deepEqual(f.calls,['/api/db/bootstrap']);
 assert.equal(window.__meetanySessionPreload,undefined);
 await store.refresh();assert.equal(f.calls.filter(p=>p.endsWith('/get-session')).length,1);
});
test('failed early session read falls back to the normal session check',async t=>{
 const f=setup(t);t.mock.property(globalThis,'window',{__meetanySessionPreload:Promise.resolve(null)});
 const store=createMarketStore({background:false});await store.refresh();
 assert.deepEqual(f.calls,['/auth/get-session','/api/db/bootstrap']);
 assert.equal(store.isSessionReady(),true);
});
test('timed-out early session read does not repeat the hung request and can be retried',async t=>{
 const f=setup(t);t.mock.property(globalThis,'window',{__meetanySessionPreload:Promise.resolve({error:'TIMEOUT'})});t.mock.method(console,'error',()=>{});
 const store=createMarketStore({background:false});await store.refresh();
 assert.equal(f.calls.length,0);assert.equal(store.isSessionReady(),true);assert(store.sessionLoadError());
 await store.refresh();assert.equal(store.sessionLoadError(),null);assert.equal(store.isAvailable(),true);
 assert.deepEqual(f.calls,['/auth/get-session','/api/db/bootstrap']);
});
test('registration supersedes an early guest session read still in flight',async t=>{
 const f=setup(t);let release;
 t.mock.property(globalThis,'window',{__meetanySessionPreload:new Promise(resolve=>{release=resolve;})});
 const store=createMarketStore({background:false});const initial=store.refresh(),registration=store.register(input);
 await f.signedUp;release({data:null,jwt:null});await registration;await initial;
 assert.equal(store.currentUser().email,input.email);assert.equal(store.needsProfile(),false);
 assert.equal(f.calls.filter(p=>p.endsWith('/sign-up/email')).length,1);
 assert.equal(f.calls.filter(p=>p.endsWith('/complete_profile')).length,1);
});
