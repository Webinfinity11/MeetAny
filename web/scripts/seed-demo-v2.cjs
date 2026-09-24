#!/usr/bin/env node
// Realistic demo content (qa/DEMO-CONTENT-GE.md §ბ) on Neon branch auth-probe only.
// Run: DEMO_API_ORIGIN=http://localhost:3001 node site/web/scripts/seed-demo-v2.cjs [--dry-run | --verify]
// Same guards and ledger as seed-demo.cjs (which stays for the first-generation data).
// Marketplace writes go through authenticated RPCs; the only SQL writes are the documented admin
// promotion and one narrow transaction for what the API cannot set: requests.created_at/expires_at,
// offers.created_at and profiles.phone of demo accounts. Nothing is printed from the ledger.
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
  {key:'supply', role:'company', name:'ლევან მამულაშვილი', company:'რეგიონის მომარაგება', city:'kutaisi', industry:'logistics', phone:'+995 577 265 031', address:'ილია ჭავჭავაძის გამზ. 32', lat:42.2543, lng:42.676,
    about:'ვგეგმავთ რეგიონულ გადაზიდვებს და ვაწვდით ბიზნესებს მუყაოს შეფუთვას. წინასწარ ვათანხმებთ აღების დროს, მარშრუტს და ტვირთის მოცულობას.', offers:['ტვირთის რეგიონული გადაზიდვა','მუყაოს ყუთები','შეკვეთების განაწილება'], seeks:['ადგილობრივი მწარმოებლები','შეფუთვის მომწოდებლები'], cities:['kutaisi','tbilisi','batumi','zugdidi']},
  {key:'cleaning', role:'company', name:'ეკა ნაკაშიძე', company:'სუფთა სივრცე', city:'batumi', industry:'cleaning', phone:'+995 593 781 406', address:'ილია ჭავჭავაძის ქ. 20', lat:41.6452, lng:41.634,
    about:'ვასუფთავებთ სასტუმროებს, ოფისებსა და კაფეებს, მათ შორის რემონტის შემდეგ. ვმუშაობთ საკუთარი ინვენტარით; სასტუმროებს ვაწვდით თეთრეულს რეცხვითა და გამოცვლით.', offers:['გენერალური დასუფთავება','რემონტის შემდგომი დასუფთავება','თეთრეულის რეცხვა და იჯარა'], seeks:['სასტუმროები და ოფისები','საწმენდი საშუალებების მომწოდებლები'], cities:['batumi','kutaisi']},
  {key:'build', role:'company', name:'ზურაბ კვარაცხელია', company:'კახეთის მშენებელი', city:'kutaisi', industry:'construction', phone:'+995 551 118 729', address:'კოსტავას ქ. 14', lat:42.2713, lng:42.7045,
    about:'ვასრულებთ შიდა რემონტს: შპაკლი, შეღებვა, იატაკი და სადურგლო სამუშაოები. გვაქვს საკუთარი სატვირთო მასალის მისატანად; ვმუშაობთ ეტაპობრივად, ობიექტის დაუკეტავად.', offers:['კედლების შეკეთება და შეღებვა','სადურგლო სამუშაოები','მასალის მიტანა'], seeks:['სამშენებლო მასალის მომწოდებლები'], cities:['kutaisi','tbilisi','batumi']},
  {key:'web', role:'company', name:'ნიკა ლომიძე', company:'ვებსტუდია 7', city:'tbilisi', industry:'technology', phone:'+995 599 037 658', address:'ილია ჭავჭავაძის გამზ. 60', lat:41.7094, lng:44.7501,
    about:'ვაკეთებთ ვებგვერდებს და მარტივ ონლაინ შეკვეთის სისტემებს მცირე ბიზნესისთვის. ვმუშაობთ ეტაპებად: პროტოტიპი, პირველი ვერსია, გაშვება და მხარდაჭერა.', offers:['ვებგვერდის დამზადება','ონლაინ მენიუ და შეკვეთები','საიტის მხარდაჭერა'], seeks:['დიზაინერები','ფოტოგრაფები'], cities:ALL_CITIES},
  {key:'admin', role:'admin', name:'ალექსანდრე მაისურაძე', company:'MeetAny', city:'tbilisi', phone:'+995 568 452 390'},
].map(a=>({...a,email:`demo-${a.key}@meetany.ge`}));
const NEW_KEYS = ['cleaning','build','web','winery','dental','garage'];
const VERIFIED = ['wood','linen','web'];
// key: owner, title, body, category, city, photo (null = no photo), quantity, unit, address_note, needed_by,
// age (hours since published), left (days until expiry). Keys R1–R11 are the seed-demo.cjs keys.
const requests = [
  ['linen','hotel','სასტუმროსთვის 60 კომპლექტი თეთრეული','გვჭირდება თეთრი ბამბის თეთრეული 30 ნომრისთვის, ორ-ორი კომპლექტი. გთხოვთ მიუთითოთ ქსოვილის სიმკვრივე, რეცხვის პირობები და ბათუმში მიწოდების ვადა.','textiles','batumi','hotel-linen.jpg',60,'pcs','ზ. ჟვანიას ქ. 12',null,216,5],
  ['chairs','winery','ვეძებთ 24 ხის სკამს მარნის ტერასაზე','სადეგუსტაციო ტერასისთვის გვჭირდება გამძლე ხის სკამები. სასურველია ბუნებრივი ფერი და დამცავი საფარი. მიუთითეთ, შედის თუ არა თელავში მიტანა და აწყობა.','furniture','telavi',null,24,'pcs','ერეკლე II-ის გამზ. 21',null,96,5],
  ['cleaning','hotel','სასტუმროს საერთო სივრცის გენერალური დასუფთავება','საჭიროა 450 კვ.მ საერთო სივრცის, ფანჯრებისა და დერეფნების დასუფთავება სტუმრების მიღებამდე. ინვენტარი და საწმენდი საშუალებები შემსრულებელმა უნდა მოიტანოს.','cleaning','batumi','commercial-cleaning.jpg',450,'m2','გორგილაძის ქ. 31',null,52,19],
  ['curtains','dental','რულონური ფარდები 12 ფანჯარაზე, მონტაჟით','კლინიკის კაბინეტებისთვის გვჭირდება ღია ნაცრისფერი დამაბნელებელი რულონური ფარდები, ადგილზე აზომვით. თითოეული ფანჯარა დაახლოებით 1.4 მეტრის სიგანისაა.','textiles','tbilisi',null,12,'pcs','ალ. ყაზბეგის გამზ. 24',null,288,2],
  ['tables','cafe','10 კომპაქტური ხის მაგიდა 70×70','გვჭირდება 70×70 სმ მაგიდები მცირე კაფისთვის. ზედაპირი ადვილად უნდა იწმინდებოდეს. გთხოვთ გამოგვიგზავნოთ მასალის აღწერა, ნიმუშის ფოტო და დამზადების ვადა.','furniture','tbilisi',null,10,'pcs','ვაჟა-ფშაველას გამზ. 41',null,24,27],
  ['produce','cafe','სეზონური ბოსტნეული კვირაში სამჯერ','ვეძებთ მომწოდებელს კვირაში სამჯერ მიწოდებისთვის: პომიდორი, კიტრი, სალათის ფოთოლი და მწვანილი. კვირაში დაახლოებით 120 კგ. საჭიროა ანგარიშფაქტურა.','food','tbilisi','fresh-produce.jpg',120,'kg',null,null,6,30],
  ['boxes','winery','საჭიროა 800 მუყაოს ყუთი 6 ბოთლზე','ღვინის ბოთლებისთვის გვჭირდება გოფრირებული მუყაოს ყუთები შიდა ტიხრებით, 6 ბოთლი 0.75 ლ. ლოგოს ბეჭდვის პირობები მიუთითეთ ცალკე; შეკვეთამდე გვინდა ნიმუშის ნახვა.','packaging','telavi',null,800,'pcs',null,null,120,8],
  ['website','dental','საჭიროა კლინიკის ვებგვერდი ონლაინ ჩაწერით','გვჭირდება ქართულ-ინგლისური, მობილურზე მორგებული საიტი: ექიმები, მომსახურებები და ვიზიტის დაჯავშნის ფორმა. ფოტოებსა და ტექსტებს მოგაწვდით. შემოგვთავაზეთ სამუშაოების გეგმა.','technology','tbilisi',null,1,'service',null,null,192,14],
  ['shelves','garage','8 ლითონის თარო სათადარიგო ნაწილებისთვის','სახელოსნოს საწყობისთვის გვჭირდება მყარი ლითონის თაროები, თითო სექცია 90 სმ სიგანის და 180 სმ სიმაღლის, 150 კგ-მდე დატვირთვით. აუცილებელია რუსთავში მონტაჟი.','furniture','rustavi',null,8,'pcs','მესხიშვილის ქ. 9',null,3,21],
  ['delivery','shop','12 პალეტის გადაზიდვა თბილისიდან ქუთაისში','საჭიროა 12 პალეტის შეფუთული არასაკვები საქონლის გადაზიდვა დახურული მანქანით. დატვირთვისა და ჩამოტვირთვის საათები წინასწარ შეთანხმდება. მიუთითეთ, რა შედის მომსახურებაში.','logistics','kutaisi',null,12,'pcs',null,null,264,3],
  ['renovation','shop','მაღაზიის 120 კვ.მ კედლების შეღებვა','გვჭირდება კედლების მცირე შეკეთება და ორი ფენა თეთრი საღებავი. სამუშაო უნდა შესრულდეს ეტაპობრივად, მაღაზიის სამუშაო საათების გათვალისწინებით. მასალა ცალკე შეაფასეთ.','construction','kutaisi',null,120,'m2','ასათიანის ქ. 17','2026-10-08',168,6],
  ['napkins','cafe','ვეძებთ სელის სუფრებს და ხელსახოცებს 25 მაგიდაზე','ვეძებთ ღია ფერის სელის ან ბამბის სუფრებს 25 მაგიდისთვის და იმავე ქსოვილის ხელსახოცებს. საჭიროა რეცხვაგამძლე ქსოვილი; ნიმუში შეკვეთამდე.','textiles','tbilisi',null,25,'pcs',null,null,15,11],
  ['weekly','hotel','ბათუმი–თბილისი: 3 პალეტი კვირაში','ყოველ კვირას გვჭირდება 3 პალეტის (თეთრეული, ჰიგიენური საშუალებები) გადატანა თბილისის საწყობიდან ბათუმში. ვეძებთ მუდმივ გადამზიდს ერთი და იმავე დღით.','logistics','batumi',null,3,'pcs',null,null,144,26],
  ['sofas','garage','3 დივანი კლიენტების მოსაცდელში','მოსაცდელისთვის გვჭირდება სამი სამადგილიანი დივანი მუქი, ადვილად მოსავლელი გადასაკრავით (ტყავი ან ეკოტყავი). გვაინტერესებს მზა მოდელებიც და შეკვეთითაც დამზადება.','furniture','rustavi',null,3,'pcs',null,null,480,17],
].map(([key,owner,title,body,category,city,photo,quantity,unit,address,needed,age,left])=>({key,owner,title,body,category,city,photo,quantity,unit,address,needed,age,left}));
// company, request, delivery days, hours after the request was published, text.
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
].map(([company,request,days,after,body])=>({company,request,days,after,body}));
// Earlier QA data created by hand under unknown accounts (§ა): the admin removes it.
const OLD_REQUESTS = ['ლობის ავეჯი: 3 დივანი და ჟურნალის მაგიდა','ყოველკვირეული ტვირთის გადაზიდვა ბათუმი–თბილისი','სასტუმროს თეთრეული 40 ნომრისთვის'];
const OLD_COMPANIES = ['სწრაფი გადაზიდვა','ტექსტილ ჰაუსი','ავეჯის სახელოსნო „ხე“'];
const CHOSEN = {request:'linen', company:'linen'};
for (const r of requests) assert(offers.filter(o=>o.request===r.key).every(o=>o.after<r.age), 'Offer after now: '+r.key);
// A request is re-created when anything the API cannot update changes (owner, photo, text after offers).
const sig=r=>crypto.createHash('sha256').update(JSON.stringify([r.owner,r.title,r.body,r.category,r.city,r.photo,r.quantity,r.unit,r.address,r.needed])).digest('base64url').slice(0,16);
let state, SUFFIX = '';
const stale=r=>!state.v2?.requests?.[r.key] || state.v2.sig?.[r.key]!==sig(r);
function save() {
  if (DRY || VERIFY) return;
  const rows = accounts.filter(a=>state.accounts[a.key]).map(a=>`| ${a.company}${SUFFIX} | ${a.email} | ${state.accounts[a.key].password} | ${a.role} |`).join('\n');
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
  const admin=byKey('admin'), old=await oldData(admin);
  const recreate=requests.filter(stale);
  console.log(JSON.stringify({
    newAccounts:accounts.filter(a=>!state.accounts[a.key]).map(a=>a.key),
    profilesUpdated:accounts.filter(a=>a.role!=='admin').length,
    oldQaRequestsToDelete:old.reqs.length, oldCompaniesToBlock:old.users.filter(u=>!u.blocked).length,
    demoRequestsToDelete:recreate.filter(r=>state.v2?.requests?.[r.key]||state.requests[r.key]?.id).length, requestsToCreate:recreate.map(r=>r.key),
    photos:requests.filter(r=>r.photo).map(r=>r.key), photosToUpload:requests.filter(r=>r.photo&&!state.requests[r.key]?.photo).length,
    owners:Object.fromEntries(accounts.filter(a=>a.role==='client').map(a=>[a.key,requests.filter(r=>r.owner===a.key).length])),
    offers:offers.length, chosen:`${CHOSEN.request}→${CHOSEN.company}`, verified:VERIFIED,
    sql:{requests:requests.length,offers:offers.length,phones:accounts.length},
    offerCounts:Object.fromEntries(requests.map(r=>[r.key,offers.filter(o=>o.request===r.key).length])),
  },null,1));
}
async function seed() {
  for(const a of accounts) {
    state.accounts[a.key]||={password:crypto.randomBytes(24).toString('base64url')+'!a9'};save();
    await login(a);
    const p=await rpc(a,'complete_profile',{p_role:a.role==='admin'?'client':a.role,p_name:a.name,p_company:a.company,p_phone:a.phone,p_city:a.city,p_industry:a.industry||null});
    assert.equal(p.id,a.id);
    if(a.role!=='admin') await rpc(a,'update_my_profile',profileArgs(a));
    console.log('პროფილი მზადაა:',a.key);
  }
  const admin=byKey('admin');
  if((await rpc(admin,'my_profile'))[0].role!=='admin') {
    const rows=await sqlClient()`update public.profiles set role='admin' where id=${admin.id}::uuid and email=${admin.email} and role='client' returning id`;
    assert.equal(rows.length,1,'Admin promotion failed');
  }
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
  const [c1,c2,c3,taken]=await sql.transaction([
    sql`select count(*)::int n from public.requests t join jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int) on t.id=v.id and t.owner_id=v.owner and t.title=v.title`,
    sql`select count(*)::int n from public.offers t join jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid,age int) on t.id=v.id and t.request_id=v.request and t.company_id=v.company`,
    sql`select count(*)::int n from public.profiles t join jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text) on t.id=v.id and t.email=v.email`,
    sql`select count(*)::int n from public.profiles t join jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text) on t.phone=v.phone and t.id<>v.id`,
  ],{readOnly:true});
  assert.deepEqual([c1[0].n,c2[0].n,c3[0].n,taken[0].n],[rq.length,of.length,ph.length,0],'Backdate precheck failed');
  const [u1,u2,u3]=await sql.transaction([
    sql`update public.requests t set created_at=now()-make_interval(hours=>v.age), expires_at=now()+make_interval(days=>v."left")
        from jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int)
        where t.id=v.id and t.owner_id=v.owner and t.title=v.title returning t.id`,
    sql`update public.offers t set created_at=now()-make_interval(hours=>v.age)
        from jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid,age int)
        where t.id=v.id and t.request_id=v.request and t.company_id=v.company returning t.id`,
    sql`update public.profiles t set phone=v.phone
        from jsonb_to_recordset(${JSON.stringify(ph)}::jsonb) v(id uuid,email text,phone text)
        where t.id=v.id and t.email=v.email and t.phone<>v.phone returning t.id`,
  ]);
  assert.equal(u1.length,rq.length);assert.equal(u2.length,of.length);
  console.log('SQL:',JSON.stringify({requests:u1.length,offers:u2.length,phones:u3.length}));
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
  for(const a of accounts.filter(a=>a.role==='client')) {
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
  assert(accounts.filter(a=>a.role==='company').every(a=>listed.some(c=>c.id===a.id)));
  assert.equal((await oldData(byKey('admin'))).reqs.length,0,'Old QA request still present');
  const phones=accounts.map(a=>a.phone);assert.equal(new Set(phones).size,phones.length);
  for(const key of ['hotel',CHOSEN.company]) assert.equal((await rpc(byKey(key),'contact_for_request',{p_request_id:state.v2.requests[CHOSEN.request]})).length,1);
  console.log(JSON.stringify({accounts:accounts.length,companies:accounts.filter(a=>a.role==='company').length,requests:own.length,open:open.length,chosen:1,fresh,owners:Object.fromEntries(accounts.filter(a=>a.role==='client').map(a=>[a.key,own.filter(r=>r.owner_id===a.id).length])),photos:requests.filter(r=>own.find(x=>x.id===state.v2.requests[r.key]).photo_url).map(r=>r.key),offers:offers.length,offerCounts:counts,expiryDays:[...left].sort((a,b)=>a-b),verified:VERIFIED,checks:'passed'}));
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
    await verify();
  } finally {fs.unlinkSync(LOCK);}
}
if(require.main===module) main().catch(err=>{console.error('მონაცემების ოპერაცია შეჩერდა:',err.message);process.exitCode=1;});
