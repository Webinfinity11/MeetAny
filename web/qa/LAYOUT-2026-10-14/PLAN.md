# განლაგება და სიმჭიდროვე — გეგმა (2026-10-14)

ორკესტრატორი: ნაკადი „განლაგება და სიმჭიდროვე“ (0CC7983D-2C35-42B8-981B-F1D98A7C3E62). დაფა: ფაზა P8, ამოცანები T8.1–T8.10. მფლობელის გადაწყვეტილებები საბოლოოა — დასტურს არ ვითხოვთ.

## 0. მფლობელის გადაწყვეტილებები

1. **დესკტოპის ფორმები** (კომპანიის პროფილი `/account/?tab=profile`, პარამეტრების სხვა ჩანართები, `/onboarding/`, `/requests/new/`): ფორმის სვეტი ~640px + მარჯვნივ sticky გვერდითი პანელი — წინასწარი ხედი „ასე ჩანს“, სტატუსი/შევსების პროგრესი, მთავარი მოქმედება. ეკრანის სიგანე ათვისებულია. მობილურზე პანელი ფორმის ქვემოთ/ზემოთ კომპაქტურად.
2. **გრძელი ფორმები** (კომპანიის პროფილი, 6+ ბლოკი): თითო ბლოკი ცალკე შენახვით — ბლოკის თავში სათაური, ბლოკის ბოლოს საკუთარი „შენახვა“ და „შენახულია“ მდგომარეობა (Google/GitHub account settings). გლობალური sticky „შენახვა“ ზოლი ქრება. შეუნახავ ბლოკზე გაფრთხილება გვერდის დატოვებისას რჩება.
3. **სიმჭიდროვე**: საიტი ზედმეტად გაშლილია → კომპაქტური. ბლოკებს/სექციებს შორის ნაკლები ცარიელი სივრცე, მეტი შინაარსი ერთ ეკრანზე, ტელეფონზე ნაკლები სქროლი. ტექსტის ზომები (type-audit) და 44px შეხების სამიზნეები უცვლელი. ჯერ ტოკენები (`tokens.css`), მერე გვერდები — ერთნაირი დაშორებები ყველგან.
4. **ფართობები — ყველა**: (ა) პროფილი/პარამეტრები/onboarding, (ბ) კატალოგი `/requests/`, `/companies/` — ბარათები, ფილტრები, ბადე, (გ) დეტალის გვერდები (მოთხოვნა, კომპანია, შეთავაზება, გარიგება), (დ) მთავარი და ტელეფონი ზოგადად.
5. **არჩევის ველები მხოლოდ ჩამოსაშლელი** (`ui/Combobox`, `ui/MultiCombobox`) — უკვე ლაივზეა და ბაზაშია (commit-ები `1777fcd`, `22fc483`, `9d0f943`, `d4f6feb`; `CategoryChips/CityChips/ChipsInput` წაშლილია). ჩიპების კედელი არსად. T7.16 (კომპანიის SSR seed, `003bbed`, `fa01d54`) ასევე ბაზაშია — ფორმებისა და კომპანიის დეტალის წინაპირობები შესრულებულია.

ბაზა ნაკადებისთვის: ორკესტრატორის checkout-ის HEAD — `116f093` (ტოკენები) ყველა ნაკადმა ჯერ `git cherry-pick -x 116f093` უნდა გააკეთოს, თუ `--block-gap` ტოკენი checkout-ში ჯერ არ ჩანს. `npm test` Node 26-ზე ჭედავს — `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`.

საერთო წესები: ერთი დავალება ორჯერ არ კეთდება (ჯერ `git log`, დაფა, კოდი). ფუნქციონალი უცვლელი (გამონაკლისი — გადაწყვეტილება 2, ბლოკური შენახვა). სადემო მონაცემებს არ ვეხებით. ცოცხალ ბაზას/დეპლოის არ ვეხებით. Neon Auth-ს არ ვიყენებთ — მხოლოდ ლოკალური JWT fixture (§4).

## 1. მეთოდი

