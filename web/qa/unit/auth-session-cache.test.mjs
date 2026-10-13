import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionCache, sessionPreloadScript } from '../../app/lib/auth-session-preload.js';
import vm from 'node:vm';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='../components/Toasts')return {url:'data:text/javascript,export function toast() {}',shortCircuit:true};return next(specifier,context);}});
globalThis.window=undefined;
globalThis.sessionStorage=null;
const key='meetany.session.v1', endpoint='https://auth.example.test/get-session';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const value=exp=>({data:{user:{id:'user'}},jwt:`header.${Buffer.from(JSON.stringify({exp,sub:'user',role:'authenticated'})).toString('base64url')}.signature`});
function setup(t){
 let now=1000000,calls=0,status=200,timer,listener;
 t.mock.method(Date,'now',()=>now);
 const env={sessionStorage:storage(),localStorage:storage(),atob,addEventListener:(name,fn)=>{listener=fn;},setTimeout:(fn,ms)=>{assert.equal(ms,30000);timer=fn;return 1;},clearTimeout:()=>{timer=null;},fetch:async()=>{calls++;const v=value(now/1000+3600);return Response.json(v.data,{status,headers:{'set-auth-jwt':v.jwt}});}};
 return {env,cache:createSessionCache(env,endpoint),calls:()=>calls,advance:ms=>{now+=ms;},status:s=>{status=s;},retry:async()=>{timer();await new Promise(resolve=>setImmediate(resolve));},event:()=>listener({key:key+'.revision'}),timer:()=>timer};
}
test('ten page loads reuse persisted session, memory and JWT until exp minus 60 seconds',async t=>{
 const f=setup(t);await f.cache.load();
 for(let i=0;i<10;i++){await createSessionCache(f.env,endpoint).load();await f.cache.load();}
 assert.equal(f.calls(),1);assert(f.env.sessionStorage.getItem(key));
 f.advance(3540000);await f.cache.load();assert.equal(f.calls(),2);
});
test('logout clears persistence, pending preload and notifies another tab',async t=>{
 const f=setup(t);await f.cache.load();f.env.__meetanySessionPreload=Promise.resolve(null);
 f.cache.invalidate(true);assert.equal(f.cache.read(),null);assert.equal(f.env.sessionStorage.getItem(key),null);assert.equal(f.env.__meetanySessionPreload,undefined);
 await f.cache.load();let notified=0;f.cache.subscribe(()=>notified++);f.event();assert.equal(notified,1);assert.equal(f.cache.read(),null);
});
test('429 uses still-valid JWT during safety minute and retries exactly once after 30 seconds',async t=>{
 const f=setup(t);const before=await f.cache.load();f.advance(3540000);f.status(429);
 assert.equal((await f.cache.load()).jwt,before.jwt);assert.equal((await f.cache.load()).jwt,before.jwt);assert.equal(f.calls(),2);
 await f.retry();assert.equal(f.calls(),3);assert.equal(f.calls(),3);
});
test('429 without usable cache has Georgian message and one successful delayed retry',async t=>{
 const f=setup(t);f.status(429);
 await assert.rejects(f.cache.load(),e=>e.status===429&&e.userMessage==='ძალიან ბევრი მცდელობა — სცადეთ წუთში');
 f.status(200);await f.retry();await f.cache.load();assert.equal(f.calls(),2);
});
test('logout while get-session is pending prevents old session repopulation',async t=>{
 const f=setup(t);let release;f.env.fetch=()=>new Promise(resolve=>{release=resolve;});
 const pending=f.cache.load();f.cache.invalidate(true);const v=value(Date.now()/1000+3600);release(Response.json(v.data,{headers:{'set-auth-jwt':v.jwt}}));
 await pending;assert.equal(f.cache.read(),null);
});
test('generated preload uses persisted session and only fetches bootstrap',async t=>{
 const f=setup(t);await f.cache.load();const urls=[];
 const fetch=async url=>{urls.push(url);return Response.json({});};
 const window={...f.env,fetch};
 vm.runInNewContext(sessionPreloadScript('https://auth.example.test'),{window,fetch,localStorage:f.env.localStorage,AbortSignal,Date});
 await window.__meetanyBootstrapPreload;
 assert.equal(urls.filter(url=>url.endsWith('/get-session')).length,0);
});
test('expired JWT is removed and never used as a 429 fallback',async t=>{
 const f=setup(t);await f.cache.load();f.advance(3600000);f.status(429);
 await assert.rejects(f.cache.load(),{status:429});assert.equal(f.env.sessionStorage.getItem(key),null);
 f.cache.invalidate();assert.equal(f.timer(),null);
});
test('a missed cross-tab invalidation is detected on the next page load',async t=>{
 const f=setup(t);await f.cache.load();f.env.localStorage.setItem(key+'.revision','logout');
 const next=createSessionCache(f.env,endpoint);assert.equal(next.read(),null);await next.load();assert.equal(f.calls(),2);
});

test('Data API 401 invalidates persisted session and obtains one replacement JWT',async t=>{
 const f=setup(t);process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL='https://auth.example.test';
 t.mock.property(globalThis,'window',f.env);t.mock.property(globalThis,'sessionStorage',f.env.sessionStorage);
 let bootstraps=0;
 t.mock.method(globalThis,'fetch',async()=>{if(++bootstraps===1)return Response.json({}, {status:401});return Response.json({me:null,requests:[],offers:[],companies:[],profiles:[],counts:[],companyStats:[],contacts:[],capabilities:{},stats:null});});
 const {createMarketStore}=await import('../../app/lib/market-store.js');
 const store=createMarketStore({background:false});await store.refresh();
 assert.equal(f.calls(),2);assert.equal(bootstraps,2);assert.equal(store.sessionLoadError(),null);assert.equal(store.hasSession(),true);
});
