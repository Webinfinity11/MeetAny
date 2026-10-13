# რეალური მომხმარებლის ნაკადები — 2026-10-13

**შედეგი: ახალი hotel → request → offer → select ციკლი დაბლოკილია 5 ღია მოთხოვნის ლიმიტით.** დარჩენილი ნაბიჯები არ არის ამ ახალი ციკლის წარმატებად გასაღებული: hotel–wood-ის უკვე არსებული `selected` გარიგება UI-ით მივიყვანე დასრულებამდე და შეფასებამდე. ახალი კომპანიის რეგისტრაცია, onboarding-ის შენახვა, ვერიფიკაციის სრული ადმინისტრაციული ციკლი, საჩივარი, შეფასების დამალვა და owner_company-ის პროფილის შევსება რეალურად შესრულდა.

**11 ხარვეზი: P1 — 1; P2 — 10; P3 — 0.** პროდუქტის კოდი არ შეცვლილა. [NECESSITY.md](NECESSITY.md) ცალკე, პირველი commit-ით (`0d880f1`) დასრულდა; იქ აღწერილი „შემდეგ“ ამ ტესტში ჯერ დანერგილი არ არის.

## გარემო და მეთოდი

- Checkout baseline: `71faac486a2eb34f79022ed5ef93bc8babd0c3a6`; ტესტი ამ იზოლირებული checkout-ის კოდზეა, სხვა მუშაკების მომავალი ცვლილებების გარანტია არაა.
- მისამართი: `http://localhost:3402`; გაშვება `cd web && npm run dev -- --port 3402 --webpack`. ჩვეულებრივი Turbopack გაშვება `node_modules` სიმბმულის filesystem-root შეცდომაზე წყდება; Webpack-ით HTTP 200 მიღებულია.
- ბაზა: `meetany_preview_1791892006000`, მხოლოდ localhost Postgres. `DATABASE_URL` და `MEETANY_LOCAL_DATABASE_URL` ჰოსტები harness-ში მოწმდება. ბიზნეს-მოქმედებები Playwright/Chrome UI-დან შესრულდა; SQL გამოყენებულია **წასაკითხად**, შედეგისა და fixture-ის დასადასტურებლად. API/DB მუტაციით ეტაპები არ გადამიხტუნებია.
- Auth საერთო Neon Auth-ია. თითო როლზე ერთი შესვლა: hotel, wood, owner_company, owner_admin; ახალი კომპანიისთვის მხოლოდ ერთი sign-up. სესიები `.private/<role>.json` storageState-ით აღდგა. შესვლებს შორის ≥20 წმ; 429 არ დაფიქსირებულა. პაროლები/ტოკენები commit-ში არ შედის.
- ზომები: 1440×1000, 390×844 და 360×844. სრული ეტაპობრივი კადრები და DOM ტექსტი სამივე ზომაზე. ძირითადი ციკლის მუტაციები 1440-ზეა; owner-ის სრული პროფილის შენახვა, ვერიფიკაციის CTA და საჩივრის შედეგის არჩევა დამატებით **390-ზე რეალურად დაჭერით** შემოწმდა. 360 მხოლოდ overflow შემოწმებაა. ეს არ არის სამი დამოუკიდებელი სრული sign-up/deal ციკლი.
- კადრები/DOM: `shots/flows/`. PNG-ები ადგილობრივად რჩება და git-ში არ ემატება; JSON მტკიცებულება და სკრიპტები commit-შია. Chrome `pageerror` მოვლენები — 0. საბოლოო გაზომვების ზუსტი რაოდენობაა [evidence-index.json](shots/flows/evidence-index.json); გაზომილ გვერდებზე document overflow — 0.
- 1×1 PNG გამოიყენება ლოგოს, პროდუქტის, პროფილის/მოთხოვნის ფოტოსა და ორი სატესტო დოკუმენტისთვის. ეს ამოწმებს ატვირთვის/მიბმის ნაკადს და **არა დოკუმენტების ნამდვილობას**.

სატესტო ობიექტები:

| ობიექტი | ID / შედეგი |
|---|---|
| ახალი კომპანია | `e2e+1791892985948@meetany.local`, ID `f2524de4-0c79-4612-95a9-c688290efb70`; სახელი `[QA-20261013] კომპანია 1791892985948`; პაროლი ledger-ის wood ანგარიშის იგივე ნაგულისხმევი მნიშვნელობით, აქ არ ქვეყნდება |
| ახალი მოთხოვნის მონახაზი | `[QA-20261013] ხის მაგიდები 1791892985948`; საჯარო მოთხოვნა **არ შექმნილა**; hotel-ის მონახაზი შენარჩუნებულია |
| არსებული გარიგება დამატებითი დაფარვისთვის | `abfa9cab-40a0-4f91-9a8e-9ea5c9bd15e8`, მოთხოვნა `ea9e0391-2fba-44f1-8be3-84ea8896dab9` — „სასტუმროს მისაღებისთვის ხის დახლი“; საწყისი `selected`, საბოლოო `complete`, შეფასება 5/5 |
| საჩივარი | hotel-დან ახალი QA კომპანიის პროფილზე; ტექსტი `QA 1791892985948 სატესტო საჩივარი განხილვის შესამოწმებლად.`; ადმინმა უარყო მიზეზით |