1. **ინვენტარი (T8.1)** — ყველა გვერდზე 1440/390 გაზომვა: სექციებს შორის ცარიელი px, შინაარსის სიგანე vs ეკრანი, სქროლის სიმაღლე, ფორმის სვეტის სიგანე. შედეგი `INVENTORY.md` + `before/` კადრები + განმეორებადი `measure.mjs`.
2. **ტოკენები (T8.2)** — §2-ის სკალა `tokens.css`-ში; `DESIGN-SYSTEM.md`-ის „ზომები“ სექცია.
3. **ფართობები ნაკადებად (T8.3–T8.9)** — თითოეული საკუთარი ფაილებით (§3), ტოკენების commit-ზე. გვერდის ad hoc დაშორებები (`--space-10/12/16`, `margin-top: var(--space-8)` და მსგავსი სექციებს შორის) იცვლება სემანტიკური ტოკენებით: `--section-gap`, `--block-gap`, `--stack-gap`, `--page-pad-y`.
4. **ინტეგრაცია (T8.10)** — ორკესტრატორი აგროვებს commit-ებს, უშვებს ყველა შემოწმებას, აგზავნის ერთ ანგარიშს მთავარ სესიაში.

**სიმჭიდროვის წესები** (ყველა ნაკადისთვის):
- სექციებს შორის მობილურზე ≤32px, დესკტოპზე ≤56px; ბლოკებს/ბარათებს შორის 16/20px; ბლოკის შიგნით 12/16px.
- ბარათის შიდა padding 16/20px რჩება; სიის რიგებისთვის 12/16px.
- ფორმის ველებს შორის 16px (იყო 20); label→input 6px რჩება.
- გვერდის ზედა/ქვედა padding 20/32px (იყო ხშირად 40–64).
- სათაურის ბლოკი (h1 + ქვესათაური) და პირველი შინაარსი ერთ ეკრანზე 390-ზე.
- 390-ზე სქროლის სიმაღლე ყოველ გვერდზე უნდა შემცირდეს ≥15% (ინვენტარის before vs after); სადაც არა — ახსენით.
- ტიპოგრაფია, 44px სამიზნეები, ფერები, რადიუსები უცვლელი.

## 2. ტოკენების სკალა (T8.2, გადაწყვეტილი)

`web/app/styles/tokens.css`, `:root` + media query-ები. ყველა ახალი მნიშვნელობა არსებულ `--space-*` სკალას ეყრდნობა.

| ტოკენი | მობილური | ≥768 | ≥1024 | როლი |
|---|---|---|---|---|
| `--section-gap` | 32px (იყო 48) | 32px | 56px (იყო 80) | სექციებს შორის (მთავარი, სტატიკური გვერდები) |
| `--block-gap` (ახალი) | `--space-4` 16px | `--space-5` 20px | — | ბლოკებს/ბარათებს შორის ერთ სვეტში |
| `--stack-gap` (ახალი) | `--space-3` 12px | `--space-4` 16px | — | ბლოკის შიგნით ელემენტებს შორის |
| `--page-pad-y` (ახალი) | `--space-5` 20px | `--space-8` 32px | — | `main`-ის ზედა/ქვედა დაშორება |
| `--hero-pad-y` (ახალი) | `--space-8` 32px | — | `--space-12` 48px | მთავარი/კატალოგის hero |
| `--card-pad` | 16px | 20px | — | უცვლელი |
| `--card-pad-sm` (ახალი) | `--space-3` 12px | `--space-4` 16px | — | სიის რიგები, ბარათის ქვედა ზოლი |
| `--form-gap` (ახალი) | `--space-4` 16px | — | — | `.ma-form` ველებს შორის (იყო `--space-5`) |
| `--form-col` (ახალი) | — | — | 640px (`--size-640`) | ფორმის სვეტი დესკტოპზე |
| `--panel-col` (ახალი) | — | — | 320px (`--size-320`) | გვერდითი sticky პანელი |
| `--form-panel-gap` (ახალი) | — | — | `--space-8` 32px | სვეტსა და პანელს შორის |
| `--panel-top` (ახალი) | — | — | `calc(var(--header-h) + var(--space-4))` | sticky პანელის `top` |

