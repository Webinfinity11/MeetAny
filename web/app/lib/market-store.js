/* Shared browser data/auth layer. Called once by market-client.ts after mount.
   Every mutation refreshes cache and notifies React subscribers. See db/CONTRACT.md. */
import { toast } from '../components/Toasts';
import { readAllRows } from './read-all-rows.js';
import { categories, categoryKind, expandCategories } from './categories-data.js';
import { isInternalTestAccount, isInternalTestRequest } from './catalog-visibility.js';
/** @param {{initial?: Awaited<ReturnType<typeof import('./public-snapshot').loadPublicSnapshot>>, background?: boolean}} options */
export function createMarketStore({initial=null,background=true}={}){
 const DAY=86400000,EXTEND_DAYS=7;
 const PENDING_KEY='meetany.pendingProfile';

 // categories: app/lib/categories-data.js (keys shared with meetany_private.categories()).
 const cities={tbilisi:'თბილისი',batumi:'ბათუმი',kutaisi:'ქუთაისი',rustavi:'რუსთავი',zugdidi:'ზუგდიდი',telavi:'თელავი',gori:'გორი',georgia:'მთელი საქართველო'};
 // Request quantity units and offer price types (keys stored in the DB, labels shown in the UI).
 const units={pcs:'ცალი',m2:'მ²',kg:'კგ',hour:'საათი',service:'სერვისი'};
 const priceTypes={unit:'ერთეულის ფასი',total:'ჯამური ფასი',negotiable:'შეთანხმებით'};
 const QUANTITY_MAX=1e9,DELIVERY_DAYS_MAX=365,NEEDED_BY_YEARS=2;

 const UNAVAILABLE='სერვისი დროებით მიუწვდომელია';
 const GENERIC='რაღაც ვერ შესრულდა. სცადე თავიდან.';
 const CHECK_EMAIL='შეამოწმე ელფოსტა';
 const STALE='მონაცემები ვერ განახლდა. გვერდზე შეიძლება ძველი ინფორმაცია ჩანდეს.';
 const MSG={
  MA801:'შეთავაზების გაგზავნას კომპანიის დადასტურება სჭირდება. განაცხადი ადმინთან უკვე გაგზავნილია.',
   MA622:'დაამატე მაქსიმუმ 12 პროდუქტი: სახელი 2–80 სიმბოლო, აღწერა 200-მდე და ფოტო შენი გალერეიდან.',
   MA621:'მიუთითე მინიმუმ ერთი რეგიონი და არხი. გადაამოწმე ველების ზომა და მნიშვნელობები.',
  MA601:'აირჩიე 1–5 ქულა და დაწერე 20–1500 სიმბოლო.',MA602:'შეფასება შეგიძლია შენ მიერ არჩეულ მომწოდებელზე.',MA603:'მიუთითე მოდერაციის მიზეზი.',MA604:'განაცხადი უკვე დამუშავებულია. განაახლე სია.',
  // New flows (CONTRACT.md 2026-10-07): deals, comparison, contact, matching, onboarding.
  MA901:'ეს ჩანაწერი ვერ მოიძებნა ან შენთვის მიუწვდომელია.',MA902:'გადაამოწმე ველები: ზომა, კატეგორია ან სტატუსი არასწორია.',
  MA903:'ეს მოქმედება ამ ეტაპზე დაუშვებელია.',MA904:'მონაცემები განახლდა. გვერდი ხელახლა წაიკითხე და სცადე თავიდან.',
  MA905:'პირობებს ჯერ ორივე მხარე უნდა ადასტურებდეს.',MA906:'დასრულების დადასტურება მხოლოდ მყიდველს შეუძლია.',
  MA701:'აირჩიე მიზეზი. „სხვა“ მიზეზისთვის დაწერე 3–500 სიმბოლო.',MA702:'ეს გვერდი ვეღარ მოიძებნა ან მისი შეტყობინება შეუძლებელია.',MA703:'საკუთარ გვერდზე შეტყობინებას ვერ გააგზავნი.',
  MA704:'ამაზე უკვე შეგვატყობინე. შეტყობინებას განვიხილავთ.',MA705:'დღეში შეიძლება 10 შეტყობინება. სცადე ხვალ.',MA706:'საჩივარი უკვე დამუშავებულია. განაახლე სია.',
  MA001:'ამისთვის შედი ანგარიშში.',MA002:'ანგარიში დაბლოკილია.',MA003:'ეს მოქმედება მხოლოდ ადმინისთვისაა.',
  MA101:'სათაური უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს.',MA102:'აღწერე საჭიროება მინიმუმ 10 სიმბოლოთი.',MA103:'აირჩიე კატეგორია.',MA104:'აირჩიე ქალაქი.',
  MA105:'ერთდროულად შეიძლება 5 ღია განცხადება. დახურე ძველი და სცადე თავიდან.',MA106:'განცხადება ვერ მოიძებნა.',MA107:'ეს განცხადება შენ არ გეკუთვნის.',
  MA108:'არჩეული ან დამალული განცხადება ვერ გაგრძელდება.',MA109:'ატვირთე მხოლოდ სურათი.',
  MA111:'რაოდენობა უნდა იყოს დადებითი რიცხვი.',MA112:'აირჩიე რაოდენობის ერთეული.',MA113:'აირჩიე დღევანდელი ან მომავალი თარიღი (არაუგვიანეს 2 წლისა).',
  MA114:'მისამართი ან რაიონი უნდა შეიცავდეს მაქსიმუმ 120 სიმბოლოს.',
  MA115:'ლოგო უნდა იყოს JPG, PNG, WEBP ან GIF სურათი, მაქსიმუმ 2 მბ.',
  MA305:'ფოტო ამ პროფილზე ვეღარ მოიძებნა — შესაძლოა უკვე წაიშალა.',
  MA116:'გალერეაში შეიძლება 8-მდე ფოტო: JPG, PNG, WEBP ან GIF, თითო მაქსიმუმ 5 მბ.',
  MA412:'მისამართი უნდა შეიცავდეს მაქსიმუმ 200 სიმბოლოს.',
  MA413:'მიუთითე ორივე კოორდინატი: განედი −90-დან 90-მდე და გრძედი −180-დან 180-მდე.',
  MA110:'განცხადებას ვეღარ შეცვლი: მასზე უკვე მოვიდა შეთავაზება ან მომწოდებელი არჩეულია.',
  MA201:'შეთავაზების გაგზავნა შეუძლია მხოლოდ კომპანიის ანგარიშს.',MA202:'საკუთარ განცხადებაზე შეთავაზებას ვერ გააგზავნი.',MA203:'განცხადება აღარ იღებს შეთავაზებებს.',
  MA204:'აღწერე შეთავაზება მინიმუმ 10 სიმბოლოთი.',MA205:'ფასი უნდა იყოს დადებითი რიცხვი.',MA206:'შეთავაზება ვერ მოიძებნა.',MA207:'არჩეული შეთავაზება ვერ გაუქმდება.',
  MA208:'ამ განცხადებაზე არჩევა აღარ შეიძლება.',MA209:GENERIC,
  MA210:'აირჩიე ფასის ტიპი.',MA211:'„შეთანხმებით“ შეთავაზებაში ფასი არ მიეთითება.',MA212:'მიუთითე ფასი ან აირჩიე „შეთანხმებით“.',MA213:'მიწოდების ვადა უნდა იყოს 0-დან 365 დღემდე.',
 MA301:'საკუთარ ანგარიშს ვერ დაბლოკავ.',MA302:'მომხმარებელი ვერ მოიძებნა.',MA303:'დადასტურება შეიძლება მხოლოდ კომპანიისთვის.',MA304:'მიზეზი უნდა იყოს 3-დან 500 სიმბოლომდე.',
  MA401:'მიუთითე სახელი და გვარი.',MA402:'მიუთითე კომპანიის დასახელება.',MA403:'მიუთითე სწორი ელფოსტა.',MA404:'მიუთითე მობილურის ნომერი ფორმატით: +995 5XX XXX XXX.',
  MA405:'ეს ტელეფონის ნომერი უკვე გამოყენებულია.',MA407:'აირჩიე საქმიანობის მიმართულება.',MA408:CHECK_EMAIL,
  MA501:'მიმოწერა ვერ მოიძებნა ან მასზე წვდომა არ გაქვს.',MA502:'კომპანია მიუწვდომელია.',MA503:'საკუთარ თავს ვერ მისწერ.',
  MA504:'ამ მოთხოვნაზე მიმოწერის დაწყება შეუძლებელია.',MA505:'შეტყობინება უნდა შეიცავდეს 1–2000 სიმბოლოს.',
  MA506:'შეტყობინებებს ძალიან სწრაფად აგზავნი. ცოტა ხანში სცადე თავიდან.',MA507:'მიმოწერის მონაწილეებისა და კონტექსტის შეცვლა შეუძლებელია.',
  MA410:'კომპანიის აღწერა მაქსიმუმ 1000 სიმბოლოა.',MA411:'ჩამონათვალში შეიძლება 8 პუნქტამდე, თითო 120 სიმბოლომდე.'
 };
 const PASSWORD_MIN=8,PASSWORD_SHORT='პაროლი უნდა შედგებოდეს მინიმუმ 8 სიმბოლოსგან.',TERMS='რეგისტრაციისთვის საჭიროა წესებზე თანხმობა.';
 const EMAIL_EXISTS='ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ანგარიშში.',WRONG_LOGIN='პაროლი არასწორია.',BLOCKED_LOGIN='ანგარიში დაბლოკილია. დაუკავშირდი MeetAny-ს გუნდს.';
 const WRONG_CODE='კოდი არასწორია ან ვადაგასულია. სცადე თავიდან ან მოითხოვე ახალი კოდი.';

 const userError=(message,code,cause)=>{const e=new Error(message);e.userMessage=message;if(code)e.code=code;if(cause)e.cause=cause;return e;};
 const fail=(message,code)=>{throw userError(message,code);};
 // Data API error {message, code, detail, hint} -> Error with the Georgian text for its MAxxx code.
 function toError(err){
  if(err&&err.userMessage)return err;
  const code=(/^(MA\d{3})\b/.exec(err?.message||'')||[])[1]||(/^MA\d{3}$/.test(err?.hint||'')?err.hint:null);
  if(code&&MSG[code])return userError(MSG[code],code,err);
  console.error('MarketStore:',err);
  return userError(GENERIC,err?.code,err);
 }
 const clean=(value,max)=>String(value??'').trim().slice(0,max);

 function normalizePhone(value){
  const digits=String(value||'').replace(/[^\d]/g,'');
  const local=digits.startsWith('995')?digits.slice(3):digits.startsWith('0')?digits.slice(1):digits;
  if(!/^5\d{8}$/.test(local))return null;
  return '+995 '+local.slice(0,3)+' '+local.slice(3,6)+' '+local.slice(6);
 }

 /* ---------- config ---------- */
 const config={authUrl:process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL,dataApiUrl:'/api/db',uploadUrl:'/api/blob-upload'};
 const placeholder=v=>typeof v!=='string'||!v.trim()||/YOUR_|<|placeholder/i.test(v);
 // Absolute http(s) URL, or a same-origin path such as "/api/auth"; anything else -> null.
 function baseUrl(v){
  if(placeholder(v))return null;
  try{const u=new URL(v.trim(),typeof location!=='undefined'?location.origin:'http://localhost');return /^https?:$/.test(u.protocol)?u.href.replace(/\/+$/,''):null;}catch{return null;}
 }
 const AUTH=baseUrl(config.authUrl),API=baseUrl(config.dataApiUrl),UPLOAD=baseUrl(config.uploadUrl||'/api/blob-upload');
 const configured=!!(AUTH&&API);

 /* ---------- tokens (Neon Auth JWT, 15 min, re-fetched from /token while the session cookie lives) ---------- */
 const claimsOf=t=>{try{return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))));}catch{return {};}};
 let userJwt=null,userExp=0,authUser=null,anon=null,anonExp=0;
 function setUserJwt(t){
  const c=t?claimsOf(t):{};
  if(t&&c.sub&&c.role==='authenticated'){userJwt=t;userExp=(Number(c.exp)||0)*1000;authUser={id:c.sub,email:String(c.email||'').toLowerCase()};}
  else{userJwt=null;userExp=0;authUser=null;}
 }
 async function authFetch(path,body){
  let res;
  try{
   res=await fetch(AUTH+path,{method:body?'POST':'GET',credentials:'include',
    headers:body?{'Content-Type':'application/json',Accept:'application/json'}:{Accept:'application/json'},body:body?JSON.stringify(body):undefined});
  }catch(err){throw userError(GENERIC,'NETWORK',err);}
  const data=await res.json().catch(()=>null);
  if(!res.ok){const e=new Error(data?.message||('auth '+res.status));e.status=res.status;e.code=data?.code||'';throw e;}
  return {data,jwt:res.headers.get('set-auth-jwt')};
 }
 // Asks Neon Auth for a fresh user JWT (needs the session cookie). No session -> signed out.
 async function loadUserJwt(){
  try{
   // get-session answers 200 (null when signed out), so a signed-out visit logs no 401.
   const {data:session,jwt}=await authFetch('/get-session');
   if(!session?.user){setUserJwt(null);return null;}
   const {data}=jwt?{data:{token:jwt}}:await authFetch('/token');
   setUserJwt(data?.token||null);
  }
  catch(err){if(err.status===401||err.status===403||err.status===404)setUserJwt(null);else throw err;}
  return userJwt;
 }
 // Parallel reads share one in-flight /token/anonymous request.
 let anonTask=null;
 function anonJwt(){
  if(anon&&Date.now()<anonExp-60e3)return Promise.resolve(anon);
  if(!anonTask)anonTask=authFetch('/token/anonymous').then(({data})=>{
   if(!data?.token)throw new Error('no anonymous token');
   const e=Number(data.expires_at)||0;
   anon=data.token;anonExp=e>1e12?e:e>0?e*1000:(Number(claimsOf(anon).exp)||0)*1000; // seconds or milliseconds
   return anon;
  }).finally(()=>{anonTask=null;});
  return anonTask;
 }
 async function token(){
  if(userJwt&&Date.now()<userExp-60e3)return userJwt;
  if(userJwt&&!(await loadUserJwt()))return anonJwt();
  return userJwt||anonJwt();
 }

 /* ---------- Data API ---------- */
 async function db(path,{method='GET',body,retried=false,keepalive=false}={}){
  const bearer=await token();
  let res;
  try{
   res=await fetch(API+path,{method,keepalive,headers:{Authorization:'Bearer '+bearer,Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});
  }catch(err){throw userError(GENERIC,'NETWORK',err);}
  if(res.status===401&&!retried){
   // Expired or revoked token: fetch a fresh one once and retry.
   if(bearer===userJwt){userExp=0;await loadUserJwt();}else{anon=null;}
   return db(path,{method,body,retried:true,keepalive});
  }
  const text=await res.text();
  let data=null;if(text){try{data=JSON.parse(text);}catch{data=null;}}
  if(!res.ok)throw toError(data||{message:'HTTP '+res.status});
  return data;
 }
 const rows=data=>Array.isArray(data)?data:data&&typeof data==='object'?[data]:[];
 const one=data=>Array.isArray(data)?data[0]||null:data&&typeof data==='object'?data:null;
 const inList=ids=>'('+ids.map(encodeURIComponent).join(',')+')';

 /* ---------- cache ---------- */
 let cache={me:null,requests:[],offers:[],counts:{},profiles:{},contacts:{},users:null,stats:null,companies:[],companyStats:{}};
 let isReady=false,loadFailed=!configured,sessionReady=false;
 let dataRevision=0;
 const requestLoads=new Map();
 const companyLoads=new Map();
 let engagement={owner:null,status:'idle',savedIds:[],unread:0,notifications:{items:[],nextCursor:null},emailOffers:false,emailDelivery:false};
 let engagementTask=null,engagementRevision=0,engagementCapabilities=null;
 // A failed refresh keeps the previous data on screen; the flags say so, and mutations toast it.
 let dataStale=false,engagementStale=false;
 const warnStale=stale=>{if(stale&&typeof window!=='undefined')toast(STALE);};
 function pendingSaveIntent(){
  let intent=null;
  try{intent=JSON.parse(sessionStorage.getItem('meetany.saveIntent')||'null');}catch{}
  return intent&&Date.now()-intent.at<30*60*1000&&/^[0-9a-f-]{36}$/i.test(intent.id)?intent:null;
 }
 // load() starts capabilities/engagement_state beside the catalog reads; results are used
 // only for the same actor and revision, otherwise refreshEngagement fetches them again.
 function prefetchEngagement(actor){
  const settle=p=>p.then(value=>({value}),error=>({error}));
  return {actor,revision:engagementRevision,
   caps:engagementCapabilities?null:settle(db('/capabilities')),
   state:pendingSaveIntent()?null:settle(rpc('engagement_state'))};
 }
 async function refreshEngagement(pre){
  const actor=currentUser()?.id;
  if(!actor||currentUser()?.blocked){engagement={...engagement,owner:null,status:'idle',savedIds:[],unread:0,notifications:{items:[],nextCursor:null}};emit();return;}
  if(engagement.owner!==actor)engagement={owner:actor,status:'idle',savedIds:[],unread:0,notifications:{items:[],nextCursor:null},emailOffers:false,emailDelivery:false};
  if(engagementTask?.actor===actor)return engagementTask.promise;
  const revision=engagementRevision;
  if(pre&&(pre.actor!==actor||pre.revision!==revision))pre=null;
  const take=async(task,fetch)=>{const r=task&&await task;if(r&&!r.error)return r.value;return fetch();};
  const work=(async()=>{
   try{
    const caps=engagementCapabilities||await take(pre?.caps,()=>db('/capabilities'));
    if(caps.engagement)engagementCapabilities=caps;
    if(actor!==currentUser()?.id)return;
    if(!caps.engagement){engagement={...engagement,owner:actor,status:'unavailable'};emit();return;}
    const intent=pendingSaveIntent();
    if(intent){
     try{await rpc('set_saved_company',{p_company_id:intent.id,p_saved:true});sessionStorage.removeItem('meetany.saveIntent');}
     catch(err){if(err.code==='MA302')sessionStorage.removeItem('meetany.saveIntent');else throw err;}
    }
    const data=await take(!intent&&pre?.state,()=>rpc('engagement_state'));
    if(actor!==currentUser()?.id||revision!==engagementRevision)return;
    engagement={...data,owner:actor,status:'ready',emailDelivery:caps.emailDelivery};engagementStale=false;emit();
   }catch(err){
    console.error('MarketStore: engagement refresh failed',err);
    if(actor===currentUser()?.id&&revision===engagementRevision){engagement={...engagement,owner:actor,status:'error'};engagementStale=true;emit();}
   }
  })();
  engagementTask={actor,promise:work};
  try{await work;}finally{if(engagementTask?.promise===work)engagementTask=null;}
 }
 async function setSavedCompany(id,saved){
  const actor=requireUser().id;
  engagementRevision++;
  await rpc('set_saved_company',{p_company_id:id,p_saved:saved});
  if(actor===currentUser()?.id){engagement={...engagement,savedIds:saved?[...new Set([...engagement.savedIds,id])]:engagement.savedIds.filter(x=>x!==id)};emit();}
 }
 async function markNotificationRead(id){
  requireUser();engagementRevision++;await rpc('mark_notification_read',{p_id:id});if(engagementTask)await engagementTask.promise;await refreshEngagement();warnStale(engagementStale);
 }
 async function setNotificationEmail(enabled){
  requireUser();engagementRevision++;await rpc('set_notification_email',{p_enabled:enabled});if(engagementTask)await engagementTask.promise;await refreshEngagement();warnStale(engagementStale);
 }

 async function setRequestAlertPreferences(preferences){
  requireUser();engagementRevision++;
  const saved=await rpc('set_request_alert_preferences',{p_enabled:preferences.enabled,p_categories:preferences.categories,p_cities:preferences.cities,p_email_mode:preferences.emailMode});
  if(engagementTask)await engagementTask.promise;await refreshEngagement();warnStale(engagementStale);return saved;
 }
 const listeners=new Set();
 function emit(){listeners.forEach(fn=>{try{fn();}catch(err){console.error(err);}});}

 const mapUser=p=>p&&({id:p.id,role:p.role,name:p.name,company:p.company,email:p.email,phone:p.phone,city:p.city,address:p.address||null,lat:p.lat??null,lng:p.lng??null,industry:p.industry||undefined,verified:!!p.verified,verifiedAt:p.verified&&p.verified_at||null,blocked:!!p.blocked,blockedReason:p.blocked&&p.blocked_reason||null,createdAt:p.created_at,
  about:p.about||'',offers:Array.isArray(p.offers)?p.offers:[],seeks:Array.isArray(p.seeks)?p.seeks:[],serviceCities:Array.isArray(p.service_cities)?p.service_cities:[],logoUrl:p.logo_url||null,gallery:Array.isArray(p.gallery)?p.gallery.filter(Boolean):[]});
 const mapRequest=r=>({id:r.id,ownerId:r.owner_id,title:r.title,body:r.body,category:r.category,city:r.city,addressNote:r.address_note||null,photo:r.photo_url||null,
  quantity:r.quantity==null?null:Number(r.quantity),unit:r.quantity!=null&&Object.hasOwn(units,r.unit)?r.unit:null,neededBy:r.needed_by?String(r.needed_by).slice(0,10):null,status:r.status,hidden:!!r.hidden,hiddenReason:r.hidden&&r.hidden_reason||null,chosenOfferId:r.chosen_offer_id||null,createdAt:r.created_at,expiresAt:r.expires_at});
 const mapOffer=o=>({id:o.id,requestId:o.request_id,companyUserId:o.company_id,body:o.body,price:o.price==null?null:Number(o.price),
  priceType:Object.hasOwn(priceTypes,o.price_type)?o.price_type:(o.price==null?'negotiable':'total'),vatIncluded:!!o.vat_included,
  paymentTerms:o.payment_terms||null,validUntil:o.valid_until||null,commercialTerms:Array.isArray(o.commercial_terms)?o.commercial_terms:[],
  deliveryDays:o.delivery_days==null?null:Number(o.delivery_days),deliveryIncluded:!!o.delivery_included,status:o.status,createdAt:o.created_at,updatedAt:o.updated_at});
 const chunks=(list,size)=>{const out=[];for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));return out;};
 const compareCompanies=(a,b)=>Number(b.verified)-Number(a.verified)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id);
 // Contact (phone) is no longer a public column (migration 20261007-contact-visibility): it is read through
 // contact_for_request / get_deal_contact only after an offer is selected.
 const PUBLIC_PROFILE='id,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng,logo_url,gallery';


 // A render-local public store never starts auth/network work. The browser singleton
 // keeps its authenticated cache on navigation; only an unready singleton is seeded.
 function seedPublic(snapshot){
  if(!snapshot||isReady)return;
  cache.requests=snapshot.requests.map(mapRequest);
  cache.companies=snapshot.companies.map(c=>mapUser({...c,role:'company'}));
  for(const p of snapshot.profiles)cache.profiles[p.id]=mapUser(p);
  for(const c of cache.companies)cache.profiles[c.id]=c;
  for(const s of snapshot.companyStats)cache.companyStats[s.company_id]={sent:Number(s.offers_sent)||0,chosen:Number(s.offers_chosen)||0};
  for(const c of snapshot.counts)cache.counts[c.request_id]=Number(c.offers)||0;
  isReady=true;loadFailed=false;
 }
 seedPublic(initial);

 // Independent reads run side by side; each dependent read starts as soon as its input arrives.
 async function load(){
  if(!userJwt||Date.now()>=userExp-60e3){
   // A guest needs the anonymous token next, so ask for it while get-session answers.
   if(!userJwt&&!anon)anonJwt().catch(()=>{});
   await loadUserJwt();
  }
  const uid=authUser?.id||null;
  const post=(fn,body={})=>db('/rpc/'+fn,{method:'POST',body});
  const reqP=readAllRows(db,'/requests?select=*').then(r=>r.map(mapRequest));
  const meP=uid?post('my_profile').then(one).then(mapUser):Promise.resolve(null);
  const companiesP=readAllRows(db,'/profiles?select='+PUBLIC_PROFILE+'&role=eq.company').then(r=>r.map(mapUser).sort(compareCompanies));
  // Offers are read for any session and kept only when the profile exists (RLS scopes them).
  const offersP=uid?readAllRows(db,'/offers?select=*').then(r=>r.map(mapOffer)):Promise.resolve([]);
  const statsP=companiesP.then(cs=>Promise.all(chunks(cs.map(c=>c.id),500).map(part=>post('company_stats',{ids:part}).then(rows)))).then(parts=>parts.flat());
  const countsP=reqP.then(rs=>Promise.all(chunks(rs.map(r=>r.id),500).map(part=>post('offer_counts',{ids:part}).then(rows)))).then(parts=>parts.flat());
  const isAdminP=meP.then(me=>!!(me&&me.role==='admin'&&!me.blocked));
  // New admin APIs page users independently; retain legacy compatibility until migration.
  const adminP=isAdminP.then(async isAdmin=>{
   if(!isAdmin)return {statsRow:null,userRows:null};
   const statsRow=await post('admin_stats').then(one);
   return {statsRow,userRows:Number(statsRow?.adminApiVersion)>=1?null:await post('admin_list_users').then(rows)};
  });
  const pre=uid?prefetchEngagement(uid):null;
  // Public columns for request authors and offer authors not known yet.
  const profilesP=Promise.all([reqP,companiesP,offersP,meP]).then(([rs,cs,os,me])=>{
   const known=new Set(cs.map(c=>c.id));
   const need=[...new Set([...rs.map(r=>r.ownerId),...(me?os:[]).map(o=>o.companyUserId)])].filter(id=>!known.has(id));
   return Promise.all(chunks(need,100).map(part=>db('/profiles?select='+PUBLIC_PROFILE+'&id=in.'+inList(part)).then(rows))).then(parts=>parts.flat());
  });
  // Contacts open only between the request author and the chosen company.
  const contactsP=Promise.all([reqP,offersP,meP]).then(([rs,os,me])=>{
   if(!me)return [];
   const byId=Object.fromEntries(os.map(o=>[o.id,o]));
   const involved=rs.filter(r=>r.chosenOfferId&&(r.ownerId===me.id||byId[r.chosenOfferId]?.companyUserId===me.id));
   return Promise.all(involved.map(r=>post('contact_for_request',{p_request_id:r.id}).then(d=>[r.id,one(d)])));
  });
  const all=[reqP,meP,companiesP,offersP,statsP,countsP,adminP,profilesP,contactsP];
  // Every branch settles before a failure propagates, so no read is left unobserved.
  const settled=await Promise.allSettled(all);
  const failed=settled.find(s=>s.status==='rejected');
  if(failed)throw failed.reason;
  const [requests,me,companies,offerList,statRows,countRows,{statsRow,userRows},profileRows,contactList]=settled.map(s=>s.value);
  const next={me,requests,offers:me?offerList:[],counts:{},profiles:{},contacts:{},users:null,stats:statsRow||null,companies,companyStats:{}};
  for(const c of companies)next.profiles[c.id]=c;
  for(const s of statRows)next.companyStats[s.company_id]={sent:Number(s.offers_sent)||0,chosen:Number(s.offers_chosen)||0};
  for(const row of countRows)next.counts[row.request_id]=Number(row.offers)||0;
  if(userRows){next.users=userRows.map(mapUser);for(const u of next.users)next.profiles[u.id]=u;}
  for(const p of profileRows)if(!next.profiles[p.id])next.profiles[p.id]=mapUser(p);
  if(me)next.profiles[me.id]=me;
  for(const [id,c] of contactList)if(c)next.contacts[id]={name:c.name,company:c.company,phone:c.phone,email:c.email};
  // Polling is a freshness check, not a new UI state. Unchanged payloads must not
  // invalidate detail/list views or flash their skeletons every thirty seconds.
  if(JSON.stringify(cache)!==JSON.stringify(next)){cache=next;dataRevision++;}
  if(pre)pre.actor=me?.id||null;
  await refreshEngagement(pre);
 }

 // Refreshes are serialized: a call during a running refresh schedules exactly one more.
 let running=null,queued=null,loadedAt=0;
 function refresh(){
  if(!configured)return Promise.resolve();
  if(running){if(!queued)queued=running.then(()=>{queued=null;return refresh();});return queued;}
  running=load().then(()=>{loadFailed=false;dataStale=false;loadedAt=Date.now();},err=>{console.error('MarketStore: refresh failed',err);if(!isReady)loadFailed=true;else dataStale=true;})
   .then(()=>{running=null;isReady=true;sessionReady=true;emit();});
  return running;
 }
 // Page mounts ask for current data; a load in flight or finished moments ago already is.
 function revalidate(){
  if(running)return queued||running;
  if(Date.now()-loadedAt<5000)return Promise.resolve();
  return refresh();
 }
 const readyPromise=background&&typeof window!=='undefined'?(configured?refresh():Promise.resolve().then(()=>{isReady=true;emit();})):Promise.resolve();

 function client(){if(!configured)fail(UNAVAILABLE);}
 async function rpc(name,args={}){client();return db('/rpc/'+name,{method:'POST',body:args});}
 async function mutate(name,args,map){const data=one(await rpc(name,args))||null;await refresh();warnStale(dataStale);return map&&data?map(data):data;}

 /* ---------- auth ---------- */
 function currentUser(){return cache.me;}
 function userById(id){return cache.profiles[id]||null;}

 // Form values kept between sign-up and the email code (memory + sessionStorage; never the password).
 let pending=null;
 try{pending=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');}catch{pending=null;}
 function setPending(value){pending=value;try{if(value)sessionStorage.setItem(PENDING_KEY,JSON.stringify(value));else sessionStorage.removeItem(PENDING_KEY);}catch{}}
 // Signed in with Neon Auth but no MarketStore profile yet (the code was verified, complete_profile not done).
 function needsProfile(){return !!(authUser&&!cache.me);}
 function pendingProfile(){
  if(needsProfile())return {...(pending&&pending.email===authUser.email?pending:{}),email:authUser.email};
  return pending?{...pending}:null;
 }
 function pendingEmail(){return pending&&!authUser?pending.email||null:null;}

 function validateProfile(input,{email,withPassword}){
  const role=input.role==='company'?'company':'client';
  const name=clean(input.name,80),company=clean(input.company,100);
  const phone=normalizePhone(input.phone),password=String(input.password||'');
  if(name.length<2)fail(MSG.MA401,'MA401');
  if(role==='company'&&company.length<2)fail(MSG.MA402,'MA402');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(MSG.MA403,'MA403');
  if(!phone)fail(MSG.MA404,'MA404');
  if(withPassword&&password.length<PASSWORD_MIN)fail(PASSWORD_SHORT);
  if(!input.acceptTerms)fail(TERMS);
  if(!Object.hasOwn(cities,input.city))fail(MSG.MA104,'MA104');
  if(role==='company'&&!Object.hasOwn(categories,input.industry))fail(MSG.MA407,'MA407');
  return {role,name,company:company||name,phone,city:input.city,industry:role==='company'?input.industry:null,email};
 }
 async function completeProfile(p){
  const row=one(await rpc('complete_profile',{p_role:p.role,p_name:p.name,p_company:p.company,p_phone:p.phone,p_city:p.city,p_industry:p.industry}));
  return row;
 }
 // After the code was verified or a password sign-in: JWT -> profile (complete it if the form values are known) -> blocked check.
 async function finishSignIn(){
  if(!(await loadUserJwt()))fail(GENERIC);
  let me=one(await rpc('my_profile'));
  if(!me&&pending&&pending.email===authUser.email){
   try{me=await completeProfile(pending);}
   catch(err){await refresh();throw err;}
  }
  if(!me){await refresh();fail('', 'PROFILE_REQUIRED');}
  if(me.blocked){await logout();fail(BLOCKED_LOGIN);}
  setPending(null);
  await refresh();
  if(!cache.me)fail(GENERIC);
  return cache.me;
 }

 async function register(input){
  client();
  // Already signed in without a profile (e.g. MA405 after the code step): only complete the profile.
  if(needsProfile()){
   const p=validateProfile(input,{email:authUser.email,withPassword:false});
   setPending(p);
   return finishSignIn();
  }
  const email=clean(input.email,120).toLowerCase();
  const p=validateProfile(input,{email,withPassword:true});
  try{await authFetch('/sign-up/email',{email,password:String(input.password||''),name:p.name});}
  catch(err){
   if(err.userMessage)throw err;
   const code=String(err.code||'');
   if(/^USER_ALREADY_EXISTS/.test(code)||err.status===422&&/exist/i.test(err.message))fail(EMAIL_EXISTS);
   if(/^PASSWORD_TOO_(SHORT|LONG)$/.test(code))fail(PASSWORD_SHORT);
   if(code==='INVALID_EMAIL')fail(MSG.MA403,'MA403');
   throw toError(err);
  }
  setPending(p);
  // No email code step when Neon Auth signs the user in right away (email verification off).
  if(await loadUserJwt().catch(()=>null))return finishSignIn();
  return {confirmationPending:true,email,message:CHECK_EMAIL};
 }
 async function verifyEmailCode(code){
  client();
  const email=pending?.email;
  if(!email)fail(GENERIC);
  const otp=String(code||'').replace(/\s+/g,'');
  if(!/^[A-Za-z0-9]{4,10}$/.test(otp))fail(WRONG_CODE,'INVALID_OTP');
  try{await authFetch('/email-otp/verify-email',{email,otp});}
  catch(err){
   if(err.userMessage)throw err;
   if(/OTP|ATTEMPTS|INVALID/i.test(String(err.code||''))||err.status===400)fail(WRONG_CODE,err.code||'INVALID_OTP');
   throw toError(err);
  }
  return finishSignIn();
 }
 async function resendCode(){
  client();
  const email=pending?.email;
  if(!email)fail(GENERIC);
  try{await authFetch('/email-otp/send-verification-otp',{email,type:'email-verification'});}
  catch(err){if(err.userMessage)throw err;throw toError(err);}
  return {email};
 }
 async function login(email,password){
  client();
  const address=clean(email,120).toLowerCase();
  try{await authFetch('/sign-in/email',{email:address,password:String(password||'')});}
  catch(err){
   if(err.userMessage)throw err;
   const code=String(err.code||'');
   if(code==='EMAIL_NOT_VERIFIED'||err.status===403&&/verif/i.test(err.message)){
    // A fresh code was emailed: continue with the code step (keeps the sign-up values if they are for this email).
    setPending(pending&&pending.email===address?pending:{email:address});
    fail(CHECK_EMAIL,'MA408');
   }
   if(code==='BANNED_USER')fail(BLOCKED_LOGIN);
   if(err.status===401||err.status===400||/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|INVALID_EMAIL/.test(code))fail(WRONG_LOGIN);
   throw toError(err);
  }
  return finishSignIn();
 }
 // Password reset by email code: request a code, then set the new password with it and sign in.
 let resetEmail=null;
 try{resetEmail=sessionStorage.getItem('meetany.resetEmail');}catch{resetEmail=null;}
 function setResetEmail(v){resetEmail=v;try{if(v)sessionStorage.setItem('meetany.resetEmail',v);else sessionStorage.removeItem('meetany.resetEmail');}catch{}}
 async function requestPasswordReset(email){
  client();
  const address=clean(email,120).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))fail(MSG.MA403,'MA403');
  // The answer is the same whether or not the account exists, so the form reveals nothing.
  try{await authFetch('/email-otp/request-password-reset',{email:address});}
  catch(err){if(err.userMessage)throw err;if(err.status>=500||err.status===429)throw toError(err);}
  setResetEmail(address);
  return {email:address};
 }
 async function resetPassword(code,password){
  client();
  if(!resetEmail)fail(GENERIC);
  const otp=String(code||'').replace(/\s+/g,'');
  if(!/^[A-Za-z0-9]{4,10}$/.test(otp))fail(WRONG_CODE,'INVALID_OTP');
  if(String(password||'').length<PASSWORD_MIN)fail(PASSWORD_SHORT);
  try{await authFetch('/email-otp/reset-password',{email:resetEmail,otp,password:String(password)});}
  catch(err){
   if(err.userMessage)throw err;
   if(/PASSWORD_TOO_(SHORT|LONG)/.test(String(err.code||'')))fail(PASSWORD_SHORT);
   if(/OTP|ATTEMPTS|INVALID/i.test(String(err.code||''))||err.status===400)fail(WRONG_CODE,err.code||'INVALID_OTP');
   throw toError(err);
  }
  const email=resetEmail;setResetEmail(null);
  return login(email,password);
 }
 async function changePassword(currentPassword,newPassword){
  client();
  const current=String(currentPassword||''),password=String(newPassword||'');
  if(!current)fail('მიუთითე მიმდინარე პაროლი.');
  if(password.length<PASSWORD_MIN)fail(PASSWORD_SHORT);
  if(password.length>128)fail('პაროლი მაქსიმუმ 128 სიმბოლოა.');
  try{await authFetch('/change-password',{currentPassword:current,newPassword:password,revokeOtherSessions:true});}
  catch(err){
   if(err.userMessage)throw err;
   const code=String(err.code||'');
   if(code==='PASSWORD_TOO_SHORT')fail(PASSWORD_SHORT);
   if(code==='PASSWORD_TOO_LONG')fail('პაროლი მაქსიმუმ 128 სიმბოლოა.');
   if(code==='INVALID_PASSWORD')fail('მიმდინარე პაროლი არასწორია.',code);
   throw toError(err);
  }
 }
 function pendingResetEmail(){return resetEmail;}

 async function logout(){
  if(!configured)return;
  let error=null;
  try{await authFetch('/sign-out',{});}catch(err){error=err;}
  setUserJwt(null);setPending(null);
  await refresh();
  if(error)throw toError(error);
 }

 /* ---------- reads ---------- */
 function requestState(r,now=Date.now()){
  if(r.hidden)return 'hidden';
  if(r.chosenOfferId)return 'chosen';
  if(r.status==='closed')return 'closed';
  if(Date.parse(r.expiresAt)<=now)return 'expired';
  return 'open';
 }
 const stateLabels={open:'ღიაა',chosen:'მომწოდებელი არჩეულია',closed:'დახურულია',expired:'ვადაგასულია',hidden:'დამალულია ადმინის მიერ'};
 function daysLeft(r,now=Date.now()){return Math.max(0,Math.ceil((Date.parse(r.expiresAt)-now)/DAY));}
 function offerCount(requestId){return cache.counts[requestId]||0;}

 function listRequests({category='',city='',state='open',q='',ownerId='',includeHidden=false,includeTests=false}={}){
  const terms=clean(q,200).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cache.requests.filter(r=>{
   const s=requestState(r);
   if(!ownerId&&!includeHidden&&!includeTests&&isInternalTestRequest(r,userById(r.ownerId)))return false;
   if(!includeHidden&&s==='hidden')return false;
   if(ownerId&&r.ownerId!==ownerId)return false;
   if(state==='open'&&s!=='open')return false;
   if(state==='done'&&!['chosen','closed','expired'].includes(s))return false;
   if(category&&!expandCategories(category).includes(r.category))return false;
   if(city&&!city.split(',').includes(r.city)&&r.city!=='georgia')return false;
   const text=(r.title+' '+r.body+' '+categories[r.category]+' '+cities[r.city]).toLocaleLowerCase();
   return terms.every(t=>text.includes(t));
  }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 }
 function getRequest(id){return cache.requests.find(r=>r.id===id)||null;}

 function canSeeOffer(viewer,offer,request){return !!viewer&&(viewer.role==='admin'||viewer.id===request.ownerId||viewer.id===offer.companyUserId);}
 // Offers are sealed: the database returns only rows the viewer may see (RLS); this filter mirrors it.
 function visibleOffers(requestId,viewer=currentUser()){
  const request=getRequest(requestId);if(!request)return [];
  return cache.offers.filter(o=>o.requestId===request.id&&canSeeOffer(viewer,o,request)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 }
 function contactFor(request,viewer=currentUser()){
  if(!viewer||!request||!request.chosenOfferId||viewer.id!==cache.me?.id)return null;
  return cache.contacts[request.id]||null;
 }
 function myOffers(user=currentUser()){if(!user)return [];return cache.offers.filter(o=>o.companyUserId===user.id).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));}
 function stats(){
  if(cache.stats)return {...cache.stats};
  const reqs=cache.requests.filter(r=>!r.hidden),people=Object.values(cache.profiles);
  return {users:people.filter(u=>u.role!=='admin').length,companies:people.filter(u=>u.role==='company').length,verified:people.filter(u=>u.role==='company'&&u.verified).length,open:reqs.filter(r=>requestState(r)==='open').length,requests:reqs.length,offers:reqs.reduce((n,r)=>n+offerCount(r.id),0),chosen:reqs.filter(r=>r.chosenOfferId).length};
 }
 function allUsers(){return [...(cache.users||Object.values(cache.profiles))].sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));}

 // Detail routes load their own record: admin pagination can open records beyond the catalog cap.
 async function ensureRequest(id,{cached=false}={}){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||'')))return null;
  // A completed session refresh already contains this record, its RLS-scoped offers,
  // author and count. Route mounts can reuse it; explicit reads still bypass it.
  if(cached&&sessionReady&&dataRevision>0&&!dataStale){const found=getRequest(id);if(found)return found;}
  const actor=currentUser()?.id||null,revision=dataRevision,key=[id,actor,revision].join(':');
  if(requestLoads.has(key))return requestLoads.get(key);
  const work=(async()=>{
   const row=one(await db('/requests?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1'));
   if(!row){if(actor===(currentUser()?.id||null)&&revision===dataRevision){cache.requests=cache.requests.filter(r=>r.id!==id);emit();}return null;}
   const request=mapRequest(row);
   const [offerRows,countRows]=await Promise.all([
    actor?readAllRows(db,'/offers?select=*&request_id=eq.'+encodeURIComponent(id)):[],
    rpc('offer_counts',{ids:[id]}).then(rows)
   ]);
   const offers=offerRows.map(mapOffer);
   const profileIds=[...new Set([request.ownerId,...offers.map(o=>o.companyUserId)])];
   const profiles=(await Promise.all(chunks(profileIds,100).map(part=>db('/profiles?select='+PUBLIC_PROFILE+'&id=in.'+inList(part)).then(rows)))).flat().map(mapUser);
   const involved=actor&&request.chosenOfferId&&(request.ownerId===actor||offers.some(o=>o.id===request.chosenOfferId&&o.companyUserId===actor));
   const contact=involved?one(await rpc('contact_for_request',{p_request_id:id})):null;
   if(actor!==(currentUser()?.id||null)||revision!==dataRevision)return null;
   cache.requests=[...cache.requests.filter(r=>r.id!==id),request];
   cache.offers=[...cache.offers.filter(o=>o.requestId!==id),...offers];
   cache.counts[id]=Number(countRows[0]?.offers)||0;
   for(const profile of profiles)if(profile&&profile.id!==actor)cache.profiles[profile.id]=profile;
   if(contact)cache.contacts[id]={name:contact.name,company:contact.company,phone:contact.phone,email:contact.email};
   else delete cache.contacts[id];
   emit();return request;
  })();
  requestLoads.set(key,work);
  try{return await work;}finally{requestLoads.delete(key);}
 }

 /* ---------- request writes ---------- */
 function requireUser(){const user=currentUser();if(!user)fail(MSG.MA001,'MA001');if(user.blocked)fail(MSG.MA002,'MA002');return user;}
 // Calendar dates as 'YYYY-MM-DD' in Georgian time (the server compares with the Asia/Tbilisi date).
 const pad=n=>String(n).padStart(2,'0');
 function todayDate(){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  catch{const d=new Date(Date.now()+4*3600e3);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());}
 }
 // Latest accepted needed-by date: today + 2 years (29 Feb -> 28 Feb, like Postgres).
 function maxNeededBy(){
  const [y,m,d]=todayDate().split('-').map(Number),last=new Date(Date.UTC(y+NEEDED_BY_YEARS,m,0)).getUTCDate();
  return (y+NEEDED_BY_YEARS)+'-'+pad(m)+'-'+pad(Math.min(d,last));
 }
 function validDate(v){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);if(!m)return false;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3];
 }
 const blank=v=>v==null||String(v).trim()==='';
 const toNumber=v=>typeof v==='number'?v:Number(String(v).trim().replace(/\s+/g,'').replace(',','.'));
 // Same rules as meetany_private.check_terms. keepDate: the stored date of the request being edited
 // (accepted unchanged even when it is in the past now).
 function validateTerms(input,keepDate=null){
  let quantity=null,unit=null,neededBy=null;
  if(!blank(input.quantity)){
   quantity=toNumber(input.quantity);
   if(!Number.isFinite(quantity)||quantity<=0||quantity>QUANTITY_MAX)fail(MSG.MA111,'MA111');
   quantity=Math.round(quantity*1000)/1000;
   if(quantity<=0)fail(MSG.MA111,'MA111');
   if(!Object.hasOwn(units,input.unit))fail(MSG.MA112,'MA112');
   unit=input.unit;
  }
  if(!blank(input.neededBy)){
   neededBy=String(input.neededBy).trim().slice(0,10);
   if(!validDate(neededBy))fail(MSG.MA113,'MA113');
   if(neededBy!==keepDate&&(neededBy<todayDate()||neededBy>maxNeededBy()))fail(MSG.MA113,'MA113');
  }
  return {quantity,unit,neededBy};
 }
 function validateRequest(input,keepDate=null){
  const title=clean(input.title,120),body=clean(input.body,2000);
  if(title.length<5)fail(MSG.MA101,'MA101');
  if(body.length<10)fail(MSG.MA102,'MA102');
  if(!Object.hasOwn(categories,input.category))fail(MSG.MA103,'MA103');
  if(!Object.hasOwn(cities,input.city))fail(MSG.MA104,'MA104');
  const addressNote=String(input.addressNote??'').trim()||null;
  if(addressNote&&[...addressNote].length>120)fail(MSG.MA114,'MA114');
  return {title,body,addressNote,category:input.category,city:input.city,...validateTerms(input,keepDate)};
 }
 function toBlob(photo){
  if(typeof Blob!=='undefined'&&photo instanceof Blob)return photo;
  const m=/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(photo);
  if(!m)fail(MSG.MA109,'MA109');
  const bin=atob(m[2]),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:m[1].toLowerCase()});
 }
 const EXT={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
 // Browser -> Vercel Blob. uploadUrl (api/blob-upload.js) checks the Neon JWT, profile and path and
 // signs a one-file token (jpeg/png/webp/gif, <= 5 MB); the file itself goes straight to Blob.
 let blobClient=null;
 // A company logo is '<uid>/logo-<ts>.<ext>', at most 2 MB (MA115).
 async function uploadPhoto(user,photo,{prefix='',maxBytes=5*1024*1024,code='MA109'}={}){
  const blob=toBlob(photo),ext=EXT[blob.type];
  if(!ext)fail(MSG[code],code);
  if(blob.size>maxBytes)fail(MSG[code],code);
  if(!UPLOAD)fail(UNAVAILABLE);
  const pathname=user.id+'/'+prefix+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'.'+ext;
  const jwt=await token();
  if(jwt!==userJwt)fail(MSG.MA001,'MA001');
  let result;
  try{
   blobClient=blobClient||import('@vercel/blob/client');
   const {upload}=await blobClient;
   result=await upload(pathname,blob,{access:'public',handleUploadUrl:UPLOAD,contentType:blob.type,multipart:false,headers:{Authorization:'Bearer '+jwt}});
  }catch(err){
   blobClient=null;
   if(/content type|too large|size|not allowed/i.test(err?.message||''))fail(MSG[code],code);
   throw toError(err);
  }
  if(!result?.url)fail(GENERIC);
  return {url:result.url};
 }
 const uploadLogo=file=>uploadPhoto(requireUser(),file,{prefix:'logo-',maxBytes:2*1024*1024,code:'MA115'});
 // Best effort: removes the caller's own orphaned photo when create_request failed (or a replaced logo).
 function removePhoto(url){
  token().then(jwt=>jwt===userJwt&&fetch(UPLOAD,{method:'DELETE',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({url})})).catch(()=>{});
 }
 async function createRequest(input){
  client();
  const user=requireUser(),fields=validateRequest(input);
  const hasPhoto=input.photo&&(typeof input.photo==='string'?input.photo.startsWith('data:image/'):true);
  const photo=hasPhoto?await uploadPhoto(user,input.photo):null;
  try{
   return await mutate('create_request',{p_title:fields.title,p_body:fields.body,p_category:fields.category,p_city:fields.city,p_photo_url:photo?photo.url:null,
    p_quantity:fields.quantity,p_unit:fields.unit,p_needed_by:fields.neededBy,p_address_note:fields.addressNote},mapRequest);
  }catch(err){
   if(photo)removePhoto(photo.url);
   throw err;
  }
 }
 async function updateRequest(id,input){
  client();requireUser();
  // Full replacement on the server: pass every field (omitted quantity/unit/neededBy are cleared).
  const current=getRequest(id);
  const fields=validateRequest({...input,addressNote:input.addressNote===undefined?current?.addressNote:input.addressNote},current?.neededBy||null);
  return mutate('update_request',{p_request_id:id,p_title:fields.title,p_body:fields.body,p_category:fields.category,p_city:fields.city,
   p_quantity:fields.quantity,p_unit:fields.unit,p_needed_by:fields.neededBy,p_address_note:fields.addressNote},mapRequest);
 }
 const closeRequest=id=>mutate('close_request',{p_request_id:id},mapRequest);
 const extendRequest=id=>mutate('extend_request',{p_request_id:id},mapRequest);
 const deleteRequest=id=>mutate('delete_request',{p_request_id:id});

 /* ---------- offers ---------- */
 // input: {body, price, priceType ('unit'|'total'|'negotiable'), vatIncluded, deliveryDays, deliveryIncluded}.
 // No priceType: price -> 'total', no price -> 'negotiable' (same as the server). 'negotiable' ignores
 // a leftover price and the VAT flag; 'unit'/'total' need a price (MA212).
 async function sendOffer(requestId,input){
  const priceType=blank(input.priceType)?(blank(input.price)?'negotiable':'total'):String(input.priceType);
  if(!Object.hasOwn(priceTypes,priceType))fail(MSG.MA210,'MA210');
  let price=null;
  if(priceType!=='negotiable'){
   if(blank(input.price))fail(MSG.MA212,'MA212');
   price=toNumber(input.price);
   if(!Number.isFinite(price)||price<=0||price>1e9)fail(MSG.MA205,'MA205');
   price=Math.round(price*100)/100;if(price<=0)fail(MSG.MA205,'MA205');
  }
  let deliveryDays=null;
  if(!blank(input.deliveryDays)){
   deliveryDays=toNumber(input.deliveryDays);
   if(!Number.isInteger(deliveryDays)||deliveryDays<0||deliveryDays>DELIVERY_DAYS_MAX)fail(MSG.MA213,'MA213');
  }
  return mutate('send_offer',{p_request_id:requestId,p_body:String(input.body??''),p_price:price,p_price_type:priceType,
   p_vat_included:priceType!=='negotiable'&&!!input.vatIncluded,p_delivery_days:deliveryDays,p_delivery_included:!!input.deliveryIncluded},mapOffer);
 }
 const withdrawOffer=offerId=>mutate('withdraw_offer',{p_offer_id:offerId});
 // Sends the version the author was shown; if the company edited the offer since, the server
 // refuses (MA209) and the refresh shows the new version.
 async function chooseOffer(offerId){
  const shown=cache.offers.find(o=>o.id===offerId);
  try{return await mutate('choose_offer',{p_offer_id:offerId,p_expected_updated_at:shown?.updatedAt||null},mapOffer);}
  catch(err){await refresh();throw err;}
 }

 /* ---------- company profiles ---------- */
 // Lists come from textareas: one item per line.
 const lines=v=>(Array.isArray(v)?v:String(v??'').split('\n')).map(x=>String(x).trim()).filter(Boolean);
 // logoUrl: undefined = keep, '' = remove, otherwise a URL from uploadLogo(). The replaced logo file is removed.
 async function updateProfile(input){
  client();const me=requireUser();
  const logoUrl=input.logoUrl===undefined||input.logoUrl===null?null:String(input.logoUrl).trim();
  const name=clean(input.name,80),company=clean(input.company,100),about=String(input.about??'').trim();
  const address=String((input.address===undefined?me.address:input.address)??'').trim()||null;
  const lat=input.lat===undefined?(me.lat??null):input.lat===''?null:input.lat;
  const lng=input.lng===undefined?(me.lng??null):input.lng===''?null:input.lng;
  if(address&&[...address].length>200)fail(MSG.MA412,'MA412');
  if(!((lat===null&&lng===null)||(Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180)))fail(MSG.MA413,'MA413');
  const offers=lines(input.offers),seeks=lines(input.seeks);
  const serviceCities=(Array.isArray(input.serviceCities)?input.serviceCities:[]).filter(c=>Object.hasOwn(cities,c));
  if(name.length<2)fail(MSG.MA401,'MA401');
  if(me.role==='company'&&company.length<2)fail(MSG.MA402,'MA402');
  if(!Object.hasOwn(cities,input.city))fail(MSG.MA104,'MA104');
  if(me.role==='company'&&!Object.hasOwn(categories,input.industry))fail(MSG.MA407,'MA407');
  if(about.length>1000)fail(MSG.MA410,'MA410');
  if(offers.length>8||seeks.length>8||[...offers,...seeks].some(x=>x.length>120))fail(MSG.MA411,'MA411');
  return mutate('update_my_profile',{p_name:name,p_company:company,p_city:input.city,p_industry:me.role==='company'?input.industry:null,
   p_about:about,p_offers:offers,p_seeks:seeks,p_service_cities:serviceCities,p_address:address,p_lat:lat,p_lng:lng,p_logo_url:logoUrl},mapUser)
   .catch(err=>{if(logoUrl&&logoUrl!==me.logoUrl)removePhoto(logoUrl);throw err;})
   .then(user=>{if(logoUrl!==null&&me.logoUrl&&me.logoUrl!==user?.logoUrl)removePhoto(me.logoUrl);return user;});
 }
 // Company gallery: the whole ordered list, at most 8 — saved URLs and/or new files (JPG/PNG/WEBP/GIF
 // <= 5 MB, uploaded here as '<uid>/gallery-<ts>.<ext>'). After success the dropped files are removed;
 // on any failure the new uploads are removed and the saved gallery stays as it was (best effort).
 async function setGallery(items){
  client();const me=requireUser();
  const list=Array.isArray(items)?items.filter(Boolean):[];
  const before=me.gallery||[];
  if(me.role!=='company'||list.length>8)fail(MSG.MA116,'MA116');
  const uploaded=[];
  try{
   const urls=[];
   for(const item of list){
    if(typeof item==='string'){urls.push(item.trim());continue;}
    const {url}=await uploadPhoto(me,item,{prefix:'gallery-',code:'MA116'});
    uploaded.push(url);urls.push(url);
   }
   const user=await mutate('set_my_gallery',{p_urls:[...new Set(urls)]},mapUser);
   before.filter(u=>!(user?.gallery||[]).includes(u)).forEach(removePhoto);
   return user;
  }catch(err){uploaded.forEach(removePhoto);throw err;}
 }
 function directionsUrl(profile){
  if(!profile)return null;
  const {lat,lng}=profile;
  const coordinates=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  const address=String(profile.address??'').trim();
  if(!coordinates&&!address)return null;
  const destination=coordinates?`${lat},${lng}`:encodeURIComponent(address+', '+(cities[profile.city]||profile.city||''));
  return 'https://www.google.com/maps/dir/?api=1&destination='+destination;
 }
 // Companies for the public catalog: search in name, about and offers; industry and city filters.
 // A company serves a city when it is its own city, a listed service city, or it serves all Georgia.
 function servesCity(c,city){return c.city===city||c.serviceCities.includes(city)||c.city==='georgia'||c.serviceCities.includes('georgia');}
 function listCompanies({q='',industry='',city='',verified=false,type='',includeTests=false}={}){
  const terms=clean(q,200).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cache.companies.filter(c=>{
   if(!includeTests&&isInternalTestAccount(c))return false;
   if(industry&&!expandCategories(industry).includes(c.industry))return false;
   const supplier=categoryKind[c.industry]==='product';
   if(type==='suppliers'&&!supplier)return false;
   if(type==='services'&&supplier)return false;
   if(type==='partners'&&!c.seeks.length)return false;
   if(city&&!city.split(',').some(x=>servesCity(c,x)))return false;
   if(verified&&!c.verified)return false;
   const text=[c.company,c.about,...c.offers,...c.seeks,categories[c.industry]||'',cities[c.city]||''].join(' ').toLocaleLowerCase();
   return terms.every(t=>text.includes(t));
  });
 }
 function getCompany(id){return cache.companies.find(c=>c.id===id)||null;}
 // Direct profile links must work before the full catalog has finished loading.
 async function ensureCompany(id,{cached=false}={}){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||'')))return null;
  if(cached&&sessionReady&&dataRevision>0&&!dataStale){const found=getCompany(id);if(found)return found;}
  const revision=dataRevision,key=[id,revision].join(':');
  if(companyLoads.has(key))return companyLoads.get(key);
  const work=(async()=>{
   const row=one(await db('/profiles?select='+PUBLIC_PROFILE+'&role=eq.company&id=eq.'+encodeURIComponent(id)+'&limit=1'));
   const statRows=row?rows(await rpc('company_stats',{ids:[id]})):[];
   if(revision!==dataRevision)return null;
   const company=mapUser(row);
   cache.companies=cache.companies.filter(c=>c.id!==id);
   if(company){
    cache.companies.push(company);cache.companies.sort(compareCompanies);
    if(id!==cache.me?.id)cache.profiles[id]=company;
    const stats=statRows[0];cache.companyStats[id]={sent:Number(stats?.offers_sent)||0,chosen:Number(stats?.offers_chosen)||0};
   }else{if(id!==cache.me?.id)delete cache.profiles[id];delete cache.companyStats[id];}
   emit();return company;
  })();
  companyLoads.set(key,work);
  try{return await work;}finally{companyLoads.delete(key);}
 }
 function companyStats(id){return cache.companyStats[id]||{sent:0,chosen:0};}

 /* ---------- messaging (caller-owned polling; no catalog cache or refresh) ---------- */
 const mapMessage=m=>m?{id:m.id,conversationId:m.conversation_id,senderId:m.sender_id,body:m.body,createdAt:m.created_at,readAt:m.read_at}:null;
 const mapConversation=c=>({id:c.id,clientId:c.client_id,companyId:c.company_id,requestId:c.request_id,contextKey:c.context_key,
  createdAt:c.created_at,lastMessageAt:c.last_message_at,clientLastReadAt:c.client_last_read_at,companyLastReadAt:c.company_last_read_at,
  otherId:c.other_id??null,otherName:c.other_name??null,otherCompany:c.other_company??null,
  lastMessage:mapMessage(c.last_message),unreadCount:Number(c.unread_count||0)});
 const startConversation=(companyId,requestId=null)=>rpc('start_conversation',{p_company_id:companyId,p_request_id:requestId}).then(mapConversation);
 const sendMessage=(id,body)=>rpc('send_message',{p_conversation_id:id,p_body:body}).then(mapMessage);
 const listConversations=()=>rpc('list_my_conversations').then(data=>rows(data).map(mapConversation));
 const listMessages=(id,after=null)=>rpc('list_messages',{p_conversation_id:id,p_after:after}).then(data=>rows(data).map(mapMessage));
 const markRead=id=>rpc('mark_read',{p_conversation_id:id}).then(data=>({marked:Number(data.marked),readAt:data.read_at}));
 const unreadMessageCount=()=>rpc('unread_message_count').then(Number);

 /* ---------- business directory, reviews and company plans ---------- */
 const companyBusinessFeatures=()=>rpc('company_business_features');
 const companyReviews=(id,offset=0)=>rpc('company_reviews',{p_company_id:id,p_offset:offset});
 const myCompanyReviewTargets=id=>rpc('my_company_review_targets',{p_company_id:id});
 const saveCompanyReview=(id,rating,body)=>rpc('save_company_review',{p_request_id:id,p_rating:rating,p_body:body});
 const myBusinessSettings=()=>rpc('my_business_settings');
 const setCompanyDistributor=value=>rpc('set_company_distributor',{p_distributor:value});
 const requestCompanyPlan=plan=>rpc('request_company_plan',{p_plan:plan});
 const cancelCompanyPlanRequest=()=>rpc('cancel_company_plan_request');
 const adminBusinessQueue=(kind,offset=0)=>rpc('admin_business_queue',{p_kind:kind,p_offset:offset});
 const adminModerateReview=(id,status,reason)=>rpc('admin_moderate_review',{p_id:id,p_status:status,p_reason:reason});
 const adminResolvePlan=(id,approve,days,note)=>rpc('admin_resolve_plan',{p_id:id,p_approve:approve,p_days:days,p_note:note});

 /* ---------- reports („შეატყობინე“) ---------- */
 const reportContent=(kind,targetId,reason,text)=>rpc('report_content',{p_kind:kind,p_target_id:targetId,p_reason:reason,p_text:String(text||'').trim()});
 const adminListReports=(status,offset=0)=>rpc('admin_list_reports',{p_status:status||null,p_offset:offset});
 // Hiding a target changes public data: refresh the cache like the other moderation actions.
 const adminResolveReport=(id,action,reason)=>mutate('admin_resolve_report',{p_id:id,p_action:action,p_reason:String(reason||'').trim()});

 /* ---------- admin ---------- */
 const adminOverview=()=>rpc('admin_overview');
 const adminSearchRequests=args=>rpc('admin_search_requests',args);
 const adminSearchUsers=args=>rpc('admin_search_users',args);
 const adminSearchOffers=args=>rpc('admin_search_offers',args);
 const adminBusinessAudit=(offset=0,limit=20)=>rpc('admin_business_audit',{p_offset:offset,p_limit:limit});
 const adminListAudit=args=>rpc(Number(stats()?.adminApiVersion)>=2?'admin_list_audit_v2':'admin_list_audit',args);
 const adminContactEvents=args=>rpc('admin_contact_events',args);
 const adminContactStats=args=>rpc('admin_contact_stats',args);
 const adminMessageStats=()=>rpc('admin_message_stats');
 // Contact remains usable during telemetry failures; authentication is shared with db().
 const logContactEvent=(targetKind,targetId,kind,source)=>db('/rpc/log_contact_event',{method:'POST',keepalive:true,body:{
  p_target_kind:targetKind,p_target_id:targetId,p_kind:kind,p_source:source,
 }}).catch(()=>null);

 const adminSetHidden=(requestId,hidden,reason)=>mutate('admin_set_hidden',{p_request_id:requestId,p_hidden:!!hidden,p_reason:hidden&&reason?String(reason).trim():null},mapRequest);
 const adminDeleteOffer=(offerId,reason)=>mutate('admin_delete_offer',{p_offer_id:offerId,p_reason:String(reason||'').trim()});
 const adminDeleteRequest=(requestId,reason)=>reason!==undefined?mutate('admin_delete_request_v2',{p_request_id:requestId,p_reason:String(reason||'').trim()}):mutate('admin_delete_request',{p_request_id:requestId});
 const adminSetBlocked=(userId,blocked,reason)=>mutate('admin_set_blocked',{p_user_id:userId,p_blocked:!!blocked,p_reason:blocked&&reason?String(reason).trim():null});
 const adminSetVerified=(userId,verified)=>mutate('admin_set_verified',{p_user_id:userId,p_verified:!!verified});
 const adminEditProfile=(id,patch)=>mutate('admin_edit_profile',{p_id:id,p_patch:patch},mapUser);
 const adminEditRequest=(id,patch)=>mutate('admin_edit_request',{p_id:id,p_patch:patch},mapRequest);
 const adminCompanySettings=id=>rpc('admin_company_settings',{p_id:id});
 const adminManagePlan=(id,plan,expires)=>mutate('admin_manage_plan',{p_id:id,p_plan:plan,p_expires_at:expires});
 let contentCache=null,contentUntil=0,contentFlight=null;
 const siteContent=()=>{if(contentCache&&Date.now()<contentUntil)return Promise.resolve(contentCache);if(contentFlight)return contentFlight;contentFlight=rpc('site_content').then(data=>{contentCache=data;contentUntil=Date.now()+60000;return data;}).finally(()=>{contentFlight=null;});return contentFlight;};
 const adminSaveSiteContent=async content=>{const result=await rpc('admin_save_site_content',{p_content:content});contentCache=result;contentUntil=0;await refresh();return result;};
 const adminUploadPhoto=(id,file,kind)=>{if(requireUser().role!=='admin')fail(MSG.MA403||'წვდომა შეზღუდულია.','MA403');return uploadPhoto({id},file,{prefix:kind==='logo'?'logo-':kind==='gallery'?'gallery-':'site-',maxBytes:kind==='logo'?2*1024*1024:5*1024*1024});};

 // Photo moderation: clear the reference (audited), then remove the Blob file (best effort).
 const adminRemovePhoto=(userId,url,reason)=>mutate('admin_remove_company_photo',{p_user_id:userId,p_url:url,p_reason:String(reason||'').trim()},mapUser).then(user=>{removePhoto(url);return user;});

 return {categories,cities,units,priceTypes,todayDate,maxNeededBy,stateLabels,EXTEND_DAYS,
  companyProducts:id=>rpc('company_products',{p_company_id:id}),
  setMyProducts:async items=>{const data=await rpc('set_my_products',{p_items:items});await refresh();warnStale(dataStale);return data;},
  adminMarketMetrics:()=>rpc('admin_market_metrics'),
  companyDistributionProfiles:()=>rpc('company_distribution_profiles'),
  setMyDistribution:args=>mutate('set_my_distribution',args),
  companyBusinessFeatures,companyReviews,myCompanyReviewTargets,saveCompanyReview,myBusinessSettings,setCompanyDistributor,requestCompanyPlan,cancelCompanyPlanRequest,adminBusinessQueue,adminModerateReview,adminResolvePlan,
  reportContent,adminListReports,adminResolveReport,
  engagement:()=>engagement.owner===currentUser()?.id?engagement:{status:'idle',savedIds:[],unread:0,notifications:{items:[],nextCursor:null}},
  refreshEngagement,setSavedCompany,markNotificationRead,setNotificationEmail,setRequestAlertPreferences,
  listSavedCompanies:cursor=>rpc('list_saved_companies',{p_cursor:cursor||null}),
  listNotifications:cursor=>rpc('list_notifications',{p_cursor:cursor||null}),
  // Generic entry points for the new flows (deals, comparison, matching, onboarding): callRpc reads,
  // mutateRpc writes and then refreshes the public snapshot. Errors carry MAxxx userMessage texts.
  callRpc:(name,args={})=>rpc(name,args),
  mutateRpc:(name,args={})=>mutate(name,args),
  seedPublic,ready:()=>readyPromise,isReady:()=>isReady,isSessionReady:()=>sessionReady,isAvailable:()=>configured&&!loadFailed,isStale:()=>dataStale||engagementStale,refresh,revalidate,dataRevision:()=>dataRevision,ensureRequest,
  // A signed-in session exists even when its profile has not loaded yet (e.g. a failed first refresh).
  hasSession:()=>!!authUser,
  currentUser,userById,register,verifyEmailCode,resendCode,pendingEmail,pendingProfile,needsProfile,login,logout,
  requestPasswordReset,resetPassword,changePassword,pendingResetEmail,
  requestState,daysLeft,offerCount,listRequests,getRequest,visibleOffers,contactFor,
  createRequest,updateRequest,closeRequest,extendRequest,deleteRequest,sendOffer,withdrawOffer,chooseOffer,myOffers,
  updateProfile,uploadLogo,setGallery,listCompanies,getCompany,ensureCompany,companyStats,directionsUrl,
  startConversation,sendMessage,listConversations,listMessages,markRead,unreadMessageCount,
  adminEditProfile,adminEditRequest,adminCompanySettings,adminManagePlan,siteContent,adminSaveSiteContent,adminUploadPhoto,
  adminOverview,adminSearchRequests,adminSearchUsers,adminSearchOffers,adminDeleteOffer,adminBusinessAudit,adminListAudit,adminContactEvents,adminContactStats,adminMessageStats,logContactEvent,adminSetHidden,adminDeleteRequest,adminRemovePhoto,adminSetBlocked,adminSetVerified,stats,allUsers,
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
}
