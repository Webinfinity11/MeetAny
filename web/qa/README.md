ადმინის უახლესი რედიზაინი: `35753e9` + `4a858c9`, საჯაროდ გამოქვეყნებულია. 55/55 ადმინის ხედი (11 განყოფილება, 5 სიგანე) და ბოლო მენიუს შესწორების 768/390/320 შემოწმება PASS. ძიება, დეტალები, ჯგუფური მონიშვნა, კლავიატურით მართვა და reduced-motion დაფარულია `qa/admin-presentation.mjs`-ით. სრული ანგარიში: [STATUS-2026-10-01.md](STATUS-2026-10-01.md).

# QA — მიმდინარე შედეგები

2026-10-01-ის სრული ანგარიში: [STATUS-2026-10-01.md](STATUS-2026-10-01.md). გაშვების ინსტრუქციები და ტესტების ზუსტი ფარგლები იმავე ანგარიშშია; E2E სცენარების ჩამონათვალი — [E2E-GE.md](E2E-GE.md).

საჯარო განახლება შესრულებულია. SQL 1,462, unit 11, QA ინფრასტრუქტურა 8, ვიზუალური 48/48 და ოთხი როლის live შემოწმება წარმატებულია. ცხრა E2E სცენარის შედეგი აერთიანებს საწყის გაშვებასა და ჩატის ცალკე წარმატებულ განმეორებას. რეალური OTP/reset წერილი ჯერ არ შემოწმებულა.

პრეზენტაციის განახლება (`8985618`): `node qa/admin-presentation.mjs` ამოწმებს 11 ადმინის განყოფილებას 1440/390-ზე, სადემო ბმულებს, 320px გზამკვლევს, ანიმაციების რეჟიმებს და ტექსტურ VIP-ს. `PRESENTATION_ORIGIN=https://meet-any.vercel.app` იგივე შემოწმებას საჯარო დემოზე უშვებს. ძირითადი SQL/E2E/48-კადრიანი შედეგები წინა ფუნქციურ ბილდს ეკუთვნის; ბოლო განახლების შედეგები სრულ ანგარიშში ცალკეა გამოყოფილი.

## ისტორიული ანგარიშები

ქვემოთ არსებული ძველი ჩანაწერები მათი გაშვების დროს აღწერს. ფრაზები „Production deploy არ შესრულებულა“ და ძველი ტესტების რაოდენობები მიმდინარე გამოქვეყნებულ ვერსიას არ ეხება.

# QA — მიმდინარე შემოწმებები და ისტორიული არქივი

მიმდინარე სკრიპტები ინახება `qa/`-ში, E2E სცენარები — `e2e/`-ში, ვიზუალური სისტემა — `visual/`-ში. ერთჯერადი სკრიპტები და ძველი ანგარიშები გადატანილია [არქივში](archive/README.md); ისინი პირდაპირ გასაშვებ ინსტრუქციებად აღარ ითვლება.

`shots/`-ის კადრები ადგილობრივად რჩება და Git-ში აღარ ემატება; ignore-ის გამონაკლისია `shots/visual-baseline/`; არსებული baseline-იც ამ ეტაპზე Git-იდან ამოღებულია და ლოკალურად რჩება. ანგარიშების კადრებზე ბმულები იმავე ადგილობრივ გზებზე მუშაობს. `ref-mobbin/` რჩება ვერსიების კონტროლში. `qa/*-report.json` გენერირებადი ადგილობრივი შედეგებია; `e2e/`-ის შედეგები შენარჩუნებულია.

ადმინისტრატორის მოქმედი ledger გასაღებია `owner_admin`. ბაზასთან დაკავშირებული შემოწმებები მხოლოდ შესაბამისი დავალების ფარგლებში გაუშვით: ლოკალური სერვერიც production-ის auth-probe ბაზას იყენებს. დღევანდელი `*-2026-09-29.md` ანგარიშები აქ რჩება; მათი თარიღი და შეზღუდვები გაითვალისწინეთ.

## ისტორიული შემოწმებების ჩანაწერები

# საბოლოო ლოკალური შემოწმება — 2026-09-22