[database-summary.json](shots/flows/database-summary.json) ადასტურებს კომპანიის `approved`, onboarding completion-ს, ორივე matching კატეგორიას, deal-ის `complete`, ორივე მხარის დასტურსა და შეფასებას; ახალი მოთხოვნის შედეგია `[]`, hotel-ის რეალური `open_count=5`.

## ხარვეზები

ბილიკები „სავარაუდო ფაილი“-ში იწყება `web/app/components/market/`-ით, თუ `web/app/lib/` ან `db/` ცალსახად არაა მითითებული. მტკიცებულების `-1440` ფაილებს იმავე სახელის `-390`/`-360` წყვილები ახლავს, გარდა სპეციალური JSON-ებისა.

| ID | ნაკადი | route | როლი | ზომა | ფაქტი (ციტატა) | მტკიცებულება | სიმძიმე | სავარაუდო ფაილი კოდში | გასწორების მოკლე აღწერა | acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| QA-01 | რეგისტრაცია → onboarding | `/account/?tab=register&role=company` | ახალი კომპანია | მოქმედება 1440; შედეგი 1440/390/360 | ანგარიში შეიქმნა, მაგრამ `/onboarding/` ავტომატური გადასვლა 60 წამში ვერ დაფიქსირდა. სესიის აღდგენით ანგარიშზე ჩანს „რეგისტრაცია · 0%“, „რეგისტრაციის გაგრძელება“. onboarding პირდაპირი ბმულით გაგრძელდა. ერთი sign-up-ის დაკვირვებაა, დამატებითი ანგარიში არ შექმნილა. | [registration-final-1440.json](shots/flows/registration-final-1440.json), `registration-final-390.png`; [runner-checks.json](shots/flows/runner-checks.json) — registration timeout | P2 | AuthForms.tsx:144–148; AccountPageContent.tsx:60–64 | რეგისტრაციის შედეგზე ნავიგაცია მშობლის ხელახალ რენდერს არ უნდა გაექცეს; სავარაუდო მიზეზი, არა დადასტურებული root cause | წარმატებული კომპანიის რეგისტრაცია ერთხელ, სტაბილურად ხსნის პირველ onboarding ნაბიჯს. ანგარიში და რეგისტრაციის სტატისტიკა არ დუბლირდება. |
| QA-02 | მოთხოვნის გამოქვეყნება | `/requests/new/?step=3` | hotel | 1440/390/360 | ყველა სამი ნაბიჯისა და ფოტოს არჩევის შემდეგ მხოლოდ გამოქვეყნებაზე: „ერთდროულად შეიძლება 5 ღია მოთხოვნა. დახურეთ ძველი და სცადეთ ხელახლა.“ შეცდომასთან პირდაპირი მართვის ბმული არაა. ლიმიტის არსებობა თავისთავად ხარვეზად არ ითვლება; ხარვეზია მისი გვიან აღმოჩენა. | [hotel-final-1440.json](shots/flows/hotel-final-1440.json), `hotel-final-390.png`; [database-summary.json](shots/flows/database-summary.json) | P2 | PostRequestPage.tsx:214–250,312–319; web/app/lib/market-store.js:39; db/schema.sql:424,624 | უკვე მიღწეული ლიმიტი დასაწყისშივე აჩვენეთ, მოთხოვნების მართვის ბმულით; მონახაზი შეინარჩუნეთ | 5 აქტიური მოთხოვნისას ახალი ფორმა თავიდანვე ხსნის შეზღუდვას. ძველის დახურვის შემდეგ იგივე მონახაზი ქვეყნდება ხელახალი შევსების გარეშე. |
| QA-03 | CMS → საჯარო გვერდი | `/admin/?tab=content` → `/companies/` | owner_admin → სტუმარი | 1440/390/360 | ფოტო შეცვლილია, UI აცხადებს „კატალოგის ფოტოები გამოქვეყნდა“, მაგრამ საჯარო გვერდზე ფოტო არ ჩანს. `.catalog-collage` რაოდენობა **0**. `CompanyCatalogCover` მხოლოდ საკუთარ ფაილშია მოხსენიებული, არც ერთი გვერდი არ იყენებს. რედაქტორის სათაური დამატებით ამბობს „მთავარი გვერდის ტექსტები და ფოტოები“, შიგნით — მთავარი აქ არ იცვლება. | [admin-content-published-1440.json](shots/flows/admin-content-published-1440.json), `admin-content-published-390.png`; [cms-public-dom.json](shots/flows/cms-public-dom.json), [guest-content-published-1440.json](shots/flows/guest-content-published-1440.json) | **P1** | AdminContentEditor.tsx:26–29; CompanyCatalogCover.tsx:35; CompaniesPageContent.tsx | რედაქტორი რეალურად ხილულ საჯარო კონტენტს მიაბით; სათაური/წარმატების ბმული იმავე დანიშნულებას ასახელებდეს | ერთი შეცვლილი ველი გამოქვეყნების შემდეგ შესაბამის საჯარო გვერდზე რეალურად იცვლება, desktop/mobile-ზე. გაუყენებელი ბლოკის რედაქტირება წარმატებად არ ცხადდება. |
| QA-04 | პროფილი → მე-13 პროდუქტი | `/account/?tab=profile&section=products` | owner_company | 1440/390/360 | „12/12“; „პროდუქტის დამატება“ disabled-ია. UI-ში 12 რიგი შეივსო; მე-13-ის დამატება შეუძლებელია. ეს რიგები ბაზაში არ შემინახავს. შეთანხმებული სამიზნეა 100. | [owner-products-12-1440.json](shots/flows/owner-products-12-1440.json), `owner-products-12-390.png` | P2 | CompanyProducts.tsx:56,69; OnboardSteps.tsx:90 | პროდუქტების ლიმიტი UI/store/SQL დონეზე ერთიანად 100 გახდეს | მე-13 პროდუქტის დამატება/შენახვა შესაძლებელია. 100-ის შემდეგ ლიმიტი გასაგებად აიხსნება და დამატებული რიგები არ იკარგება. |
| QA-05 | დასრულებული მოთხოვნის CTA | `/requests/view/?id=26b44585-e6d4-4d3c-b359-532d0fb1f4d2` | owner_company | 1440/390/360 | ერთ ეკრანზე „მომწოდებელი არჩეულია“ და „საჭიროა ვერიფიკაცია“ / „დოკუმენტების ატვირთვა“. ვერიფიკაცია ამ მოთხოვნაზე პასუხის შესაძლებლობას მაინც ვერ გახსნის. ცალკე **ღია** მოთხოვნაზე იგივე verification gate სწორად მუშაობს. | [owner-request-cta-390.json](shots/flows/owner-request-cta-390.json), `owner-request-cta-390.png`; კონტროლი `owner-open-request-cta-390.json` | P2 | RequestViewPageContent.tsx:276–277,359 | პასუხის პანელმა ჯერ მოთხოვნის დახურული/არჩეული სტატუსი გაითვალისწინოს, შემდეგ კომპანიის ვერიფიკაცია | არჩეულ/დახურულ მოთხოვნაზე CTA არ მიანიშნებს, რომ ვერიფიკაცია შეთავაზების გაგზავნას გახსნის. ღია მოთხოვნაზე ვერიფიკაციის ბმული რჩება. |
| QA-06 | გარიგების შეტყობინების ფასი | `/account/?tab=notifications` | wood | 1440; სიის ძველი ფასი 390/360-ზეც | დასრულების ჩანაწერში „2 800 ₾ · 18 დღე“, იმავე შეტყობინების დეტალში „ფასი 2 400 ₾“. პირობები ორივემ უკვე 2400-ზე დაადასტურა; სია საწყისი offer-ის ფასს იყენებს, დეტალი — deal-ს. | [wood-final-notifications-1440.json](shots/flows/wood-final-notifications-1440.json), `wood-final-notifications-1440.png`; [database-summary.json](shots/flows/database-summary.json) | P2 | EngagementPanels.tsx:60–64,107 | deal შეტყობინებისთვის შეთანხმებული ფასის ერთიანი წყარო გამოიყენეთ ან ისტორიული snapshot აშკარად აღნიშნეთ | პირობების შეცვლისა და დასრულების შემდეგ ერთი შეტყობინების სიასა და დეტალში ფასი თანმიმდევრულია. საწყისი შეთავაზება მიმდინარე შეთანხმებად არ ჩანს. |
| QA-07 | საჩივრის განხილვის პასუხი | `/account/?tab=notifications` | hotel | 1440 | „საჩივარი განხილულია“ დეტალში შედეგია მხოლოდ **`rejected`**; ადმინის მიზეზი „QA: სატესტო საჩივარი შემოწმებულია, დარღვევა არ დადასტურდა.“ ავტორს არ ეჩვენება, თუმცა ადმინის დამუშავებულ სიაში ინახება. | [hotel-report-notifications-1440.json](shots/flows/hotel-report-notifications-1440.json), [admin-report-handled-1440.json](shots/flows/admin-report-handled-1440.json) | P2 | EngagementPanels.tsx:104; db/migrations/20261012-admin-management.sql:506–509 | შედეგი ქართულად ითარგმნოს; საჯაროდ მისაწოდებელი განხილვის მიზეზი notice payload/detail-ს მიჰყვეს | ავტორი ხედავს „უარყოფილია“ ან შესაბამის ქართულ შედეგს და განხილვის მიზეზს. შიდა enum მომხმარებლის ტექსტად არ გამოჩნდება. |
| QA-08 | მობილურზე საჩივრის შედეგის გახსნა | `/account/?tab=notifications` | hotel | **390 (რეალური კლიკი)**; 360 | „საჩივარი განხილულია“-ზე დაჭერის შემდეგ ხილული შედეგი არ იხსნება. ჩანაწერს route არ აქვს, selection მხოლოდ desktop aside-ს ცვლის; mobile-ზე aside `display:none`-ა. | [hotel-report-clicked-mobile-390.json](shots/flows/hotel-report-clicked-mobile-390.json), `hotel-report-clicked-mobile-390.png`; [runner-checks.json](shots/flows/runner-checks.json) — `detailVisible:false` | P2 | EngagementPanels.tsx:46,79–85; engagement.module.css:166 | ბმულის არმქონე შეტყობინება მობილურზეც ხსნიდეს ხილულ დეტალს/sheet-ს | 390/360-ზე საჩივრის ჩანაწერის დაჭერა აჩვენებს შედეგსა და მიზეზს, დახურვისა და სიაში დაბრუნების გზით. |
| QA-09 | რეგისტრაციის ქალაქი | `/account/?tab=register&role=company` | სტუმარი | 1440/390/360 | ჯერ შეუვსებელ ფორმაში „ქალაქი *“ უკვე „თბილისი“-ა. რეგისტრაციის ტესტში ქალაქის არჩევის გარეშე შეიქმნა თბილისი; PD მოითხოვს „აირჩიეთ ქალაქი“-ს და არა ჩუმ default-ს. | [registration-before-1440.json](shots/flows/registration-before-1440.json), `registration-before-390.png` | P2 | AuthForms.tsx:117,208–217 | ცარიელი საწყისი მნიშვნელობა და submit-ზე ქალაქის არჩევის ვალიდაცია | ახალი მომხმარებელი ქალაქს შეგნებულად ირჩევს; ცნობილ pending profile-ზე არსებული ქალაქი წინასწარ ივსება. |
| QA-10 | onboarding details-ის აუცილებლობა | `/onboarding/?step=details` | ახალი კომპანია | 1440/390/360 | „იურიდიული სახელი *“, „საიდენტიფიკაციო კოდი *“, „დაარსების წელი *“, „იურიდიული ფორმა *“, „თანამშრომლები *“; DOM-ში required. გასავლელად ყველა შევავსე. PD აქ მხოლოდ საკონტაქტო პირსა და ქალაქს ითხოვს; legal name/code საჭიროა მხოლოდ verification submit-ზე. | [onboard-2-details-1440.json](shots/flows/onboard-2-details-1440.json), `onboard-2-details-390.png` | P2 | OnboardSteps.tsx:66–72; OnboardPage.tsx:63,129 | optional კონტრაქტი შეათანხმეთ HTML validation-სა და completion-თან; verify წინაპირობები ცალკე განმარტეთ | მხოლოდ საკონტაქტო პირითა და ქალაქით details ნაბიჯი გადის; არასრულ იურიდიულ მონაცემებზე მხოლოდ ვერიფიკაციის გაგზავნა ითხოვს კონკრეტულ დანაკლისს. |
| QA-11 | ერთი აღწერის ორი კონტრაქტი | `/onboarding/?step=profile` და `/account/?tab=profile` | ახალი კომპანია / owner_company | 1440/390/360 | onboarding-ის „კომპანიის შესახებ“ required და `/500`; პროფილის იგივე ველი optional და `/1000`. განსხვავება DOM-ის `required`-ით და წყაროს maxLength-ითაც დასტურდება. ტექსტის მოჭრა ამ ტესტში არ შემიმოწმებია. | [onboard-3-profile-1440.json](shots/flows/onboard-3-profile-1440.json), [owner-profile-all-persisted-1440.json](shots/flows/owner-profile-all-persisted-1440.json) | P2 | OnboardSteps.tsx:77; account/Profile.tsx:188 | ორივეგან optional, 1000 სიმბოლო, ერთიანი helper/counter | ცარიელი აღწერა onboarding-ს არ ბლოკავს; 501–1000 სიმბოლოს ტექსტი ორივე რედაქტორში უცვლელად ინახება. |