`primitives.css`-ში `.ma-form`-ის gap → `var(--form-gap)`. `lint:design` უნდა გადიოდეს ახალი ტოკენებით (ყველა px სკალაზეა). `DESIGN-SYSTEM.md` §„ზომები“ ცხრილს ემატება ეს სტრიქონები.

## 3. ნაკადები, ფაილები, რიგი

ყველა ნაკადი: ცალკე checkout, ცალკე ლოკალური ბაზა და პორტი (§4). ფაილების სიები **ამომწურავია** — სხვა ფაილის შეცვლა საჭიროების შემთხვევაში ორკესტრატორს ეცნობება და არ კეთდება თვითნებურად. ყველა ნაკადს აქვს: `web/qa/LAYOUT-2026-10-14/<area>/` (ანგარიში, after კადრები, საკუთარი სკრიპტი).

| ამოცანა | ნაკადი (kind) | ფაილები (მხოლოდ ეს) | წინაპირობა | პორტი / ბაზა |
|---|---|---|---|---|
| T8.1 ინვენტარი | research | `web/qa/LAYOUT-2026-10-14/INVENTORY.md`, `measure.mjs`, `before/**` | — | 3440 / `meetany_layout_inv` |
| T8.2 ტოკენები | execute | `web/app/styles/tokens.css`, `web/app/styles/primitives.css` (მხოლოდ `.ma-form` gap), `DESIGN-SYSTEM.md`, საჭიროებისას `web/scripts/lint-design.mjs` | — | — |
| T8.3 კატალოგი | design | `web/app/components/market/{RequestsPageContent,CompaniesPageContent,RequestRow,CompanyListingCard,OpportunityCard,CatalogHeader,CatalogSearch,MobileFilterSheet,CompaniesMap,CompanyCatalogCover}.tsx`, `market/OpportunityCard.module.css` (ბარათი კატალოგში, მთავარზე და დეტალის „მსგავსი“ ბლოკში — ერთი მფლობელი), `market/catalog/*`, `market/RequestCatalogCover.module.css`, `web/app/styles/cards.css`, `web/app/styles/pages/catalog.css`, `web/app/(requests)/**`, `web/app/(companies)/**` | T8.1 + T8.2 | 3441 / `meetany_layout_catalog` |
| T8.4 მთავარი + ტელეფონი | design | `web/app/(home)/**`, `web/app/components/home/*`, `web/app/components/{HomeLive,HomeBusinessScene,BusinessIdeas,Header,Footer,SiteShell,StatusPage}.tsx`, `Header.module.css`, `Footer.module.css`, `StatusPage.module.css`, `web/app/styles/pages/homepage.css`, `web/app/styles/base.css`, `web/app/styles/patterns.css`, `web/app/(how)/**`, `web/app/(terms)/**`, `web/app/(ideas)/**`, `web/app/styles/pages/ideas.css` | T8.1 + T8.2 | 3442 / `meetany_layout_home` |
| T8.5 დეტალი: მოთხოვნა/შეთავაზება/გარიგება | design | `web/app/components/market/{RequestViewPageContent,OfferCard,MakeOfferPageContent,CompareOffersPageContent,DealViewPageContent,DealShell,DealTermsForm,DealCollaboration,DealDiscussion,EngagementPanels,RequestAlertSettings}.tsx`, `market/request/*`, `market/flow-details.module.css`, `market/deals.module.css`, `market/MakeOffer.module.css`, `web/app/styles/pages/detail.css` (მხოლოდ მოთხოვნის/გარიგების სელექტორები — კომპანიის პროფილის სელექტორებს არ ეხება), `web/app/(request-view)/**`, `web/app/(make-offer)/**`, `web/app/(compare-offers)/**`, `web/app/(deals)/**` | T8.1 + T8.2 | 3443 / `meetany_layout_detail` |

