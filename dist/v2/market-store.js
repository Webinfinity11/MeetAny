/* MeetAny beta marketplace data layer.
   All reads and writes go through window.MarketStore, so a real backend (e.g. Supabase)
   can replace this file later without touching the pages. Beta data lives in this
   browser's localStorage and is seeded with fictional demo records. */
(function(){
 const DATA_KEY='meetany-beta-v1',SESSION_KEY='meetany-beta-session';
 const DAY=86400000,REQUEST_DAYS=14,EXTEND_DAYS=7,MAX_OPEN_REQUESTS=5;

 const categories={furniture:'ავეჯი და ინვენტარი',construction:'მშენებლობა და რემონტი',textiles:'ტექსტილი და სასტუმროები',food:'საკვები და სასმელი',packaging:'შეფუთვა და წარმოება',logistics:'ლოგისტიკა და დისტრიბუცია',cleaning:'დასუფთავება და მოვლა',technology:'IT და ტექნოლოგიები',marketing:'მარკეტინგი და დიზაინი',finance:'ბუღალტერია და ფინანსები',legal:'იურიდიული მომსახურება',tourism:'ტურიზმი',other:'სხვა'};
 const cities={tbilisi:'თბილისი',batumi:'ბათუმი',kutaisi:'ქუთაისი',rustavi:'რუსთავი',zugdidi:'ზუგდიდი',telavi:'თელავი',gori:'გორი',georgia:'მთელი საქართველო'};

 // Seed dates are offsets from "now", so the demo always looks fresh.
 const seedUsers=[
  {id:'u-admin',role:'admin',name:'MeetAny ადმინი',company:'MeetAny',email:'admin@demo.meetany.ge',phone:'+995 555 000 000',city:'tbilisi',verified:true,ago:40},
  {id:'u-nino',role:'client',name:'ნინო ბერიძე',company:'სასტუმრო „მთის ხედი“',email:'nino@demo.meetany.ge',phone:'+995 555 120 450',city:'tbilisi',ago:30},
  {id:'u-giorgi',role:'client',name:'გიორგი მელაძე',company:'კაფე „ბაღი“',email:'giorgi@demo.meetany.ge',phone:'+995 577 310 220',city:'kutaisi',ago:25},
  {id:'u-tamar',role:'client',name:'თამარ ლომიძე',company:'დეველოპერი „ახალი უბანი“',email:'tamar@demo.meetany.ge',phone:'+995 599 440 118',city:'batumi',ago:20},
  {id:'u-wood',role:'company',name:'ლევან ხუციშვილი',company:'ხის ოსტატი',email:'sales@khisostati.demo.meetany.ge',phone:'+995 555 781 900',city:'tbilisi',industry:'furniture',verified:true,ago:35},
  {id:'u-officeline',role:'company',name:'ანა გელაშვილი',company:'Office Line',email:'hello@officeline.demo.meetany.ge',phone:'+995 568 220 017',city:'rustavi',industry:'furniture',ago:12},
  {id:'u-axis',role:'company',name:'დავით ჩხეიძე',company:'Axis Build',email:'team@axisbuild.demo.meetany.ge',phone:'+995 599 100 245',city:'tbilisi',industry:'construction',verified:true,profile:'axis-build',ago:33},
  {id:'u-beton',role:'company',name:'ირაკლი ბოლქვაძე',company:'ბეტონ-ცენტრი',email:'order@betoncentri.demo.meetany.ge',phone:'+995 577 902 330',city:'batumi',industry:'construction',ago:9},
  {id:'u-linen',role:'company',name:'მარიამ კობახიძე',company:'Linen House',email:'b2b@linenhouse.demo.meetany.ge',phone:'+995 555 640 112',city:'tbilisi',industry:'textiles',verified:true,profile:'linen-house',ago:31},
  {id:'u-fresh',role:'company',name:'ნიკა ჯაფარიძე',company:'Fresh Market',email:'horeca@freshmarket.demo.meetany.ge',phone:'+995 591 200 330',city:'tbilisi',industry:'food',profile:'fresh-market',ago:28},
  {id:'u-pack',role:'company',name:'სოფო ნიჟარაძე',company:'Pack & Co',email:'sales@packco.demo.meetany.ge',phone:'+995 558 115 660',city:'kutaisi',industry:'packaging',verified:true,profile:'pack-and-co',ago:27},
  {id:'u-route',role:'company',name:'ზურა ტყეშელაშვილი',company:'Route Logistics',email:'cargo@route.demo.meetany.ge',phone:'+995 593 870 441',city:'batumi',industry:'logistics',verified:true,profile:'route-logistics',ago:26},
  {id:'u-pixel',role:'company',name:'ელენე წიკლაური',company:'Pixel Works',email:'projects@pixel.demo.meetany.ge',phone:'+995 571 330 908',city:'tbilisi',industry:'technology',profile:'pixel-works',ago:22},
  {id:'u-clean',role:'company',name:'ქეთი მამულაშვილი',company:'Clear Space',email:'office@clearspace.demo.meetany.ge',phone:'+995 598 404 772',city:'tbilisi',industry:'cleaning',profile:'clear-space',ago:18}
 ];
 const seedRequests=[
  {id:'r-chairs',slug:'1000-chairs',ownerId:'u-nino',title:'მჭირდება 1000 სკამი საბანკეტო დარბაზისთვის',body:'ვხსნით ახალ საბანკეტო დარბაზს. გვჭირდება 1000 დასაწყობი (stackable) სკამი, რბილი დასაჯდომით, ნეიტრალურ ფერში. მიწოდება თბილისში, სასურველია ერთ თვეში. ვიხილავთ როგორც ახალს, ისე შეკვეთით დამზადებულს.',category:'furniture',city:'tbilisi',photo:'/assets/photos/meeting.jpg',ago:3},
  {id:'r-concrete',slug:'concrete-m300',ownerId:'u-tamar',title:'50 მ³ ბეტონი M300 ფუნდამენტისთვის',body:'ბათუმში, საცხოვრებელი კორპუსის ფუნდამენტისთვის გვჭირდება დაახლოებით 50 მ³ M300 მარკის ბეტონი, ტუმბოთი მიწოდებით. ჩასხმა იგეგმება ორ ეტაპად, შემდეგი კვირიდან.',category:'construction',city:'batumi',photo:'/assets/photos/construction-interior.jpg',ago:1},
  {id:'r-linen',slug:'hotel-linen-200',ownerId:'u-nino',title:'200 კომპლექტი სასტუმროს თეთრეული',body:'სეზონისთვის გვჭირდება 200 კომპლექტი თეთრი საწოლის თეთრეული (ორადგილიანი) და 400 პირსახოცი. საჭიროა ნიმუშის ნახვა შეკვეთამდე.',category:'textiles',city:'batumi',photo:'/assets/photos/hotel-linen.jpg',ago:6},
  {id:'r-produce',slug:'weekly-produce',ownerId:'u-giorgi',title:'ყოველკვირეული ხილი და ბოსტნეული კაფესთვის',body:'ქუთაისში, კაფესთვის ვეძებთ მომწოდებელს: კვირაში ორჯერ, დაახლოებით 80 კგ სეზონური ხილი და ბოსტნეული. მნიშვნელოვანია სტაბილური ხარისხი და დილის მიწოდება.',category:'food',city:'kutaisi',photo:'/assets/photos/fresh-produce.jpg',ago:2},
  {id:'r-boxes',slug:'branded-boxes',ownerId:'u-giorgi',title:'ბრენდირებული ყუთები — 5 000 ცალი',body:'საკონდიტრო პროდუქციისთვის გვჭირდება 5 000 ბრენდირებული მუყაოს ყუთი ორ ზომაში, ერთფეროვანი ბეჭდვით. დიზაინი მზად გვაქვს.',category:'packaging',city:'kutaisi',photo:'/assets/photos/cardboard-packaging.jpg',ago:10},
  {id:'r-cleaning',slug:'post-renovation-cleaning',ownerId:'u-tamar',title:'ოფისის დასუფთავება რემონტის შემდეგ, 400 მ²',body:'თბილისში, ახლად გარემონტებული ოფისის (400 მ²) სრული დასუფთავება, მათ შორის ფანჯრები. სამუშაო უნდა შესრულდეს შაბათ-კვირას.',category:'cleaning',city:'tbilisi',photo:'/assets/photos/commercial-cleaning.jpg',ago:0},
  {id:'r-website',slug:'hotel-booking-website',ownerId:'u-nino',title:'ვებსაიტი სასტუმროსთვის ონლაინ ჯავშნით',body:'გვჭირდება სამენოვანი ვებსაიტი (ქართული, ინგლისური, რუსული) ონლაინ ჯავშნისა და გადახდის სისტემით. გვაქვს ფოტოები და ტექსტები.',category:'technology',city:'batumi',photo:'/assets/photos/technology-office.jpg',ago:4},
  {id:'r-transport',slug:'tbilisi-batumi-cargo',ownerId:'u-tamar',title:'ტვირთის გადაზიდვა თბილისი–ბათუმი, თვეში 4 რეისი',body:'სამშენებლო მასალის რეგულარული გადაზიდვა თბილისიდან ბათუმში, თვეში დაახლოებით 4 რეისი, 20-ტონიანი მანქანით.',category:'logistics',city:'tbilisi',photo:'/assets/photos/logistics-warehouse.jpg',ago:18}
 ];
 const seedOffers=[
  {requestId:'r-chairs',companyUserId:'u-wood',body:'დაგიმზადებთ 1000 დასაწყობ სკამს მუხის ჩარჩოთი და რბილი ქსოვილის დასაჯდომით (ფერის 6 ვარიანტი). ნიმუშს 3 დღეში მოგაწვდით. მიწოდება და ადგილზე ჩამოტვირთვა თბილისში უფასოა. გარანტია 2 წელი.',price:48,ago:2},
  {requestId:'r-chairs',companyUserId:'u-officeline',body:'გვაქვს მზა საბანკეტო სკამები საწყობში (ლითონის ჩარჩო, რბილი დასაჯდომი), 1000 ცალის მიწოდება შეგვიძლია 10 დღეში. ფასი მიწოდების ჩათვლით.',price:39,ago:1},
  {requestId:'r-chairs',companyUserId:'u-axis',body:'შეგვიძლია შევუკვეთოთ ევროპელ მწარმოებელს და დარბაზის მოწყობაც ერთად გავაკეთოთ. ზუსტ ფასს დარბაზის ნახვის შემდეგ დაგისახელებთ.',price:null,ago:1},
  {requestId:'r-concrete',companyUserId:'u-beton',body:'M300 ბეტონი ტუმბოთი, ორ ეტაპად ჩასხმა. მიწოდება ბათუმში 24 საათში შეკვეთიდან. ფასი 1 მ³-ზე, ტუმბოს მომსახურების ჩათვლით.',price:215,ago:0},
  {requestId:'r-concrete',companyUserId:'u-axis',body:'გთავაზობთ ბეტონის მიწოდებას ჩვენი ლაბორატორიული შემოწმებით და ჩასხმის ზედამხედველობით. ფასი 1 მ³-ზე.',price:238,ago:0},
  {requestId:'r-linen',companyUserId:'u-linen',body:'200 კომპლექტი 100% ბამბის თეთრეული (სატინი) და 400 პირსახოცი. ნიმუშს ბათუმში უფასოდ ჩამოგიტანთ. მიწოდება 12 დღეში.',price:9800,ago:5,status:'chosen'},
  {requestId:'r-linen',companyUserId:'u-clean',body:'სასტუმროს ტექსტილის რეცხვისა და მოვლის სერვისიც შეგვიძლია შემოგთავაზოთ, მიწოდებასთან ერთად პარტნიორის მეშვეობით.',price:null,ago:4},
  {requestId:'r-produce',companyUserId:'u-fresh',body:'კვირაში ორჯერ, დილის 8 საათამდე მიწოდება ქუთაისში. ყოველ ორშაბათს მოგაწვდით სეზონურ ფასების სიას. ფასი კვირის სავარაუდო მოცულობაზე.',price:620,ago:1},
  {requestId:'r-boxes',companyUserId:'u-pack',body:'5 000 ყუთი ორ ზომაში, ერთფეროვანი ბეჭდვა. საცდელი ნიმუში 4 დღეში, სრული შეკვეთა 3 კვირაში. ფასი ერთ ყუთზე.',price:1.35,ago:8},
  {requestId:'r-website',companyUserId:'u-pixel',body:'სამენოვანი საიტი ჯავშნის მოდულით და ბარათით გადახდით. სამუშაო ვადა 5 კვირა, 3 თვის უფასო მხარდაჭერა.',price:4500,ago:3},
  {requestId:'r-transport',companyUserId:'u-route',body:'თვეში 4 რეისი 20-ტონიანი მანქანით, დაზღვევით. ფასი ერთ რეისზე.',price:900,ago:16}
 ];

 function seed(){
  const now=Date.now(),at=days=>new Date(now-days*DAY-Math.round(days*3.7)*3600000).toISOString();
  const users=seedUsers.map(({ago,...u})=>({verified:false,blocked:false,...u,createdAt:at(ago)}));
  const requests=seedRequests.map(({ago,...r})=>{const created=now-ago*DAY-ago*3600000;return{...r,status:'open',hidden:false,chosenOfferId:null,createdAt:new Date(created).toISOString(),expiresAt:new Date(created+REQUEST_DAYS*DAY).toISOString()};});
  const offers=seedOffers.map(({ago,...o},i)=>({id:'o-seed-'+(i+1),status:'sent',...o,createdAt:at(ago)}));
  for(const o of offers)if(o.status==='chosen')requests.find(r=>r.id===o.requestId).chosenOfferId=o.id;
  return {version:1,users,requests,offers};
 }

 let memory=null;
 function load(){
  if(memory)return memory;
  try{const raw=localStorage.getItem(DATA_KEY);if(raw){const data=JSON.parse(raw);if(data&&data.version===1)return memory=data;}}catch{}
  memory=seed();save();return memory;
 }
 function save(){try{localStorage.setItem(DATA_KEY,JSON.stringify(memory));}catch{}emit();}
 const listeners=new Set();
 function emit(){listeners.forEach(fn=>{try{fn();}catch{}});}
 window.addEventListener('storage',e=>{if(e.key===DATA_KEY||e.key===SESSION_KEY){memory=null;emit();}});

 let sessionMemory=null;
 function sessionId(){try{return localStorage.getItem(SESSION_KEY);}catch{return sessionMemory;}}
 function setSession(id){sessionMemory=id;try{id?localStorage.setItem(SESSION_KEY,id):localStorage.removeItem(SESSION_KEY);}catch{}emit();}

 const uid=prefix=>prefix+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const fail=message=>{const e=new Error(message);e.userMessage=message;throw e;};
 const clean=(value,max)=>String(value??'').trim().slice(0,max);

 function normalizePhone(value){
  const digits=String(value||'').replace(/[^\d]/g,'');
  const local=digits.startsWith('995')?digits.slice(3):digits.startsWith('0')?digits.slice(1):digits;
  if(!/^5\d{8}$/.test(local))return null;
  return '+995 '+local.slice(0,3)+' '+local.slice(3,6)+' '+local.slice(6);
 }
 async function hashPassword(password){
  try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('meetany-beta:'+password));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  catch{return 'plain:'+password.length;}
 }

 function currentUser(){const id=sessionId();return id?load().users.find(u=>u.id===id)||null:null;}
 function userById(id){return load().users.find(u=>u.id===id)||null;}

 async function register(input){
  const data=load();
  const role=input.role==='company'?'company':'client';
  const name=clean(input.name,80),company=clean(input.company,100),email=clean(input.email,120).toLowerCase();
  const phone=normalizePhone(input.phone),password=String(input.password||'');
  if(name.length<2)fail('მიუთითე სახელი და გვარი.');
  if(role==='company'&&company.length<2)fail('მიუთითე კომპანიის დასახელება.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('მიუთითე სწორი ელფოსტა.');
  if(!phone)fail('მიუთითე მობილურის ნომერი ფორმატით: +995 5XX XXX XXX.');
  if(password.length<6)fail('პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან.');
  if(!input.acceptTerms)fail('რეგისტრაციისთვის საჭიროა წესებზე თანხმობა.');
  if(!Object.hasOwn(cities,input.city))fail('აირჩიე ქალაქი.');
  if(role==='company'&&!Object.hasOwn(categories,input.industry))fail('აირჩიე საქმიანობის მიმართულება.');
  if(data.users.some(u=>u.email===email))fail('ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ანგარიშში.');
  if(data.users.some(u=>u.phone===phone))fail('ეს ტელეფონის ნომერი უკვე გამოყენებულია.');
  const user={id:uid('u'),role,name,company:company||name,email,phone,city:input.city,industry:role==='company'?input.industry:undefined,verified:false,blocked:false,passwordHash:await hashPassword(password),createdAt:new Date().toISOString()};
  data.users.push(user);save();setSession(user.id);return user;
 }
 async function login(email,password){
  const user=load().users.find(u=>u.email===clean(email,120).toLowerCase());
  if(!user)fail('ამ ელფოსტით ანგარიში ვერ მოიძებნა.');
  if(user.passwordHash&&user.passwordHash!==await hashPassword(String(password||'')))fail('პაროლი არასწორია.');
  if(user.blocked)fail('ანგარიში დაბლოკილია. დაუკავშირდი MeetAny-ს გუნდს.');
  setSession(user.id);return user;
 }
 function loginAsDemo(id){const user=userById(id);if(!user)fail('სადემონსტრაციო ანგარიში ვერ მოიძებნა.');setSession(user.id);return user;}
 function logout(){setSession(null);}
 function demoAccounts(){return load().users.filter(u=>!u.passwordHash);}

 function requestState(r,now=Date.now()){
  if(r.hidden)return 'hidden';
  if(r.chosenOfferId)return 'chosen';
  if(r.status==='closed')return 'closed';
  if(Date.parse(r.expiresAt)<=now)return 'expired';
  return 'open';
 }
 const stateLabels={open:'ღიაა',chosen:'მომწოდებელი არჩეულია',closed:'დახურულია',expired:'ვადაგასულია',hidden:'დამალულია ადმინის მიერ'};
 function daysLeft(r,now=Date.now()){return Math.max(0,Math.ceil((Date.parse(r.expiresAt)-now)/DAY));}
 function offersFor(requestId){return load().offers.filter(o=>o.requestId===requestId);}
 function offerCount(requestId){return offersFor(requestId).length;}

 function listRequests({category='',city='',state='open',q='',ownerId='',includeHidden=false}={}){
  const terms=clean(q,200).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return load().requests.filter(r=>{
   const s=requestState(r);
   if(!includeHidden&&s==='hidden')return false;
   if(ownerId&&r.ownerId!==ownerId)return false;
   if(state==='open'&&s!=='open')return false;
   if(state==='done'&&!['chosen','closed','expired'].includes(s))return false;
   if(category&&!category.split(',').includes(r.category))return false;
   if(city&&!city.split(',').includes(r.city))return false;
   const text=(r.title+' '+r.body+' '+categories[r.category]+' '+cities[r.city]).toLocaleLowerCase();
   return terms.every(t=>text.includes(t));
  }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 }
 function getRequest(idOrSlug){return load().requests.find(r=>r.id===idOrSlug||r.slug===idOrSlug)||null;}

 function canSeeOffer(viewer,offer,request){return !!viewer&&(viewer.role==='admin'||viewer.id===request.ownerId||viewer.id===offer.companyUserId);}
 // Offers are sealed: only the request owner (and each offer's author) sees text and price.
 function visibleOffers(requestId,viewer=currentUser()){
  const request=getRequest(requestId);if(!request)return [];
  return offersFor(request.id).filter(o=>canSeeOffer(viewer,o,request)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 }
 // Contact details open only between the request owner and the chosen company.
 function contactFor(request,viewer=currentUser()){
  if(!viewer||!request.chosenOfferId)return null;
  const chosen=load().offers.find(o=>o.id===request.chosenOfferId);if(!chosen)return null;
  const other=viewer.id===request.ownerId?userById(chosen.companyUserId):viewer.id===chosen.companyUserId?userById(request.ownerId):null;
  return other?{name:other.name,company:other.company,phone:other.phone,email:other.email}:null;
 }

 function requireUser(){const user=currentUser();if(!user)fail('ამისთვის შედი ანგარიშში.');if(user.blocked)fail('ანგარიში დაბლოკილია.');return user;}
 function validateRequest(input){
  const title=clean(input.title,120),body=clean(input.body,2000);
  if(title.length<5)fail('სათაური უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს.');
  if(body.length<10)fail('აღწერე საჭიროება მინიმუმ 10 სიმბოლოთი.');
  if(!Object.hasOwn(categories,input.category))fail('აირჩიე კატეგორია.');
  if(!Object.hasOwn(cities,input.city))fail('აირჩიე ქალაქი.');
  return {title,body,category:input.category,city:input.city};
 }
 function createRequest(input){
  const user=requireUser(),data=load();
  if(listRequests({ownerId:user.id}).length>=MAX_OPEN_REQUESTS)fail('ერთდროულად შეიძლება '+MAX_OPEN_REQUESTS+' ღია განცხადება. დახურე ძველი და სცადე თავიდან.');
  const now=Date.now();
  const request={id:uid('r'),ownerId:user.id,...validateRequest(input),photo:typeof input.photo==='string'&&input.photo.startsWith('data:image/')?input.photo:null,status:'open',hidden:false,chosenOfferId:null,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+REQUEST_DAYS*DAY).toISOString()};
  data.requests.push(request);
  try{save();}catch{}
  return request;
 }
 function ownRequest(id){const user=requireUser(),r=getRequest(id);if(!r)fail('განცხადება ვერ მოიძებნა.');if(r.ownerId!==user.id&&user.role!=='admin')fail('ეს განცხადება შენ არ გეკუთვნის.');return r;}
 function closeRequest(id){const r=ownRequest(id);r.status='closed';save();return r;}
 function extendRequest(id){
  const r=ownRequest(id),s=requestState(r);
  if(!['open','expired','closed'].includes(s))fail('არჩეული ან დამალული განცხადება ვერ გაგრძელდება.');
  r.status='open';r.expiresAt=new Date(Math.max(Date.now(),Date.parse(r.expiresAt))+EXTEND_DAYS*DAY).toISOString();save();return r;
 }
 function deleteRequest(id){const r=ownRequest(id),data=load();data.requests=data.requests.filter(x=>x.id!==r.id);data.offers=data.offers.filter(o=>o.requestId!==r.id);save();}

 function sendOffer(requestId,input){
  const user=requireUser(),data=load(),r=getRequest(requestId);
  if(!r)fail('განცხადება ვერ მოიძებნა.');
  if(user.role!=='company')fail('შეთავაზების გაგზავნა შეუძლია მხოლოდ კომპანიის ანგარიშს.');
  if(r.ownerId===user.id)fail('საკუთარ განცხადებაზე შეთავაზებას ვერ გააგზავნი.');
  if(requestState(r)!=='open')fail('განცხადება აღარ იღებს შეთავაზებებს.');
  const body=clean(input.body,2000);if(body.length<10)fail('აღწერე შეთავაზება მინიმუმ 10 სიმბოლოთი.');
  let price=null;
  if(String(input.price??'').trim()!==''){price=Number(String(input.price).replace(',','.'));if(!Number.isFinite(price)||price<=0||price>1e9)fail('ფასი უნდა იყოს დადებითი რიცხვი.');price=Math.round(price*100)/100;}
  const existing=data.offers.find(o=>o.requestId===r.id&&o.companyUserId===user.id);
  if(existing){Object.assign(existing,{body,price,updatedAt:new Date().toISOString()});save();return existing;}
  const offer={id:uid('o'),requestId:r.id,companyUserId:user.id,body,price,status:'sent',createdAt:new Date().toISOString()};
  data.offers.push(offer);save();return offer;
 }
 function withdrawOffer(offerId){const user=requireUser(),data=load(),o=data.offers.find(x=>x.id===offerId);if(!o||o.companyUserId!==user.id)fail('შეთავაზება ვერ მოიძებნა.');if(o.status==='chosen')fail('არჩეული შეთავაზება ვერ გაუქმდება.');data.offers=data.offers.filter(x=>x.id!==offerId);save();}
 function chooseOffer(offerId){
  const data=load(),o=data.offers.find(x=>x.id===offerId);if(!o)fail('შეთავაზება ვერ მოიძებნა.');
  const r=ownRequest(o.requestId);if(requestState(r)!=='open')fail('ამ განცხადებაზე არჩევა აღარ შეიძლება.');
  for(const x of data.offers)if(x.requestId===r.id)x.status=x.id===o.id?'chosen':'declined';
  r.chosenOfferId=o.id;save();return o;
 }
 function myOffers(user=currentUser()){if(!user)return [];return load().offers.filter(o=>o.companyUserId===user.id).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));}

 function requireAdmin(){const user=requireUser();if(user.role!=='admin')fail('ეს მოქმედება მხოლოდ ადმინისთვისაა.');return user;}
 function adminSetHidden(requestId,hidden){requireAdmin();const r=getRequest(requestId);if(!r)fail('განცხადება ვერ მოიძებნა.');r.hidden=!!hidden;save();}
 function adminDeleteRequest(requestId){requireAdmin();const data=load();data.requests=data.requests.filter(r=>r.id!==requestId);data.offers=data.offers.filter(o=>o.requestId!==requestId);save();}
 function adminSetBlocked(userId,blocked){const admin=requireAdmin();if(userId===admin.id)fail('საკუთარ ანგარიშს ვერ დაბლოკავ.');const u=userById(userId);if(!u)fail('მომხმარებელი ვერ მოიძებნა.');u.blocked=!!blocked;save();}
 function adminSetVerified(userId,verified){requireAdmin();const u=userById(userId);if(!u||u.role!=='company')fail('დადასტურება შეიძლება მხოლოდ კომპანიისთვის.');u.verified=!!verified;save();}
 function stats(){
  const data=load(),reqs=data.requests.filter(r=>!r.hidden);
  return {users:data.users.filter(u=>u.role!=='admin').length,companies:data.users.filter(u=>u.role==='company').length,verified:data.users.filter(u=>u.role==='company'&&u.verified).length,open:reqs.filter(r=>requestState(r)==='open').length,requests:reqs.length,offers:data.offers.length,chosen:reqs.filter(r=>r.chosenOfferId).length};
 }
 function allUsers(){return [...load().users].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));}
 function resetBeta(){memory=seed();save();setSession(null);}

 window.MarketStore={categories,cities,stateLabels,REQUEST_DAYS,EXTEND_DAYS,normalizePhone,currentUser,userById,register,login,loginAsDemo,logout,demoAccounts,requestState,daysLeft,offerCount,listRequests,getRequest,visibleOffers,contactFor,createRequest,closeRequest,extendRequest,deleteRequest,sendOffer,withdrawOffer,chooseOffer,myOffers,adminSetHidden,adminDeleteRequest,adminSetBlocked,adminSetVerified,stats,allUsers,resetBeta,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})();