## რა გაიარა წარმატებით

| ნაკადი / შემოწმება | ფაქტობრივი შედეგი | მტკიცებულება |
|---|---|---|
| ერთი ახალი კომპანიის შექმნა | ლოკალურ profiles-ში company როლი და ახალი ID; იგივე სესია შემდგომ სკრიპტებში აღდგა. ავტომატური გადასვლა ცალკე QA-01-ია. | `registration-final-*`, `database-summary.json` |
| onboarding ტიპი | `both`, provide=`furniture`, need=`furniture`; UI შვიდ ნაბიჯს აჩვენებს | `onboard-1-type-*`, `onboard-5-need-*`, `database-summary.json` |
| details + profile | საკონტაქტო/იურიდიული მონაცემები და აღწერა შეინახა; 1×1 ლოგო აიტვირთა | `onboard-2-details-*`, `onboard-3-profile-*` |
| პროდუქტი და ფოტო | „QA ხის მაგიდა“, აღწერა და photoUrl ბაზაშია; reload-ზე ჩანს. თავდაპირველი notice-ის ლოდინი არ იყო ატვირთვის მარცხი — პროდუქტის patch ტექსტურ notice-ს ასუფთავებს. | `onboard-4-provide-*`, `newcompany-product-persisted-*`, `runner-checks.json` — persisted proof |
| review → დაფა | review ნაჩვენებია; completion timestamp ჩაიწერა; ვერიფიკაციის გაგზავნის გადადებით დასრულება დაშვებულია | `onboard-7-review-*`, `newcompany-dashboard-*`, `database-summary.json` |
| verification submit | `registration` და `tax` ფაილები მიბმულია; სტატუსი „განსახილველი“ | `newcompany-verification-sent-*` |
| ადმინი აბრუნებს → კომპანია ხელახლა აგზავნის → ადმინი ადასტურებს | მიზეზი ჩანს კომპანიასთან; საბოლოოდ `verified=true`, `approved`; ორივე შეტყობინება კომპანიას მიუვიდა | `admin-company-returned-*`, `newcompany-returned-*`, `admin-company-approved-*`, `newcompany-approved-*`, `newcompany-notifications-*` |
| hotel-ის მოთხოვნის draft | სამი ნაბიჯის მონაცემები და ფოტოს preview ნაჩვენებია; ლიმიტზე უარი draft-ს არ შლის | `request-step1-*`, `request-step2-*`, `request-step3-*`, `hotel-final-*` |
| wood matching-ის საბაზისო სია | არსებული შესაბამისი რეკომენდაციები ჩაიტვირთა. **ახალი hotel მოთხოვნის matching არ შემოწმებულა**, რადგან არ გამოქვეყნდა. | `wood-matching-baseline-*` |
| არსებული hotel მოთხოვნის შედარების გვერდი | არსებული შეთავაზებები/არჩეული შედეგი ჩანს; ეს ახალი select მოქმედების ტესტი არაა | `hotel-existing-comparison-*` |
| არსებული deal selected → discuss | hotel-მა გახსნა ჩატი; hotel-ის კითხვა wood-მა ნახა, wood-ის პასუხი hotel-მა | `hotel-selected-fixture-*`, `wood-selected-fixture-*`, `hotel-discuss-*`, `wood-discuss-*` |
| ახალი პირობები და ორმხრივი დასტური | wood-მა 2400 ₾ და გადახდა შეცვალა; ჯერ buyer, შემდეგ supplier დაეთანხმა; ორივე timestamp არსებობს | `wood-terms-edit-*`, `hotel-terms-before-*`, `wood-terms-before-*`, `*-terms-buyer-confirmed-*`, `*-terms-both-confirmed-*` |
| progress → complete → შეფასება | supplier-ის წარმოების ტექსტი ორივე მხარეს ჩანს; buyer-მა მიღება დაადასტურა; ოთხივე კრიტერიუმი 5, განმეორებითი თანამშრომლობა „დიახ“, ტექსტი ორივე მხარეს | `hotel-progress-*`, `wood-progress-*`, `hotel-review-form-*`, `hotel-complete-review-*`, `wood-complete-review-*` |
| მიმოწერები/შეტყობინებები | ორივე როლის სიები ჩაიტვირთა; დასრულებისა და განხილვის შეტყობინებები ჩანს. ფასისა და საჩივრის დეტალის ხარვეზები QA-06–08-შია | `hotel-final-messages-*`, `wood-final-messages-*`, `hotel-final-notifications-*`, `wood-final-notifications-*` |
| შეფასების დამალვა | admin reviews-ში „დამალული“; wood-ის საჯარო გვერდიდან კონკრეტული QA შეფასების ტექსტი გაქრა | `admin-review-published-*`, `admin-review-hidden-*`, `guest-wood-review-hidden-*` |
| hotel-ის საჩივარი → გადაწყვეტა | ახალი კომპანიის პროფილზე რეალური საჩივარი; ადმინის სიაში გადადის დამუშავებულში და მიზეზი ინახება | `hotel-report-form-*`, `hotel-report-sent-*`, `admin-report-new-*`, `admin-report-handled-*` |
| CMS-ის შენახვა და აღდგენა | ფოტო ატვირთვა/გამოქვეყნების შენახვა შესრულდა; საჯარო ასახვა QA-03-ით ჩავარდა; შემდეგ საწყისი ფოტო UI-ით აღდგა | `admin-content-changed-*`, `admin-content-published-*`, `guest-content-restored-*` |
| დაუდასტურებელი კომპანიის ღია მოთხოვნის gate | შეთავაზების editable ფორმა არ ჩანს; „დოკუმენტების ატვირთვა“ 390-ზე რეალურად გადავიდა verify-ზე | `owner-open-request-cta-*`, `owner-open-offer-gate-*`, `owner-gate-verification-link-*` |
| owner-ის სრული პროფილის შენახვა | სახელი, კომპანია, ქალაქი/დარგი, აღწერა, offers/seeks, მომსახურების ქალაქი, მისამართი, კოორდინატები, ახალი ლოგო/გალერეა შეინახა და reload-ს გაუძლო; ტელეფონი/ელფოსტა readOnly დარჩა | `owner-profile-filled-*`, `owner-profile-saved-*`, `owner-profile-all-fields-*`, `owner-profile-all-persisted-*` |
| Responsive | ყველა აღრიცხულ 1440/390/360 snapshot-ზე scrollWidth ≤ viewport; ეს არ ამტკიცებს რეალური მოწყობილობის ვირტუალური კლავიატურის ქცევას | `evidence-index.json`; PNG-ები ვიზუალურადაც დათვალიერებულია |

