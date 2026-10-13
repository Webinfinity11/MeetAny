import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import pg from 'pg';
export {assert};
export const dir=import.meta.dirname, root=path.resolve(dir,'../../..'), origin='http://localhost:3402';
fs.mkdirSync(path.join(dir,'.private'),{recursive:true,mode:0o700});
export const env=Object.fromEntries(fs.readFileSync(path.join(root,'web/.env.local'),'utf8').split(/\r?\n/).flatMap(l=>{const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[]}));
for(const name of ['DATABASE_URL','MEETANY_LOCAL_DATABASE_URL']) assert(['localhost','127.0.0.1'].includes(new URL(env[name]).hostname),'local DB required');
export const ledger=JSON.parse(fs.readFileSync(path.join(root,'DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
export const statePath=path.join(dir,'.private/run.json');
export const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)): {run:Date.now(),checks:[],captures:[],errors:[]};
export const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2),{mode:0o600});save();
export const png={name:'qa-1x1.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqXcAAAAASUVORK5CYII=','base64')};
export const db=new pg.Client({connectionString:env.MEETANY_LOCAL_DATABASE_URL});await db.connect();
export const sql=async(q,v=[])=>(await db.query(q,v)).rows;
export const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
export async function actor(role){const file=path.join(dir,'.private',role+'.json');const context=await browser.newContext({...(fs.existsSync(file)?{storageState:file}:{}),viewport:{width:1440,height:1000},locale:'ka-GE',reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(60000);p.on('pageerror',e=>{state.errors.push({role,message:e.message});save();});return {p,context,file};}
export async function persist(a){await a.context.storageState({path:a.file});fs.chmodSync(a.file,0o600);save();}
export async function goto(p,url){await p.goto(origin+url,{waitUntil:'domcontentloaded'});await p.locator('main').first().waitFor();await p.waitForTimeout(1500);}
export async function capture(p,label){const originalViewport=p.viewportSize();for(const width of [1440,390,360]){await p.setViewportSize({width,height:width===1440?1000:844});await p.waitForTimeout(250);const name=`${label}-${width}`;await p.screenshot({path:path.join(dir,'shots/flows',name+'.png'),fullPage:true,mask:[p.locator('input[type=password]')]});const data=await p.evaluate(()=>({text:document.querySelector('main')?.innerText||document.body.innerText,overflow:document.documentElement.scrollWidth-innerWidth,collageCount:document.querySelectorAll('.catalog-collage').length,images:[...document.querySelectorAll('main img')].map(e=>({src:e.getAttribute('src'),alt:e.alt})),dialogs:[...document.querySelectorAll('[role=dialog],dialog[open]')].filter(e=>e.getClientRects().length).map(e=>e.innerText),fields:[...document.querySelectorAll('input,textarea,select')].map(e=>({tag:e.tagName,id:e.id,type:e.type,label:e.getAttribute('aria-label'),required:e.required,disabled:e.disabled,...(e.type==='password'?{}:{value:e.value})})),buttons:[...document.querySelectorAll('main button')].map(e=>({text:e.innerText,disabled:e.disabled}))}));fs.writeFileSync(path.join(dir,'shots/flows',name+'.json'),JSON.stringify({route:new URL(p.url()).pathname+new URL(p.url()).search,...data},null,2));state.captures.push({name,overflow:data.overflow});}await p.setViewportSize(originalViewport);save();}
export async function select(p,id,label){await p.locator('#'+id).click();await p.getByRole('option',{name:label,exact:true}).click();}
export async function check(name,fn){if(process.env.QA_ONLY&&!new RegExp(process.env.QA_ONLY).test(name))return;try{const detail=await fn();state.checks.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e){state.checks.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message.slice(0,300));for(const [i,c] of browser.contexts().entries()){const p=c.pages()[0];if(p)await capture(p,`failure-${state.checks.length}-context${i}`).catch(()=>{});}}save();}
export async function login(role){const a=await actor(role);if(fs.existsSync(a.file))return a;assert(!state['attempt_'+role],'one login attempt per role; inspect failure');assert(Date.now()-(state.lastAuth||0)>=20000,'space auth by 20 seconds');await goto(a.p,'/account/');const account=ledger.accounts[role];await a.p.locator('#login-email').fill(account.email||`demo-${role}@meetany.ge`);await a.p.locator('#login-password').fill(account.password);state.lastAuth=Date.now();state['attempt_'+role]=true;save();await a.p.locator('form button[type=submit]').click();await a.p.locator('#login-email').waitFor({state:'hidden',timeout:45000});await persist(a);return a;}
export async function finish(){await browser.close();await db.end();}
