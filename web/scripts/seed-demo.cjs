#!/usr/bin/env node
// Run from any directory: node site/web/scripts/seed-demo.cjs [--verify]
// Requires the local API (3000), web/.env.local, and Blob credentials in the API process.
// DEMO_UPLOAD_ORIGIN may point to another running copy of api/blob-upload (e.g. :4032).
// Keep DEMO-ACCOUNTS.local.md: it is the private credential/recovery ledger, never commit it.
// All marketplace writes use authenticated HTTP RPCs; the sole SQL write is the documented
// first-admin promotion. No schema changes, JWT fabrication, or RLS bypass for seed data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md');
const LOCK = FILE + '.lock';
const BASE = process.env.DEMO_API_ORIGIN || 'http://localhost:3000';
const UPLOAD = process.env.DEMO_UPLOAD_ORIGIN || BASE;
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
  {key:'hotel', role:'client', name:'ნინო ზღვისპირელი', company:'სასტუმრო ზღვის ხედი', city:'batumi'},
  {key:'cafe', role:'client', name:'მარიამ გემოვანი', company:'კაფე მზიანი დილა', city:'tbilisi'},
  {key:'shop', role:'client', name:'გიორგი სავაჭრო', company:'მაღაზია იმერული კუთხე', city:'kutaisi'},
  {key:'wood', role:'company', name:'დავით სახელოსნო', company:'ხის ხაზი', city:'tbilisi', industry:'furniture', about:'ვამზადებთ ხის ავეჯს კაფეების, სასტუმროებისა და მაღაზიებისთვის. ვეხმარებით ზომების შერჩევაში, ვამზადებთ ესკიზს და ვგეგმავთ მონტაჟს.', offers:['მაგიდებისა და სკამების დამზადება','სავაჭრო თაროები','ავეჯის მიტანა და მონტაჟი'], seeks:['ხის მასალის მომწოდებლები','ავეჯის ფურნიტურა'], cities:['tbilisi','kutaisi','batumi']},
  {key:'linen', role:'company', name:'თამარ ქსოვილი', company:'რბილი სივრცე', city:'batumi', industry:'textiles', about:'ვკერავთ სასტუმროს თეთრეულს, ფარდებსა და სუფრებს. შეკვეთამდე ვამზადებთ ქსოვილის ნიმუშებს; ზომები და შეფუთვა დამკვეთის საჭიროებას ერგება.', offers:['სასტუმროს თეთრეული','ფარდების შეკერვა','კაფის სუფრები და ხელსახოცები'], seeks:['ბამბის ქსოვილის მომწოდებლები','სასტუმროებთან თანამშრომლობა'], cities:['batumi','kutaisi','tbilisi']},
  {key:'supply', role:'company', name:'ლევან მომარაგება', company:'რეგიონის მომარაგება', city:'kutaisi', industry:'logistics', about:'ვგეგმავთ რეგიონულ გადაზიდვებს და ვაწვდით ბიზნესებს მუყაოს შეფუთვას. წინასწარ ვათანხმებთ აღების დროს, მარშრუტს და ტვირთის მოცულობას.', offers:['ტვირთის რეგიონული გადაზიდვა','მუყაოს ყუთები','შეკვეთების განაწილება'], seeks:['ადგილობრივი მწარმოებლები','შეფუთვის მომწოდებლები'], cities:['kutaisi','tbilisi','batumi','zugdidi']},
  {key:'admin', role:'admin', name:'ალექსანდრე მაისურაძე', company:'MeetAny', city:'tbilisi'},
].map((a,i)=>({...a,email:`demo-${a.key}@meetany.ge`,phone:`+995 555 900 ${101+i}`}));
// Three clients, at most four open requests each. First request is chosen after offers are sent.
const requests = [
  ['hotel','linen','სასტუმროსთვის 60 კომპლექტი თეთრეული','გვჭირდება თეთრი ბამბის თეთრეული 30 ნომრისთვის, ორ-ორი კომპლექტი. გთხოვთ მიუთითოთ ქსოვილის სიმკვრივე, რეცხვის პირობები და ბათუმში მიწოდების ვადა.','textiles','batumi','hotel-linen.jpg',60,'pcs'],
  ['hotel','chairs','სასტუმროს ტერასისთვის 24 ხის სკამი','ვეძებთ გამძლე ხის სკამებს გადახურული ტერასისთვის. სასურველია ბუნებრივი ფერი და დამცავი საფარი. ფასში ცალკე მიუთითეთ ბათუმში მიტანა და აწყობა.','furniture','batumi','gallery/office-1.jpg',24,'pcs'],
  ['hotel','cleaning','სასტუმროს საერთო სივრცის გენერალური დასუფთავება','საჭიროა 450 კვ.მ საერთო სივრცის, ფანჯრებისა და დერეფნების დასუფთავება სტუმრების მიღებამდე. ინვენტარი და საწმენდი საშუალებები შემსრულებელმა უნდა მოიტანოს.','cleaning','batumi','commercial-cleaning.jpg',450,'m2'],
  ['hotel','curtains','სასტუმროს 12 ნომრისთვის დამაბნელებელი ფარდები','გვჭირდება ღია ნაცრისფერი დამაბნელებელი ფარდები, ადგილზე აზომვითა და მონტაჟით. თითოეული ფანჯარა დაახლოებით 2.4 მეტრის სიგანისაა. საბოლოო ზომები შეთანხმდება.','textiles','batumi',null,12,'pcs'],
  ['cafe','tables','კაფისთვის 10 კომპაქტური ხის მაგიდა','გვჭირდება 70×70 სმ მაგიდები მცირე კაფისთვის. ზედაპირი ადვილად უნდა იწმინდებოდეს. გთხოვთ გამოგვიგზავნოთ მასალის აღწერა, ნიმუშის ფოტო და დამზადების ვადა.','furniture','tbilisi',null,10,'pcs'],
  ['cafe','produce','კაფისთვის სეზონური ბოსტნეულის რეგულარული მიწოდება','ვეძებთ მომწოდებელს კვირაში სამჯერ მიწოდებისთვის: პომიდორი, კიტრი, სალათის ფოთოლი და მწვანილი. საწყისი პარტია დაახლოებით 80 კგ. საჭიროა ანგარიშფაქტურა.','food','tbilisi','fresh-produce.jpg',80,'kg'],
  ['cafe','boxes','კაფისთვის 1000 მუყაოს წასაღები ყუთი','გვჭირდება საკვებთან თავსებადი მუყაოს ყუთები სენდვიჩებისა და დესერტებისთვის. ლოგოს ბეჭდვის ფასი მიუთითეთ ცალკე. შეკვეთამდე გვინდა ნიმუშების ნახვა.','packaging','tbilisi','cardboard-packaging.jpg',1000,'pcs'],
  ['cafe','website','კაფის მენიუსა და შეკვეთების მარტივი ვებგვერდი','საჭიროა ქართულენოვანი მობილურზე მორგებული მენიუ, პროდუქტების მართვა და შეკვეთის ფორმა. ფოტოებსა და ტექსტებს მოგაწვდით. შემოგვთავაზეთ სამუშაოების გეგმა.','technology','tbilisi','technology-office.jpg',1,'service'],
  ['shop','shelves','მაღაზიისთვის 8 კედლის სავაჭრო თარო','გვჭირდება ხის და ლითონის კომბინირებული თაროები სასურსათო მაღაზიისთვის. თითოეული სექცია 90 სმ სიგანისა და 180 სმ სიმაღლის. აუცილებელია ქუთაისში მონტაჟი.','furniture','kutaisi',null,8,'pcs'],
  ['shop','delivery','საქონლის გადაზიდვა თბილისიდან ქუთაისში','საჭიროა 12 პალეტის შეფუთული არასაკვები საქონლის გადაზიდვა დახურული მანქანით. დატვირთვისა და ჩამოტვირთვის საათები წინასწარ შეთანხმდება. გთხოვთ მიუთითოთ სრული ფასი.','logistics','kutaisi','logistics-warehouse.jpg',1,'service'],
  ['shop','renovation','მაღაზიის 120 კვ.მ კედლების შეღებვა','გვჭირდება კედლების მცირე შეკეთება და ორი ფენა თეთრი საღებავი. სამუშაო უნდა შესრულდეს ეტაპობრივად, მაღაზიის სამუშაო საათების გათვალისწინებით. მასალა ცალკე შეაფასეთ.','construction','kutaisi','construction-interior.jpg',120,'m2'],
].map(([owner,key,title,body,category,city,photo,quantity,unit])=>({owner,key,title,body,category,city,photo,quantity,unit}));
const offers = [
  ['linen','linen',4200,12,'გთავაზობთ 60 კომპლექტ ბამბის თეთრეულს, ნიმუშის წინასწარი შეთანხმებით. ფასში შედის ბათუმში მიწოდება.'],
  ['wood','chairs',3840,18,'დავამზადებთ 24 სკამს დამცავი საფარით. ფასში შედის მიტანა და აწყობა ბათუმში.'],
  ['linen','curtains',3600,14,'ადგილზე ავიღებთ ზომებს და შევკერავთ დამაბნელებელ ფარდებს. მონტაჟი და ქსოვილის ნიმუშები შედის ფასში.'],
  ['wood','tables',2900,16,'გთავაზობთ ათ ხის მაგიდას ადვილად მოსავლელი ზედაპირით. საბოლოო ფერს ნიმუშის მიხედვით შევათანხმებთ.'],
  ['supply','boxes',680,7,'მოგაწვდით 1000 მუყაოს ყუთს, ლოგოს გარეშე. ნიმუშებს შეკვეთამდე გაჩვენებთ; თბილისში მიტანა შედის ფასში.'],
  ['wood','shelves',4400,21,'რვა სექციის დამზადება და ქუთაისში მონტაჟი. მასალა და ფურნიტურა სრულად შედის შეთავაზებაში.'],
  ['supply','delivery',950,3,'გამოვყოფთ დახურულ სატვირთოს 12 პალეტისთვის. ფასი მოიცავს თბილისიდან ქუთაისში ერთ რეისს.'],
].map(([company,request,price,days,body])=>({company,request,price,days,body}));
let state;
function save() {
  const rows = accounts.map(a=>`| ${a.company} | ${a.email} | ${state.accounts[a.key].password} | ${a.role} |`).join('\n');
  const text = '# MeetAny — სატესტო ანგარიშები\n\nმხოლოდ ადგილობრივი გამოყენებისთვის; არ ატვირთოთ git-ში და არ გააზიაროთ საჯაროდ.\nპროექტი: fancy-surf-61327851; branch: auth-probe.\nყველა ბიზნესი, სახელი და ნომერი სადემონსტრაციოა.\n\n| ბიზნესი | ელფოსტა | პაროლი | როლი |\n|---|---|---|---|\n'+rows+'\n\nგაშვება: `node scripts/seed-demo.cjs`; შემოწმება: `node scripts/seed-demo.cjs --verify`.\nქვემოთ მოცემული ჩანაწერი საჭიროა განმეორებითი გაშვებისა და შეწყვეტილი სამუშაოს აღსადგენად.\n\n```json\n'+JSON.stringify(state,null,2)+'\n```\n';
  fs.writeFileSync(FILE, text, {mode:0o600});
  fs.chmodSync(FILE,0o600);
}
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
  async function auth(route, body) {
    const out = await json(AUTH+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined});
    for (const c of out.res.headers.getSetCookie()) {const pair=c.split(';')[0]; const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
    return out;
  }
  const input={email:a.email,password:state.accounts[a.key].password};
  try {await auth('/sign-in/email',input);}
  catch(err) {
    if (VERIFY || err.code!=='INVALID_EMAIL_OR_PASSWORD' || state.accounts[a.key].id) throw err;
    await auth('/sign-up/email',{...input,name:a.name}); // Verification is off: sign-up creates the session.
  }
  const {data} = await auth('/token');
  assert(data?.token, 'Auth did not issue a JWT');
  a.jwt=data.token;
  a.id=JSON.parse(Buffer.from(a.jwt.split('.')[1],'base64url')).sub;
  if(state.accounts[a.key].id) assert.equal(a.id,state.accounts[a.key].id);
  state.accounts[a.key].id=a.id;
  if(!VERIFY) save();
}
async function api(a, route, body) {
  return (await json(BASE+'/api/db/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(a?{Authorization:'Bearer '+a.jwt}:{})},body:body?JSON.stringify(body):undefined})).data;
}
const rpc=(a,name,args={})=>api(a,'rpc/'+name,args);
const byKey=key=>accounts.find(a=>a.key===key);
async function seed() {
  for(const a of accounts) {
    await login(a);
    const p=await rpc(a,'complete_profile',{p_role:a.role==='admin'?'client':a.role,p_name:a.name,p_company:a.company,p_phone:a.phone,p_city:a.city,p_industry:a.industry||null});
    assert.equal(p.id,a.id);
    if(a.role==='company') await rpc(a,'update_my_profile',{p_name:a.name,p_company:a.company,p_city:a.city,p_industry:a.industry,p_about:a.about,p_offers:a.offers,p_seeks:a.seeks,p_service_cities:a.cities});
    console.log('ანგარიში მზადაა:',a.email);
  }
  const admin=byKey('admin');
  if((await rpc(admin,'my_profile'))[0].role!=='admin') {
    const {neon}=require('@neondatabase/serverless');
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql`update public.profiles set role='admin' where id=${admin.id}::uuid and email=${admin.email} and role='client' returning id`;
    assert.equal(rows.length,1,'Admin promotion failed');
  }
  for(const key of ['wood','linen']) await rpc(admin,'admin_set_verified',{p_user_id:byKey(key).id,p_verified:true});
  const {upload}=require('@vercel/blob/client');
  for(const r of requests) {
    const a=byKey(r.owner);
    const existing=(await api(a,`requests?select=*&owner_id=eq.${a.id}`)).filter(x=>x.title===r.title);
    assert(existing.length<=1,'Duplicate request title in seed owner');
    if(existing.length) {state.requests[r.key]={...state.requests[r.key],id:existing[0].id};save();continue;}
    const record=state.requests[r.key]||={};
    if(r.photo && !record.photo) {
      const file=fs.readFileSync(path.join(ROOT,'public/assets/photos',r.photo));
      const blob=await upload(`${a.id}/demo-${r.key}.jpg`,file,{access:'public',handleUploadUrl:UPLOAD+'/api/blob-upload',contentType:'image/jpeg',headers:{Authorization:'Bearer '+a.jwt}});
      record.photo=blob.url;save(); // Persist before creating the request; retry reuses the uploaded photo.
    }
    const created=await rpc(a,'create_request',{p_title:r.title,p_body:r.body,p_category:r.category,p_city:r.city,p_photo_url:record.photo||null,p_quantity:r.quantity,p_unit:r.unit});
    record.id=created.id;save();
    console.log('მოთხოვნა მზადაა:',r.key);
  }
  for(const o of offers) {
    const a=byKey(o.company),id=state.requests[o.request].id;
    if((await api(a,`offers?select=*&request_id=eq.${id}&company_id=eq.${a.id}`)).length) continue;
    await rpc(a,'send_offer',{p_request_id:id,p_body:o.body,p_price:null,p_price_type:'negotiable',p_vat_included:false,p_delivery_days:o.days,p_delivery_included:false});
  }
  const chosen=(await api(byKey('hotel'),`requests?select=*&id=eq.${state.requests.linen.id}`))[0];
  if(!chosen.chosen_offer_id) {
    const o=(await api(byKey('hotel'),`offers?select=*&request_id=eq.${chosen.id}`))[0];
    await rpc(byKey('hotel'),'choose_offer',{p_offer_id:o.id,p_expected_updated_at:o.updated_at});
  }
}
async function verify() {
  for(const a of accounts) {
    if(!a.jwt) await login(a);
    const p=(await rpc(a,'my_profile'))[0];assert.equal(p.id,a.id);assert.equal(p.role,a.role);
  }
  const all=await api(null,'requests?select=*');
  const own=all.filter(r=>Object.values(state.requests).some(s=>s.id===r.id));
  assert.equal(own.length,requests.length);
  const open=own.filter(r=>!r.hidden&&!r.chosen_offer_id&&r.status==='open'&&new Date(r.expires_at)>new Date());
  assert.equal(open.length,10,'Expected ten open demo requests');
  assert.equal(own.filter(r=>r.chosen_offer_id).length,1);
  for(const a of accounts.filter(a=>a.role==='client')) {
    assert(open.filter(r=>r.owner_id===a.id).length<=4);
    const visible=await api(a,'offers?select=*');
    assert(visible.length>0);assert(visible.every(o=>own.some(r=>r.id===o.request_id&&r.owner_id===a.id)));
  }
  for(const a of accounts.filter(a=>a.role==='company')) {
    const visible=await api(a,'offers?select=*');assert(visible.length>0);assert(visible.every(o=>o.company_id===a.id));
    const p=(await rpc(a,'my_profile'))[0];assert(p.about&&p.offers.length&&p.seeks.length&&p.service_cities.length);
  }
  const profiles=await api(null,'profiles?select=id,role,verified');
  assert.equal(profiles.filter(p=>['wood','linen'].some(k=>byKey(k).id===p.id)&&p.verified).length,2);
  const stats=await rpc(byKey('admin'),'admin_stats');assert(stats.offers>=offers.length);
  for(const r of own.filter(r=>r.photo_url)) {
    assert(new URL(r.photo_url).pathname.startsWith('/'+r.owner_id+'/'));
    const res=await fetch(r.photo_url,{method:'HEAD',signal:AbortSignal.timeout(20000)});
    assert(res.ok);assert.match(res.headers.get('content-type'),/^image\//);
  }
  for(const key of ['hotel','linen']) assert.equal((await rpc(byKey(key),'contact_for_request',{p_request_id:state.requests.linen.id})).length,1);
  console.log(JSON.stringify({accounts:accounts.length,open:open.length,chosen:1,photos:own.filter(r=>r.photo_url).length,offers:offers.length,verifiedCompanies:2,checks:'passed'}));
}
async function main() {
  const fd=fs.openSync(LOCK,'wx',0o600);fs.closeSync(fd);
  try {
    if(fs.existsSync(FILE)) state=JSON.parse(fs.readFileSync(FILE,'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
    else {assert(!VERIFY,'Run seed first');state={version:1,accounts:Object.fromEntries(accounts.map(a=>[a.key,{password:crypto.randomBytes(24).toString('base64url')+'!a9'}])),requests:{}};save();}
    if(!VERIFY) await seed();
    await verify();
  } finally {fs.unlinkSync(LOCK);}
}
if(require.main===module) main().catch(err=>{console.error('მონაცემების ოპერაცია შეჩერდა:',err.message);process.exitCode=1;});