## ბლოკერები და დაუფარავი ნაწილი

1. **ახალი request → საჯარო სია/მთავარი → matching → ახალი offer → ახალი select**: MA105-ზე გაჩერდა. სხვა მუშაკების/seed მოთხოვნები ლიმიტის გასათავისუფლებლად არ დამიხურავს და SQL-ით ლიმიტი არ შემიცვლია. `newRequest=[]` დადასტურებულია. ახალი შეთავაზებისა და არჩევის სკრიპტები არსებობს (`offer.mjs`, `deal.mjs`), მაგრამ ამ run-ში მათი ახალი-ობიექტის branch წარმატებულად არ შესრულებულა.
2. **გარიგების ეტაპები** დამოუკიდებლად შემოწმდა არსებულ `selected` hotel–wood fixture-ზე. მისი არჩევის წარმომავლობა ამ run-ს არ მიეწერება. ყველა შემდგომი გადასვლა რეალური UI-ითაა.
3. **კონტენტის საჯარო შედეგი** არ გავიდა — QA-03. ტექსტური რედაქტორი საერთოდ არ იყო; ხელმისაწვდომი ფოტო-ველი გამოვიყენე და მისი გამოქვეყნების რეალური უშედეგობა შევამოწმე.
4. **მე-13 პროდუქტი** ვერ დაემატა — QA-04; 12 ახალი/არსებული რიგის საბოლოო შენახვით საწყისი პროდუქტის სია არ გადამიწერია.
5. **გაუვლელია** სამი დამოუკიდებელი სრული ციკლი სამ viewport-ზე, ნამდვილი email inbox/OTP, touch keyboard, რეალური იურიდიული დოკუმენტის შემოწმება. მოთხოვნილი ერთი ახალი account-ის შეზღუდვა დაცულია.