- `npm run build`: წარმატებული (ცხრავე გვერდი და API Route Handlers).
- `npm run lint`: 0 შეცდომა; 17 გაფრთხილება (`img` ოპტიმიზაცია და არსებული JS სტილი).
- `bash db/tests/run.sh`: 621/621 — 337 ძირითადი, 67 უსაფრთხოების, 72 პროფილის, 145 ველის ტესტი.
- `report.json`: 9 გვერდი × 1280/390 + ფილტრები, URL/history, ფოტოები, ტელეფონის 44px სამიზნე, მენიუ/ფილტრის Esc და ფოკუსი. Console errors: 0.
- `demo-report.json`: შესვლა, ფოტოთი მოთხოვნის შექმნა, რედაქტირება, დახურვა/გაგრძელება, შეთავაზების გაგზავნა/რედაქტირება/გაუქმება/ხელახლა გაგზავნა, არჩევა, მოთხოვნის წაშლა და ადმინი. Console errors: 0.
- `accounts-report.json`: კლიენტის/კომპანიის/ადმინის ანგარიშები და პროფილები, 1280/390. Console errors: 0.
- მობილური კომპანიის ბარათი დამატებით შემოწმდა: ტელეფონი და მომსახურების ჩიპები ორივე grid სვეტს იკავებს (390px ეკრანზე 358px კონტენტი).
- მთავარი hero შედარდა ძველ localhost:4031 ვერსიას: 1440 × 435.09px ორივეგან; პიქსელის არხის საშუალო სხვაობა 0.156/255. მთავარი დიზაინი შენარჩუნებულია.

სურათები: `shots/`. `browser.mjs` და `archive/scripts/accounts.mjs` იყენებს Playwright Chromium-ს; ჩვეულებრივი Chrome გაიხსნა infinity11 (`Profile 8 — INFINITY`) პროფილში. ძველი დაუთრექავი შემოწმების მასალები შენარჩუნებულია `archive/prototype-local` და `archive/qa-local`-ში.

ტესტებმა შეცვალა მხოლოდ auth-probe branch-ის საკუთარი დროებითი QA მოთხოვნები; საბოლოოდ ისინი წაიშალა. Production deploy არ შესრულებულა. პაროლის აღდგენის/OTP ფორმები კოდში გადატანილია; რეალური კოდის წერილი არ გაგზავნილა. რეალური რეგისტრაცია და ადმინისტრატორის ბლოკირების/დადასტურების ცვლილებები UI-ით არ გამეორებულა; მათი სერვერული წესები DB ტესტებით მოწმდება.

## ვიზუალური შესწორება მფლობელის სურათების შემდეგ

კატეგორიების სია, კომპანიის ბარათი და მოთხოვნის დეტალი გადაიწყო. `shots/refined-*` აჩვენებს 1440/1024/390 ხედებს და შესული კლიენტის/კომპანიის მოთხოვნის ხედებს. შემოწმდა სურათები, ქართული ტექსტი და ჰორიზონტალური საზღვრები; სრულმა browser smoke-მა ხელახლა გაიარა 19 შემოწმება, 0 console error-ით. Build წარმატებულია, lint: 0 შეცდომა / 17 არსებული გაფრთხილება. ამ ვიზუალური ცვლილებისთვის DB workflow ტესტები არ გამეორებულა; შესული ანგარიშების დათვალიერება მხოლოდ წაკითხვას მოიცავდა.

მოთხოვნისა და კომპანიის კატალოგების შემდგომი განსხვავების კვლევა: [archive/reports/DESIGN-DIRECTION.md](archive/reports/DESIGN-DIRECTION.md). მფლობელის თანხმობის შემდეგ განსხვავებული შესავალი ბლოკებიც განხორციელდა.

კატალოგების განსხვავება: `shots/catalog-*-desktop.png`, `catalog-*-mobile.png` და `catalog-*-filters-mobile.png`. შემოწმდა 1440/1024/390, ძიება/ცარიელი შედეგი, URL/reload/back, მობილური ფილტრი და Escape. Build წარმატებულია; შეცვლილ კომპონენტებზე lint: 0 შეცდომა, 1 არსებული img გაფრთხილება.

