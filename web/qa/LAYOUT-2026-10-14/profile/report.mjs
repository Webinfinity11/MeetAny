import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'qa/LAYOUT-2026-10-14/profile';
const read = path => JSON.parse(fs.readFileSync(`${root}/${path}`, 'utf8'));
const before = read('before/metrics.json'), after = read('after/metrics.json');
assert.equal(before.rows.length, 63); assert.equal(after.rows.length, 63);
assert.equal(after.errors.length, 0); assert(!after.rows.some(row => row.overflow));
const functional = read('functional.json'), overlay = read('overlays.json');
assert.equal(functional.errors.length, 0); assert.equal(overlay.errors.length, 0);
assert(!overlay.results.some(row => row.overflow || row.covered?.length));
// Keep the original reports intact. Final results replace only the exact rerun cases.
const originals = ['a11y-company', 'a11y-client'].map(folder => read(`${folder}/results.json`));
const retries = ['a11y-company-chat', 'a11y-company-rows', 'a11y-client-final'].map(folder => read(`${folder}/results.json`));
const key = row => [row.role,row.theme,row.width,row.path,row.state || row.name || 'page'].join('/');
const pageMap = new Map(), keyboardMap = new Map();
for (const report of [...originals,...retries]) {
  report.pages.forEach(row => pageMap.set(key(row), row));
  report.keyboard.forEach(row => keyboardMap.set(key(row), row));
}
const pages = [...pageMap.values()], keyboard = [...keyboardMap.values()];
const rerunPaths = new Set(retries.flatMap(report => report.pages.map(row => [row.role,row.theme,row.width,row.path].join('/'))));
const failures = originals.flatMap(report => report.failures).filter(row => !rerunPaths.has([row.role,row.theme,row.width,row.path].join('/'))).concat(retries.flatMap(report => report.failures));
assert(!failures.length); assert(!keyboard.some(row => !row.passed));
assert(!pages.some(row => row.overflow || row.violations.some(v => ['serious','critical'].includes(v.impact))));
fs.writeFileSync(`${root}/a11y-final.json`, JSON.stringify({ pages, keyboard, failures }, null, 2));
const labels = {overview:'დაფა',requests:'მოთხოვნები',deals:'გარიგებები',saved:'შენახული',messages:'მიმოწერები',notifications:'შეტყობინებები',opportunities:'შესაძლებლობები',offers:'შეთავაზებები',details:'პროფილი · მონაცემები',legal:'იურიდიული',documents:'დოკუმენტები',products:'პროდუქტები',distribution:'დისტრიბუცია',security:'პაროლი',profile:'პროფილი'};
const rows = before.rows.filter(row => row.width === 390).map(row => {
  const next = after.rows.find(item => item.role === row.role && item.name === row.name && item.width === 390);
  const percent = ((row.scrollHeight - next.scrollHeight) / row.scrollHeight * 100).toFixed(1);
  return `| ${row.role === 'company' ? 'კომპანია' : 'კლიენტი'} | ${labels[row.name]} | ${row.scrollHeight} → ${next.scrollHeight} | ${percent}% | ${row.mainHeight} → ${next.mainHeight} |`;
});
const report = `# T8.8 — პროფილი და ანგარიშის სივრცე

თარიღი: 2026-10-14. ბაზა: \`meetany_layout_profile\`, dev: 3445, JWT fixture: 4445. მხოლოდ ნაკადისთვის გამოყოფილი ფაილები შეიცვალა.

## ცვლილებები

- კომპანიის details: **ძირითადი მონაცემები** (სახელი, კომპანია, ქალაქი, დარგი), **აღწერა და ტეგები** (about, offers, seeks), **ლოგო და გალერეა**, **მისამართი და მდებარეობა** (მომსახურების ქალაქები, მისამართი, რუკა, კოორდინატები), **კონტაქტი**. კლიენტთან პირადი მონაცემები და კონტაქტი რჩება.
- თითოეული editable ბლოკი დამოუკიდებელი form/section-ია: h2, აღწერა, ველები და \`--card-pad-sm\` ქვედა ზოლი. „შენახვა“ თავდაპირველად disabled-ია; წარმატება „შენახულია · HH:MM“ სამი წამით ჩანს; ვალიდაციისა და RPC-ის შეცდომა ზოლშივეა.
- \`updateProfile\` იგივე სრულ payload-ს იღებს. მხოლოდ არჩეული ბლოკის draft ეფარება store-ის უახლეს შენახულ ჩანაწერს; დანარჩენი ბლოკების draft-ები არ იგზავნება. ლოგო ისევ \`uploadLogo/updateProfile\`-ით, გალერეა \`setGallery\`-ით ინახება. details-ის \`useUnsavedGuard\` ოთხივე editable ბლოკის dirty-ის OR-ს იყენებს და გასვლისას შენახვა მათ თანმიმდევრულად ინახავს.
- იურიდიული მონაცემები, დოკუმენტები, პაროლი, დისტრიბუტორის სტატუსი და მიწოდების პირობები იმავე ბლოკის ზოლს იყენებს. \`CompanyProducts\` მხოლოდ ბლოკშია ჩასმული; მისი შიდა რედაქტორი არ შეცვლილა.
- **კონტაქტი** ძველადაც ადმინისტრატორის დასადასტურებელი მოთხოვნა იყო: ნომერი/ელფოსტა პირდაპირ არ ინახება. **დოკუმენტები** ატვირთვისას ინახება და ცალკე ღილაკით განხილვაზე იგზავნება. ამ ორი პროცესის კონტრაქტი შენარჩუნებულია.
- საერთო \`FormLayout\` უცვლელია. 1440-ზე ფორმა **640px**, პანელი **320px**, მათ შორის 32px; 1200px კონტეინერში მარცხენა ნავიგაცია ვიწროვდება. 1024–1279-ზე ანგარიშის ნავიგაცია ზედა რიგად გადადის. კომპანიის სექციები ჰორიზონტალურ ზოლად რჩება.
- პანელი: რეალური \`CompanyListingCard catalog\` შენახული მონაცემებით, შევსებული ბლოკების რაოდენობა, ცარიელი ბლოკების ბმულები, ვერიფიკაცია და საჯარო გვერდი. კლიენტთან მისი შენახული იდენტობა/შევსებაა. მობილურზე პანელი ქვემოთ ჩაკეცილია, რათა ფორმის დაწყებას არ აყოვნებდეს.
- ანგარიშის padding/gap გადავიდა სემანტიკურ ტოკენებზე. მობილურის მოთხოვნისა და გარიგების სათაური/მეტამონაცემები ერთ ≥44px ბმულშია; მოქმედების ღილაკები და ტექსტის ზომები შენარჩუნებულია.

## 390px: სრული გვერდი და ანგარიშის ნაწილი

დადებითი პროცენტი შემცირებას ნიშნავს; უარყოფითი — ზრდას. \`mainHeight\` არის \`.account-shell\`-ის სიმაღლე. საერთო header/footer ამ ნაკადში უცვლელია.

| როლი | გვერდი | scrollHeight, px | შემცირება | account-shell, px |
|---|---|---:|---:|---:|
${rows.join('\n')}

≥15% ყველა ჩანართზე მიღწეული არ არის. მოკლე/ცარიელ გვერდებს საერთო გვერდის მინიმალური სიმაღლე და დაახლოებით 865px header/footer ზღუდავს. უკვე კომპაქტურ offers/შესაძლებლობების რიგებში ტექსტი და 44px კონტროლები არ შემცირებულა. details/products/documents/security-ში ახალი ბლოკების აღწერებმა, დამოუკიდებელმა ქვედა ზოლებმა და ჩაკეცილი პანელის 44px სათაურმა სიმაღლე დაამატა; არცერთი ველი/მოქმედება არ დამალულა ამ მაჩვენებლის შესამცირებლად. საერთო ფუტერის შემდგომი ცვლილება სხვა ნაკადის პასუხისმგებლობაა.

## შემოწმებები

- \`npx tsc --noEmit\`: 0; \`npx eslint app\`: 0 error; \`npm run lint:design\`: წარმატებული.
- \`PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test\`: **133/133**.
- პროექტის \`qa/a11y-audit.mjs\`: company/client, blue/classic, 1440/390/360; საბოლოო გაერთიანებულ მატრიცაში **${pages.length} მდგომარეობა**, serious/critical **0**, overflow **0**, pageerror **0**, კლავიატურა **${keyboard.filter(row => row.passed).length}/${keyboard.length}**.
- პირველი გაშვებისას company blue/390 chat timeout, client blue/360 messages timeout და notifications-ის სკრიპტის ჩატვირთვის შეცდომა დაფიქსირდა. კოდის ცვლილების დასრულების შემდეგ ზუსტად ეს შემთხვევები და ბოლო ცვლილებით შეხებული requests/deals ხელახლა შემოწმდა. თავდაპირველი და განმეორებითი ანგარიშები შენარჩუნებულია; \`a11y-final.json\` მხოლოდ შესაბამის ჩანაწერებს ანაცვლებს.
- \`overlays.mjs\`: ლოკალური JWT-ით იგივე elementFromPoint მეთოდი, რასაც პროექტის overlay-audit იყენებს; 1440/1024/980/390/360/320; **overlaps 0**, overflow **0**, pageerror **0**; desktop 640/320 და მობილურის ჩაკეცვა/გახსნა შემოწმებულია. პროექტის overlay-audit-ის პაროლით შესვლა JWT fixture-ს არ შეესაბამება, ამიტომ გამოიყენება ეს ექვივალენტი.
- \`functional.mjs\`: **${functional.checks.length} სცენარი** — company/client რეალური ლოკალური შენახვა→გადატვირთვა; ორი dirty ბლოკის დამოუკიდებლობა; გასვლის გაფრთხილება/დარჩენა; კოორდინატების ბლოკური ვალიდაცია; RPC შეცდომა; ლოგო/გალერეის არჩევა, ატვირთვის შეცდომიდან ხელახალი ცდა, შენახვა და აღდგენა; მედიის overflow 390/360/320.
- Blob-ის token/upload/image პასუხები ლოკალური fixture-ით იმიტირდება; ბრაუზერის SDK, store და ბაზის RPC რეალურად მუშაობს. რეალურ Blob საცავში ფაილი არ ატვირთულა/წაშლილა. ტესტის ბოლოს პროფილები და გალერეა საწყის მნიშვნელობებზე ბრუნდება.

## არტეფაქტები და გამეორება

- \`before/\`: 63 სრული კადრი; \`after/\`: 63 სრული კადრი — company/client × ყველა ჩანართი/სექცია × 1440/390/360. ორივეში \`metrics.json\`.
- \`measure.mjs before|after\`; არჩევითი \`WIDTHS\`, \`PAGES\`. არჩეული გვერდის განმეორებითი გაზომვა დანარჩენ metrics-ს ინარჩუნებს.
- \`functional.mjs\`, \`overlays.mjs\`, \`report.mjs\`; შესაბამისი JSON/ლოგები. A11y-ის თავდაპირველი, ხელახალი და გაერთიანებული შედეგები ცალკეა.
- commit-ები: \`54efa68\` ბლოკური შენახვა; \`3167d4d\` პანელი; \`509fc5f\` სიმჭიდროვე; \`84c5d34\` ვალიდაციის ზოლი; \`3c3d1db\` სიების ბმულები/მედია; \`d4bae8a\` padding-ის სელექტორები; QA commit — ამ ანგარიშთან ერთად.

დარჩა: ≥15%-ის ერთიანი მიზნის შეფასება საერთო ფუტერის ცვლილების ინტეგრაციის შემდეგ. \`CompanyUpgrade\`, \`CompanyProducts\`, backend RPC allowlist და საერთო FormLayout არ შეცვლილა. რეალური password-provider/Blob სერვისის ოპერაციები ამ ლოკალურ QA-ში არ სრულდება.
`;
fs.writeFileSync(`${root}/REPORT.md`, report);
console.log('Final matrix:', pages.length, 'a11y states,', after.rows.length, 'screenshots,', functional.checks.length, 'functional checks');