## შემოწმებები და გამეორება

ყველა ბრძანება checkout-ის ძირიდან (server ბრძანების გარდა):

```sh
node web/qa/QA-2026-10-13/register.mjs
node web/qa/QA-2026-10-13/onboard.mjs
node web/qa/QA-2026-10-13/request.mjs
node web/qa/QA-2026-10-13/admin.mjs
node web/qa/QA-2026-10-13/owner.mjs
node web/qa/QA-2026-10-13/moderation.mjs
QA_ONLY='deal discuss|terms proposed|progress|completion|messages|notifications' node web/qa/QA-2026-10-13/deal.mjs
QA_ONLY='completion' node web/qa/QA-2026-10-13/deal.mjs
QA_ONLY='hides completed' node web/qa/QA-2026-10-13/moderation.mjs
node web/qa/QA-2026-10-13/content-proof.mjs
node web/qa/QA-2026-10-13/profile-full.mjs
node web/qa/QA-2026-10-13/final-proof.mjs
node web/qa/QA-2026-10-13/notifications-proof.mjs
```

ეს კონკრეტული QA სესიის ეტაპობრივი სკრიპტებია; ხელახლა გაშვება მუტაციებს იწვევს. `QA_ONLY` კონკრეტულ შემოწმებას არჩევს და არსებული storageState გამოიყენება. ახალი სრული ციკლისთვის საჭიროა ლოკალური შესაბამისი fixture/თავისუფალი quota და მდგომარეობების ხელახალი შეფასება; ამ დასრულებულ გარიგებაზე სრული `deal.mjs` თავიდან არ გაუშვათ.