## დარჩენილი UI ხარვეზები — 2026-09-23

- მომხმარებლის ხედებიდან ამოღებულია კომპანიის დადასტურების ბეიჯი და კატალოგის შესაბამისი ფილტრი (მთავარი, პროფილი, ანგარიში, კომპანიის რიგი). ძველი `?verified=1` კატალოგს აღარ ზღუდავს; ადმინისტრაციული მონაცემები/მართვა შენარჩუნებულია.
- მოთხოვნისა და კომპანიის ფილტრებს ცალკე desktop/mobile ID-ები აქვს. ბრაუზერში შემოწმდა უნიკალურობა, label/control კავშირი და მობილურიდან ქალაქის შეცვლა.
- შეთავაზების ქარდი ცარიელ მოქმედებების ბლოკს აღარ გამოსახავს; არჩეული შეთავაზების ტექსტი ელფოსტის მდებარეობაზე მცდარ დაპირებას აღარ იძლევა.
- კომპანიის სახელის სავალდებულო ვალიდაცია დამატებულია რეგისტრაციასა და პროფილის ფორმაში; შესვლის ველები იყენებს password-manager autocomplete-ს. ანგარიშის შესავალი სათაური ყველა ავტორიზაციის რეჟიმს ერგება.
- პროფილის სექციებს შორის ორმაგი დაშორება მოხსნილია. 1280/390-ზე დათვალიერებულია პროფილი, რეგისტრაციის ორივე როლი, აღდგენის ფორმა და სამი როლის ანგარიშები. სურათები: `review-*`, `profile-*`, `account-*`.
- Build წარმატებულია. რეგისტრაციის რეალური გაგზავნა, წერილის მიღება და პაროლის შეცვლა ჯერ არ შესრულებულა: მომხმარებელმა ელფოსტის მხოლოდ პირველი ნაწილი მოგვაწოდა; სრული მისამართი მოთხოვნილია. სატესტო ელფოსტამდე სამუშაოს დასრულებულად არ ჩავთვლით ამ ნაწილში.


## კატალოგების გამარტივება — 2026-09-23

`simple-{companies,requests}-{1440,1024,390,320}.png` — მიმდინარე კომპაქტური ხედები. შემოწმდა: ძიების გასუფთავება/ფოკუსი/URL, ცარიელი შედეგი, reload/back, მობილური ფილტრი/Escape, ტექსტისა და კონტროლების ჩატევა. Build წარმატებულია; შეცვლილი კომპონენტების lint 0 შეცდომა / 2 არსებული img გაფრთხილება. ვიზუალური შემოწმებისას გასწორდა მოთხოვნის მეტამონაცემების ძველი flex-basis-ით გამოწვეული ცარიელი ადგილი და 320px-ზე დალაგების მოკლე სახელები.

## პროფილისა და საერთო ნავიგაციის კრიტიკული გადახედვა — 2026-09-23

`company-shell-{guest,member}-{1440,1024,768,390,320}.png`: კომპაქტური პროფილი, მოკლე ანგარიშის კონტროლი, ფუტერის ორი დონის ბმულები. სტუმრისა და შესული კლიენტის 10 ხედში ჰორიზონტალური გადაცდენა არ გამოვლენილა; desktop dropdown და mobile dialog იხურება Escape-ით და ფოკუსი ბრუნდება. გრძელი ქართული სათაური (მათ შორის უწყვეტი სიტყვა) შემოწმდა DOM-ში 1024/390/320-ზე, ბაზაში ჩაწერის გარეშე. სრული read-only browser smoke: 19 შემოწმება, 0 console error. Build წარმატებულია; სრული lint: 0 შეცდომა / 16 არსებული გაფრთხილება. კრიტიკული შეფასება და დარჩენილი UX შეზღუდვები აღწერილია DESIGN-DIRECTION.md-ში. ეს არ არის რეალურ მომხმარებლებთან ჩატარებული usability კვლევა.
გრძელი სახელის პირველმა შემოწმებამ გამოავლინა CSS grid-ის ავტომატური მინიმალური სიგანით გადაცდენა; გასწორდა პროფილის/ვინაობის `minmax(0,1fr)` სვეტებით და სათაურის `overflow-wrap:anywhere`-ით. განმეორებითი შემოწმება სამივე სიგანეზე წარმატებულია.