ინვენტარის დასკვნები ფართობების მიხედვით: `INVENTORY.md` §3 და §6 (ფაილი:ხაზი), ბარათების სიმაღლეები §4, ფორმები §5. ყოველი ფართობის ნაკადი after-ს იმავე `measure.mjs`-ით ზომავს (§1 „გაშვება“) და before-ს `before/measure-<role>.json`-დან ადარებს.
| T8.6 დეტალი: კომპანია | design | `web/app/components/market/{CompanyProfilePageContent,CompanyGallery,CompanyProducts,ProductCard,CompanyAvatar}.tsx`, `market/company/*`, `web/app/styles/pages/detail.css` (მხოლოდ კომპანიის სელექტორები), `web/app/(company-view)/**` | T8.5 დასრულებული (detail.css); T7.16 ბაზაშია | 3447 / `meetany_layout_company` |
| T8.7 FormLayout + onboarding (პრიორიტეტი) | design | ახალი `web/app/components/ui/FormLayout.tsx` + `form-layout.module.css` (+ `ui/index.ts` ექსპორტი), `web/app/components/ui/{Combobox,MultiCombobox}*` (მხოლოდ წვრილმანი: სიაში checkbox-სა და ტექსტს შორის ცარიელი icon-სლოტის მოხსნა), `web/app/components/market/{OnboardPage,OnboardSteps,OnboardFields,ProductsImport}.tsx`, `market/onboarding.module.css`, `web/app/(onboarding)/**` | T8.2 (ინვენტარს არ ელოდება) | 3446 / `meetany_layout_onboard` |
| T8.8 კომპანიის პროფილი + ანგარიშის სივრცე | build | `web/app/components/market/account/*` (Profile.tsx, ProfileForm.module.css, AccountShell, account.module.css, Dashboard, MyRequests, MyOffers, MyDeals, Filters, shared, nav), `market/{AccountPageContent,ProfileItems,PhotoField,VerificationDocuments,CompanyBusiness,Inbox,ChatPopup*}.tsx`, `market/Distribution.*`, `web/app/styles/pages/account.css`, `web/app/(account)/**` | T8.7 (FormLayout) | 3445 / `meetany_layout_profile` |
| T8.9 /requests/new/ + CompanyUpgrade | design | `web/app/components/market/PostRequestPage.tsx`, `market/post/*`, `market/RequestPreferences.tsx`, `web/app/styles/pages/post.css`, `web/app/styles/pages/forms.css`, `web/app/(requests-new)/**`, `market/account/CompanyUpgrade.*` (T8.8-თან შეთანხმებით — ეს ორი ფაილი T8.9-ისაა) | T8.7 (FormLayout) | 3444 / `meetany_layout_post` |
| T8.10 ინტეგრაცია | ორკესტრატორი | — | ყველა | — |

პარალელურობა: T8.1 ∥ T8.2 ∥ T8.7 → (T8.3 ∥ T8.4 ∥ T8.5) → (T8.6 ∥ T8.8 ∥ T8.9) → T8.10. საერთო ფაილები (`primitives.css`, `patterns.css`, `base.css`, `detail.css`) მხოლოდ ერთ ნაკადს აქვს ერთდროულად.

### 3.1 ფორმა + პანელი (T8.7, T8.8, T8.9)

`ui/FormLayout` — ერთი კომპონენტი სამივე ფორმისთვის: `<FormLayout aside={<...>}>{form}</FormLayout>`. ≥1024px: grid `minmax(0, var(--form-col)) var(--panel-col)`, gap `--form-panel-gap`, პანელი `position: sticky; top: var(--panel-top)`; მთლიანი სიგანე კონტეინერის ფარგლებში, მარცხნივ გასწორებული. <1024px: ერთი სვეტი, პანელი ფორმის **ზემოთ** კომპაქტური ზოლით (სტატუსი + პროგრესი, 44px მოქმედება) ან ქვემოთ — ნაკადი ირჩევს გვერდის მიხედვით და ასაბუთებს ანგარიშში. პანელის სტანდარტული ბლოკები: (1) „ასე ჩანს“ — რეალური ბარათი/სათაური იმავე კომპონენტით, რასაც საჯარო გვერდი იყენებს (`OpportunityCard`/`CompanyListingCard`, არა ასლი); (2) სტატუსი და შევსების პროგრესი (რამდენი ბლოკი/ნაბიჯი შევსებულია); (3) მხოლოდ მეორადი ბმული (მაგ. „საჯარო გვერდის ნახვა“, „გადით“). **მთავარი მოქმედება პანელში არ იდება** (მთავარი სესია, 2026-10-14: ეკრანზე ერთი primary) — „შემდეგი/განთავსება/გაგზავნა/გააგრძელეთ“ მხოლოდ ფორმის ფუტერში; მობილურზე sticky ქვედა ზოლი.