[runner-checks.json](shots/flows/runner-checks.json) ინახავს ყველა ცდას და შესწორების ისტორიას. `PASS` სახელით „missing DOM proof“/„no visible outcome“ ნიშნავს **ხარვეზის დადასტურებას**, არა პროდუქტის წარმატებას. პირველი navigation timeout (15 წამი), hidden-category სელექტორი, გარდამავალი ორი main, პროდუქტის გაქრობილი notice, უკვე pending verification-ის ხელახლა ატვირთვის ცდა, review ღილაკის ძველი სახელის სელექტორი და hidden-modal-ის duplicate ტექსტი **runner-ის ცდებია, დამოუკიდებელ პროდუქტულ ხარვეზებად არ დათვლილა**. პროდუქტის შენახვა და review საბოლოოდ სხვა მტკიცებულებით დადასტურდა.

QA სკრიპტების `node --check`, Markdown evidence link-ების არსებობა, საიდუმლო მნიშვნელობების არყოფნის სკანი და `git diff --check` შესრულდა. აპლიკაციის build/unit/DB mutation suite არ გაშვებულა: პროდუქტის კოდი არ შეცვლილა; ამ ამოცანის შემოწმება რეალური UI ციკლები და read-only DB დამოწმებაა.

## დარჩენილი ლოკალური მდგომარეობა

- ახალი QA კომპანია რჩება `approved` და შევსებული პროფილით/პროდუქტით; ერთმა ახალმა Auth ანგარიშმა საერთო Auth-ში რეალურად იარსება. მისი წაშლა ან სხვა ანგარიშების პაროლის შეცვლა არ შესრულებულა.
- hotel-ის ახალი მოთხოვნა მონახაზია; არსებული fixture გარიგება დასრულებულია; მის შეფასებას ადმინმა `hidden` სტატუსი მისცა. საჩივარი `handled/rejected`-ია. ისტორია/შეტყობინებები შენარჩუნებულია.
- owner_company-ის პროფილი QA მნიშვნელობებით განახლდა, მათ შორის დარგი `furniture`, ლოგო და ერთი ახალი gallery ფოტო. დაუდასტურებელი სტატუსი უცვლელია; მე-13 პროდუქტის ცდიდან რიგები არ შენახულა.
- CMS პირველი ფოტო საწყისზე დაბრუნდა; გამოქვეყნების აუდიტის კვალი რჩება.
- `.private/` შეიცავს სესიის მდგომარეობას და gitignore-ით გამორიცხულია. დამატებითი worktree/clone არ შექმნილა; იზოლირებული checkout შენარჩუნებულია.
- მფლობელმა უნდა გადაამოწმოს ინტეგრირებული checkout და გამოიყენოს `agent integrate 213AE477-7ED8-4D9E-9CEF-DD1BB3ECB5F0`. ამ worker-ის ანგარიშში ინტეგრაცია შესრულებულად არ ცხადდება.