## აიქონები და ღილაკების დეტალები — 2026-09-23

კატალოგები შემოწმდა 1440/1024/390/320-ზე (ძიების გასუფთავება/ფოკუსი/URL და გადაცდენა); პროფილი და საერთო ჰედერი სტუმრის/შესული მომხმარებლისთვის — 1440/1024/768/390/320-ზე. აქტიური ცვლილებები ჩანს `simple-*` და `company-shell-*` სურათებში. დამატებით შემოწმდა ძირითადი ღილაკის hover/focus/press, reduced-motion რეჟიმში ისრის უძრაობა, რენდერებული აიქონების sprite-ში არსებობა, მობილური დამატების ხილული წარწერა და საკონტაქტო/პროფილის ღილაკების ≥44px სიმაღლე. მთავარი 320px-ზე: `details-home-320.png`. Build წარმატებულია; lint 0 შეცდომა / 16 არსებული გაფრთხილება. მონაცემები არ შეცვლილა.

## გაფართოებული ძიება, ფილტრები და გამართულობა — 2026-09-23

- ახალი `discovery.mjs`: ძიების ფოკუსზე რეალური კატეგორიები/ჩანაწერები, ტექსტით შერჩევა, ArrowUp/Down/Enter/Escape, ცარიელი ძიება, კატეგორიით გაფილტვრა და მთავარი გვერდიდან გადასვლა; დესკტოპი და 390/320px.
- მოთხოვნები: პერიოდი, უპასუხო მოთხოვნები, 3 დღემდე ვადა, ფოტოს არსებობა. კომპანიები: არსებული საქმიანობის ტიპები, ქვეყნის მასშტაბით მომსახურება და სახელით/უახლესით დალაგება. მდგომარეობა URL-შია; შემოწმდა reload/history და მობილური კონტროლების სინქრონიზაცია.
- `resilience.mjs`: პროფილებს შორის გადასვლისას დაყოვნებული პასუხი ძველ ნომერს აღარ აჩვენებს; არარსებულ პროფილზე საკონტაქტო ბმული არ რჩება. ხელოვნური 503-ის შემდეგ „ხელახლა ცდა“ მონაცემებს აღადგენს. ეს მხოლოდ ბრაუზერის ქსელურ გადაფარვას იყენებს.
- `bash db/tests/run.sh`: 621/621 წარმატებული, დროებით ლოკალურ ბაზაზე.
- `archive/scripts/accounts.mjs`: კლიენტი/კომპანია/ადმინი წარმატებული.
- `QA_DEMO=1 QA_DEMO_ONLY=1 browser.mjs`: მოთხოვნის სრული ციკლი ფოტოთი და შეთავაზების გაგზავნა/რედაქტირება/გაუქმება/ხელახლა გაგზავნა/არჩევა; 0 console errors; საკუთარი დროებითი QA ჩანაწერები auth-probe-ში წაიშალა. პირველ გაშვებაში აღმოჩენილი null-კონტაქტის პრობლემა გასწორდა და სრული სცენარი ხელახლა გაიარა.
- Build წარმატებულია; lint 0 შეცდომა / 16 არსებული გაფრთხილება. სურათები `discovery-*`-შია.

რეალური ელფოსტის OTP/პაროლის აღდგენის წერილი კვლავ შეუმოწმებელია: მომხმარებლისგან მიღებული ელფოსტის ნაწილი დომენს არ შეიცავს. Deployment არ შესრულებულა. ავტომატური შემოწმებები არ ნიშნავს რეალურ მომხმარებლებთან ჩატარებულ usability კვლევას.
საბოლოო საერთო browser smoke-მაც გაიარა 19 შემოწმება, 0 console errors. 320px-ზე მთავარი ძიების ტიპების ტექსტის გადაფარვა დამატებით შემოწმდა და გასწორდა მოკლე ხილული სახელებითა და პროპორციული სვეტებით; სრული accessible სახელები შენარჩუნებულია.
ძიების რეალური ჩანაწერები ითვალისწინებს მოქმედ ფილტრებს; კატეგორიის შეთავაზებები რჩება დარგის სწრაფად შესაცვლელად. შემოწმება მოიცავს კონკრეტული ჩანაწერის არჩევიდან შესაბამის პროფილზე გადასვლას.

