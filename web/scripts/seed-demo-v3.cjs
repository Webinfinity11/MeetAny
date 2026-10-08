#!/usr/bin/env node
// auth-probe only. All marketplace mutations use the local authenticated API.
// The sole SQL mutation backdates this ledger's requests/offers in one transaction.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.DEMO_LEDGER_PATH || '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md';
const LOCK = FILE + '.lock';
const BASE = process.env.DEMO_API_ORIGIN || 'http://localhost:3001';
const UPLOAD = process.env.DEMO_UPLOAD_ORIGIN || BASE;
const DRY = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');
const CLEANUP = process.argv.includes('--cleanup');
const MARKER = 'meetany-demo-cycle-2026-10-08-v3';
const REASON = 'სადემო მონაცემების გასუფთავება';
const STAGES = ['selected','discuss','terms','progress','complete'];
let state, ledgerText, sql;
const sessions = new Map();
const check = (ok, message) => { if (!ok) throw Object.assign(new Error(message), {safe:true}); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const account = key => state.accounts[key];
const id = key => account(key).id;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = async query => (await sql.transaction([query], {readOnly:true}))[0];
const dateAfter = days => new Date(Date.now() + days * 864e5).toISOString().slice(0,10);
const companies = {
  wood: {provide:['furniture'],need:['building_materials'],tags:['ხის ავეჯი','მონტაჟი']},
  linen: {provide:['textiles','laundry'],need:['textiles'],tags:['სასტუმროს თეთრეული','შეკერვა']},
  supply: {provide:['wholesale','packaging','furniture','textiles','equipment','food_fresh','freight'],need:['freight'],tags:['საბითუმო მიწოდება','საწყობი']},
  cleaning: {provide:['cleaning','laundry','textiles'],need:['office_household'],tags:['დასუფთავება','თეთრეულის მოვლა']},
  build: {provide:['renovation','furniture'],need:['building_materials'],tags:['სარემონტო სამუშაოები','სადურგლო სამუშაოები']},
  web: {provide:['software_web'],need:['branding_design'],tags:['ვებგვერდები','მხარდაჭერა']},
  food: {provide:['food_fresh'],need:['freight','packaging'],tags:['ფერმერული პროდუქტი','რეგულარული მიწოდება']},
  port: {provide:['freight'],need:['warehouse'],tags:['პალეტური ტვირთი','გადაზიდვა']},
  code: {provide:['software_web'],need:['branding_design'],tags:['ჯავშნის სისტემები','ონლაინ მაღაზიები']},
  ads: {provide:['branding_design','advertising'],need:['printing'],tags:['ბრენდის დიზაინი','სოციალური ქსელები']},
};
// Deal requests go first: each selection frees one of the owner's five open slots.
// Fields: key, owner, title, description, category, city, quantity, unit, address,
// target stage, suppliers (first = selected), total GEL, delivery days, existing photo key.
const requests = [
  ['reception','hotel','სასტუმროს მისაღებისთვის ხის დახლი', 'მისაღებში გვჭირდება 240 სმ სიგანის დახლი, მარცხენა მხარეს უჯრებით და კაბელების გასატარებელი ჭრილით. სასურველია მუხისფერი ზედაპირი; ადგილზე აზომვა აუცილებელია.', 'furniture','batumi',1,'pcs','გორგილაძის ქ. 31','selected',['wood','supply','build'],2800,18,null],
  ['menu','cafe','კაფის მენიუს გვერდი QR კოდით', 'გვინდა ქართულ-ინგლისური მენიუ, რომელსაც ტელეფონით მარტივად შეცვლით ჩვენი თანამშრომელი. საჭიროა კერძების ფოტოები, ალერგენები და მაგიდებზე დასადები QR კოდის ფაილი.', 'software_web','tbilisi',1,'service','ვაჟა-ფშაველას გამზ. 41','selected',['web','code'],850,7,null],
  ['display','shop','მაღაზიისთვის ოთხი ხის საგამოფენო სტენდი', 'ადგილობრივი ნაწარმის გამოსაფენად გვჭირდება ოთხი მოძრავი სტენდი, თითოეული 120 სმ სიგანის. ბორბლებს უნდა ჰქონდეს მუხრუჭი. ფერსა და თაროებს ნიმუშის ნახვის შემდეგ შევათანხმებთ.', 'furniture','kutaisi',4,'pcs','ასათიანის ქ. 17','discuss',['wood','build','supply'],2400,14,null],
  ['bottles','winery','ღვინის 600 ბოთლის გადაზიდვა თელავიდან თბილისში', 'ბოთლები უკვე ყუთებშია, ჯამში სამი პალეტი. გვჭირდება დახურული მანქანა და ტვირთის დამაგრება. თბილისის საწყობში მიღება შესაძლებელია დილის 9-დან 12 საათამდე.', 'freight','telavi',3,'pcs','ერეკლე II-ის გამზ. 21','discuss',['port','supply'],680,3,null],
  ['waiting','dental','კლინიკის მოსაცდელში რვა სკამი', 'ვეძებთ რვა სკამს ადვილად გასაწმენდი რბილი დასაჯდომით. ფერი ღია ნაცრისფერი, ფეხები ლითონის. სასურველია ერთი ნიმუშის ადგილზე მოტანა, რომ არსებულ ინტერიერს შევადაროთ.', 'furniture','tbilisi',8,'pcs','ალ. ყაზბეგის გამზ. 24','terms',['supply','wood','build'],1680,6,null],
  ['cabinets','garage','სახელოსნოსთვის სამი დახურული კარადა', 'საჭიროა სამი გამძლე კარადა ხელსაწყოებისთვის, თითოეული 180 სმ სიმაღლის და საკეტით. შიდა თაროების სიმაღლე უნდა იცვლებოდეს. მოგვაწოდეთ ფასი რუსთავში მიტანით.', 'furniture','rustavi',3,'pcs','მესხიშვილის ქ. 9','terms',['wood','build','supply'],2100,12,null],
  ['towels','hotel','სასტუმროსთვის 120 თეთრი პირსახოცი', 'შევიძენთ 70×140 სმ ზომის 120 პირსახოცს, მინიმუმ 500 გ/კვ.მ სიმკვრივით. სასტუმროს სახელის ამოქარგვა არ გვჭირდება. შეფუთვა ათ-ათ ცალად, ბათუმში მიწოდებით.', 'textiles','batumi',120,'pcs','გორგილაძის ქ. 31','progress',['linen','supply','cleaning'],2640,10,'linen'],
  ['shelves','shop','ექვსი თარო ახალი სავაჭრო კუთხისთვის', 'ახალი კუთხისთვის გვჭირდება ექვსი ღია თარო, 90×180 სმ ზომით. ქვედა ნაწილი დახურული უნდა იყოს. ზედაპირი ღია ხისფერი; მიტანასა და მონტაჟს ერთ დღეს ვგეგმავთ.', 'furniture','kutaisi',6,'pcs','ასათიანის ქ. 17','progress',['build','wood','supply'],3300,16,null],
  ['vegetables','cafe','კაფისთვის ბოსტნეულის პირველი კვირის შეკვეთა', 'კვირის განმავლობაში გვჭირდება ჯამში 90 კგ სეზონური ბოსტნეული: პომიდორი, კიტრი, სტაფილო და მწვანილი. მიტანა სამ ნაწილად, დილის 8 საათამდე. აუცილებელია ანგარიშფაქტურა.', 'food_fresh','tbilisi',90,'kg','ვაჟა-ფშაველას გამზ. 41','complete',['food','supply'],540,3,'produce'],
  ['booking','dental','კლინიკის ჩაწერის ფორმის გამართვა', 'არსებულ საიტზე გვინდა ვიზიტის მოთხოვნის ფორმა: მომსახურება, სასურველი დრო და საკონტაქტო ნომერი. ადმინისტრატორმა მოთხოვნა ელფოსტაზე უნდა მიიღოს. საჭიროა ტელეფონებზე შემოწმება.', 'software_web','tbilisi',1,'service','ალ. ყაზბეგის გამზ. 24','complete',['code','web'],720,5,null],
  ['curtain','hotel','ექვსი ნომრისთვის დამაბნელებელი ფარდები', 'ექვს ნომერში ვცვლით ფარდებს. თითო ფანჯრის სიგანეა 180 სმ, სიმაღლე 260 სმ. გვინდა ქვიშისფერი ქსოვილი, არსებული კარნიზებისთვის. შეთავაზებაში აზომვაც გაითვალისწინეთ.', 'textiles','batumi',6,'pcs','გორგილაძის ქ. 31',null,['linen','supply'],1800,12,null],
  ['laundry','hotel','სასტუმროს 80 კომპლექტი თეთრეულის რეცხვა', 'ვეძებთ თეთრეულის რეცხვის მომსახურებას, სასტუმროდან გატანითა და დაბრუნებით. პირველი პარტია 80 კომპლექტია. მნიშვნელოვანია ცალკე რეცხვა, დაუთოება და დათვლილი შეფუთვა.', 'laundry','batumi',80,'pcs','გორგილაძის ქ. 31',null,['cleaning','linen'],480,2,null],
  ['tables','cafe','ტერასაზე დასადგმელი ექვსი პატარა მაგიდა', 'გვჭირდება ექვსი მრგვალი მაგიდა, 60 სმ დიამეტრით. ტერასა გადახურულია, თუმცა ავეჯი ტენს უნდა უძლებდეს. მაინტერესებს მუქი მწვანე ფეხისა და ხის ზედაპირის კომბინაცია.', 'furniture','tbilisi',6,'pcs','ვაჟა-ფშაველას გამზ. 41',null,['wood','supply','build'],1920,15,null],
  ['cargo','shop','მაღაზიის მარაგის გადატანა ზუგდიდის ფილიალში', 'ქუთაისიდან ზუგდიდში გადასატანია ოთხი პალეტი შეფუთული ჭურჭელი. საჭიროა დახურული მანქანა, ფრთხილი დატვირთვა და მიმღებთან საათის წინასწარ შეთანხმება.', 'freight','zugdidi',4,'pcs','ზუგდიდი, რუსთაველის ქ. 18',null,['port','supply'],520,2,'delivery'],
  ['tasting','winery','სადეგუსტაციო სივრცის რვა მაგიდა', 'მარანში ვაწყობთ სადეგუსტაციო სივრცეს. გვჭირდება რვა მასიური ხის მაგიდა, თითო ექვს სტუმარზე. გთხოვთ მიუთითოთ ხის სახეობა, დამცავი საფარი და თელავში მონტაჟის პირობები.', 'furniture','telavi',8,'pcs','ერეკლე II-ის გამზ. 21',null,['wood','build','supply'],6400,24,null],
  ['winepage','winery','მარნის საიტი ღვინოების კატალოგით', 'გვინდა მოკლე ქართულ-ინგლისური საიტი: მარნის ისტორია, ექვსი ღვინო, სტუმრობის დაჯავშნის მოთხოვნა და რუკა. ონლაინ გადახდა ამ ეტაპზე არ გვჭირდება. ტექსტსა და ფოტოებს მოგაწვდით.', 'software_web','telavi',1,'service','ერეკლე II-ის გამზ. 21',null,['web','code'],1900,18,null],
  ['workbench','garage','სახელოსნოსთვის ორი სამუშაო მაგიდა', 'გვჭირდება ორი სამუშაო მაგიდა, 180×70 სმ ზომით, მყარი ზედაპირითა და ქვედა თაროთი. მაგიდები კედელთან დადგება. გთხოვთ ფასში ჩასვათ რუსთავში მიტანა და აწყობა.', 'furniture','rustavi',2,'pcs','მესხიშვილის ქ. 9',null,['build','wood','supply'],1560,10,null],
  ['labels','winery','ღვინის ახალი პარტიის ეტიკეტის დიზაინი', 'სამი ღვინისთვის გვჭირდება ერთიანი ეტიკეტის დიზაინი და საბეჭდი ფაილები. მარნის ლოგო მზად გვაქვს. პირველ ეტაპზე გვინდა ორი მიმართულების ნახვა და შერჩეულის დამუშავება.', 'branding_design','telavi',3,'service','ერეკლე II-ის გამზ. 21',null,[],null,null,null],
  ['floor','garage','ავტოსერვისის იატაკის საფარის განახლება', 'რუსთავის სახელოსნოში 85 კვ.მ ბეტონის იატაკს სჭირდება მომზადება და ზეთგამძლე საფარი. გვაინტერესებს რამდენ ხანს დაიკეტება სამუშაო ზონა და რა მოვლა დასჭირდება.', 'renovation','rustavi',85,'m2','მესხიშვილის ქ. 9',null,[],null,null,null],
  ['office','dental','გორის ახალი კაბინეტის დასუფთავება გახსნამდე', 'გორში ვხსნით პატარა კაბინეტს და რემონტის შემდეგ გვჭირდება 75 კვ.მ სივრცის დასუფთავება, ფანჯრებისა და ჩაშენებული კარადების ჩათვლით. ინვენტარი შემსრულებელმა უნდა მოიტანოს.', 'cleaning','gori',75,'m2','გორი, ჭავჭავაძის ქ. 22',null,[],null,null,null],
].map(([key,owner,title,body,category,city,quantity,unit,address,stage,suppliers,price,days,photo],i)=>({key,owner,title,body,category,city,quantity,unit,address,stage,suppliers,price,days,photo,age:stage?72+i*20:4+(i-10)*9,left:7+i}));
const chats = {
  display:['შეგვიძლია ქვედა თარო 40 სმ სიმაღლეზე ავწიოთ? დიდი ქილებიც უნდა დავაწყოთ.','კი, თაროს ამ სიმაღლეზე დავაყენებთ. ბორბლების ჩათვლით საერთო სიმაღლე 150 სმ გამოვა.','კარგია. ჯერ ერთი სტენდის ესკიზი გამოგვიგზავნეთ და დანარჩენებს იმის მიხედვით შევათანხმებთ.'],
  bottles:['საწყობში ჩატვირთვა დილის ათზე შეგვიძლია. პალეტები შეფუთულია, დამატებითი ფირი საჭიროა?','ფირსა და დამჭერ ქამრებს წამოვიღებთ. დატვირთვის ადგილზე ამწე გყავთ?','დიახ, ამწე ადგილზეა. თბილისის მიმღების ნომერს გამოგიგზავნით, რომ დრო შეუთანხმოთ.'],
  waiting:['ფასში რვავე სკამის მიტანა შედის? ლიფტი გვაქვს, კლინიკა მეორე სართულზეა.','დიახ, მიტანა და სართულზე ატანა შედის. პირობებში ავანსი 30 პროცენტია, დარჩენილი თანხა მიღებისას.','პირობები ვნახე და ჩემი მხრიდან ვადასტურებ. ნიმუშის ფერს დღესვე შეგითანხმებთ.'],
  cabinets:['შეგვიძლია სამივე კარადას ერთნაირი საკეტი ჰქონდეს?','დიახ, ერთ გასაღებზე მოვარგებთ. ზომები და ფასი პირობებში ჩავწერე.','ჩემი მხრიდან პირობები დადასტურებულია. სახელოსნოში მიღება საღამოს ექვსამდე შეგვიძლია.'],
  towels:['ნიმუში მივიღეთ, ქსოვილის სისქე მისაღებია. 120 ცალს ვადასტურებთ.','შეკვეთა წარმოებაშია. თითო შეკვრაში ათი პირსახოცი იქნება, როგორც შევთანხმდით.','მიღების დღეს წინასწარ შეგვატყობინეთ, საწყობთან ადგილს გაგითავისუფლებთ.'],
  shelves:['ზომები გადავამოწმეთ, ექვსივე თარო ეტევა. სამუშაო დავიწყოთ.','მასალა უკვე სახელოსნოშია. აწყობის შემდეგ ფოტოს გამოგიგზავნით და მონტაჟის დროს შევათანხმებთ.','მონტაჟი დილის საათებში აჯობებს, მაღაზია თერთმეტზე იხსნება.'],
  vegetables:['დღევანდელი პარტია მივიღეთ, რაოდენობაც ემთხვევა. მწვანილი ცალკე შეფუთეთ შემდეგ ჯერზე.','აუცილებლად. მწვანილს ცალკე ყუთში ჩავაწყობთ. კვირის ანგარიშფაქტურას დღეს გამოგიგზავნით.','სამივე მიწოდება დასრულებულია. ხარისხით კმაყოფილი ვართ, შემდეგი კვირის რაოდენობას ხვალ მოგწერთ.'],
  booking:['ფორმა ტელეფონზე შევამოწმეთ, მოთხოვნა ელფოსტაზეც მოვიდა. ნომრის ველი სავალდებულო დავტოვოთ.','ნომერი უკვე სავალდებულოა. შეცდომის ტექსტიც ქართულად ჩანს და ორმაგი გაგზავნა დაბლოკილია.','ახლა ყველაფერი მუშაობს. ადმინისტრატორსაც ვაჩვენეთ, სამუშაოს ვიბარებთ.'],
};
const reviews = {vegetables:'სამივე პარტია დათქმულ დროს მივიღეთ. ბოსტნეული ახალი იყო, რაოდენობა ზუსტი და ანგარიშფაქტურაც დროულად გამოგვიგზავნეს.',booking:'ჩაწერის ფორმა სწრაფად გამართეს. ტელეფონზეც მოსახერხებელია, ადმინისტრატორს მოთხოვნები აღარ ეკარგება. ცვლილებებზე დროულად გვპასუხობდნენ.'};
const payment = '30% ავანსი, დარჩენილი 70% მიღება-ჩაბარების შემდეგ';
const includes = r => r.category==='software_web' ? ['ტელეფონებზე შემოწმება','თანამშრომლისთვის გამოყენების ახსნა','ერთი თვის მხარდაჭერა'] : ['მისამართზე მიწოდება','შეფუთვა და უსაფრთხო გადატანა','მიღებისას რაოდენობის შემოწმება'];
function offer(r,key,index) {
  const lead = {
    wood:'შეკვეთით დავამზადებთ, ზომებს დაწყებამდე ადგილზე გადავამოწმებთ.',
    build:'ჩვენი სახელოსნო სამუშაოს შეთანხმებული ზომებით შეასრულებს. მონტაჟსაც ჩვენი გუნდი მოაგვარებს.',
    supply:r.category==='freight'?'ტვირთს ჩვენი დახურული მანქანით გადავიტანთ. დატვირთვის დროს წინასწარ შეგითანხმებთ.':r.category==='food_fresh'?'საწყობიდან შერჩეულ პროდუქტს სამ პარტიად მოგაწვდით. ანგარიშფაქტურა თითო მიწოდებას მოჰყვება.':'შეგვიძლია საწყობიდან მოგაწოდოთ. შეკვეთამდე მოდელსა და ფერს ფოტოებით შეგითანხმებთ.',
    linen:r.category==='laundry'?'თეთრეულს გავრეცხავთ და დავაუთოებთ, შეფუთულს და დათვლილს დაგიბრუნებთ.':'მოგაწვდით შეთანხმებული ზომითა და ქსოვილით. საბოლოო შეკვეთამდე ნიმუშს გაჩვენებთ.',
    cleaning:r.category==='laundry'?'თეთრეულს თავად წავიღებთ, გავრეცხავთ და შეფუთულს დაგიბრუნებთ.':'სასტუმროსთვის თეთრეულისა და პირსახოცების მიწოდებასაც ვასრულებთ. ნიმუშის ნახვა შეკვეთამდე შეგიძლიათ.',
    food:'პროდუქტს მეურნეობებიდან შევაგროვებთ. სამივე მიწოდებას დილის რვამდე მოვასწრებთ, მწვანილს ცალკე შევფუთავთ.',
    port:'ტვირთს დახურული მანქანით გადავიტანთ. დამჭერი ქამრები და დამცავი ფირი ფასში შედის.',
    web:'ჯერ გვერდების განლაგებას გაჩვენებთ, შემდეგ გამართულ ვერსიას. შინაარსის შეცვლას თქვენს თანამშრომელს ავუხსნით.',
    code:'ფორმებსა და შინაარსის მართვას მოთხოვნის მიხედვით გავმართავთ. ჩაბარებამდე ტელეფონებსა და კომპიუტერზე ერთად შევამოწმებთ.',
  }[key];
  return {body:`${lead} ${r.quantity} ${r.unit==='pcs'?'ერთეულის':r.unit==='kg'?'კილოგრამის':'მომსახურების'} სრული ფასი მოცემულია შეთავაზებაში.`,price:Math.round(r.price*(1+index*0.09)),days:r.days+index*2};
}
function save() {
  check(!DRY && !VERIFY,'წაკითხვის რეჟიმში ledger-ის ცვლილება აკრძალულია');
  const next = ledgerText.replace(/```json\r?\n[\s\S]*?\r?\n```/, () => '```json\n'+JSON.stringify(state,null,2)+'\n```');
  // Atomic replacement preserves the human-readable credentials and every older ledger section.
  const tmp = FILE + '.v3.tmp';
  const fd = fs.openSync(tmp,'wx',0o600);
  try { fs.writeFileSync(fd,next); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp,FILE); ledgerText=next;
}
async function json(url,options={}) {
  let response;
  try { response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(45000)}); }
  catch { check(false,'კავშირი ვერ შესრულდა; გადაამოწმეთ ლოკალური API და Auth'); }
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw Object.assign(new Error(`მოთხოვნა შეჩერდა: HTTP ${response.status}${/^MA\d+$/.test(data?.code)?' '+data.code:''}`),{safe:true,status:response.status});
  return {data,response};
}
async function login(key) {
  if(sessions.has(key)) return sessions.get(key);
  const a=account(key),jar=new Map();
  async function auth(route,body,attempt=0) {
    let out;
    try { out=await json(process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined}); }
    catch(error) {
      if(error.status!==429 || attempt>=8) throw error;
      // Same bounded Auth throttling recovery as v2; never retry marketplace writes.
      await new Promise(resolve=>setTimeout(resolve,30000));
      return auth(route,body,attempt+1);
    }
    for(const cookie of out.response.headers.getSetCookie()) { const pair=cookie.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1)); }
    return out.data;
  }
  await auth('/sign-in/email',{email:key==='owner_admin'?a.email:`demo-${key}@meetany.ge`,password:a.password});
  const token=(await auth('/token')).token;
  check(typeof token==='string','Auth-ის ტოკენი ვერ მივიღეთ');
  check(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub===a.id,'ანგარიშის იდენტობა არ ემთხვევა ledger-ს');
  sessions.set(key,token);
  return token;
}
async function rpc(key,name,args={}) {
  check(!DRY && !VERIFY,'ამ რეჟიმში API მუტაცია აკრძალულია');
  return (await json(BASE+'/api/db/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await login(key)},body:JSON.stringify(args)})).data;
}
async function authenticate() {
  // Compare the local API's profiles with this explicitly pinned database before the first mutation.
  for(const key of [...new Set(requests.map(r=>r.owner)),...Object.keys(companies),'owner_admin']) {
    const token=await login(key);
    const data=(await json(BASE+'/api/db/rpc/my_profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'})).data;
    const profile=Array.isArray(data)?data[0]:data;
    check(profile?.id===id(key) && profile?.role===(key==='owner_admin'?'admin':companies[key]?'company':'client'),'ლოკალური API-ის პროფილი არ ემთხვევა გეგმას');
  }
}
async function snapshot() {
  const ids=[...new Set(requests.map(r=>id(r.owner))),...Object.keys(companies).map(id),id('owner_admin')];
  const [profiles,rows,offers,deals,messages]=await sql.transaction([
    sql`select * from public.profiles where id=any(${ids}::uuid[])`,
    sql`select r.*,meetany_private.request_state(r) flow_state from public.requests r where owner_id=any(${ids}::uuid[])`,
    sql`select o.* from public.offers o join public.requests r on r.id=o.request_id where r.owner_id=any(${ids}::uuid[])`,
    sql`select d.* from meetany_private.deals d where buyer_id=any(${ids}::uuid[])`,
    sql`select m.*,c.request_id,c.company_id,c.client_id from meetany_private.messages m join meetany_private.conversations c on c.id=m.conversation_id where c.client_id=any(${ids}::uuid[]) and c.request_id is not null`,
  ],{readOnly:true});
  return {profiles,rows,offers,deals,messages};
}
function record(r) { return state.v3?.requests?.[r.key]; }
function identity(r,row) { check(row && row.owner_id===id(r.owner) && row.title===r.title && row.body===r.body && row.category===r.category && row.city===r.city && Number(row.quantity)===r.quantity && row.unit===r.unit,'მოთხოვნის იდენტობა შეიცვალა; ოპერაცია შეჩერებულია'); }
function photo(r) {
  if(!r.photo) return null;
  const url=state.requests?.[r.photo]?.photo;
  check(url,'გეგმაში გამოყენებული ატვირთული ფოტო ledger-ში არ არის');
  const parsed=new URL(url);
  check(parsed.protocol==='https:' && parsed.pathname.startsWith('/'+id(r.owner)+'/'),'ფოტო მოთხოვნის მფლობელს არ ეკუთვნის');
  return url;
}
async function preflight(snap) {
  for(const key of [...new Set(requests.map(r=>r.owner)),...Object.keys(companies),'owner_admin']) {
    const p=snap.profiles.find(p=>p.id===id(key));
    check(p && !p.blocked && p.role===(key==='owner_admin'?'admin':companies[key]?'company':'client'),'აუცილებელი პროფილი არ არსებობს ან დაბლოკილია');
    check(p.email===(key==='owner_admin'?'admin@gmail.com':`demo-${key}@meetany.ge`),'პროფილის ელფოსტა ledger-ს არ შეესაბამება');
  }
  if(state.v3) {
    check(state.v3.marker===MARKER && state.v3.signature===digest(requests),'v3 ledger ან გეგმა შეიცვალა');
    check(Object.keys(state.v3.requests).every(k=>requests.some(r=>r.key===k)),'ledger-ში უცნობი მოთხოვნაა');
  }
  for(const r of requests) {
    const rec=record(r),row=snap.rows.find(x=>x.id===rec?.id);
    if(rec?.id) identity(r,row);
    else {
      const found=snap.rows.filter(x=>x.owner_id===id(r.owner)&&x.title===r.title);
      check(found.length===0 || (rec?.pending && found.length===1),'მსგავსი მოთხოვნა v3-ის გარეთ უკვე არსებობს');
      if(found.length) identity(r,found[0]);
    }
    if(!CLEANUP && !VERIFY && r.photo) {
      const url=photo(r);
      const [valid]=await read(sql`select meetany_private.valid_photo_url(${url},${id(r.owner)}::uuid) valid,meetany_private.photo_origin() origin`);
      check(valid.valid && new URL(url).origin.toLowerCase()===valid.origin,'ფოტო auth-probe-ის Blob საცავს არ შეესაბამება');
      const response=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});
      check(response.ok && response.headers.get('content-type')?.startsWith('image/'),'არსებული ფოტო ხელმისაწვდომი არ არის');
    }
    for(const [key,o] of Object.entries(rec?.offers||{})) {
      check(r.suppliers.includes(key) && uuid(o.id),'ledger-ში უცნობი შეთავაზებაა');
      const actual=snap.offers.find(x=>x.id===o.id);
      check(((CLEANUP || state.v3?.cleanupStarted) && !actual) || (actual?.request_id===rec.id && actual?.company_id===id(key)),'შეთავაზების იდენტობა შეიცვალა');
    }
    if(rec?.deal) {
      const d=snap.deals.find(d=>d.id===rec.deal);
      check(d?.request_id===rec.id && d.buyer_id===id(r.owner) && d.supplier_id===id(r.suppliers[0]),'გარიგების იდენტობა შეიცვალა');
    }
  }
  if(!CLEANUP && !VERIFY) {
    check(!state.v3?.cleanupStarted,'cleanup დაწყებულია; ეს ნაკრები ხელახლა არ გააქტიურდება');
    const open=new Map([...new Set(requests.map(r=>r.owner))].map(k=>[k,snap.rows.filter(x=>x.owner_id===id(k)&&x.flow_state==='open').length]));
    for(const r of requests) {
      const row=snap.rows.find(x=>x.id===record(r)?.id || (record(r)?.pending && x.owner_id===id(r.owner)&&x.title===r.title));
      if(!row) { check(open.get(r.owner)<5,'კლიენტს ხუთი ღია მოთხოვნა აქვს; არსებულ მოთხოვნებს სკრიპტი არ ცვლის');open.set(r.owner,open.get(r.owner)+1); }
      if(r.stage && (!row || row.flow_state==='open')) open.set(r.owner,open.get(r.owner)-1);
      if(row) check(!row.hidden,'v3 მოთხოვნა დამალულია; ავტომატური აღდგენა აკრძალულია');
    }
  }
}
function printPlan(snap) {
  const tracked=requests.map(r=>({r,rec:record(r),row:snap.rows.find(x=>x.id===record(r)?.id || (record(r)?.pending && x.owner_id===id(r.owner)&&x.title===r.title))})).filter(x=>x.rec && x.row);
  const stageCounts=Object.fromEntries(STAGES.map(s=>[s,requests.filter(r=>r.stage===s).length]));
  const profiles=snap.profiles.filter(p=>Object.keys(companies).some(k=>id(k)===p.id));
  const cleanupPlan=CLEANUP?{
    დასამალიმოთხოვნები:tracked.filter(x=>!x.row.hidden).length,
    გასაუქმებელიგარიგებები:tracked.filter(x=>['selected','discuss','terms'].includes(snap.deals.find(d=>d.request_id===x.row.id)?.stage)).length,
    წასაშლელიშეთავაზებები:tracked.reduce((n,{rec,row})=>n+snap.offers.filter(o=>o.request_id===row.id && o.status!=='chosen' && !snap.deals.some(d=>d.offer_id===o.id) && (Object.values(rec.offers).some(x=>x.id===o.id)||Object.keys(rec.offerIntents||{}).some(k=>id(k)===o.company_id))).length,0),
    შენიშვნა:'progress/complete და ჩატები მონაწილეებისთვის რჩება; საჯარო მოთხოვნები იმალება',
  }:{};
  console.log(JSON.stringify({რეჟიმი:CLEANUP?'გასუფთავების გეგმა':'შექმნის გეგმა',მარკერი:MARKER,ახალიანგარიშები:0,კლიენტები:6,გამოყენებულიკომპანიები:10,მოთხოვნები:20,შესაქმნელიმოთხოვნები:20-tracked.length,შეთავაზებები:requests.reduce((n,r)=>n+r.suppliers.length,0),შეთავაზებისგარეშე:3,ეტაპები:stageCounts,შეფასებები:2,შეტყობინებები:Object.values(chats).reduce((n,a)=>n+a.length,0),არსებულიფოტოები:requests.filter(r=>r.photo).length,matchingშესავსები:profiles.filter(p=>!p.provide_categories.length||!p.need_categories.length).length,...cleanupPlan,ჩაწერა:false},null,2));
}
async function fillProfiles(snap) {
  for(const [key,config] of Object.entries(companies)) {
    const p=snap.profiles.find(p=>p.id===id(key));
    // send_offer refuses unverified companies (MA801); demo suppliers are approved by the admin.
    if(!p.verified) await rpc('owner_admin','admin_set_verified',{p_user_id:p.id,p_verified:true});
    if(!p.provide_categories.length || !p.need_categories.length) await rpc(key,'set_matching_categories',{p_provide:p.provide_categories.length?p.provide_categories:config.provide,p_need:p.need_categories.length?p.need_categories:config.need});
    // The RPC replaces all fields: preserve existing values, including private legal details.
    const args={p_account_intent:p.account_intent,p_employee_band:p.employee_band||'8-50',p_founded_year:p.founded_year,p_markets:p.markets.length?p.markets:['საქართველო'],p_languages:p.languages.length?p.languages:['ქართული'],p_legal_name:p.legal_name,p_registration_code:p.registration_code,p_legal_form:p.legal_form,p_contact_position:p.contact_position||'შეკვეთების მენეჯერი',p_website:p.website,p_business_tags:p.business_tags.length?p.business_tags:config.tags,p_certificates:p.certificates};
    if(Object.entries(args).some(([k,v])=>JSON.stringify(p[k.slice(2)])!==JSON.stringify(v))) await rpc(key,'set_onboarding_details',args);
    state.v3.profiles[key]={id:p.id,filled:true};save();
  }
}
async function seedRequest(r,snap) {
  let rec=record(r);
  if(!rec) {rec=state.v3.requests[r.key]={pending:true,offers:{},messages:[]};save();}
  if(!rec.id) {
    // A durable intent is written BEFORE create_request. A crash after HTTP success can
    // recover exactly this owner's title; preflight refuses any unjournaled collision.
    const found=await read(sql`select * from public.requests where owner_id=${id(r.owner)}::uuid and title=${r.title}`);
    check(found.length<=1,'აღდგენისას რამდენიმე ერთნაირი მოთხოვნა აღმოჩნდა');
    const row=found[0]||await rpc(r.owner,'create_request',{p_title:r.title,p_body:r.body,p_category:r.category,p_city:r.city,p_photo_url:photo(r),p_quantity:r.quantity,p_unit:r.unit,p_needed_by:null,p_address_note:r.address});
    identity(r,row);rec.id=row.id;rec.pending=false;save();
  }
  for(const [i,key] of r.suppliers.entries()) {
    const expected=offer(r,key,i);
    let rows=await read(sql`select * from public.offers where request_id=${rec.id}::uuid and company_id=${id(key)}::uuid`);
    let row=rows[0];
    rec.offerIntents||={};rec.offerIntents[key]=true;save();
    if(!row) row=await rpc(key,'send_offer',{p_request_id:rec.id,p_body:expected.body,p_price:expected.price,p_price_type:'total',p_vat_included:true,p_delivery_days:expected.days,p_delivery_included:true});
    check(row.body===expected.body && Number(row.price)===expected.price,'შეთავაზება შეცვლილია; ავტომატური გადაწერა შეჩერებულია');
    rec.offers[key]||={id:row.id};save();
    if(!row.payment_terms || !row.valid_until || !row.commercial_terms.length) {
      row=await rpc(key,'set_offer_terms',{p_offer_id:row.id,p_payment_terms:payment,p_valid_until:dateAfter(35),p_commercial_terms:includes(r),p_expected_updated_at:row.updated_at});
    }
    rec.offers[key].terms=true;save();
  }
  if(r.stage) await seedDeal(r,rec);
}
async function seedDeal(r,rec) {
  const supplier=r.suppliers[0];
  let d=(await read(sql`select * from meetany_private.deals where request_id=${rec.id}::uuid`))[0];
  if(!d) {
    // Text keeps the microseconds; a JS Date would round them and trip MA904.
    const o=(await read(sql`select id,updated_at::text updated_at from public.offers where id=${rec.offers[supplier].id}::uuid`))[0];
    d=await rpc(r.owner,'select_offer_deal',{p_offer_id:o.id,p_expected_updated_at:o.updated_at});
  }
  check(d.offer_id===rec.offers[supplier].id && d.stage!=='cancelled','გარიგება დაგეგმილ შეთავაზებას ან ეტაპს არ შეესაბამება');
  check(STAGES.indexOf(d.stage)<=STAGES.indexOf(r.stage),'გარიგება უკვე დაგეგმილ ეტაპს გასცდა');
  rec.deal=d.id;save();
  const advance=async stage=>{d=await rpc(r.owner,'advance_deal',{p_deal_id:d.id,p_stage:stage,p_expected_revision:d.revision});};
  if(r.stage!=='selected' && d.stage==='selected') await advance('discuss');
  if(chats[r.key]) {
    const c=await rpc(r.owner,'start_conversation',{p_company_id:id(supplier),p_request_id:rec.id});
    rec.conversation=c.id;save();
    for(const [i,body] of chats[r.key].entries()) {
      const sender=i%2?supplier:r.owner;
      const existing=await read(sql`select * from meetany_private.messages where conversation_id=${c.id}::uuid and sender_id=${id(sender)}::uuid and body=${body}`);
      check(existing.length<=1,'ჩატში განმეორებული შეტყობინება აღმოჩნდა');
      // send_message allows one message per sender and conversation every 2 seconds (MA506).
      if(!existing[0]) await new Promise(done=>setTimeout(done,2200));
      const m=existing[0]||await rpc(sender,'send_message',{p_conversation_id:c.id,p_body:body});
      rec.messages[i]={id:m.id,sender:id(sender),bodyHash:digest(body)};save();
    }
  }
  if(STAGES.indexOf(r.stage)>=2 && d.stage==='discuss') d=await rpc(supplier,'propose_deal_terms',{p_deal_id:d.id,p_expected_revision:d.revision,p_total_price:r.price,p_quantity:r.quantity,p_unit:r.unit,p_delivery_days:r.days,p_delivery_date:null,p_delivery_place:r.address,p_payment_terms:payment,p_includes:includes(r)});
  if(d.stage==='terms') {
    if(!d.buyer_confirmed_at) d=await rpc(r.owner,'confirm_deal_terms',{p_deal_id:d.id,p_expected_revision:d.revision});
    if(STAGES.indexOf(r.stage)>=3) {
      if(!d.supplier_confirmed_at) d=await rpc(supplier,'confirm_deal_terms',{p_deal_id:d.id,p_expected_revision:d.revision});
      await advance('progress');
    }
  }
  if(r.stage==='complete' && d.stage==='progress') await advance('complete');
  if(r.stage==='complete' && d.rating===null) await rpc(r.owner,'rate_deal',{p_deal_id:d.id,p_rating:5,p_review:reviews[r.key],p_expected_revision:d.revision});
}
async function backdate() {
  if(state.v3.dated) return;
  const rq=requests.map(r=>({id:record(r).id,owner:id(r.owner),title:r.title,age:r.age,left:r.left}));
  const of=requests.flatMap(r=>r.suppliers.map((key,i)=>({id:record(r).offers[key].id,request:record(r).id,company:id(key),age:r.age-i-1})));
  const [beforeR,beforeO]=await sql.transaction([
    sql`select count(*)::int n from public.requests t join jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text) on t.id=v.id and t.owner_id=v.owner and t.title=v.title`,
    sql`select count(*)::int n from public.offers t join jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid) on t.id=v.id and t.request_id=v.request and t.company_id=v.company`,
  ],{readOnly:true});
  check(beforeR[0].n===rq.length && beforeO[0].n===of.length,'თარიღების განახლების წინ იდენტობა ვერ დადასტურდა');
  const [a,b]=await sql.transaction([
    sql`update public.requests t set created_at=now()-make_interval(hours=>v.age),expires_at=now()+make_interval(days=>v."left") from jsonb_to_recordset(${JSON.stringify(rq)}::jsonb) v(id uuid,owner uuid,title text,age int,"left" int) where t.id=v.id and t.owner_id=v.owner and t.title=v.title returning t.id`,
    sql`update public.offers t set created_at=now()-make_interval(hours=>v.age) from jsonb_to_recordset(${JSON.stringify(of)}::jsonb) v(id uuid,request uuid,company uuid,age int) where t.id=v.id and t.request_id=v.request and t.company_id=v.company returning t.id`,
  ]);
  check(a.length===rq.length && b.length===of.length,'თარიღების განახლების რაოდენობა არ ემთხვევა გეგმას');
  state.v3.dated=true;save();
}
async function cleanup(snap) {
  if(!state.v3) { console.log('v3 ჩანაწერები არ არსებობს; ცვლილება არ შესრულდა.');return; }
  state.v3.cleanupStarted=true;save();
  for(const r of requests) {
    const rec=record(r);if(!rec) continue;
    // Recover an interrupted create before hiding; only a previously journaled intent is eligible.
    if(!rec.id && rec.pending) {
      const rows=snap.rows.filter(x=>x.owner_id===id(r.owner)&&x.title===r.title);
      if(!rows.length) continue;
      check(rows.length===1,'აღდგენისას მოთხოვნა არაერთმნიშვნელოვანია');identity(r,rows[0]);rec.id=rows[0].id;rec.pending=false;save();
    }
    if(!rec.id) continue;
    for(const key of Object.keys(rec.offerIntents||{})) {
      check(r.suppliers.includes(key),'ledger-ში უცნობი შეთავაზების განზრახვაა');
      const o=snap.offers.find(o=>o.request_id===rec.id && o.company_id===id(key));
      if(o && !rec.offers[key]) {rec.offers[key]={id:o.id};save();}
    }
    const d=snap.deals.find(d=>d.request_id===rec.id);
    if(d) {
      check(d.buyer_id===id(r.owner) && d.offer_id===rec.offers[r.suppliers[0]]?.id,'გასასუფთავებელი გარიგების იდენტობა არ ემთხვევა ledger-ს');
      rec.deal=d.id;save();
      if(['selected','discuss','terms'].includes(d.stage)) await rpc(r.owner,'advance_deal',{p_deal_id:d.id,p_stage:'cancelled',p_expected_revision:d.revision});
    }
    const row=snap.rows.find(x=>x.id===rec.id);identity(r,row);
    if(!row.hidden) await rpc('owner_admin','admin_set_hidden',{p_request_id:rec.id,p_hidden:true,p_reason:REASON});
    // A chosen offer is retained even if the deal is cancelled. Never delete untracked offers.
    for(const o of Object.values(rec.offers)) {
      const actual=snap.offers.find(x=>x.id===o.id);
      if(actual && actual.id!==d?.offer_id && actual.status!=='chosen') await rpc('owner_admin','admin_delete_offer',{p_offer_id:actual.id,p_reason:REASON});
    }
    rec.cleaned=true;save();
  }
  state.v3.cleaned=true;save();
}
async function verify(snap) {
  check(state.v3,'v3 ჯერ არ შექმნილა');
  if(state.v3.cleanupStarted) {
    for(const r of requests.filter(r=>record(r)?.id)) {
      const rec=record(r),row=snap.rows.find(x=>x.id===rec.id);identity(r,row);
      check(row.hidden,'გასუფთავების შემდეგ მოთხოვნა დამალული არ არის');
      const d=snap.deals.find(d=>d.request_id===rec.id);
      check(!d || ['cancelled','progress','complete'].includes(d.stage),'გასაუქმებელი გარიგება დარჩა');
      check(Object.values(rec.offers).every(o=>!snap.offers.some(x=>x.id===o.id&&x.id!==d?.offer_id)),'წასაშლელი შეთავაზება დარჩა');
    }
    console.log('გასუფთავების შემოწმება: PASS; ისტორია და მონაწილეთა წვდომა შენარჩუნებულია.');return;
  }
  const counts=Object.fromEntries(STAGES.map(s=>[s,0]));
  for(const r of requests) {
    const rec=record(r);check(rec?.id,'მოთხოვნა ledger-ში აკლია');
    const row=snap.rows.find(x=>x.id===rec.id);identity(r,row);check(!row.hidden,'მოთხოვნა დამალულია');
    check(row.photo_url===photo(r) && row.address_note===r.address,'ფოტო ან მისამართი არ ემთხვევა გეგმას');
    const offers=snap.offers.filter(o=>o.request_id===row.id);check(offers.length===r.suppliers.length,'შეთავაზებების რაოდენობა არ ემთხვევა გეგმას');
    for(const [i,key] of r.suppliers.entries()) {
      const o=offers.find(o=>o.id===rec.offers[key]?.id),expected=offer(r,key,i);
      check(o && o.company_id===id(key) && o.body===expected.body && Number(o.price)===expected.price && o.price_type==='total' && o.delivery_days===expected.days && o.vat_included && o.delivery_included && o.payment_terms===payment && o.valid_until && digest(o.commercial_terms)===digest(includes(r)),'შეთავაზების სრული პირობები არ ემთხვევა გეგმას');
      check(new Date(o.created_at)>new Date(row.created_at),'შეთავაზების დრო მოთხოვნას უსწრებს');
    }
    if(!r.stage) check(row.flow_state==='open','ღია მოთხოვნა აღარ იღებს შეთავაზებებს');
    else {
      const d=snap.deals.find(d=>d.id===rec.deal);check(d && d.stage===r.stage && d.offer_id===row.chosen_offer_id,'გარიგების ეტაპი არ ემთხვევა გეგმას');counts[d.stage]++;
      if(r.stage==='terms') check(d.buyer_confirmed_at && !d.supplier_confirmed_at,'terms ეტაპზე საჭიროა მხოლოდ მყიდველის დადასტურება');
      if(['progress','complete'].includes(r.stage)) check(d.buyer_confirmed_at && d.supplier_confirmed_at,'ორივე მხარის დადასტურება აკლია');
      if(r.stage==='complete') check(d.rating===5 && d.review===reviews[r.key],'შეფასება აკლია');
    }
    for(const [i,body] of (chats[r.key]||[]).entries()) {
      const m=snap.messages.find(m=>m.id===rec.messages[i]?.id);
      check(m?.body===body && m.request_id===rec.id && m.conversation_id===rec.conversation && m.sender_id===id(i%2?r.suppliers[0]:r.owner),'მიმოწერა არასრულია');
    }
  }
  for(const key of Object.keys(companies)) {
    const p=snap.profiles.find(p=>p.id===id(key));
    check(p.provide_categories.length && p.need_categories.length && p.employee_band && p.markets.length && p.languages.length && p.business_tags.length && p.contact_position,'კომპანიის დეტალები არასრულია');
  }
  check(Object.values(counts).every(n=>n===2),'ყველა ეტაპზე ორი გარიგება უნდა იყოს');
  console.log(JSON.stringify({შემოწმება:'PASS',მოთხოვნები:20,შეთავაზებები:requests.reduce((n,r)=>n+r.suppliers.length,0),ეტაპები:counts,შეფასებები:2}));
}
async function main() {
  check(process.argv.slice(2).every(x=>['--dry-run','--verify','--cleanup'].includes(x)),'უცნობი არგუმენტი');
  check(!(VERIFY&&(DRY||CLEANUP)),'--verify ცალკე გამოიყენეთ');
  for(const line of fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split(/\r?\n/)) {
    const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
  }
  const AUTH=process.env.NEON_AUTH_BASE_URL?.replace(/\/$/,'');
  // Keep v2's exact auth-probe and localhost guards, including the unused upload origin.
  assert.equal(AUTH,'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth','Wrong Neon Auth branch');
  assert.match(new URL(process.env.DATABASE_URL).hostname,/^ep-withered-glade-b54ts1g5(?:-pooler)?\./,'Wrong database branch');
  for(const origin of [BASE,UPLOAD]) {
    assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Use a local API connected to auth-probe');
    check(['http:','https:'].includes(new URL(origin).protocol) && new URL(origin).origin===origin,'API origin უნდა იყოს სუფთა ლოკალური origin');
  }
  check(new URL(process.env.DATABASE_URL).protocol==='postgresql:'||new URL(process.env.DATABASE_URL).protocol==='postgres:','არასწორი ბაზის პროტოკოლი');
  check(!fs.existsSync(LOCK),'ledger-ის lock უკვე არსებობს; გადაამოწმეთ სხვა seed პროცესი');
  const fd=fs.openSync(LOCK,'wx',0o600);fs.closeSync(fd);
  try {
    ledgerText=fs.readFileSync(FILE,'utf8');
    const match=ledgerText.match(/```json\r?\n([\s\S]*?)\r?\n```/);check(match,'ledger-ის ფორმატი უცნობია');state=JSON.parse(match[1]);
    for(const key of [...new Set(requests.map(r=>r.owner)),...Object.keys(companies),'owner_admin']) check(uuid(account(key)?.id)&&account(key)?.password,'აუცილებელი ანგარიში ledger-ში არ არის');
    check(account('owner_admin').email==='admin@gmail.com','მფლობელის ადმინის ანგარიში არ ემთხვევა v2-ს');
    sql=require('@neondatabase/serverless').neon(process.env.DATABASE_URL);
    const snap=await snapshot();await preflight(snap);
    if(DRY) { printPlan(snap);return; }
    if(VERIFY) { await verify(snap);return; }
    if(CLEANUP && !state.v3) { console.log('v3 ჩანაწერები არ არსებობს; ცვლილება არ შესრულდა.');return; }
    await authenticate();
    if(CLEANUP) await cleanup(snap);
    else {
      state.v3||={marker:MARKER,signature:digest(requests),requests:{},profiles:{}};save();
      await fillProfiles(snap);
      for(const r of requests) await seedRequest(r,snap);
      await backdate();
    }
    const after=await snapshot();await preflight(after);await verify(after);
  } finally { fs.unlinkSync(LOCK); }
}
if(require.main===module) main().catch(err=>{
  // Never print server error bodies, assertions' actual values, credentials or ledger content.
  const safe=err instanceof assert.AssertionError ? 'auth-probe/localhost უსაფრთხოების შემოწმება ვერ გაიარა' : err.safe?err.message:'გარემოს ან ბაზის შემოწმება ვერ შესრულდა';
  console.error('ოპერაცია შეჩერდა:',safe);process.exitCode=1;
});