## მუდმივი E2E — 2026-10-13T13:33:47.870Z

გაშვება: `cd web && npm run dev -- --port 3402 --webpack`, შემდეგ `cd web && npm run e2e`. BASE: http://localhost:3402. ხანგრძლივობა: 326.9 წმ. PASS: 20; FAIL: 18. SQL seed: 0 (გამოძახებები: []). [სრული ანგარიში](e2e-report.json). FAIL დამოკიდებულება მიუთითებს შეუსრულებელ წინაპირობაზე და არა დადასტურებულ დამოუკიდებელ პროდუქტის ხარვეზზე.

| ნაბიჯი | შედეგი |
|---|---|
| A01-register-company | PASS |
| A02-onboarding-type-both | PASS |
| A03-onboarding-details-minimal | PASS |
| A04-onboarding-profile-logo | PASS |
| A05-onboarding-product-service | PASS |
| A06-onboarding-xlsx-import | PASS |
| A07-onboarding-need | PASS |
| A07b-verification-required-legal-details | PASS |
| A08-onboarding-verify-documents | PASS |
| A09-onboarding-review-dashboard | PASS |
| B01-hotel-close-old-e2e-requests | PASS |
| B02-hotel-publish-request-photo | PASS |
| B03-guest-request-list | FAIL |
| B04-guest-home | FAIL |
| B05-wood-matching | PASS |
| B06-wood-offer-file | FAIL |
| B07-wood-withdraw-offer | FAIL |
| B08-wood-resend-offer | FAIL |
| B09-hotel-compare-select | FAIL |
| B10-deal-discuss-both-directions | FAIL |
| B11-deal-terms-both-confirm | FAIL |
| B12-deal-progress-file-download | FAIL |
| B13-deal-complete | FAIL |
| B14-deal-review | FAIL |
| B15-review-public-profile | FAIL |
| C01-admin-return-documents | FAIL |
| C02-company-return-reason | FAIL |
| C03-company-resubmit-documents | PASS |
| C04-admin-approve-verification | PASS |
| C05-company-public-verification-badge | PASS |
| C06-admin-hide-review | FAIL |
| C07-admin-restore-review | FAIL |
| C08-hotel-complaint | PASS |
| C09-admin-resolve-complaint | PASS |
| C10-hotel-complaint-result-georgian | FAIL |
| C11-admin-catalog-image-public | FAIL |
| C12-admin-catalog-image-restore | PASS |
| D01-guest-request-login-context | PASS |