### 3.2 onboarding (T8.7) — მფლობელის შენიშვნა 2026-10-14 (step=type, 1440)

ხარვეზები: (1) „ასე გამოჩნდებით“ პანელი ბარათების რიგში მე-4 სვეტადაა → სამი ბარათი ვიწროა, სათაური სიტყვის შუაში წყდება („მომწოდებლები / ს პოვნა“); (2) ბარათები სხვადასხვა სიმაღლის, ხატულა + რადიო ორივე; (3) მარცხენა ნაბიჯი „ანგარიშის ტიპი“ ≠ სათაური „როგორ გამოიყენებთ MeetAny-ს?“; (4) აქტიური ნაბიჯი 1, 2–4 კი უკვე ✓ — სტატუსი გაუგებარია; (5) ფუტერში მხოლოდ „შემდეგი“ მარჯვნივ, „უკან“ არ არის, ქვემოთ დიდი ცარიელი სივრცე.

გადაწყვეტილება — ყველა ნაბიჯი (type, details, profile, provide, need, verify, review) ერთ შაბლონზე = `FormLayout`:
- ≥1280px სამი სვეტი: მარცხნივ stepper (~220–240px), ცენტრში ფორმის სვეტი `--form-col` (640px), მარჯვნივ sticky პანელი „ასე გამოჩნდებით“ `--panel-col` (300–320px) — პანელი **არასდროს** ფორმის შიგნით/ბარათების რიგში. 1024–1279px: stepper ჰორიზონტალურ ზოლად ფორმის ზემოთ, ფორმა + პანელი. <1024px: ერთი სვეტი; stepper → „ნაბიჯი 2/6“ + პროგრესის ზოლი; პანელი ფორმის ქვემოთ ჩაკეცილი (`<details>`/ღილაკი „ასე გამოჩნდებით“).
- ნაბიჯის სახელი = გვერდის სათაური (ერთი და იგივე ტექსტი `stepLabels`-სა და `titles`-ში — გააერთიანეთ ერთ წყაროდ), ქვესათაური ერთი წინადადება (`leads`).
- stepper-ის სტატუსები ვიზუალურად გამიჯნული: „შევსებულია“ (✓, მუქი ტექსტი), „მიმდინარე“ (ყოველთვის გამოკვეთილი — ფონი `--active-bg`, მარცხენა ზოლი ან bold, `aria-current="step"`), „მომავალი“ (`--text-3`). მიმდინარე ნაბიჯი შევსებულადაც რომ იყოს, მიმდინარედ გამოიყურება.
- არჩევანი (step=type და სხვა radio არჩევანი): ერთ სვეტად radio-row ბარათები — ხატულა მარცხნივ, სათაური + ერთი ხაზი ტექსტი, რადიო მარჯვნივ; ერთნაირი სიმაღლე; `word-break: normal; hyphens: none; overflow-wrap: normal` — სიტყვა შუაში არ წყდება.
- ფუტერი ფორმის სვეტის სიგანეზე: „უკან“ მარცხნივ (`ma-btn--secondary`, პირველ ნაბიჯზე არ ჩანს ან disabled), „შემდეგი“/„დასრულება“ მარჯვნივ (`ma-btn--primary`); მობილურზე sticky ქვედა ზოლი (safe-area); ფუტერის ქვემოთ დიდი ცარიელი სივრცე არა — `--page-pad-y`.
- პანელის შიგთავსი: `OnboardPreview` (რეალური `CompanyListingCard`-ის მსგავსი ბარათი), შევსების პროგრესი (N/7 ნაბიჯი), სტატუსი „შენახულია HH:MM“ (`savedAt`), მეორადი ბმული „გადით“.
- შემოწმება: ყველა ნაბიჯი 1440/1280/1024/390/360 — overflow 0, სიტყვის გაწყვეტა 0 (DOM-ში სათაურების `getClientRects` ერთ ხაზზე ან სიტყვის საზღვარზე), axe 0, pageerror 0; დრაფტის დაცვა/შენახვის ლოგიკა უცვლელი (`validateOnboardStep`, `saveOnboardStep`, `useUnsavedGuard`).

