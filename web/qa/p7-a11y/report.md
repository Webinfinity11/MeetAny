# T7.7 — ხელმისაწვდომობის აუდიტი

## გაშვება

`web/`-დან:

```sh
node qa/perf-2026-10-12/auth-fixture.mjs 3719
NEON_AUTH_BASE_URL=http://127.0.0.1:3719 npx next dev --webpack -p 3709
BASE=http://localhost:3709 AUTH=http://127.0.0.1:3719 node qa/a11y-audit.mjs --role all
```

`--role`: `guest`, `client`, `company`, `admin`, `all` (ნაგულისხმევი). ორივე თემა (`blue`, `classic`), 1440×1000 და 390×844. როლები დამოუკიდებელ browser context-ებში პარალელურად მოწმდება. დამატებითი შემოწმებისთვის `WIDTHS=360`, `PAGES='<regex>'`, `A11Y_OUTPUT=qa/p7-a11y/<run>`; სხვა ლოკალური მონაცემებისთვის `REQUEST_ID`, `COMPANY_ID`, `DEAL_ID`.

სკრიპტი იყენებს axe-core 4.10.3-ს: `wcag2a`, `wcag2aa`, `wcag21aa`, `best-practice`. `results.json` შეიცავს თითოეული დარღვევის DOM-სამიზნეებს, განმარტებებს, ავტომატურად დაუდგენელ შემთხვევებს (`incomplete`), გვერდის overflow-სა და კლავიატურის შედეგებს; `results.md` — გვერდი × impact × წესი × ელემენტების რაოდენობას. Exit 1: serious/critical, გვერდის ჩატვირთვის/JavaScript/API შეცდომა, ჰორიზონტალური overflow ან კლავიატურის ჩავარდნა. არ ხდება წესების გამორთვა ან დარღვევების გამორიცხვა.

Auth მხოლოდ loopback fixture-ია; ცოცხალი Auth არ გამოიყენება. სცენარები მოქმედებებს Enter-ით ხსნის და Escape-ით აუქმებს; ბაზაში დასადასტურებელი მოქმედებები არ იგზავნება. Modal-ში მოწმდება საწყისი ფოკუსი, Tab-ის სრული ციკლი, Shift+Tab, Escape და ფოკუსის დაბრუნება. desktop ChatPopup განზრახ non-modal-ია და Tab-ის დაჭერას არ ზღუდავს.

გარიგების გვერდის მიმდინარე URL არის `/deals/view/?id=…` (დავალების `/deals/?id=…` იძლევა 404-ს). მოთხოვნის დახურვა მოთავსებულია „სხვა მოქმედებები“ details-ში; სკრიპტი ჯერ მას კლავიატურით ხსნის.

## შედეგები

საწყისი სკანირება: 195 გვერდის/ღია დიალოგის მდგომარეობა; critical 0, serious 86, moderate 49, minor 0. დარღვევები დათვლილია ელემენტებით, ყოველი თემა/ზომა ცალკე. საწყისი მონაცემები: `before.json`, `before.md`. ჩატის საუბრის შემდგომმა დამატებითმა შემოწმებამ გამოავლინა `scrollable-region-focusable`; საწყისი მატრიცა ჩატის სიას ამოწმებდა, საბოლოო — სიასაც და საუბარსაც.

საწყის გაშვებაში ოთხი გარიგების URL იყო 404 და ერთი admin/users ნავიგაცია ვერ დასრულდა. ასევე დაზუსტდა ჰარნესის სელექტორები: Next Dev Tools-ის გამორიცხვა ანგარიშის მენიუს სელექტორიდან, მობილურზე დამალული ანგარიშის მენიუს ნაცვლად მობილური დიალოგის შემოწმება, დახურვის details-ის გახსნა და nested დიალოგის DOM-კვანძის შენარჩუნება. საბოლოო სკრიპტი იყენებს რეალურ მარშრუტს და ჩატვირთულ, ანიმაციის დასრულებულ მდგომარეობას.

საბოლოო სრული გაშვება: **exit 0**, 208 მდგომარეობა და 46/46 კლავიატურის სცენარი. გახსნილი ანგარიშის მენიუს დამატებითი სკანირება: **exit 0**, 6 ახალი axe მდგომარეობა (სულ 214 უნიკალური მდგომარეობა). `results.json`/`results.md` აერთიანებს სრულ გაშვებასა და ამ 6 მდგომარეობას; დამატებითი გაშვების სრული წყარო `menus.json`-შია. მუდმივი სკრიპტი ამ შემოწმებებს უკვე ერთ `--role all` გაშვებაში აკეთებს.

| impact | before | after |
|---|---:|---:|
| critical | 0 | 0 |
| serious | 86 | 0 |
| moderate | 49 | 20 |
| minor | 0 | 0 |

დარჩენილი 20 moderate ჩანაწერი ერთი მიზეზიდან მოდის: admin-ის requests/companies/offers/users/audit გვერდებზე ერთნაირად დასახელებული ორი pagination × 2 თემა × 2 ზომა. სხვა როლებზე დარჩენილი დარღვევა 0. გვერდების/ღია მდგომარეობების რაოდენობა: guest 46, client 56, company 52, admin 60. JavaScript/API/ნავიგაციის შეცდომა 0; ჰორიზონტალური overflow 0. axe-ის `incomplete` ჩანაწერები სრულად შენარჩუნებულია JSON-ში და დარღვევებად არ ითვლება.