## მომრგვალებული აიქონები და ნომრის გახსნა — 2026-09-23

`qa/contact.mjs` ამოწმებს, რომ კომპანიების სიაში, პროფილსა და მოთხოვნაზე ნომერი და tel ბმული დაჭერამდე არ ჩანს; ღილაკი კლავიატურითაც ხსნის ნომერს და ფოკუსი ბმულზე გადადის. მოწმდება ცალკე reveal/call მოვლენები, წყარო/ობიექტის იდენტიფიკატორი და ნომრის არყოფნა მოვლენის payload-ში. გადატვირთვა თავიდან მალავს ნომერს. კლიენტის მოვლენა არ ინახება და სრულ ზარს არ ნიშნავს. მომრგვალებული, გამარტივებული დარგობრივი აიქონები ჩანს `rounded-icons-{desktop,mobile}.png`-ში.

## Administration API v1 and detail routes — 2026-09-23

- `QA_BROWSER_PATH=… node web/qa/archive/scripts/admin-v1.mjs` from `site`: demo-admin sign-in with local ignored ledger, mocked v1 RPCs (no data mutations). Checks server-only rows, next/first page, query cursor reset, role/verification filters, audit, error/retry and 320px overflow.
- `QA_BROWSER_PATH=… node web/qa/archive/scripts/admin-legacy.mjs`: existing-schema admin filters, URL reload, six metrics, required moderation reason and pending Escape/cancel protection; mutation is intercepted. Intended for the pre-v1 test database.
- `QA_BROWSER_PATH=… node web/qa/request-detail.mjs`: omits a real request from initial catalog response, verifies ID-based detail load; failure/retry and invalid-ID state. Read-only.
- `bash db/tests/run.sh`: 701 assertions, including 1,105 records per entity and equal-timestamp cursor traversal. Uses throwaway local databases, not remote data.

Build passes; lint has zero errors and 16 existing warnings. Remote admin schema migration remains pending; see `db/ADMIN-MIGRATION.md`. Mock UI tests and local SQL tests do not substitute for remote post-migration integration checks.

Post-change protected demo workflow also passed: create with photo, edit, close/reopen, send/edit/withdraw/resend offer, choose, delete own QA request, admin view; zero console errors. Own QA data was removed.

## Saved companies and offer notifications

- `node web/qa/notification-worker.mjs`: fake provider tests, no mail sent.
- `QA_BROWSER_PATH=… node web/qa/engagement.mjs`: mocked RPCs with real demo login; guest intent, save/reload/remove, failed save, notification read and Escape, disabled email channel, 1280/390/320px.
- `QA_BROWSER_PATH=… node web/qa/saved-live.mjs`: auth-probe only, saves an initially unsaved company with demo-hotel and removes that test save, checks account/profile/reload and CTA clipping.
- `QA_DEMO=1 QA_DEMO_ONLY=1 QA_BROWSER_PATH=… node web/qa/browser.mjs`: existing isolated offer lifecycle now verifies recipient and chosen-supplier notifications when capability is enabled.

Database rollout and delivery boundaries: `db/ENGAGEMENT-MIGRATION.md`. Placement references: Thomasnet's explicit Save action and Europages' upper company-profile utility area. Save is in the company heading/tools area, separate from the footer's phone/profile actions.

Final evidence: 749 SQL assertions pass (schema twice plus additive migration rerun), production build passes, lint zero errors/16 existing warnings. Real auth-probe save persistence and both offer-event recipients passed; all QA-owned saves/requests were removed. Compact saved/notification pages omit the large account profile sidebar to keep the requested list directly accessible.