| ID | ფაქტი | მტკიცებულება | სიმძიმე | ფაილი | acceptance |
|---|---|---|---|---|---|
| QA-14 | B06-wood-offer-file: locator.fill: Timeout 12000ms exceeded. Call log:   - waiting for locator('#of-body')  \| wood: console error: Failed to load resource: the server responded with a status of 429 () \| wood: console error: MarketStore: refresh failed Error: Too many requests. Please try again later.     at authFetch (webpack-internal:///(app-pages-browser)/./app/lib/market-store.js:245:23)     at async eval (webpack-internal:///(app-pages-browser)/./app/lib/market-store.js:272:48)     at async loadUserJwt (webpack-internal:///(app-pages-browser)/./app/lib/market-store.js:293:20)     at async load (webpack-internal:///(app-pages-browser)/./app/lib/market-store.js:834:55) \| wood: HTTP 429 GET https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/get-session RPC=(none) body={"message":"Too many requests. Please try again later."} | [კადრი](shots/e2e/16-b06-wood-offer-file-wood-1440.png), [კადრი](shots/e2e/16-b06-wood-offer-file-wood-390.png); e2e-report.json | P2 / დასაკვლევი | web/app/components/market/SendOfferForm.tsx; RequestViewPageContent.tsx; runner: web/qa/e2e-full.mjs (B06-wood-offer-file); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |
| QA-15 | C01-admin-return-documents: owner_admin: console error: Failed to load resource: the server responded with a status of 429 () \| owner_admin: HTTP 429 GET https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/get-session RPC=(none) body={"message":"Too many requests. Please try again later."} | [კადრი](shots/e2e/26-c01-admin-return-documents-owner_admin-1440.png), [კადრი](shots/e2e/26-c01-admin-return-documents-owner_admin-390.png); e2e-report.json | P2 / დასაკვლევი | web/app/components/market/VerificationDocuments.tsx; AdminReviews.tsx; AdminReports.tsx; runner: web/qa/e2e-full.mjs (C01-admin-return-documents); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |
| QA-16 | C02-company-return-reason: newcompany: console error: Failed to load resource: the server responded with a status of 429 () \| newcompany: HTTP 429 GET https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/get-session RPC=(none) body={"message":"Too many requests. Please try again later."} | [კადრი](shots/e2e/27-c02-company-return-reason-newcompany-1440.png), [კადრი](shots/e2e/27-c02-company-return-reason-newcompany-390.png); e2e-report.json | P2 / დასაკვლევი | web/app/components/market/VerificationDocuments.tsx; AdminReviews.tsx; AdminReports.tsx; runner: web/qa/e2e-full.mjs (C02-company-return-reason); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |
| QA-17 | C10-hotel-complaint-result-georgian: Complaint status must be Georgian; displayed: rejected | [კადრი](shots/e2e/35-c10-hotel-complaint-result-georgian-hotel-1440.png), [კადრი](shots/e2e/35-c10-hotel-complaint-result-georgian-hotel-390.png); e2e-report.json | P2 / დასაკვლევი | web/app/components/market/EngagementPanels.tsx (NoticeDetail); runner: web/qa/e2e-full.mjs (C10-hotel-complaint-result-georgian); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |
| QA-18 | C11-admin-catalog-image-public: page.waitForFunction: Timeout 12000ms exceeded. | [კადრი](shots/e2e/36-c11-admin-catalog-image-public-owner_admin-1440.png), [კადრი](shots/e2e/36-c11-admin-catalog-image-public-owner_admin-390.png), [კადრი](shots/e2e/36-c11-admin-catalog-image-public-content-guest-1440.png), [კადრი](shots/e2e/36-c11-admin-catalog-image-public-content-guest-390.png); e2e-report.json | P2 / დასაკვლევი | web/app/components/market/AdminContentEditor.tsx; CompaniesPageContent.tsx; runner: web/qa/e2e-full.mjs (C11-admin-catalog-image-public); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |
| QA-19 | დამოკიდებული ნაბიჯები — იხ. e2e-report.json (11 ნაბიჯი) | [ანგარიში](e2e-report.json) | დამოკიდებულება | web/qa/e2e-full.mjs | ფესვური ბლოკერების გასწორების შემდეგ ნაბიჯები სრულდება |


დარჩენილი: B03-guest-request-list, B04-guest-home, B06-wood-offer-file, B07-wood-withdraw-offer, B08-wood-resend-offer, B09-hotel-compare-select, B10-deal-discuss-both-directions, B11-deal-terms-both-confirm, B12-deal-progress-file-download, B13-deal-complete, B14-deal-review, B15-review-public-profile, C01-admin-return-documents, C02-company-return-reason, C06-admin-hide-review, C07-admin-restore-review, C10-hotel-complaint-result-georgian, C11-admin-catalog-image-public. სკრინშოტები ადგილობრივია, git-ში არ დაამატოთ.

გაშვების დამატებითი დიაგნოსტიკა:

- A01-ის საწყისი `complete_profile` HTTP 400 იყო `MA405` — განმეორებით გამოყენებული ტელეფონის ნომერი. ყოველი გაშვების უნიკალური ნომრით A01 და სრული onboarding ახლა PASS-ია; ცარიელი დასრულების ფორმის fallback შენარჩუნებულია.
- B03/B04: `listRequests({includeTests:false})` და `isInternalTestRequest` საჯაროდ ფილტრავს `[e2e]` მოთხოვნებს (`market-store.js`, `catalog-visibility.js`). მოთხოვნა B02-ში შეიქმნა და B05 matching-ში გამოჩნდა. მოთხოვნილი პრეფიქსი შენარჩუნებულია.
- B06, C01, C02 და B04: Neon Auth `get-session` HTTP 429; ზუსტი URL და პასუხის ტექსტი ზემოთ და JSON-ის `http` ველშია. B06-ის შემდეგ 11 ნაბიჯი დამოკიდებულების გამო FAIL-ია. ეს 11 ცალკე პროდუქტის ხარვეზი არ არის.
- C10: შედეგი აჩვენებს ინგლისურ `rejected`-ს. C11: გამოქვეყნებული კატალოგის ფოტო `/companies/` გვერდის სურათებში არ გამოჩნდა. C12-ით თავდაპირველი ფოტოს ბაიტები აღდგა.
- B01: UI-ით გასუფთავება საკმარისი აღმოჩნდა; `freeRequestQuota` SQL seed არ შესრულებულა. მისი SQL ლოკალურ PostgreSQL-ში `EXPLAIN`-ით შემოწმდა, მონაცემების ცვლილების გარეშე.
- საბოლოო გაშვება: 326.9 წმ, 20 PASS / 18 FAIL, 7 დამოუკიდებელი FAIL-რიგი და 11 დამოკიდებული ნაბიჯი. წინამორბედ დიაგნოსტიკურ გაშვებაში შესრულდა გარიგების terms/progress/download/complete და შეფასების მოდერაცია; საბოლოო ანგარიშში მათი შედეგი არ გადმოტანილა.

სკრიპტის ბოლო ცვლილება (ხელახლა გაშვების გარეშე): საჯარო `[e2e]` ფილტრი პროდუქტის განზრახ წესია, ამიტომ B03/B04-ის ხარვეზის რიგები ამოღებულია. ახალი სათაურია `ხის მაგიდები e2e-<ts>`; cleanup ეძებს hotel-ის `title ilike '%e2e-%'` ღია მოთხოვნებს. ზემოთ არსებული ნაბიჯების ცხრილი და JSON წინა გაშვების ისტორიული შედეგებია. ახალი ვერსია როლის context-ს ხელახლა იყენებს, ნაბიჯებს შორის მინიმუმ 3 წამს იცდის და HTTP 429-ზე ნაბიჯს 60 წამის შემდეგ მაქსიმუმ ორჯერ იმეორებს; ყველა მცდელობის მტკიცებულება JSON-ის `attempts` ველში ინახება. ახალი შედეგები ინტეგრირებულ აპზე ორკესტრატორის გაშვებას ელოდება.