## შესწორებები

- `CompanyListingCard.tsx`: ვერიფიკაციის ხატულას დაემატა `role="img"`; არსებული ტექსტური სახელი ახლა სწორად იკითხება.
- `CompanyCatalogCover.tsx`: სახელდებული `group` და `tabIndex=0` — ფოტოების ჰორიზონტალური ზოლი კლავიატურით ხელმისაწვდომია.
- `RequestsPageContent.tsx`, `CatalogFilters.tsx`, `Catalog.module.css`: ფილტრების სათაურები `h2`; მათი ზომები უცვლელია. `ResultsBar.tsx`-ის უხილავი `h2` მობილურზეც აკავშირებს გვერდის სათაურს შედეგების ბარათების `h3`-ებთან.
- `tokens.css`, `pages/account.css`, `engagement.module.css`: საერთო `--filter-count-opacity:1`, რაოდენობები ინარჩუნებს მშობელი ღილაკის კონტრასტს ორივე თემაში.
- `ChatPopup.tsx`: ჩატის შიდა სათაურის კონტეინერი აღარ ქმნის გვერდის მეორე `banner` landmark-ს; შეტყობინებების გადასახვევ არეს დაემატა `tabIndex=0`.
- `FileAttachments.tsx`: დანართების ბლოკს მიენიჭა დასახელებული ჯგუფის სემანტიკა.
- `Inbox.tsx`: საუბრის სათაური `h2`, ვიზუალური კლასი უცვლელია.
- `FullMatchingFeed.tsx`, `account/MyOffers.tsx`: გვერდის შიდა დეტალის პანელები სახელდებული `section`-ებია, არა ჩადგმული `complementary` landmark-ები.
- `(how)/how-it-works/page.tsx`: სექციის შიდა საინფორმაციო შენიშვნას აღარ აქვს გვერდის დამატებითი landmark-ის სემანტიკა.

## დარჩენილი / გადაცემის სია

| ფაილი:ხაზი | წესი | რეკომენდაცია |
|---|---|---|
| `app/components/market/AdminPageContent.tsx:247` (`:279`, `:386`) | moderate `landmark-unique` | ზედა და ქვედა pagination-ის განსხვავებული სახელები, მაგალითად „ჩანაწერების გვერდები — სიის დასაწყისი/ბოლო“. ფაილს აქტიური ადმინის ნაკადი ცვლის; ამ ნაკადში არ შეცვლილა. |

`RequestViewPageContent.tsx`, `CompanyProfilePageContent.tsx`, `public-snapshot.js`, `market-store.js` არ შეცვლილა. დაცული დეტალის კომპონენტების საბოლოო სკანირებებში დარჩენილი დარღვევა არ აღმოჩენილა.

Header უცვლელია; `overlay-audit.mjs` ინსტრუქციის შესაბამისად გამოტოვებულია. auth fixture-ის კლავიატურის ტესტები ამოწმებს მობილურ და ანგარიშის მენიუს.

## გარემო და შემოწმებები

- ბაზა: `meetany_preview_p7_a11y`; dev `3709`, fixture `3719`. საწყისი checkout: `aba39735a6b1020645f888583d2bdbd55b40dda1`.
- `npx tsc --noEmit`: exit 0.
- `npx eslint app`: exit 0, 0 error / 0 warning.
- `npm run lint:design`: exit 0.
- `npm test`: exit 0, 127 pass / 0 fail.
- `node --check qa/a11y-audit.mjs` და `git diff --check`: exit 0.
- 360px დამატებითი შემოწმება: 44 მდგომარეობა, 20/20 კლავიატურის სცენარი, serious/critical 0, moderate 0, pageerror 0, overflow 0. შედეგები: `mobile-360.json`.
- მიგრაციები არ დამატებულა. დაცული ოთხივე ფაილის diff ცარიელია. Header არ შეცვლილა.
- `package.json`/`package-lock.json` diff მხოლოდ axe-core-ს ეხება: პირდაპირი devDependency `4.10`, რეალურად `4.10.3`; სხვა dependency ცვლილება არ დარჩენილა.

## ვიზუალური გადამოწმება

PNG-ები მხოლოდ ლოკალურად: `qa/p7-a11y/shots/` (gitignore). ძირითადი გვერდები და ღია დიალოგები ორივე თემაში ინახება `როლი-თემა-სიგანე-URL.png` / `როლი-თემა-სიგანე-სცენარი-URL.png` ფორმატით. ნანახია desktop კატალოგი, შეტყობინებების ფილტრები, ჩატი და მობილური ფილტრის დიალოგები; ზომები და განლაგება შენარჩუნებულია. მაგალითად:

- `shots/guest-blue-1440-%2Fcompanies%2F.png`
- `shots/guest-blue-390-filters-%2Fcompanies%2F.png`
- `shots/guest-blue-360-filters-%2Frequests%2F.png`
- `shots/client-blue-1440-%2Faccount%2F%3Ftab%3Dnotifications.png`
- `shots/client-blue-360-chat-thread-%2Frequests%2Fview%2F%3Fid%3D0101aaac-f4e6-4ed4-b1bd-5a52e0942db9.png`