ბლოკური შენახვა (T8.8): ყოველი ბლოკი `<section class="account-section">` — სათაური (h2) + ერთწინადადებიანი აღწერა, ველები, ქვედა ზოლი მარჯვნივ `შენახვა` (ბლოკის ცვლილებამდე `disabled`), შენახვის შემდეგ ზოლში „შენახულია · 14:05“ ტექსტი 3 წმ, შეცდომა ზოლში წითლად. ბლოკის ცვლილება სხვა ბლოკს არ ეხება. `useUnsavedGuard` ბლოკების dirty-ის OR-ზე. გლობალური `.ma-form-bar` ამ გვერდიდან ქრება. RPC-ები/ველების სია უცვლელი — მხოლოდ სად და როდის იგზავნება.

## 4. ნაკადის გარემო (ყოველი checkout)

ორკესტრატორი ნაკადის გახსნისთანავე checkout-ში დებს: `web/node_modules` (symlink), `web/.env.local` (**მხოლოდ ლოკალური** `DATABASE_URL` და `MEETANY_LOCAL_DATABASE_URL`; Neon Auth/Blob გასაღებები რჩება, მაგრამ ავტორიზაციისთვის არ გამოიყენება), `DEMO-ACCOUNTS.local.md` (რეპოს root), `web/qa/LAYOUT-2026-10-14/PLAN.md` (ეს ფაილი; არ დაკომიტდეს, თუ უკვე არ არის ისტორიაში). ბაზა უკვე შექმნილია (§3 ცხრილი; `pg_dump meetany_layout_20261014`-ის ასლი, perf snapshot-იდან).

```sh
# web/-დან, ცალკე ტერმინალებში (პორტები §3-დან; AUTH პორტი = 1000 + dev პორტი)
node qa/perf-2026-10-12/auth-fixture.mjs 4441
NEON_AUTH_BASE_URL=http://127.0.0.1:4441 REQUIRE_EMAIL_VERIFICATION=off REGISTRATION_ANALYTICS_ENABLED=false npm run dev -- --webpack --hostname 127.0.0.1 --port 3441
```
Turbopack symlink-ზე ვარდება — ყოველთვის `--webpack`. სერვერი ფონურ რეჟიმში (`run_in_background`), ლოგი `web/qa/LAYOUT-2026-10-14/<area>/server.log`-ში.

**შესვლა Playwright-ში (Neon Auth-ის გარეშე)** — იგივე რეცეპტი, რასაც `web/qa/a11y-audit.mjs:135-145` იყენებს:

