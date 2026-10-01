#!/usr/bin/env node
// Realistic demo content (qa/DEMO-CONTENT-GE.md §ბ, §ე, §ვ, §ზ) on Neon branch auth-probe only.
// Run: DEMO_API_ORIGIN=http://localhost:3001 node site/web/scripts/seed-demo-v2.cjs [--dry-run | --verify]
// Same guards and ledger as seed-demo.cjs (which stays for the first-generation data).
// Marketplace writes go through authenticated RPCs with the existing owner admin; SQL uses
// one narrow transaction for what the API cannot set: requests.created_at/expires_at,
// offers.created_at, profiles.phone/created_at of demo accounts and the QA suffix of three chat messages.
// Nothing is printed from the ledger.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md');
const LOCK = FILE + '.lock';
const BASE = process.env.DEMO_API_ORIGIN || 'http://localhost:3000';
const UPLOAD = process.env.DEMO_UPLOAD_ORIGIN || BASE;
const REFRESH_DATES = process.argv.includes('--refresh-dates');
const VERIFY = process.argv.includes('--verify') || REFRESH_DATES;
const DRY = process.argv.includes('--dry-run');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const AUTH = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
assert.equal(AUTH, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth', 'Wrong Neon Auth branch');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'Wrong database branch');
for (const origin of [BASE, UPLOAD]) assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use a local API connected to auth-probe');
const ALL_CITIES = ['tbilisi','batumi','kutaisi','rustavi','zugdidi','telavi','gori','georgia'];
const accounts = [
  {key:'hotel', role:'client', name:'ნინო ბერიძე', company:'სასტუმრო „ლეგენდა“', city:'batumi', phone:'+995 593 274 186'},
  {key:'cafe', role:'client', name:'მარიამ ჭანტურია', company:'კაფე მზიანი დილა', city:'tbilisi', phone:'+995 577 318 942'},
  {key:'shop', role:'client', name:'გიორგი ხარაიშვილი', company:'მაღაზია იმერული კუთხე', city:'kutaisi', phone:'+995 551 640 273'},
  {key:'winery', role:'client', name:'ლაშა ჯანგულაშვილი', company:'მარანი „ქიზიყი“', city:'telavi', phone:'+995 577 604 918'},
  {key:'dental', role:'client', name:'ანა ქავთარაძე', company:'სტომატოლოგიური კლინიკა „დენტა-ლაინი“', city:'tbilisi', phone:'+995 599 286 351'},
  {key:'garage', role:'client', name:'ირაკლი ნოზაძე', company:'ავტოსერვისი „მექანიკა“', city:'rustavi', phone:'+995 551 873 042'},
  {key:'wood', role:'company', name:'დავით ღვინიაშვილი', company:'ხის ხაზი', city:'tbilisi', industry:'furniture', phone:'+995 599 412 867', address:'აკაკი წერეთლის გამზ. 116', lat:41.7438, lng:44.7793,
    about:'ვამზადებთ ხის ავეჯს კაფეების, სასტუმროებისა და მაღაზიებისთვის. ვეხმარებით ზომების შერჩევაში, ვამზადებთ ესკიზს და ვგეგმავთ მონტაჟს.', offers:['მაგიდებისა და სკამების დამზადება','სავაჭრო თაროები','ავეჯის მიტანა და მონტაჟი'], seeks:['ხის მასალის მომწოდებლები','ავეჯის ფურნიტურა'], cities:['tbilisi','rustavi']},
  {key:'linen', role:'company', name:'თამარ ჯაფარიძე', company:'რბილი სივრცე', city:'batumi', industry:'textiles', phone:'+995 568 903 154', address:'ლუკა ასათიანის ქ. 4', lat:41.6469, lng:41.6372,
    about:'ვკერავთ სასტუმროს თეთრეულს, ფარდებსა და სუფრებს. შეკვეთამდე ვამზადებთ ქსოვილის ნიმუშებს; ზომები და შეფუთვა დამკვეთის საჭიროებას ერგება.', offers:['სასტუმროს თეთრეული','ფარდების შეკერვა','კაფის სუფრები და ხელსახოცები'], seeks:['ბამბის ქსოვილის მომწოდებლები','სასტუმროებთან თანამშრომლობა'], cities:['batumi','kutaisi','tbilisi']},
  // A HoReCa wholesaler (ready furniture, linen, packaging from stock, own trucks): furniture and inventory since §ზ.
  {key:'supply', role:'company', name:'ლევან მამულაშვილი', company:'რეგიონის მომარაგება', city:'kutaisi', industry:'wholesale', phone:'+995 577 265 031', address:'ილია ჭავჭავაძის გამზ. 32', lat:42.2543, lng:42.676,
    about:'კაფეებს, სასტუმროებსა და მაღაზიებს ვაწვდით მზა ავეჯს, ინვენტარსა და შეფუთვას საწყობიდან. საკუთარი სატვირთოებით ვზიდავთ დასავლეთ საქართველოსა და თბილისში.', offers:['მზა მაგიდები, სკამები და დივნები','HoReCa ინვენტარი და თეთრეული საწყობიდან','მუყაოს ყუთები','საკუთარი ტრანსპორტით მიწოდება'], seeks:['ავეჯის მწარმოებლები','შეფუთვის მომწოდებლები'], cities:['kutaisi','tbilisi','batumi','zugdidi']},
  {key:'cleaning', role:'company', name:'ეკა ნაკაშიძე', company:'სუფთა სივრცე', city:'batumi', industry:'cleaning', phone:'+995 593 781 406', address:'ილია ჭავჭავაძის ქ. 20', lat:41.6452, lng:41.634,
    about:'ვასუფთავებთ სასტუმროებს, ოფისებსა და კაფეებს, მათ შორის რემონტის შემდეგ. ვმუშაობთ საკუთარი ინვენტარით; სასტუმროებს ვაწვდით თეთრეულს რეცხვითა და გამოცვლით.', offers:['გენერალური დასუფთავება','რემონტის შემდგომი დასუფთავება','თეთრეულის რეცხვა და იჯარა'], seeks:['სასტუმროები და ოფისები','საწმენდი საშუალებების მომწოდებლები'], cities:['batumi','kutaisi']},
  {key:'build', role:'company', name:'ზურაბ კვარაცხელია', company:'კახეთის მშენებელი', city:'kutaisi', industry:'renovation', phone:'+995 551 118 729', address:'კოსტავას ქ. 14', lat:42.2713, lng:42.7045,
    about:'ვასრულებთ შიდა რემონტს: შპაკლი, შეღებვა, იატაკი და სადურგლო სამუშაოები. გვაქვს საკუთარი სატვირთო მასალის მისატანად; ვმუშაობთ ეტაპობრივად, ობიექტის დაუკეტავად.', offers:['კედლების შეკეთება და შეღებვა','სადურგლო სამუშაოები','მასალის მიტანა'], seeks:['სამშენებლო მასალის მომწოდებლები'], cities:['kutaisi','tbilisi','batumi']},
  {key:'web', role:'company', name:'ნიკა ლომიძე', company:'სტუდია ვები', city:'tbilisi', industry:'software_web', phone:'+995 599 037 658', address:'ილია ჭავჭავაძის გამზ. 60', lat:41.7094, lng:44.7501,
    about:'ვაკეთებთ ვებგვერდებს და მარტივ ონლაინ შეკვეთის სისტემებს მცირე ბიზნესისთვის. ვმუშაობთ ეტაპებად: პროტოტიპი, პირველი ვერსია, გაშვება და მხარდაჭერა.', offers:['ვებგვერდის დამზადება','ონლაინ მენიუ და შეკვეთები','საიტის მხარდაჭერა'], seeks:['დიზაინერები','ფოტოგრაფები'], cities:ALL_CITIES},
  {key:'food', role:'company', name:'ნათია ხუციშვილი', company:'მთის ბაღი', city:'tbilisi', industry:'food_fresh', phone:'+995 514 207 639', address:'დავით აღმაშენებლის ხეივანი 178', lat:41.7846, lng:44.7712,
    about:'ფერმერთა კოოპერატივი: კახეთისა და ქართლის 14 მეურნეობის ბოსტნეულს, ხილსა და ყველს ვაწვდით კაფეებსა და სასტუმროებს. ვაწვდით კვირაში სამჯერ, ანგარიშფაქტურით.', offers:['სეზონური ბოსტნეული და მწვანილი','ხილი და კენკრა','ყველი და რძის ნაწარმი','კვირის გრაფიკით მიწოდება'], seeks:['კაფეები და რესტორნები','მაცივრიანი ტრანსპორტი'], cities:['tbilisi','rustavi','gori']},
  // Poti is not in the city list, so the home city is "all Georgia" and the address names the town.
  {key:'port', role:'company', name:'გელა ჟვანია', company:'კოლხეთის ტვირთი', city:'georgia', industry:'freight', phone:'+995 595 318 074', address:'ფოთი, დავით აღმაშენებლის ქ. 12', lat:42.1466, lng:41.6727,
    about:'ფოთის პორტიდან ვზიდავთ კონტეინერულ და პალეტურ ტვირთს დასავლეთ საქართველოსა და თბილისში. გვყავს 20-ტონიანი და მაცივრიანი მანქანები.', offers:['კონტეინერის გატანა პორტიდან','პალეტური გადაზიდვა','საბაჟო დოკუმენტების მომზადება'], seeks:['საწყობი თბილისში','იმპორტიორი კომპანიები'], cities:['batumi','kutaisi','zugdidi','tbilisi']},
  {key:'oak', role:'company', name:'ბესიკ ლორთქიფანიძე', company:'იმერული დურგალი', city:'kutaisi', industry:'furniture', phone:'+995 574 862 015', address:'თამარ მეფის ქ. 49', lat:42.2685, lng:42.7069,
    about:'შეკვეთით ვამზადებთ მასიური ხის მაგიდებს, კარადებს და სასტუმროს ნომრის ავეჯს. ვმუშაობთ წაბლითა და მუხით.', offers:['მასიური ხის მაგიდები','კარადები და თაროები','სასტუმროს ნომრის ავეჯი'], seeks:['ხის მასალის მომწოდებლები'], cities:['kutaisi','batumi']},
  {key:'code', role:'company', name:'სალომე გოგიჩაიშვილი', company:'კოდის ხიდი', city:'tbilisi', industry:'software_web', phone:'+995 591 746 208', address:'პეკინის გამზ. 41', lat:41.7247, lng:44.7584,
    about:'ვქმნით ჯავშნის სისტემებს, ონლაინ მაღაზიებს და მობილურ აპებს კლინიკებისთვის, სასტუმროებისა და მაღაზიებისთვის.', offers:['ონლაინ ჯავშნის სისტემა','ონლაინ მაღაზია','მობილური აპლიკაცია','ბუღალტრულ პროგრამასთან დაკავშირება'], seeks:['UX დიზაინერები','ტესტერები'], cities:['tbilisi']},
  {key:'ads', role:'company', name:'ქეთევან აბაშიძე', company:'ახალი ხედი', city:'tbilisi', industry:'branding_design', phone:'+995 592 604 371', address:'მერაბ კოსტავას ქ. 37', lat:41.7079, lng:44.7869,
    about:'მარკეტინგის სააგენტო მცირე და საშუალო ბიზნესისთვის: ბრენდის იდენტობა, შეფუთვის დიზაინი, სოციალური ქსელები და ვებგვერდის შინაარსი. ვმუშაობთ თვიური გეგმით და გაზომვადი მიზნებით.', offers:['ლოგო და ბრენდის იდენტობა','შეფუთვისა და ეტიკეტის დიზაინი','სოციალური ქსელების მართვა','მაღაზიის ინტერიერის ბრენდირება'], seeks:['ბეჭდვის სახელოსნოები','ფოტოგრაფები'], cities:['tbilisi','batumi','kutaisi','rustavi']},
  {key:'stay', role:'company', name:'თეონა ცინცაძე', company:'ზღვის სტუმარი', city:'batumi', industry:'hotel_services', phone:'+995 598 146 723', address:'შოთა რუსთაველის ქ. 26', lat:41.6508, lng:41.6363,
    about:'ბათუმის სასტუმროებსა და საოჯახო სასტუმროებს ვემსახურებით: ნომრების მოვლა საკუთარი დიასახლისების გუნდით, სტუმრების ტრანსფერი და ონლაინ ჯავშნების მართვა.', offers:['ნომრების მოვლა და დასუფთავება','სტუმრების ტრანსფერი აეროპორტიდან','ჯავშნების მართვა Booking-სა და Airbnb-ზე'], seeks:['სასტუმროები და საოჯახო სასტუმროები','თეთრეულის მომწოდებლები'], cities:['batumi','kutaisi']},
  {key:'admin', role:'client', name:'ალექსანდრე მაისურაძე', company:'MeetAny', city:'tbilisi', phone:'+995 568 452 390'},
].map(a=>({...a,email:`demo-${a.key}@meetany.ge`}));
const NEW_KEYS = ['cleaning','build','web','winery','dental','garage','food','port','oak','code','ads','stay'];
const VERIFIED = ['wood','linen','web','food','port','ads'];
// Days since each company joined (profiles.created_at): three months to two days, so "member since"
// and the "newest" sort mean something. Every company joins before its first offer.
const JOINED = {wood:92,linen:78,supply:64,build:51,cleaning:37,oak:30,stay:26,web:23,port:19,code:11,ads:8,food:4};
// §ზ: no count is shared by three industries except 1 (2/2/1/1/1/1/1/1/1/1).
const INDUSTRY_COUNTS = {furniture:2,software_web:2,textiles:1,wholesale:1,freight:1,cleaning:1,renovation:1,food_fresh:1,branding_design:1,hotel_services:1};
// Hand-typed QA chat messages end in " QA <timestamp>"; only that suffix is removed.
const QA_CHAT = '%QA 1790%';
// key: owner, title, body, category, city, photo (null = no photo), quantity, unit, address_note, needed_by,
// age (hours since published), left (days until expiry). Keys R1–R11 are the seed-demo.cjs keys.
const requests = [
  ['linen','hotel','სასტუმროსთვის 60 კომპლექტი თეთრეული','გვჭირდება თეთრი ბამბის თეთრეული 30 ნომრისთვის, ორ-ორი კომპლექტი. გთხოვთ მიუთითოთ ქსოვილის სიმკვრივე, რეცხვის პირობები და ბათუმში მიწოდების ვადა.','textiles','batumi','hotel-linen.jpg',60,'pcs','ზ. ჟვანიას ქ. 12',null,216,5],
  ['chairs','winery','ვეძებთ 24 ხის სკამს მარნის ტერასაზე','სადეგუსტაციო ტერასისთვის გვჭირდება გამძლე ხის სკამები. სასურველია ბუნებრივი ფერი და დამცავი საფარი. მიუთითეთ, შედის თუ არა თელავში მიტანა და აწყობა.','furniture','telavi',null,24,'pcs','ერეკლე II-ის გამზ. 21',null,96,5],
  ['cleaning','hotel','სასტუმროს საერთო სივრცის გენერალური დასუფთავება','საჭიროა 450 კვ.მ საერთო სივრცის, ფანჯრებისა და დერეფნების დასუფთავება სტუმრების მიღებამდე. ინვენტარი და საწმენდი საშუალებები შემსრულებელმა უნდა მოიტანოს.','cleaning','batumi','commercial-cleaning.jpg',450,'m2','გორგილაძის ქ. 31',null,52,19],
  ['curtains','dental','რულონური ფარდები 12 ფანჯარაზე, მონტაჟით','კლინიკის კაბინეტებისთვის გვჭირდება ღია ნაცრისფერი დამაბნელებელი რულონური ფარდები, ადგილზე აზომვით. თითოეული ფანჯარა დაახლოებით 1.4 მეტრის სიგანისაა.','textiles','tbilisi',null,12,'pcs','ალ. ყაზბეგის გამზ. 24',null,288,2],
  ['tables','cafe','10 კომპაქტური ხის მაგიდა 70×70','გვჭირდება 70×70 სმ მაგიდები მცირე კაფისთვის. ზედაპირი ადვილად უნდა იწმინდებოდეს. გთხოვთ გამოგვიგზავნოთ მასალის აღწერა, ნიმუშის ფოტო და დამზადების ვადა.','furniture','tbilisi',null,10,'pcs','ვაჟა-ფშაველას გამზ. 41',null,24,27],
  ['produce','cafe','სეზონური ბოსტნეული კვირაში სამჯერ','ვეძებთ მომწოდებელს კვირაში სამჯერ მიწოდებისთვის: პომიდორი, კიტრი, სალათის ფოთოლი და მწვანილი. კვირაში დაახლოებით 120 კგ. საჭიროა ანგარიშფაქტურა.','food_fresh','tbilisi','fresh-produce.jpg',120,'kg',null,null,6,30],
  ['boxes','winery','საჭიროა 800 მუყაოს ყუთი 6 ბოთლზე','ღვინის ბოთლებისთვის გვჭირდება გოფრირებული მუყაოს ყუთები შიდა ტიხრებით, 6 ბოთლი 0.75 ლ. ლოგოს ბეჭდვის პირობები მიუთითეთ ცალკე; შეკვეთამდე გვინდა ნიმუშის ნახვა.','packaging','telavi',null,800,'pcs',null,null,120,8],
  ['website','dental','საჭიროა კლინიკის ვებგვერდი ონლაინ ჩაწერით','გვჭირდება ქართულ-ინგლისური, მობილურზე მორგებული საიტი: ექიმები, მომსახურებები და ვიზიტის დაჯავშნის ფორმა. ფოტოებსა და ტექსტებს მოგაწვდით. შემოგვთავაზეთ სამუშაოების გეგმა.','software_web','tbilisi',null,1,'service',null,null,192,14],
  ['shelves','garage','8 ლითონის თარო სათადარიგო ნაწილებისთვის','სახელოსნოს საწყობისთვის გვჭირდება მყარი ლითონის თაროები, თითო სექცია 90 სმ სიგანის და 180 სმ სიმაღლის, 150 კგ-მდე დატვირთვით. აუცილებელია რუსთავში მონტაჟი.','equipment','rustavi',null,8,'pcs','მესხიშვილის ქ. 9',null,3,21],
  ['delivery','shop','12 პალეტის გადაზიდვა თბილისიდან ქუთაისში','საჭიროა 12 პალეტის შეფუთული არასაკვები საქონლის გადაზიდვა დახურული მანქანით. დატვირთვისა და ჩამოტვირთვის საათები წინასწარ შეთანხმდება. მიუთითეთ, რა შედის მომსახურებაში.','freight','kutaisi',null,12,'pcs',null,null,264,3],
  ['renovation','shop','მაღაზიის 120 კვ.მ კედლების შეღებვა','გვჭირდება კედლების მცირე შეკეთება და ორი ფენა თეთრი საღებავი. სამუშაო უნდა შესრულდეს ეტაპობრივად, მაღაზიის სამუშაო საათების გათვალისწინებით. მასალა ცალკე შეაფასეთ.','renovation','kutaisi',null,120,'m2','ასათიანის ქ. 17','2026-10-08',168,6],
  ['napkins','cafe','ვეძებთ სელის სუფრებს და ხელსახოცებს 25 მაგიდაზე','ვეძებთ ღია ფერის სელის ან ბამბის სუფრებს 25 მაგიდისთვის და იმავე ქსოვილის ხელსახოცებს. საჭიროა რეცხვაგამძლე ქსოვილი; ნიმუში შეკვეთამდე.','textiles','tbilisi',null,25,'pcs',null,null,15,11],
  ['weekly','hotel','ბათუმი–თბილისი: 3 პალეტი კვირაში','ყოველ კვირას გვჭირდება 3 პალეტის (თეთრეული, ჰიგიენური საშუალებები) გადატანა თბილისის საწყობიდან ბათუმში. ვეძებთ მუდმივ გადამზიდს ერთი და იმავე დღით.','freight','batumi',null,3,'pcs',null,null,144,26],
  ['sofas','garage','3 დივანი კლიენტების მოსაცდელში','მოსაცდელისთვის გვჭირდება სამი სამადგილიანი დივანი მუქი, ადვილად მოსავლელი გადასაკრავით (ტყავი ან ეკოტყავი). გვაინტერესებს მზა მოდელებიც და შეკვეთითაც დამზადება.','furniture','rustavi',null,3,'pcs',null,null,480,17],
].map(([key,owner,title,body,category,city,photo,quantity,unit,address,needed,age,left])=>({key,owner,title,body,category,city,photo,quantity,unit,address,needed,age,left}));
// company, request, delivery days, hours after the request was published (2–72), text.
// §ზ: offers per request are 0–6 and no count repeats on three requests.
const offers = [
  ['linen','linen',12,5,'გთავაზობთ 60 კომპლექტს 100% ბამბისგან. ორ ნიმუშს ხვალვე მოგიტანთ სასტუმროში; ბათუმში მიწოდება ჩვენზეა.'],
  ['cleaning','linen',9,26,'სასტუმროს თეთრეულს ვაწვდით იჯარით, რეცხვითა და კვირაში ორჯერ გამოცვლით. თუ ყიდვა აუცილებელი არ არის, პირველი თვე საცდელად შეგვიძლია შევთანხმდეთ.'],
  ['supply','linen',16,50,'საწყობში გვაქვს თეთრი ბამბის თეთრეული, 60 კომპლექტი ერთ პარტიად. ქუთაისიდან ბათუმში ორ დღეში ჩამოვიტანთ.'],
  ['wood','chairs',18,3,'დავამზადებთ 24 სკამს მუხისგან, გარე გამოყენების ლაქით. ერთ სკამს ნიმუშად ერთ კვირაში გაჩვენებთ.'],
  ['build','chairs',21,20,'ჩვენი სადურგლო საამქრო ფიჭვის სკამებს ამზადებს; 24 ცალი სამ კვირაში. ადგილზე აწყობას ჩვენი ხელოსნები შეასრულებენ.'],
  ['supply','chairs',7,61,'საწყობში გვაქვს 30 მზა ხის სკამი ბუნებრივ ფერში. ფოტოებს ჩატში გამოგიგზავნით, თელავში მიტანა — ერთ კვირაში.'],
  ['linen','curtains',10,31,'ზომებს ორშაბათს ავიღებთ. დამაბნელებელი რულონური ქსოვილი ნაცრისფრის სამ ტონში გვაქვს; მონტაჟი შედის.'],
  ['wood','tables',14,2,'მაგიდები მუხის შპონით, ზედაპირი ტენგამძლე ლაქით. 70×70 ზომის ნიმუში სახელოსნოში გვაქვს — შეგიძლიათ მოხვიდეთ და ნახოთ.'],
  ['build','tables',20,4,'ვამზადებთ ლითონის ფეხით და ლამინირებული ზედაპირით. ათივე მაგიდას ორ კვირაში მოგაწვდით.'],
  ['supply','tables',5,7,'გვაქვს მზა კომპაქტური მაგიდები 70×70, თეთრი და კაკლისფერი. საწყობიდან გამოგზავნა ხუთ დღეში.'],
  ['linen','tables',12,11,'პარტნიორ სახელოსნოსთან ერთად გთავაზობთ მაგიდებს სუფრების კომპლექტით. ქსოვილის ნიმუშებს კაფეში მოვიტანთ.'],
  ['cleaning','tables',9,19,'HoReCa ინვენტარსაც ვაწვდით: ხის მაგიდები 70×70 საწყობიდან. სპეციფიკაციასა და ფოტოებს ჩატში გამოგიგზავნით.'],
  ['supply','boxes',6,44,'6-ბოთლიანი ყუთები ტიხრებით, 800 ცალი, ხუთფენიანი გოფრით. ლოგოს ბეჭდვა დამატებით 10 სამუშაო დღეა; ნიმუშს თელავში ჩამოგიტანთ.'],
  ['web','website',21,70,'გავაკეთებთ ორენოვან საიტს ექიმების გვერდებით და ვიზიტის დაჯავშნით. სამუშაოს სამ ეტაპად დავგეგმავთ; პირველი ვერსია — ორ კვირაში.'],
  ['wood','shelves',19,2,'თაროები ლითონის ჩარჩოთი და ფანერის ზედაპირით, 90×180 სმ, 150 კგ-მდე. მონტაჟს რუსთავში ერთ დღეში შევასრულებთ.'],
  ['supply','delivery',2,3,'დახურული სატვირთო ხუთშაბათს თბილისში იქნება. 12 პალეტი ერთ რეისად, დატვირთვა-ჩამოტვირთვა შედის.'],
  ['build','delivery',3,27,'ჩვენი მანქანა კვირაში ორჯერ მოდის თბილისიდან ქუთაისში. 12 პალეტს ორ რეისად გადმოვიტანთ.'],
  ['wood','delivery',4,72,'საკუთარი დახურული ფურგონით ვმუშაობთ. 12 პალეტი ორ რეისად, ორ დღეში.'],
  ['build','renovation',12,9,'ბზარების შევსება, შპაკლი და ორი ფენა საღებავი. ვიმუშავებთ საღამოს 19:00-დან, რომ მაღაზია არ დაიკეტოს.'],
  ['cleaning','renovation',8,40,'გვყავს მცირე სარემონტო ბრიგადა: შეღებვა და შემდეგ დასუფთავება ერთ პაკეტად. სამუშაოს ორ ეტაპად შევასრულებთ.'],
  ['supply','weekly',5,6,'ბათუმი–თბილისის მიმართულებით ყოველ სამშაბათს გვაქვს რეისი. 3 პალეტისთვის მუდმივ ადგილს დაგიჯავშნით.'],
  ['build','weekly',11,52,'სამშენებლო მასალის გამო კვირაში ორჯერ ვმოძრაობთ თბილისსა და ბათუმს შორის; 3 პალეტი დაგვეტევა.'],
  ['port','weekly',4,30,'ფოთსა და თბილისს შორის ყოველდღე დავდივართ, ბათუმამდე — ოთხშაბათობით. 3 პალეტისთვის მუდმივ ადგილს დაგიტოვებთ.'],
  ['code','website',9,60,'ჯავშნის მოდული მზა გვაქვს და თქვენს საიტში ჩავაშენებთ. ორენოვანი ვერსია ექიმების გვერდებით — 9 სამუშაო დღეში.'],
  ['oak','chairs',25,40,'მასიური წაბლის სკამები ზურგით, ზეთ-ცვილის საფარით, რომელიც მზესა და ტენს უძლებს. 24 ცალს 25 დღეში დავამზადებთ; თელავში მიტანა შედის.'],
  ['cleaning','cleaning',2,4,'ბათუმში ვართ და ობიექტს ხვალ დილით ვნახავთ. ოთხკაციანი ბრიგადა 450 კვ.მ-ს ფანჯრებისა და დერეფნების ჩათვლით ორ დღეში დაასრულებს.'],
  ['stay','cleaning',3,8,'სასტუმროებს ვემსახურებით და საკუთარი დიასახლისების გუნდი გვყავს. საერთო სივრცეს ორ ღამეში დავასუფთავებთ, სტუმრების შეუწუხებლად; ინვენტარი ჩვენია.'],
  ['oak','tables',16,9,'70×70 მაგიდებს მუხის მასივისგან ვამზადებთ, ზედაპირი ტენგამძლე ზეთით. ფოტოებსა და მასალის ნიმუშს ჩატში გამოგიგზავნით.'],
  ['ads','boxes',8,30,'ყუთის დიზაინსა და ბეჭდვის მაკეტს მოვამზადებთ: ლოგოს განთავსება, ფერები და ეტიკეტის სტილი. მაკეტს ტირაჟამდე დაგიმტკიცებთ.'],
  ['ads','website',30,48,'საიტთან ერთად მოვამზადებთ ექიმების ფოტოსესიას, მომსახურებების ტექსტებს და Google-ის ბიზნეს-პროფილს. ჯავშნის ფორმას პარტნიორი დეველოპერი ჩააშენებს.'],
  ['oak','renovation',9,22,'ქუთაისში ვართ და სადურგლო ნაწილს ავიღებთ: თაროების მოხსნა და ხელახლა დაკიდება, ხის პლინტუსი. შეღებვას პარტნიორ მღებავებთან ერთად შევასრულებთ.'],
  ['ads','renovation',10,55,'მაღაზიების ინტერიერის ბრენდირებას ვაკეთებთ: კედლები ფირმის ფერებში, ლოგო და ვიტრინის აბრა. შეღებვას ჩვენი პარტნიორი ბრიგადა ეტაპობრივად შეასრულებს.'],
  ['port','delivery',3,14,'თბილისიდან ქუთაისის მიმართულებით ყოველდღე გვაქვს დახურული 20-ტონიანი მანქანა. 12 პალეტს ერთ რეისად წავიღებთ, ტვირთის დაზღვევით.'],
  ['oak','delivery',5,58,'ავეჯის დახურული მანქანა თბილისიდან ქუთაისში ხშირად ცარიელი ბრუნდება. 12 პალეტს ორ რეისად ჩამოვიტანთ.'],
  ['cleaning','weekly',7,20,'ჰიგიენურ საშუალებებს ბათუმში ჩვენი საწყობიდან მოგაწვდით, ასე რომ თბილისიდან მხოლოდ თეთრეულის გადატანა დაგრჩებათ. თეთრეულის იჯარაზეც შეგვიძლია ვისაუბროთ.'],
  ['wood','weekly',6,66,'ბათუმის სასტუმროებში ავეჯს ყოველ პარასკევს ვზიდავთ და ფურგონში ადგილი გვრჩება. 3 პალეტს იმავე რეისით წამოვიღებთ.'],
  ['supply','sofas',4,12,'საწყობში გვაქვს მზა სამადგილიანი დივნები შავ ეკოტყავში. რუსთავში მიტანა ოთხ დღეში.'],
  ['wood','sofas',24,30,'დავამზადებთ სამადგილიან დივნებს ხის ჩარჩოთი და ეკოტყავის გადასაკრავით, მუქ ყავისფერში ან შავში. ნიმუშების ფოტოებს ჩატში გამოგიგზავნით.'],
  ['build','sofas',20,36,'დივნის ჩარჩოს ჩვენი სადურგლო საამქრო ამზადებს, გადაკვრას კი პარტნიორი სახელოსნო. სამივე დივანს სამ კვირაში მოგაწვდით.'],
  ['oak','sofas',28,50,'მუხის ჩარჩოზე ვამზადებთ დივნებს ტყავის მოსახსნელი ბალიშებით, რომლებიც ადვილად იწმინდება. სამ დივანს ოთხ კვირაში დავასრულებთ.'],
  ['stay','sofas',6,62,'სასტუმროს ლობის განახლების შემდეგ გვრჩება სამი ტყავის სამადგილიანი დივანი კარგ მდგომარეობაში. ფოტოებს ჩატში გამოგიგზავნით; რუსთავამდე გადატანას ჩვენ მოვაგვარებთ.'],
  ['linen','sofas',14,70,'თუ დივნები უკვე გაქვთ, ახალ გადასაკრავს შევკერავთ ეკოტყავისგან ან ტეფლონიანი ქსოვილისგან. ქსოვილის ნიმუშებს ფოსტით გამოგიგზავნით.'],
].map(([company,request,days,after,body])=>({company,request,days,after,body}));
// Earlier QA data created by hand under unknown accounts (§ა): the admin removes it.
const OLD_REQUESTS = ['ლობის ავეჯი: 3 დივანი და ჟურნალის მაგიდა','ყოველკვირეული ტვირთის გადაზიდვა ბათუმი–თბილისი','სასტუმროს თეთრეული 40 ნომრისთვის'];
const OLD_COMPANIES = ['სწრაფი გადაზიდვა','ტექსტილ ჰაუსი','ავეჯის სახელოსნო „ხე“'];
const CHOSEN = {request:'linen', company:'linen'};
for (const r of requests) assert(offers.filter(o=>o.request===r.key).every(o=>o.after<r.age), 'Offer after now: '+r.key);
for (const o of offers) assert(o.after>=2&&o.after<=72, 'Offer 2 h – 3 days after the request: '+o.company+'/'+o.request);
assert.equal(new Set(offers.map(o=>o.company+'/'+o.request)).size, offers.length, 'Duplicate offer');
// No value may appear three times: offers per request, companies per industry (1 excepted).
const repeats=(values,skip)=>Object.entries(values.reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{})).filter(([v,n])=>n>=3&&v!==String(skip));
assert.deepEqual(repeats(requests.map(r=>offers.filter(o=>o.request===r.key).length)),[],'Offer counts repeat');
assert.deepEqual(repeats(Object.values(INDUSTRY_COUNTS),1),[],'Industry counts repeat');
for (const o of offers) assert(requests.find(r=>r.key===o.request).age-o.after<JOINED[o.company]*24, 'Offer before joining: '+o.company);
// A request is re-created when anything the API cannot update changes (owner, photo, text after offers).
const sig=r=>crypto.createHash('sha256').update(JSON.stringify([r.owner,r.title,r.body,r.category,r.city,r.photo,r.quantity,r.unit,r.address,r.needed])).digest('base64url').slice(0,16);
let state, SUFFIX = '';
const stale=r=>!state.v2?.requests?.[r.key] || state.v2.sig?.[r.key]!==sig(r);
function save() {
  if (DRY || VERIFY) return;
  const rows = accounts.filter(a=>state.accounts[a.key]).map(a=>`| ${state.accounts[a.key].label || a.company+SUFFIX} | ${a.email} | ${state.accounts[a.key].password} | ${a.role} |`).concat(Object.entries(state.accounts).filter(([key, a])=>a.email && !accounts.some(known=>known.key===key)).map(([, a])=>`| ${a.label} | ${a.email} | ${a.password} | ${a.role} |`)).join('\n');
  const text = '# MeetAny — სატესტო ანგარიშები\n\nმხოლოდ ადგილობრივი გამოყენებისთვის; არ ატვირთოთ git-ში და არ გააზიაროთ საჯაროდ.\nპროექტი: fancy-surf-61327851; branch: auth-probe.\nყველა ბიზნესი, სახელი და ნომერი სადემონსტრაციოა.\n\n| ბიზნესი | ელფოსტა | პაროლი | როლი |\n|---|---|---|---|\n'+rows+'\n\nგაშვება: `node scripts/seed-demo-v2.cjs`; შემოწმება: `node scripts/seed-demo-v2.cjs --verify` (პირველი თაობა: `seed-demo.cjs`).\nქვემოთ მოცემული ჩანაწერი საჭიროა განმეორებითი გაშვებისა და შეწყვეტილი სამუშაოს აღსადგენად.\n\n```json\n'+JSON.stringify(state,null,2)+'\n```\n';
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
  async function auth(route, body, attempt=0) {
    let out;
    try { out = await json(AUTH+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined}); }
    catch(err) { // Neon Auth rate-limits sign-ins; ten accounts in a row hit it.
      if (err.status!==429 || attempt>=8) throw err;
      await new Promise(r=>setTimeout(r,30000));
      return auth(route, body, attempt+1);
    }
    for (const c of out.res.headers.getSetCookie()) {const pair=c.split(';')[0]; const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
    return out;
  }
  const input={email:a.email,password:state.accounts[a.key].password};
  try {await auth('/sign-in/email',input);}
  catch(err) {
    if (VERIFY || DRY || err.code!=='INVALID_EMAIL_OR_PASSWORD' || state.accounts[a.key].id) throw err;
    await auth('/sign-up/email',{...input,name:a.name}); // Verification is off: sign-up creates the session.
  }
  const {data} = await auth('/token');
  assert(data?.token, 'Auth did not issue a JWT');
  a.jwt=data.token;
  a.id=JSON.parse(Buffer.from(a.jwt.split('.')[1],'base64url')).sub;
  if(state.accounts[a.key].id) assert.equal(a.id,state.accounts[a.key].id);
  state.accounts[a.key].id=a.id;
  save();
}
async function api(a, route, body) {
  return (await json(BASE+'/api/db/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(a?{Authorization:'Bearer '+a.jwt}:{})},body:body?JSON.stringify(body):undefined})).data;
}
const rpc=(a,name,args={})=>api(a,'rpc/'+name,args);
const byKey=key=>accounts.find(a=>a.key===key);
async function ownerAdmin() {
  const record=state.accounts.owner_admin;
  assert(record?.id && record?.password && record.email==='admin@gmail.com','Run add-owner-accounts.cjs first');
  const admin={key:'owner_admin',email:record.email};
  await login(admin);
  assert.equal((await rpc(admin,'my_profile'))[0]?.role,'admin','Owner admin role missing');
  return admin;
}

const sqlClient=()=>require('@neondatabase/serverless').neon(process.env.DATABASE_URL);
const demoIds=()=>accounts.map(a=>a.id).filter(Boolean);
async function oldData(admin) {
  const ids=new Set(demoIds());
  const reqs=(await api(admin,'requests?select=id,title,owner_id')).filter(r=>OLD_REQUESTS.includes(r.title)&&!ids.has(r.owner_id));
  const users=(await rpc(admin,'admin_list_users')).filter(p=>p.role==='company'&&OLD_COMPANIES.includes(p.company)&&!ids.has(p.id));
  return {reqs,users};
}
function profileArgs(a) {
  return {p_name:a.name,p_company:a.company,p_city:a.city,p_industry:a.industry||null,p_about:a.about||'',p_offers:a.offers||[],p_seeks:a.seeks||[],p_service_cities:a.cities||[],p_address:a.address||null,p_lat:a.lat??null,p_lng:a.lng??null};
}
async function plan() {
  // Read-only: what a real run would change.
  for(const a of accounts) if(state.accounts[a.key]) await login(a);
  const admin=await ownerAdmin(), old=await oldData(admin);
  const recreate=requests.filter(stale);
  console.log(JSON.stringify({
    newAccounts:accounts.filter(a=>!state.accounts[a.key]).map(a=>a.key),
    profilesUpdated:accounts.filter(a=>a.key!=='admin').length,
    oldQaRequestsToDelete:old.reqs.length, oldCompaniesToBlock:old.users.filter(u=>!u.blocked).length,
    demoRequestsToDelete:recreate.filter(r=>state.v2?.requests?.[r.key]||state.requests[r.key]?.id).length, requestsToCreate:recreate.map(r=>r.key),
    photos:requests.filter(r=>r.photo).map(r=>r.key), photosToUpload:requests.filter(r=>r.photo&&!state.requests[r.key]?.photo).length,
    owners:Object.fromEntries(accounts.filter(a=>a.role==='client').map(a=>[a.key,requests.filter(r=>r.owner===a.key).length])),
    offers:offers.length, chosen:`${CHOSEN.request}→${CHOSEN.company}`, verified:VERIFIED,
    sql:{requests:requests.length,offers:offers.length,phones:accounts.length,joined:Object.keys(JOINED).length,qaMessages:(await sqlClient()`select count(*)::int n from meetany_private.messages where body like ${QA_CHAT}`)[0].n},
    industries:INDUSTRY_COUNTS,
    offerCounts:Object.fromEntries(requests.map(r=>[r.key,offers.filter(o=>o.request===r.key).length])),
  },null,1));
}
async function seed() {
  for(const a of accounts) {
    state.accounts[a.key]||={password:crypto.randomBytes(24).toString('base64url')+'!a9'};save();
    await login(a);
    const p=await rpc(a,'complete_profile',{p_role:a.role,p_name:a.name,p_company:a.company,p_phone:a.phone,p_city:a.city,p_industry:a.industry||null});
    assert.equal(p.id,a.id);
    if(a.key!=='admin') await rpc(a,'update_my_profile',profileArgs(a));
    console.log('პროფილი მზადაა:',a.key);
  }
  const admin=await ownerAdmin();
  const old=await oldData(admin);
  for(const r of old.reqs) await rpc(admin,'admin_delete_request',{p_request_id:r.id});
  for(const u of old.users.filter(u=>!u.blocked)) await rpc(admin,'admin_set_blocked',{p_user_id:u.id,p_blocked:true,p_reason:'ძველი QA ჩანაწერი, ჩანაცვლდა სადემო მონაცემებით'});
  console.log('ძველი QA:',JSON.stringify({deleted:old.reqs.length,blocked:old.users.filter(u=>!u.blocked).length}));
  for(const a of accounts.filter(a=>a.role==='company')) await rpc(admin,'admin_set_verified',{p_user_id:a.id,p_verified:VERIFIED.includes(a.key)});
  const {upload}=require('@vercel/blob/client');
  state.v2||={requests:{}};state.v2.sig||={};
  // Delete every stale request first (by its current owner, which may differ from the new one), so no
  // client passes five open requests while the set is rebuilt. Offers cascade.
  const owners=new Map(accounts.map(a=>[a.id,a]));
  const all=await api(null,'requests?select=id,title,owner_id');
  for(const r of requests.filter(stale)) {
    const old=new Set([state.v2.requests[r.key],state.requests[r.key]?.id].filter(Boolean));
    for(const x of all.filter(x=>old.has(x.id)||(x.title===r.title&&x.owner_id===byKey(r.owner).id))) await rpc(owners.get(x.owner_id),'delete_request',{p_request_id:x.id});
    delete state.v2.requests[r.key];save();
  }
  for(const r of requests) {
    const a=byKey(r.owner);
    if(!state.v2.requests[r.key]) {
      const record=state.requests[r.key]||={};
      if(r.photo && !(record.photo && new URL(record.photo).pathname.startsWith('/'+a.id+'/'))) {
        const file=fs.readFileSync(path.join(ROOT,'public/assets/photos',r.photo));
        const blob=await upload(`${a.id}/demo-${r.key}.jpg`,file,{access:'public',handleUploadUrl:UPLOAD+'/api/blob-upload',contentType:'image/jpeg',headers:{Authorization:'Bearer '+a.jwt}});
        record.photo=blob.url;save();
      }
      const created=await rpc(a,'create_request',{p_title:r.title,p_body:r.body,p_category:r.category,p_city:r.city,p_photo_url:r.photo?record.photo:null,p_quantity:r.quantity,p_unit:r.unit,p_needed_by:r.needed,p_address_note:r.address});
      record.id=created.id;state.v2.requests[r.key]=created.id;state.v2.sig[r.key]=sig(r);save();
      console.log('მოთხოვნა მზადაა:',r.key);
    }
    const id=state.v2.requests[r.key];
    for(const o of offers.filter(o=>o.request===r.key)) {
      const c=byKey(o.company);
      if((await api(c,`offers?select=id&request_id=eq.${id}&company_id=eq.${c.id}`)).length) continue;
      await rpc(c,'send_offer',{p_request_id:id,p_body:o.body,p_price:null,p_price_type:'negotiable',p_vat_included:false,p_delivery_days:o.days,p_delivery_included:false});
    }
    if(r.key===CHOSEN.request) { // choose before the owner's later requests, so the owner stays within five open
      const req=(await api(a,`requests?select=*&id=eq.${id}`))[0];
      if(!req.chosen_offer_id) {
        const o=(await api(a,`offers?select=*&request_id=eq.${id}`)).find(o=>o.company_id===byKey(CHOSEN.company).id);
        await rpc(a,'choose_offer',{p_offer_id:o.id,p_expected_updated_at:o.updated_at});
      }
    }
  }
  await backdate();
}
// The one SQL write for seed data: dates and phones the API cannot set. Every row is matched by id plus
// owner/title (requests), request/company (offers) or email (profiles); counts are checked before the update.
async function backdate() {
  const sql=sqlClient();
  const rq=requests.map(r=>({id:state.v2.requests[r.key],owner:byKey(r.owner).id,title:r.title,age:r.age,left:r.left}));
  const of=[];
  for(const o of offers) {
    const r=requests.find(r=>r.key===o.request);
    const row=(await api(byKey(o.company),`offers?select=id&request_id=eq.${state.v2.requests[r.key]}&company_id=eq.${byKey(o.company).id}`))[0];
    of.push({id:row.id,request:state.v2.requests[r.key],company:byKey(o.company).id,age:r.age-o.after});
  }
  const ph=accounts.map(a=>({id:a.id,email:a.email,phone:a.phone}));
  const jn=accounts.filter(a=>a.role==='company').map(a=>({id:a.id,email:a.email,days:JOINED[a.key]}));
  const [c1,c2,c3,taken,qa]=await sql.transaction([
    sql`select count(*)::int n from public.requests t join jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int) on t.id=v.id and t.owner_id=v.owner and t.title=v.title`,
    sql`select count(*)::int n from public.offers t join jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid,age int) on t.id=v.id and t.request_id=v.request and t.company_id=v.company`,
    sql`select count(*)::int n from public.profiles t join jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text) on t.id=v.id and t.email=v.email`,
    sql`select count(*)::int n from public.profiles t join jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text) on t.phone=v.phone and t.id<>v.id`,
    sql`select count(*)::int n from meetany_private.messages where body like ${QA_CHAT}`,
  ],{readOnly:true});
  assert.deepEqual([c1[0].n,c2[0].n,c3[0].n,taken[0].n],[rq.length,of.length,ph.length,0],'Backdate precheck failed');
  assert(qa[0].n<=3,'Unexpected QA chat messages: '+qa[0].n);
  const [u1,u2,u3,u4,u5]=await sql.transaction([
    sql`update public.requests t set created_at=now()-make_interval(hours=>v.age), expires_at=now()+make_interval(days=>v."left")
        from jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int)
        where t.id=v.id and t.owner_id=v.owner and t.title=v.title returning t.id`,
    sql`update public.offers t set created_at=now()-make_interval(hours=>v.age)
        from jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid,age int)
        where t.id=v.id and t.request_id=v.request and t.company_id=v.company returning t.id`,
    sql`update public.profiles t set phone=v.phone
        from jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text)
        where t.id=v.id and t.email=v.email and t.phone<>v.phone returning t.id`,
    sql`update public.profiles t set created_at=now()-make_interval(days=>v.days)
        from jsonb_to_recordset(${JSON.stringify(jn)}::jsonb) v(id uuid,email text,days int)
        where t.id=v.id and t.email=v.email and t.role='company' returning t.id`,
    sql`update meetany_private.messages set body=regexp_replace(body,${'\\s*QA 1790[0-9]+$'},'') where body like ${QA_CHAT} returning id`,
  ]);
  assert.equal(u1.length,rq.length);assert.equal(u2.length,of.length);assert.equal(u4.length,jn.length);assert.equal(u5.length,qa[0].n);
  console.log('SQL:',JSON.stringify({requests:u1.length,offers:u2.length,phones:u3.length,joined:u4.length,chat:u5.length}));
}
// Refresh only the explicit demo timeline. Content, photos, accounts and messages stay intact.
async function refreshDates() {
  assert(state.v2,'Missing v2 demo inventory');
  const sql=sqlClient();
  const rq=requests.map(r=>({id:state.v2.requests[r.key],owner:state.accounts[r.owner].id,title:r.title,age:r.age,left:r.left}));
  const jn=accounts.filter(a=>a.role==='company').map(a=>({id:state.accounts[a.key].id,email:a.email,days:JOINED[a.key]}));
  const of=offers.map(o=>({request:state.v2.requests[o.request],company:state.accounts[o.company].id,age:requests.find(r=>r.key===o.request).age-o.after}));
  const [check]=await sql`select count(*)::int n from public.requests t join jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text) on t.id=v.id and t.owner_id=v.owner and t.title=v.title`;
  assert.equal(check.n,rq.length,'Demo identity check failed');
  const changed=await sql.transaction([
    sql`update public.requests t set created_at=now()-make_interval(hours=>v.age),expires_at=now()+make_interval(days=>v."left") from jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int) where t.id=v.id and t.owner_id=v.owner and t.title=v.title returning t.id`,
    sql`update public.offers t set created_at=now()-make_interval(hours=>v.age) from jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(request uuid,company uuid,age int) where t.request_id=v.request and t.company_id=v.company returning t.id`,
    sql`update public.profiles t set created_at=now()-make_interval(days=>v.days) from jsonb_to_recordset(${JSON.stringify(jn)}::jsonb) v(id uuid,email text,days int) where t.id=v.id and t.email=v.email returning t.id`,
  ]);
  console.log('Demo timeline refreshed:',JSON.stringify(changed.map(rows=>rows.length)));
}
async function verify() {
  for(const a of accounts) {
    if(!a.jwt) await login(a);
    const p=(await rpc(a,'my_profile'))[0];assert.equal(p.id,a.id);assert.equal(p.role,a.role);
    assert.equal(p.phone,a.phone);assert.equal(p.name,a.name);assert.equal(p.company,a.company);
    if(a.role==='company') {assert.equal(p.address,a.address);assert(p.about&&p.offers.length&&p.service_cities.length);assert.equal(p.verified,VERIFIED.includes(a.key));}
  }
  const ids=Object.values(state.v2.requests);
  const own=(await api(null,'requests?select=*')).filter(r=>ids.includes(r.id));
  assert.equal(own.length,requests.length);
  const now=Date.now(), day=864e5;
  const open=own.filter(r=>!r.hidden&&!r.chosen_offer_id&&r.status==='open'&&new Date(r.expires_at)>now);
  assert.equal(open.length,requests.length-1,'Expected all but the chosen request open');
  const chosen=own.filter(r=>r.chosen_offer_id);assert.equal(chosen.length,1);assert.equal(chosen[0].id,state.v2.requests[CHOSEN.request]);
  const left=new Set(open.map(r=>Math.round((new Date(r.expires_at)-now)/day)));
  assert(left.size>=12,'Expiry days are not varied');
  for(const a of accounts.filter(a=>a.role==='client' && requests.some(r=>r.owner===a.key))) {
    assert(open.filter(r=>r.owner_id===a.id).length<=5);
    const n=own.filter(r=>r.owner_id===a.id).length;assert(n>=2&&n<=3,'Requests per client: '+a.key);
  }
  const fresh=open.filter(r=>now-new Date(r.created_at)<=48*36e5).length;assert(fresh>=3&&fresh<=4,'New (≤48 h): '+fresh);
  const counts={};
  for(const r of requests) {
    const row=own.find(x=>x.id===state.v2.requests[r.key]);
    assert.equal(!!row.photo_url,!!r.photo,'Photo mismatch: '+r.key);
    assert.equal(row.address_note,r.address);assert.equal(Number(row.quantity),r.quantity);assert.equal(row.unit,r.unit);
    const got=await api(byKey(r.owner),`offers?select=*&request_id=eq.${row.id}`);
    assert.equal(got.length,offers.filter(o=>o.request===r.key).length,'Offer count: '+r.key);
    assert(got.every(o=>new Date(o.created_at)>new Date(row.created_at)&&new Date(o.created_at)<now));
    counts[got.length]=(counts[got.length]||0)+1;
  }
  for(const r of own.filter(r=>r.photo_url)) {
    assert(new URL(r.photo_url).pathname.startsWith('/'+r.owner_id+'/'));
    const res=await fetch(r.photo_url,{method:'HEAD',signal:AbortSignal.timeout(20000)});
    assert(res.ok);assert.match(res.headers.get('content-type'),/^image\//);
  }
  const listed=await rpc(null,'list_companies');
  assert(OLD_COMPANIES.every(n=>!listed.some(c=>c.company===n)),'Old QA company still listed');
  const companies=accounts.filter(a=>a.role==='company');
  assert(companies.every(a=>listed.some(c=>c.id===a.id)));
  const industries={};for(const c of listed.filter(c=>companies.some(a=>a.id===c.id)))industries[c.industry]=(industries[c.industry]||0)+1;
  assert.deepEqual(industries,INDUSTRY_COUNTS,'Industry counts');
  for(const a of companies) {
    const c=listed.find(c=>c.id===a.id);
    assert(Math.abs((now-new Date(c.created_at))/day-JOINED[a.key])<1,'Joined: '+a.key);
    assert(!/\d/.test(a.company.split(/\s+/).slice(0,2).map(w=>w.replace(/[„“"]/g,'')[0]).join('')),'Digit initial: '+a.key);
  }
  const pub=await api(null,`profiles?select=id,phone&id=in.(${companies.map(a=>a.id).join(',')})`);
  assert.equal(pub.filter(p=>p.phone).length,companies.length,'Public company phone missing');
  const sent={};for(const o of offers)sent[o.company]=(sent[o.company]||0)+1;
  assert(companies.filter(a=>!sent[a.key]).length>=1,'Some company should have sent no offer');
  assert(Object.values(counts).every(n=>n<=2),'Offer counts repeat on three requests');
  assert.equal((await sqlClient()`select count(*)::int n from meetany_private.messages m join meetany_private.conversations c on c.id=m.conversation_id where c.request_id=any(${ids}::uuid[]) and (m.body like ${QA_CHAT} or m.body like '%ტესტ%')`)[0].n,0,'QA chat text left');
  assert.equal((await oldData(await ownerAdmin())).reqs.length,0,'Old QA request still present');
  const phones=accounts.map(a=>a.phone);assert.equal(new Set(phones).size,phones.length);
  for(const key of ['hotel',CHOSEN.company]) assert.equal((await rpc(byKey(key),'contact_for_request',{p_request_id:state.v2.requests[CHOSEN.request]})).length,1);
  console.log(JSON.stringify({accounts:accounts.length,companies:accounts.filter(a=>a.role==='company').length,requests:own.length,open:open.length,chosen:1,fresh,owners:Object.fromEntries(accounts.filter(a=>a.role==='client').map(a=>[a.key,own.filter(r=>r.owner_id===a.id).length])),photos:requests.filter(r=>own.find(x=>x.id===state.v2.requests[r.key]).photo_url).map(r=>r.key),offers:offers.length,offerCounts:counts,expiryDays:[...left].sort((a,b)=>a-b),verified:VERIFIED,industries,sent:Object.fromEntries(companies.map(a=>[a.key,sent[a.key]||0])),joinedDays:JOINED,checks:'passed'}));
}
async function main() {
  const fd=fs.openSync(LOCK,'wx',0o600);fs.closeSync(fd);
  try {
    const text=fs.readFileSync(FILE,'utf8');
    state=JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
    if(text.includes('(დემო) |')) SUFFIX=' (დემო)';
    if(DRY) return await plan();
    if(VERIFY) assert(state.v2 && NEW_KEYS.every(k=>state.accounts[k]),'Run seed-demo-v2 first');
    else await seed();
    if(REFRESH_DATES) await refreshDates();
    await verify();
  } finally {fs.unlinkSync(LOCK);}
}
if(require.main===module) main().catch(err=>{console.error('მონაცემების ოპერაცია შეჩერდა:',err.message);process.exitCode=1;});
