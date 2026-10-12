import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import pg from 'pg';

const root=path.resolve(import.meta.dirname,'..'),origin='https://www.meetany.ge';
const run=Date.now().toString(),marker=`[live-qa:${run}]`,output=path.join(root,'qa',`live-functional-${run}`);
fs.mkdirSync(output,{recursive:true});
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).flatMap(l=>{const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[]}));
const auth=env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
assert.equal(new URL(auth).hostname,'ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech');
assert.match(new URL(env.DATABASE_URL).hostname,/^ep-withered-glade-b54ts1g5(?:-pooler)?\./);
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets=[env.DATABASE_URL,...Object.values(ledger.accounts).map(a=>a.password)].filter(Boolean);
const safe=value=>secrets.reduce((s,k)=>s.replaceAll(k,'[redacted]'),String(value)).replace(/Bearer\s+[^\s"']+/g,'Bearer [redacted]');
const report={origin,run,marker,startedAt:new Date().toISOString(),checks:[],runtimeErrors:[],unexpectedResponses:[],actors:{},artifacts:{},cleanup:[],limitations:['Real OTP and password-reset email delivery requires a receiving test mailbox and is not asserted.','New QA account setup uses real Auth and profile APIs. Business writes use real browser forms where stated; permission and concurrency cases use real HTTP APIs.','Admin moderation audit entries for this run are retained as audit history.']};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),safe(JSON.stringify(report,null,2)));
const db=new pg.Client({connectionString:env.DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:!process.argv.includes('--visible'),executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const actors={},testAccounts=[],contexts=[];
let request,offer,otherOffer,deal,conversation,requestFile,offerFile,photo;
const one=value=>Array.isArray(value)?value[0]:value;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqXcAAAAASUVORK5CYII=','base64');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function shot(p,label){if(!p)return;await p.screenshot({path:path.join(output,label+'.png'),fullPage:true,mask:[p.locator('input[type=password],input[type=email],input[type=tel]')],timeout:12000}).catch(()=>{});}
async function check(name,actor,fn,{required=false}={}){
 const started=Date.now();
 try{const evidence=await fn();report.checks.push({name,status:'PASS',ms:Date.now()-started,evidence});console.log('PASS '+name);save();return true;}
 catch(e){report.checks.push({name,status:'FAIL',ms:Date.now()-started,error:safe(e.message)});console.log('FAIL '+name+': '+safe(e.message).split('\n')[0]);await shot(actors[actor]?.p,`failure-${report.checks.length}`);save();if(required)throw e;return false;}
}
async function makeActor(name){
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await c.newPage();contexts.push(c);p.setDefaultTimeout(18000);
 p.on('pageerror',e=>report.runtimeErrors.push({actor:name,error:safe(e.message)}));
 p.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=500)report.unexpectedResponses.push({actor:name,path:new URL(r.url()).pathname,status:r.status()});});
 actors[name]={c,p};return actors[name];
}
async function jwt(actor){const r=await actors[actor].c.request.get(auth+'/token');assert(r.ok(),'Auth token HTTP '+r.status());return (await r.json()).token;}
async function api(actor,route,body,{error,method}={}){
 const headers=actor==='guest'?{}:{Authorization:'Bearer '+await jwt(actor)};
 const r=await actors[actor].c.request.fetch(origin+'/api/db/'+route,{method:method||(body===undefined?'GET':'POST'),headers,...(body===undefined?{}:{data:body}),timeout:20000});
 const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{throw Error(`${route}: HTTP ${r.status()}, non-JSON response`);}
 if(error){assert(!r.ok(),route+' unexpectedly succeeded');if(error!=='DENIED')assert.match(JSON.stringify(data),new RegExp(error));return {status:r.status(),code:data?.code};}
 assert(r.ok(),`${route}: HTTP ${r.status()} ${data?.message||''}`);return data;
}
const rpc=(actor,name,args={},options)=>api(actor,'rpc/'+name,args,options);
async function navigate(actor,route){const p=actors[actor].p;await p.bringToFront();const r=await p.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);await p.locator('main').waitFor();await p.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy=true]'),null,{timeout:25000});}
async function select(p,id,text){await p.locator('#'+id).click();await p.locator('[role=option]:not([aria-disabled=true])').filter({hasText:text}).first().click();}
async function refreshDeal(){deal=await rpc('buyer','get_deal',{p_deal_id:deal.id});return deal;}
async function upload(actor,kind,target,bytes=png,name='qa.png'){
 const token=await jwt(actor),headers={Authorization:'Bearer '+token};
 let r=await actors[actor].c.request.post(origin+'/api/files',{headers,data:{action:'begin',kind,target,name,mime:'image/png',size:bytes.length}});assert(r.ok(),'Upload begin HTTP '+r.status());const id=(await r.json()).id;
 for(let offset=0;offset<bytes.length;offset+=1048576){r=await actors[actor].c.request.post(`${origin}/api/files?upload=${id}&offset=${offset}`,{headers:{...headers,'Content-Type':'application/octet-stream'},data:bytes.subarray(offset,offset+1048576)});assert(r.ok(),'Chunk HTTP '+r.status());}
 r=await actors[actor].c.request.post(origin+'/api/files',{headers,data:{action:'finish',id}});assert(r.ok(),'Upload finish HTTP '+r.status());return {file:await r.json(),uploadId:id};
}
async function fileGet(actor,id){return actors[actor].c.request.get(`${origin}/api/files?id=${id}`,{headers:actor==='guest'?{}:{Authorization:'Bearer '+await jwt(actor)}});}
async function signup(name,role,index){
 const a=await makeActor(name),account={email:`e2e+${run}-${name}@meetany.local`,password:crypto.randomBytes(24).toString('base64url')};secrets.push(account.password);testAccounts.push(account);
 const response=await a.c.request.post(auth+'/sign-up/email',{headers:{Origin:origin},data:{...account,name:`QA ${name} ${run}`}});
 if(!response.ok()){const error=await response.json().catch(()=>({}));throw Error(`${name} signup HTTP ${response.status()} ${error.code||''} ${error.message||''}`);}
 const user=(await response.json()).user;account.id=user.id;
 const profile=one(await rpc(name,'complete_profile',{p_role:role,p_name:`QA ${name}`,p_company:`QA ${name} ${run}`,p_phone:'+995 5'+(Number(run.slice(-8))+index).toString().padStart(8,'0').slice(-8),p_city:'tbilisi',p_industry:role==='company'?'furniture':null}));
 assert.equal(profile.id,user.id);assert.equal(profile.role,role);a.profile=profile;a.account=account;report.actors[name]={id:profile.id,role};save();
}
try{
 await check('Real QA actors and admin authentication','buyer',async()=>{
  await makeActor('guest');await makeActor('admin');const a=ledger.accounts.owner_admin;
  const r=await actors.admin.c.request.post(auth+'/sign-in/email',{data:{email:a.email,password:a.password}});assert(r.ok(),'Admin login HTTP '+r.status());assert.equal(one(await rpc('admin','my_profile')).role,'admin');
  for(const [i,name,role] of [[0,'buyer','client'],[1,'supplier','company'],[2,'other','company'],[3,'pending','company']])await signup(name,role,i);
  for(const name of ['supplier','other'])await rpc('admin','admin_set_verified',{p_user_id:actors[name].profile.id,p_verified:true});
  return {actors:4,realAuth:true};
 },{required:true});
 await check('Account identity persists in buyer/supplier UI','buyer',async()=>{for(const actor of ['buyer','supplier']){await navigate(actor,'/account/');await actors[actor].p.locator('nav[aria-label="ანგარიშის განყოფილებები"]').waitFor();assert.equal(await actors[actor].p.locator('#reg-name').count(),0);}});
 await check('Request draft survives reload and backward steps; validation focuses title','buyer',async()=>{
  await navigate('buyer','/requests/new/');const p=actors.buyer.p;
  await p.locator('button[form="post-request-form"][type=submit]').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'title');
  await p.locator('#title').fill(`${marker} საოფისე მაგიდები`);await select(p,'category','ავეჯი');await p.locator('#body').fill(`${marker} გვჭირდება 12 საოფისე მაგიდა, თბილისში მიწოდებით. სატესტო მოთხოვნა.`);await p.locator('#quantity').fill('12');
  await p.reload({waitUntil:'domcontentloaded'});await p.locator('#title').waitFor();assert((await p.locator('#title').inputValue()).includes(marker));assert.equal(await p.locator('#quantity').inputValue(),'12');
  await p.locator('button[form="post-request-form"][type=submit]').click();await p.locator('#neededBy').waitFor();
  await p.locator('#neededBy').fill(new Date(Date.now()+7*86400000).toISOString().slice(0,10));await p.locator('#addressNote').fill('QA თბილისი');
  await p.goBack();await p.locator('#title').waitFor();assert((await p.locator('#title').inputValue()).includes(marker));
 });
 await check('Request attachment and photo upload through browser forms','buyer',async()=>{
  const p=actors.buyer.p;if(!await p.locator('#title').count())await navigate('buyer','/requests/new/?step=1');
  await p.getByLabel('ფაილები — დამატება',{exact:true}).setInputFiles({name:`qa-request-${run}.png`,mimeType:'image/png',buffer:png});
  await p.getByRole('button',{name:`qa-request-${run}.png`,exact:true}).waitFor();
  await p.getByLabel('მოთხოვნის ფოტოს არჩევა',{exact:true}).setInputFiles({name:`qa-photo-${run}.png`,mimeType:'image/png',buffer:png});await p.getByAltText('არჩეული ფოტო',{exact:true}).waitFor();
  return {privateAttachmentBytes:png.length,photoSelected:true};
 });
 await check('Request publication via three-step UI creates one row and binds draft file','buyer',async()=>{
  const p=actors.buyer.p;await p.locator('button[form="post-request-form"][type=submit]').click();await p.locator('#neededBy').waitFor();
  await p.locator('#neededBy').fill(new Date(Date.now()+7*86400000).toISOString().slice(0,10));await p.locator('#addressNote').fill('QA თბილისი');
  await p.locator('button[form="post-request-form"][type=submit]').click();await p.getByRole('button',{name:`qa-request-${run}.png`,exact:true}).waitFor();
  await p.locator('button[form="post-request-form"][type=submit]').click({clickCount:2});
  await p.getByRole('heading',{name:'მოთხოვნა გამოქვეყნდა',exact:true}).waitFor({timeout:35000});
  const rows=await api('buyer',`requests?select=*&owner_id=eq.${actors.buyer.profile.id}`);assert.equal(rows.length,1);request=rows[0];assert(request.title.includes(marker));assert.equal(Number(request.quantity),12);assert(request.photo_url);photo=request.photo_url;
  report.artifacts.requestId=request.id;report.artifacts.photoUrl=photo;
  const files=await rpc('buyer','list_attachments',{p_kind:'request',p_target:request.id});assert.equal(files.length,1);requestFile=files[0];report.artifacts.requestFile=requestFile.id;
  assert.equal((await db.query('select count(*)::int n from public.requests where owner_id=$1',[actors.buyer.profile.id])).rows[0].n,1);
  return {requestId:request.id,rows:1,draftBound:true,blobPhoto:true};
 },{required:true});
 await check('Published request visible to guests; private attachment bytes match','guest',async()=>{
  await navigate('guest',`/requests/view/?id=${request.id}`);await actors.guest.p.getByRole('heading',{name:request.title,exact:true}).waitFor();
  const r=await fileGet('guest',requestFile.id);assert(r.ok(),'Public request attachment HTTP '+r.status());assert.equal(sha(await r.body()),sha(png));
  const image=await actors.guest.c.request.get(photo);assert(image.ok());return {requestAttachmentPublicByDesign:true};
 });
 await check('Unverified supplier, nonowner editing and direct table writes rejected','pending',async()=>{
  await rpc('pending','send_offer',{p_request_id:request.id,p_body:`${marker} pending offer`},{error:'MA801'});
  await rpc('other','update_request',{p_request_id:request.id,p_title:request.title,p_body:request.body,p_category:'furniture',p_city:'tbilisi'},{error:'MA107'});
  await api('buyer','requests',{title:`${marker} direct`,owner_id:actors.buyer.profile.id},{error:'DENIED'});
  await api('guest','offers?select=id',{},{error:'DENIED',method:'GET'});
 });
 await check('Private budget stays hidden from guest and supplier','buyer',async()=>{
  await rpc('buyer','set_request_preferences',{p_request_id:request.id,p_preferences:{budgetType:'range',budgetMin:1000,budgetMax:1800,budgetPrivate:true,specification:`${marker} ხის მაგიდები`,vatInvoice:true}});
  const own=await rpc('buyer','request_preferences',{p_request_id:request.id});assert.equal(own.budgetMax,1800);
  for(const actor of ['guest','supplier']){const data=await rpc(actor,'request_preferences',{p_request_id:request.id});assert(!Object.hasOwn(data,'budgetMin'));assert(!Object.hasOwn(data,'budgetMax'));}
 });
 await check('Close/reopen and owner edit enforce state; main request retained','buyer',async()=>{
  let r=one(await rpc('buyer','close_request',{p_request_id:request.id}));assert.equal(r.status,'closed');
  await rpc('supplier','send_offer',{p_request_id:request.id,p_body:`${marker} closed offer`},{error:'MA203'});
  r=one(await rpc('buyer','extend_request',{p_request_id:request.id}));assert.equal(r.status,'open');
  r=one(await rpc('buyer','update_request',{p_request_id:request.id,p_title:request.title,p_body:request.body,p_category:'furniture',p_city:'tbilisi',p_quantity:15,p_unit:'pcs',p_needed_by:request.needed_by,p_address_note:'QA თბილისი'}));assert.equal(Number(r.quantity),15);request=r;
 });
 await check('Supplier offer and private file sent via real UI','supplier',async()=>{
  await navigate('supplier',`/offers/new/?requestId=${request.id}`);const p=actors.supplier.p;await p.locator('#of-body').waitFor();
  await p.locator('#of-body').fill(`${marker} მაგიდების მიწოდება შვიდ სამუშაო დღეში, ადგილზე აწყობით.`);await p.locator('#of-price').fill('110');
  await p.getByRole('button',{name:'ერთეულის',exact:true}).click();await select(p,'of-deliveryDays','7 სამუშაო დღე');await p.getByRole('button',{name:'მიწოდებისას',exact:true}).click();
  await p.getByRole('button',{name:'გარანტია',exact:true}).click();
  await p.getByLabel('ფაილები — დამატება',{exact:true}).setInputFiles({name:`qa-offer-${run}.png`,mimeType:'image/png',buffer:png});await p.getByRole('button',{name:`qa-offer-${run}.png`,exact:true}).waitFor();
  await p.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();await p.getByRole('dialog').waitFor({timeout:30000});
  const rows=await api('supplier',`offers?select=*&request_id=eq.${request.id}`);assert.equal(rows.length,1);offer=rows[0];assert.equal(Number(offer.price),110);assert.equal(offer.price_type,'unit');assert.equal(offer.payment_terms,'მიწოდებისას');
  report.artifacts.offerId=offer.id;const files=await rpc('supplier','list_attachments',{p_kind:'offer',p_target:offer.id});assert.equal(files.length,1);offerFile=files[0];return {offerId:offer.id,attached:true};
 },{required:true});
 await check('Offer edit upserts once; stale terms rejected; sealed access enforced','supplier',async()=>{
  const original=offer.id;offer=one(await rpc('supplier','send_offer',{p_request_id:request.id,p_body:offer.body,p_price:120,p_price_type:'unit',p_delivery_days:7}));assert.equal(offer.id,original);
  offer=one(await rpc('supplier','set_offer_terms',{p_offer_id:offer.id,p_payment_terms:'მიწოდებისას',p_valid_until:null,p_commercial_terms:['გარანტია'],p_expected_updated_at:offer.updated_at}));
  await rpc('supplier','set_offer_terms',{p_offer_id:offer.id,p_payment_terms:'stale',p_valid_until:null,p_commercial_terms:[],p_expected_updated_at:'2000-01-01T00:00:00Z'},{error:'MA904'});
  assert.equal((await api('other',`offers?select=id&id=eq.${offer.id}`)).length,0);const forbidden=await fileGet('other',offerFile.id);assert.equal(forbidden.status(),403);
  const own=await fileGet('buyer',offerFile.id);assert(own.ok());assert.equal(sha(await own.body()),sha(png));
  assert.equal((await api('supplier',`offers?select=id&request_id=eq.${request.id}`)).length,1);
 });
 await check('Second offer withdraw/resend and normalized comparison totals','other',async()=>{
  otherOffer=one(await rpc('other','send_offer',{p_request_id:request.id,p_body:`${marker} მეორე შეთავაზება`,p_price:2000,p_price_type:'total',p_delivery_days:5}));
  await rpc('other','withdraw_offer',{p_offer_id:otherOffer.id});assert.equal((await api('other',`offers?select=id&id=eq.${otherOffer.id}`)).length,0);
  otherOffer=one(await rpc('other','send_offer',{p_request_id:request.id,p_body:`${marker} მეორე შეთავაზება`,p_price:2000,p_price_type:'total',p_delivery_days:5}));
  const compared=await rpc('buyer','compare_offers',{p_request_id:request.id});assert.equal(compared.length,2);assert.equal(Number(compared.find(o=>o.id===offer.id).total_gel),1800);await rpc('other','compare_offers',{p_request_id:request.id},{error:'MA901'});
 });
 await check('Stale selection denied; choosing through UI creates one deal','buyer',async()=>{
  await rpc('buyer','select_offer_deal',{p_offer_id:offer.id,p_expected_updated_at:'2000-01-01T00:00:00Z'},{error:'MA904'});
  await navigate('buyer',`/requests/compare/?id=${request.id}`);const p=actors.buyer.p;
  const card=p.locator('article').filter({hasText:actors.supplier.profile.company});await card.getByRole('button',{name:'არჩევა',exact:true}).click();
  await p.getByRole('dialog').getByRole('button',{name:'არჩევა',exact:true}).click();await p.waitForURL('**/deals/view/**',{timeout:30000});
  const id=new URL(p.url()).searchParams.get('id');deal=await rpc('buyer','get_deal',{p_deal_id:id});assert.equal(deal.supplier_id,actors.supplier.profile.id);report.artifacts.dealId=deal.id;
  const duplicate=await rpc('buyer','select_offer_deal',{p_offer_id:offer.id,p_expected_updated_at:offer.updated_at});assert.equal(duplicate.id,deal.id);
  return {dealId:deal.id,stage:deal.stage,idempotent:true};
 },{required:true});
 await check('Selected request closes new offers; outsider deal/contact denied','other',async()=>{
  await rpc('other','send_offer',{p_request_id:request.id,p_body:`${marker} chosen offer`},{error:'MA203'});await rpc('other','get_deal',{p_deal_id:deal.id},{error:'MA901'});await rpc('other','get_deal_contact',{p_deal_id:deal.id},{error:'MA901'});
  const contacts=await rpc('buyer','get_deal_contact',{p_deal_id:deal.id});assert.equal(contacts[0].id,actors.supplier.profile.id);
 });
 await check('Chat roundtrip via deal forms; unread/read and nonparticipant isolation','buyer',async()=>{
  const p=actors.buyer.p;if(await p.getByRole('button',{name:'ჩატის გახსნა',exact:true}).count())await p.getByRole('button',{name:'ჩატის გახსნა',exact:true}).click();
  await p.locator('#deal-message').waitFor();await p.locator('#deal-message').fill(`${marker} ადგილზე აწყობა შედის?`);await p.locator('#deal-message').locator('..').getByRole('button',{name:'გაგზავნა',exact:true}).click();
  await p.getByRole('log').getByText(`${marker} ადგილზე აწყობა შედის?`).waitFor();
  const threads=await rpc('buyer','list_my_conversations');conversation=threads.find(c=>c.request_id===request.id);assert(conversation);report.artifacts.conversationId=conversation.id;
  assert(Number(await rpc('supplier','unread_message_count'))>0);await navigate('supplier',`/deals/view/?id=${deal.id}`);const q=actors.supplier.p;await q.locator('#deal-message').waitFor();
  await q.locator('#deal-message').fill(`${marker} დიახ, აწყობა შედის.`);await q.locator('#deal-message').locator('..').getByRole('button',{name:'გაგზავნა',exact:true}).click();await q.getByRole('log').getByText(`${marker} დიახ, აწყობა შედის.`).waitFor();
  const messages=await rpc('buyer','list_messages',{p_conversation_id:conversation.id});assert(messages.some(m=>m.body.includes('დიახ')));await rpc('other','list_messages',{p_conversation_id:conversation.id},{error:'MA501'});
  await rpc('buyer','mark_read',{p_conversation_id:conversation.id});assert.equal(Number(await rpc('buyer','unread_message_count')),0);
 });
 await check('Chunked private chat file and download authorization','buyer',async()=>{
  const bytes=Buffer.concat([png,Buffer.alloc(1100000)]);const {file,uploadId}=await upload('buyer','conversation',conversation.id,bytes,`qa-chunked-${run}.png`);
  const finish=await actors.buyer.c.request.post(origin+'/api/files',{headers:{Authorization:'Bearer '+await jwt('buyer')},data:{action:'finish',id:uploadId}});assert(finish.ok());assert.equal((await finish.json()).id,file.id);
  for(const actor of ['buyer','supplier']){const r=await fileGet(actor,file.id);assert(r.ok());assert.equal(sha(await r.body()),sha(bytes));}
  assert.equal((await fileGet('other',file.id)).status(),403);assert.equal((await fileGet('guest',file.id)).status(),403);
  return {bytes:bytes.length,finishIdempotent:true};
 });
 await check('Terms proposed through UI and both parties confirm before progress','supplier',async()=>{
  await refreshDeal();if(deal.stage==='selected')deal=await rpc('buyer','advance_deal',{p_deal_id:deal.id,p_stage:'discuss',p_expected_revision:deal.revision});
  await navigate('supplier',`/deals/view/?id=${deal.id}`);const p=actors.supplier.p;await p.getByRole('button',{name:'ახალი პირობები',exact:true}).click();const modal=p.getByRole('dialog');
  await modal.locator('input[name=price]').fill('1800');await modal.locator('input[name=place]').fill('QA თბილისი');const payment=modal.getByRole('combobox').nth(1);await payment.click();await p.getByRole('option',{name:'100% მიწოდებისას',exact:true}).click();await modal.getByRole('button',{name:'გაგზავნა ჩატში',exact:true}).click();await modal.waitFor({state:'hidden'});await refreshDeal();assert.equal(deal.stage,'terms');
  await rpc('buyer','advance_deal',{p_deal_id:deal.id,p_stage:'progress',p_expected_revision:deal.revision},{error:'MA905'});
  await navigate('buyer',`/deals/view/?id=${deal.id}`);await actors.buyer.p.getByRole('button',{name:'პირობების დადასტურება',exact:true}).click();await actors.buyer.p.getByText('მყიდველი: დადასტურდა',{exact:true}).waitFor();const stale=deal.revision;await refreshDeal();
  await rpc('supplier','confirm_deal_terms',{p_deal_id:deal.id,p_expected_revision:stale},{error:'MA904'});
  await navigate('supplier',`/deals/view/?id=${deal.id}`);await p.getByRole('button',{name:'პირობების დადასტურება',exact:true}).click();await p.getByRole('button',{name:'შესრულების დაწყება',exact:true}).waitFor();await p.getByRole('button',{name:'შესრულების დაწყება',exact:true}).click();await p.getByRole('heading',{name:'შეკვეთის სტატუსი',exact:true}).waitFor();await refreshDeal();assert.equal(deal.stage,'progress');
 },{required:true});
 await check('Production update, issue pause and admin resolution','supplier',async()=>{
  await rpc('supplier','add_deal_update',{p_deal_id:deal.id,p_expected_revision:deal.revision,p_status:'producing',p_body:`${marker} წარმოება დაიწყო`});await refreshDeal();
  const issue=await rpc('buyer','open_deal_issue',{p_deal_id:deal.id,p_expected_revision:deal.revision,p_reason:'late',p_body:`${marker} QA პრობლემის განხილვა`});await refreshDeal();
  await rpc('buyer','advance_deal',{p_deal_id:deal.id,p_stage:'complete',p_expected_revision:deal.revision},{error:'MA903'});
  await rpc('supplier','add_deal_update',{p_deal_id:deal.id,p_expected_revision:deal.revision,p_status:'ready',p_body:`${marker} paused`},{error:'MA903'});
  const issues=await rpc('admin','admin_deal_issues');assert(issues.some(i=>i.id===issue.id));await rpc('admin','admin_resolve_deal_issue',{p_issue_id:issue.id,p_resolution:`${marker} QA საკითხი მოგვარდა`});await refreshDeal();assert(!deal.issues.some(i=>i.status==='open'));
 });
 await check('Buyer-only completion and detailed review through real UI','buyer',async()=>{
  await rpc('supplier','advance_deal',{p_deal_id:deal.id,p_stage:'complete',p_expected_revision:deal.revision},{error:'MA906'});
  await navigate('buyer',`/deals/view/?id=${deal.id}`);const p=actors.buyer.p;await p.getByRole('button',{name:'მიღებულია, დასრულება',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'დასრულების დადასტურება',exact:true}).click();await p.getByRole('button',{name:'შეფასება',exact:true}).waitFor();await refreshDeal();assert.equal(deal.stage,'complete');
  await p.getByRole('button',{name:'შეფასება',exact:true}).click();const modal=p.getByRole('dialog');for(const criterion of ['ხარისხი','ვადების დაცვა','კომუნიკაცია','საიმედოობა'])await modal.getByRole('group',{name:criterion,exact:true}).getByRole('button',{name:'5 ვარსკვლავი',exact:true}).click();
  await modal.getByRole('button',{name:'დიახ',exact:true}).click();await modal.locator('textarea').fill(`${marker} სრული სატესტო ციკლი წარმატებით დასრულდა.`);await modal.getByRole('button',{name:'შეფასების გაგზავნა',exact:true}).click();await modal.waitFor({state:'hidden'});
  await refreshDeal();assert.equal(deal.rating,5);assert.deepEqual(deal.review_details.scores,[5,5,5,5]);assert.equal(deal.review_details.would_again,true);
  await rpc('buyer','rate_deal_full',{p_deal_id:deal.id,p_expected_revision:deal.revision,p_scores:[1,1,1,1],p_would_again:false,p_review:'retry'},{error:'MA903'});
  await p.reload({waitUntil:'domcontentloaded'});await p.getByRole('heading',{name:'თანამშრომლობის შეფასება',exact:true}).waitFor();await shot(p,'completed-deal');return {stage:deal.stage,rating:deal.rating};
 });
 await check('Deal files remain participant-only; admin and buyer see persisted history','buyer',async()=>{
  const {file}=await upload('supplier','deal',deal.id,png,`qa-delivery-${run}.png`);assert((await fileGet('buyer',file.id)).ok());assert.equal((await fileGet('other',file.id)).status(),403);
  const admin=await rpc('admin','get_deal',{p_deal_id:deal.id});assert.equal(admin.stage,'complete');assert(admin.events.some(e=>e.action==='complete'));await navigate('supplier',`/deals/view/?id=${deal.id}`);await actors.supplier.p.getByRole('heading',{name:'თანამშრომლობის შეფასება',exact:true}).waitFor();
  const layouts=[];for(const width of [390,1440]){await actors.supplier.p.setViewportSize({width,height:1000});await actors.supplier.p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const size=await actors.supplier.p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));layouts.push(size);await shot(actors.supplier.p,`supplier-complete-${width}`);assert(size.scrollWidth<=size.width+1,JSON.stringify(size));}return {layouts};
 });
 await check('Blocking QA supplier immediately denies further writes','pending',async()=>{
  await rpc('admin','admin_set_blocked',{p_user_id:actors.pending.profile.id,p_blocked:true,p_reason:`${marker} QA blocking`});await rpc('pending','create_request',{p_title:`${marker} blocked`,p_body:`${marker} blocked request`,p_category:'furniture',p_city:'tbilisi'},{error:'MA002'});
 });
}catch(e){report.runnerError=safe(e.message);}
finally{
 // Stop browser polling before removing this run's exact records.
 for(const c of contexts)await c.close().catch(()=>{});
 try{
  const emails=testAccounts.map(a=>a.email);assert(emails.every(e=>e.startsWith(`e2e+${run}-`)&&e.endsWith('@meetany.local')));
  const own=(await db.query('select id,email from public.profiles where email=any($1::text[])',[emails])).rows;
  const ids=own.map(p=>p.id);assert(own.every(p=>testAccounts.some(a=>a.email===p.email&&a.id===p.id)));
  await db.query('begin');
  const requests=(await db.query('select id,title from public.requests where owner_id=any($1::uuid[])',[ids])).rows;assert(requests.every(r=>r.title.includes(marker)));const rids=requests.map(r=>r.id);
  const deals=(await db.query('select id from meetany_private.deals where buyer_id=any($1::uuid[]) and supplier_id=any($1::uuid[])',[ids])).rows.map(d=>d.id);
  const conversations=(await db.query('select id from meetany_private.conversations where client_id=any($1::uuid[]) or company_id=any($1::uuid[])',[ids])).rows.map(c=>c.id);
  await db.query('delete from meetany_private.notifications where deal_id=any($1::uuid[]) or request_id=any($2::uuid[]) or user_id=any($3::uuid[])',[deals,rids,ids]);
  for(const table of ['deal_events','deal_issues','deal_proposals','deal_reviews','deal_updates'])await db.query(`delete from meetany_private.${table} where deal_id=any($1::uuid[])`,[deals]);
  await db.query('delete from meetany_private.deals where id=any($1::uuid[])',[deals]);
  await db.query('delete from meetany_private.attachments where owner_id=any($1::uuid[])',[ids]);await db.query('delete from meetany_private.file_uploads where owner_id=any($1::uuid[])',[ids]);
  await db.query('delete from meetany_private.conversations where id=any($1::uuid[])',[conversations]);await db.query('delete from public.requests where id=any($1::uuid[])',[rids]);
  await db.query('delete from public.profiles where id=any($1::uuid[]) and email=any($2::text[])',[ids,emails]);
  await db.query('delete from neon_auth."user" where email=any($1::text[]) and id=any($2::uuid[])',[emails,testAccounts.map(a=>a.id).filter(Boolean)]);
  await db.query('commit');
  const remaining=(await db.query('select (select count(*) from public.profiles where email=any($1::text[]))+(select count(*) from neon_auth."user" where email=any($1::text[])) n',[emails])).rows[0];assert.equal(Number(remaining.n),0);
  if(photo){assert(photo.includes(actors.buyer.profile.id));const {del}=await import('@vercel/blob');await del(photo,{token:env.BLOB_READ_WRITE_TOKEN});}
  report.cleanup.push({status:'PASS',profilesRemoved:ids.length,requestsRemoved:rids.length,dealsRemoved:deals.length,conversationsRemoved:conversations.length,remainingAccounts:0,photoRemoved:!!photo});
 }catch(e){await db.query('rollback').catch(()=>{});report.cleanup.push({status:'FAIL',error:safe(e.message)});}
 await browser.close();await db.end();report.finishedAt=new Date().toISOString();report.pass=!report.runnerError&&report.checks.every(c=>c.status==='PASS')&&!report.runtimeErrors.length&&!report.unexpectedResponses.length&&report.cleanup.every(c=>c.status==='PASS');save();
 console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failures:report.checks.filter(c=>c.status==='FAIL'),runnerError:report.runnerError,runtimeErrors:report.runtimeErrors,unexpectedResponses:report.unexpectedResponses,cleanup:report.cleanup,report:path.join(output,'report.json')},null,2));process.exitCode=report.pass?0:1;
}
