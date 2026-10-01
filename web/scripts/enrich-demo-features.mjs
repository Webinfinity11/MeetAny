import fs from 'node:fs';
import path from 'node:path';
import { request } from 'playwright';
import { upload } from '@vercel/blob/client';
import { credentials, auth, origin, root, rpc, db, token, safe, assert } from '../qa/e2e/lib.mjs';

// Only existing demo accounts on auth-probe. No broad SQL writes or resets.
const verifyOnly=process.argv.includes('--verify');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const journal=path.join(root,'../DEMO-FEATURES.local.json');
const state=fs.existsSync(journal)?JSON.parse(fs.readFileSync(journal,'utf8')):{photos:{},requests:{}};
const save=()=>fs.writeFileSync(journal,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const sessions=new Map();
async function session(key){
 if(sessions.has(key))return sessions.get(key);
 const context=await request.newContext();
 let login;
 for(let attempt=0;attempt<8;attempt++){login=await context.post(auth+'/sign-in/email',{data:credentials(key)});if(login.status()!==429)break;console.log('Auth rate limit; retry:',key);await new Promise(resolve=>setTimeout(resolve,20000));}
 assert(login.ok(),`Sign in ${key}: ${login.status()}`);
 const p={request:context};const profile=(await rpc(p,'my_profile'))[0];
 assert.equal(profile.id,ledger.accounts[key].id);
 assert(key==='owner_admin'?profile.role==='admin':profile.email===`demo-${key}@meetany.ge`,'Non-demo account refused');
 const result={p,profile};sessions.set(key,result);return result;
}
const targets=[
 {key:'linen',plan:'vip',photo:'companies/linen.jpg',products:[['სასტუმროს თეთრეულის კომპლექტი','სადემო პროდუქტი · ბამბის ქსოვილი; ზომა და შეფუთვა შეთანხმებით.'],['რესტორნის სუფრა და ხელსახოცები','სადემო პროდუქტი · ქსოვილის ნიმუში და ფერი წინასწარ შეთანხმდება.']]},
 {key:'wood',plan:'vip',photo:'companies/furniture.jpg',products:[['კაფის ხის მაგიდა 70×70','სადემო პროდუქტი · ხის ზედაპირი; დამზადება ზომის მიხედვით.'],['სავაჭრო თარო','სადემო პროდუქტი · კონსტრუქცია და თაროების რაოდენობა შეთანხმებით.']]},
 {key:'supply',plan:'premium',photo:'companies/wholesale.jpg',products:[['HoReCa ინვენტარის ნაკრები','სადემო პროდუქტი · კომპლექტაცია და მიწოდების გრაფიკი შეთანხმებით.'],['შეფუთვის საბითუმო ნაკრები','სადემო პროდუქტი · ყუთები და მასალები ბიზნესისთვის.']]},
 {key:'food',plan:'premium',photo:'companies/produce.jpg',products:[['სეზონური ბოსტნეულის კალათა','სადემო პროდუქტი · შემადგენლობა იცვლება სეზონის მიხედვით.'],['მწვანილის საბითუმო ნაკრები','სადემო პროდუქტი · დაგეგმილი მიწოდება კაფეებისა და მაღაზიებისთვის.']]},
];
const distributions={
 supply:{p_regions:['kutaisi','tbilisi','batumi','zugdidi'],p_categories:['furniture','textiles','packaging'],p_channels:['horeca','retail_small','institutions'],p_brands:['სადემო კოლექცია'],p_warehouse:'own',p_transport:'own',p_cold_chain:false,p_min_order:'სადემო პირობა: 300 ₾',p_exclusive:true},
 food:{p_regions:['tbilisi','rustavi','gori'],p_categories:['food_fresh'],p_channels:['horeca','retail_small'],p_brands:['სადემო სეზონური ხაზი'],p_warehouse:'rented',p_transport:'own',p_cold_chain:true,p_min_order:'სადემო პირობა: 50 კგ',p_exclusive:false},
};
const reviewExamples=[
 {owner:'hotel',company:'linen',key:'linen',existing:true,rating:5,body:'სადემო შეფასება — პრეზენტაციის მაგალითი. ქსოვილის ნიმუშები და მიწოდების პირობები წინასწარ შეთანხმდა; კომუნიკაციისა და შეთავაზების შეფასების ნიმუში.'},
 {owner:'cafe',company:'wood',key:'review-wood',title:'სადემო მაგალითი: კაფის მაგიდის შერჩევა',category:'furniture',city:'tbilisi',rating:5,body:'სადემო შეფასება — პრეზენტაციის მაგალითი. მაგიდის ზომა, მასალა და დამზადების ვადა დეტალურადაა აღწერილი; ეს ჩანაწერი შეფასების ფუნქციის საჩვენებლადაა შექმნილი.'},
 {owner:'shop',company:'supply',key:'review-supply',title:'სადემო მაგალითი: მაღაზიის ინვენტარის შერჩევა',category:'wholesale',city:'kutaisi',rating:4,body:'სადემო შეფასება — პრეზენტაციის მაგალითი. მიწოდების გრაფიკი და მინიმალური შეკვეთა გასაგებადაა მითითებული; ეს არის სადემონსტრაციო გამოცდილება.'},
];
try {
 const admin=await session('owner_admin');
 // Mark every established demo company without changing its identity, region, or services.
 if(!verifyOnly)for(const [key,a]of Object.entries(ledger.accounts).filter(([key,a])=>a.role==='company'||targets.some(t=>t.key===key)||['cleaning','build','web','port','oak','code','ads','stay'].includes(key))){
  if(!key||!a.id||credentials(key).email!==`demo-${key}@meetany.ge`)continue;
  const {p,profile:c}=await session(key);assert.equal(c.role,'company');
  if(!c.about.startsWith('სადემო კომპანია.'))await rpc(p,'update_my_profile',{p_name:c.name,p_company:c.company,p_city:c.city,p_industry:c.industry,p_about:'სადემო კომპანია. პრეზენტაციისთვის შექმნილი ინფორმაცია. '+c.about,p_offers:c.offers,p_seeks:c.seeks,p_service_cities:c.service_cities,p_address:c.address,p_lat:c.lat,p_lng:c.lng});
 }
 for(const target of targets){
  const {p,profile:c}=await session(target.key);
  if(!verifyOnly){
   let photo=state.photos[target.key];
   if(!photo){const jwt=await token(p);const result=await upload(`${c.id}/gallery-demo-${target.key}.jpg`,fs.readFileSync(path.join(root,'public/assets/photos',target.photo)),{access:'public',handleUploadUrl:origin+'/api/blob-upload',contentType:'image/jpeg',headers:{Authorization:'Bearer '+jwt}});photo=state.photos[target.key]=result.url;save();}
   const fresh=(await rpc(p,'my_profile'))[0];assert(fresh.gallery.length<8||fresh.gallery.includes(photo),'Full gallery: refuse overwrite');
   if(!fresh.gallery.includes(photo))await rpc(p,'set_my_gallery',{p_urls:[...fresh.gallery,photo]});
   const products=await rpc(p,'company_products',{p_company_id:c.id});
   if(!products.length)await rpc(p,'set_my_products',{p_items:target.products.map(([name,note])=>({name,note:note.replace('სადემო პროდუქტი ·','სადემო პროდუქტი · ფოტო საილუსტრაციოა;'),photoUrl:photo}))});
   if(products.length&&products.every(item=>item.note.startsWith('სადემო პროდუქტი ·')&&target.products.some(([name])=>name===item.name))&&!products.every(item=>item.note.includes('ფოტო საილუსტრაციოა')))await rpc(p,'set_my_products',{p_items:products.map(item=>({...item,note:item.note.replace('სადემო პროდუქტი ·','სადემო პროდუქტი · ფოტო საილუსტრაციოა;')}))});
   let settings=await rpc(p,'my_business_settings');
   if(!settings.membership||settings.membership.plan!==target.plan){settings=await rpc(p,'request_company_plan',{p_plan:target.plan});await rpc(admin.p,'admin_resolve_plan',{p_id:settings.application.id,p_approve:true,p_days:90,p_note:'სადემო პაკეტი — პრეზენტაციის მაგალითი; თანხა არ გადახდილა.'});}
   if(distributions[target.key])await rpc(p,'set_my_distribution',distributions[target.key]);
  }
  const products=await rpc(p,'company_products',{p_company_id:c.id});assert(products.length>=2,`Products: ${target.key}`);
  const settings=await rpc(p,'my_business_settings');assert.equal(settings.membership?.plan,target.plan);
  if(distributions[target.key]){assert(settings.distributor);assert(settings.distribution.regions.length>=3);}
  console.log('PASS demo company:',target.key,`${products.length} products`,target.plan);
 }
 for(const example of reviewExamples){
  const owner=await session(example.owner),company=await session(example.company);
  let id=example.existing?ledger.v2.requests[example.key]:state.requests[example.key];
  if(!id&&!verifyOnly){const created=await rpc(owner.p,'create_request',{p_title:example.title,p_body:'სადემო მოთხოვნა — შეფასების ფუნქციის პრეზენტაცია. პროდუქტის დეტალები და მიწოდება შეთანხმებით.',p_category:example.category,p_city:example.city});id=state.requests[example.key]=created.id;save();}
  assert(id,'Missing review request');
  let row=(await db(owner.p,`requests?select=*&id=eq.${id}`))[0];assert.equal(row.owner_id,owner.profile.id);
  if(!example.existing)assert.equal(row.title,example.title);
  if(!verifyOnly){
   if(!row.chosen_offer_id){const offer=await rpc(company.p,'send_offer',{p_request_id:id,p_body:'სადემო შეთავაზება — პროდუქტის შერჩევა და მიწოდების პირობების შეთანხმება.',p_price_type:'negotiable',p_delivery_days:5});await rpc(owner.p,'choose_offer',{p_offer_id:offer.id,p_expected_updated_at:offer.updated_at});}
   const reviews=await rpc(company.p,'company_reviews',{p_company_id:company.profile.id,p_offset:0});
   if(!reviews.items.some(r=>r.body===example.body)){const review=await rpc(owner.p,'save_company_review',{p_request_id:id,p_rating:example.rating,p_body:example.body});await rpc(admin.p,'admin_moderate_review',{p_id:review.id,p_status:'published',p_reason:'სადემო შეფასება — პრეზენტაციის მაგალითი.'});}
  }
  const reviews=await rpc(owner.p,'company_reviews',{p_company_id:company.profile.id,p_offset:0});assert(reviews.items.some(r=>r.body===example.body));
  console.log('PASS demo review:',example.company,example.rating+'/5');
 }
 if(!verifyOnly){
  const client=await session('cafe'),id=ledger.v2.requests.tables;
  const r=(await db(client.p,`requests?select=*&id=eq.${id}`))[0];assert.equal(r.owner_id,client.profile.id);assert(!r.chosen_offer_id);
  const terms={wood:[350,'unit',true,20],linen:[180,'total',false,3],supply:[3200,'total',true,5]};
  for(const [key,[price,type,delivery,days]]of Object.entries(terms)){const company=await session(key);const offers=await db(company.p,`offers?select=*&request_id=eq.${id}&company_id=eq.${company.profile.id}`);assert.equal(offers.length,1);const o=offers[0];const body=o.body.startsWith('სადემო შეთავაზება.')?o.body:'სადემო შეთავაზება. '+o.body+' გადახდის სადემო პირობა: 30% წინასწარ, დარჩენილი მიწოდებისას.';await rpc(company.p,'send_offer',{p_request_id:id,p_body:body,p_price:price,p_price_type:type,p_vat_included:true,p_delivery_days:days,p_delivery_included:delivery});}
 }
 const priced=await db((await session('cafe')).p,`offers?select=*&request_id=eq.${ledger.v2.requests.tables}`);
 for(const [key,price,type]of [['wood',350,'unit'],['linen',180,'total'],['supply',3200,'total']]){const offer=priced.find(o=>o.company_id===ledger.accounts[key].id);assert.equal(Number(offer?.price),price);assert.equal(offer?.price_type,type);}
 console.log('PASS demo terms: 3 offers with optional price, VAT and delivery.');
 console.log('PASS: demo features',verifyOnly?'verified':'filled','on auth-probe.');
}catch(error){console.error(safe(error.message));process.exitCode=1;}finally{for(const {p}of sessions.values())await p.request.dispose();}