```js
const AUTH='http://127.0.0.1:4441', BASE='http://127.0.0.1:3441';
const ids={ client:'bacf1572-7493-4ac9-bfc7-95719e911c4c', company:'74cc28fc-47de-45cb-9563-93735b86855e', admin:'d2517b00-554d-4e6b-929a-ef3da51f3b47' };
const jwt = role==='guest' ? null : (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
const context = await browser.newContext({ viewport:{width,height: width<=390?844:1000}, serviceWorkers:'block' });
await context.route(`${AUTH}/**`, route => { const url=route.request().url(); if (url.includes('/.well-known/')) return route.continue();
  return route.fulfill({ headers:{ 'Access-Control-Allow-Origin':BASE, 'Access-Control-Allow-Credentials':'true', 'Access-Control-Expose-Headers':'set-auth-jwt', ...(jwt?{'set-auth-jwt':jwt}:{}) },
    json: url.includes('/get-session') ? (jwt ? { user:{ id:ids[role], email:'qa@local.test', name:'QA' } } : null) : { token:jwt } }); });
await context.route(/https:\/\/.*\/auth\//, route => route.abort());
await context.addInitScript(({signedIn}) => { if (signedIn) localStorage.setItem('meetany.session','1'); }, { signedIn: !!jwt });
```
Chrome: `chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })`. სხვა ID-ები: მოთხოვნა `0101aaac-f4e6-4ed4-b1bd-5a52e0942db9`, გარიგება `8e6766e1-b67e-408a-a8c0-e9e6944e115b` (ლოკალურ ბაზაში გადაამოწმეთ `psql`-ით; თუ არ არის — პირველი შესაფერისი ჩანაწერი).

**შემოწმებები ყოველ ნაწილზე** (`web/`-დან): `npx tsc --noEmit` (0), `npx eslint app` (0 error), `npm run lint:design`, `npm test`, `BASE=... AUTH=... node qa/a11y-audit.mjs --role <როლი>` შეცვლილ გვერდებზე (serious/critical 0, overflow 0), `BASE=... node qa/overlay-audit.mjs` (overlaps 0; სჭირდება `DEMO-ACCOUNTS.local.md` და შესვლა — თუ ლოკალურ auth-ზე ვერ გადის, იგივე შემოწმება საკუთარ სკრიპტში ლოკალური JWT-ით), ჰორიზონტალური overflow 0 და pageerror 0 320/390/1440-ზე.

**კადრები**: `web/qa/LAYOUT-2026-10-14/<area>/after/<გვერდი>-<როლი>-<1440|390|360>.png` (სრული გვერდი), before — ინვენტარის `before/`. PNG gitignore-შია: `git add -f web/qa/LAYOUT-2026-10-14/<area>/after/*.png`. რაოდენობა გონივრული (თითო გვერდი × 3 სიგანე).

**Commit-ები**: ქართულად, თემატურად; ბოლო ხაზი `ThreadRig-Thread: <ნაკადის სახელი>`. PLAN.md, `.env.local`, ledger არ დაკომიტდეს. ნაკადის საკუთარი commit-ების SHA-ები (cherry-pick-ით მიღებული გამოკლებული) ანგარიშში.

**ანგარიში**: დასრულებისას ერთი შეტყობინება ორკესტრატორს: `agent say 0CC7983D-2C35-42B8-981B-F1D98A7C3E62 "<area>: commit-ები …; კადრები web/qa/LAYOUT-2026-10-14/<area>/after; შემოწმებები …; before→after 390 სქროლი: …"`. მთავარ სესიას (717E24C5) ნაკადი პირდაპირ არ წერს — ორკესტრატორი აგზავნის ერთ ანგარიშს.

## 5. Mobbin რეფერენსები (2026-10-14, Mobbin MCP, web)

**ბლოკური შენახვა (account settings)** — ყველა ბლოკი ბარათია სათაურით, ქვედა ზოლით და საკუთარი „Save“-ით; ზოლში მარცხნივ მინიშნება, მარჯვნივ ღილაკი; შეუცვლელ ბლოკზე ღილაკი disabled:
- Vercel — https://mobbin.com/screens/50684193-8926-4ce6-9543-416339ba7ece (ბარათი: სათაური, აღწერა, ველი; ქვედა ნაცრისფერი ზოლი „Please use 32 characters at maximum“ + Save; toast „Your name has been updated“)
- Dub — https://mobbin.com/screens/c6f878d6-b08c-4817-bb41-8a778bb6343f (იგივე სქემა, Save Changes disabled სანამ არ შეიცვლება)
- Midday — https://mobbin.com/screens/d01b9e2d-1b42-43b6-a520-64ceb430442c · Neon — https://mobbin.com/screens/141af122-266b-48e8-9270-68289f3b9805 (Save ველების ქვეშ, მარჯვნივ სექციების ნავიგაცია) · Hume — https://mobbin.com/screens/0c37f095-961a-40dd-8eb1-fd68f026aa02 · Givingli — https://mobbin.com/screens/d7ab0158-54a8-4a04-9231-8075f50a7f40 (Cancel + Save წყვილი ბლოკში) · Homerun — https://mobbin.com/screens/995bd2b9-805d-4844-bd9e-46aa44945256 (ველის მარჯვნივ ახსნა, ქვედა ზოლი Save changes).
- ვიღებთ: ბარათი = ბლოკი; ქვედა ზოლი `--card-pad-sm`; disabled Save სანამ dirty არ არის; „შენახულია“ ზოლშივე. არ ვიღებთ: ცალკე toast ყოველ ბლოკზე (ერთი ზოლის ტექსტი საკმარისია), „Cancel“ ღილაკს (ბლოკი ისედაც პატარაა).

**ფორმა + გვერდითი პანელი (preview / summary / progress)**:
- Digg Edit profile — https://mobbin.com/screens/43f428b9-4468-4ab1-a209-b7ecb5f9a214 (მარჯვნივ sticky ბარათი „Previewing changes“: ავატარი, სახელი, რიცხვები; Save changes ზედა ზოლში)
- Ghost Customize listing — https://mobbin.com/screens/498a791d-3d09-4173-84f0-6ef58dfaa61d (მარცხნივ ფორმა, მარჯვნივ „Preview“ ბარათი + ერთი მუქი CTA + მიზეზი, რატომ ვერ ქვეყნდება)
- Coda Listing — https://mobbin.com/screens/5e4a9e55-f21e-428d-8526-ec6527afb79b (ფორმის სვეტი ~600px, მარჯვნივ „Card preview“ 240px)
- Whop Add product — https://mobbin.com/screens/ec320b59-1410-4ef2-8175-68e9bdf5a396 (პანელში „4/5 complete“ ჩეკლისტი)
- Snowflake listing — https://mobbin.com/screens/ebe82577-35c2-4479-8cf5-633d5e42d6c8 (მარჯვენა „Publishing guide“ ნაბიჯების სტატუსით)
- Nextdoor Create ad — https://mobbin.com/screens/39b683ce-84db-4e56-a120-649d3e61af66 (ფორმა ბლოკებად + მარჯვნივ „Ad preview“)
- Airtasker Create listing — https://mobbin.com/screens/1e71df22-4b58-413a-a86e-b14f58ce8088 (მარცხნივ ნაბიჯები, შუაში ფორმა, მარჯვნივ რჩევები — onboarding-ის სქემა)
- Eventbrite — https://mobbin.com/screens/62fe9780-57f5-4911-8a1d-b3a70bbdd94a (მარცხენა ბარათი: სათაური, თარიღი, სტატუსი „Draft“, ნაბიჯები; „Save and continue“ ქვედა მარჯვნივ)
- ვიღებთ: პანელი = რეალური ბარათის preview + პროგრესი + ერთი CTA; ფორმის სვეტი 600–640px; პანელი 280–320px. არ ვიღებთ: ზედა ზოლში Save-ს (ჩვენი CTA პანელშია და მობილურზე ქვედა ზოლში), პანელში რჩევების გრძელ ტექსტს.

ადრეული რეფერენსები სიებისა და დეტალისთვის: `web/qa/MOBBIN-REFS-GE.md` §1–§4 (LinkedIn რიგი ≈90–130px; დეტალი — ფაქტების ზოლი სათაურის ქვეშ, sticky მარჯვენა ბარათი).

## 6. ინვენტარის ფორმატი (T8.1)

`INVENTORY.md`: გვერდი × სიგანე ცხრილი — სქროლის სიმაღლე, `main` padding ზედა/ქვედა, შინაარსის მაქს. სიგანე და მარჯვენა ცარიელი მინდორი (1440), 5 ყველაზე დიდი ვერტიკალური ცარიელი ინტერვალი (px + ორი ელემენტის სელექტორი), ფორმის სვეტის სიგანე. ბოლოს — სია „სად იკარგება სივრცე“ ფართობების მიხედვით და რეკომენდაცია რომელი ტოკენი/სელექტორი უნდა შეიცვალოს. `measure.mjs` არგუმენტებით `BASE AUTH ROLE PAGES OUT` ისე, რომ ფართობის ნაკადებმა იგივე სკრიპტი after-ზე გაუშვან და ციფრები შეადარონ.
