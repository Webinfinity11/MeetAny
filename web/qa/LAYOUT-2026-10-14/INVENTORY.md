# ინვენტარი: ცარიელი სივრცე (T8.1, 2026-10-14)

გაზომვა **კოდის ცვლილებამდე** (base: commit `b01d5d0`). სკრიპტი `web/qa/LAYOUT-2026-10-14/measure.mjs`, ნედლი მონაცემები `before/measure-{guest,client,company}.json`, კადრები `before/<როლი>-<გვერდი>-<სიგანე>.png` (1440 / 390 / 360, სრული გვერდი).

## 1. მეთოდი და გარემო

- **გარემო:** dev `127.0.0.1:3440` (`next dev --webpack`), auth fixture `127.0.0.1:4440`, ლოკალური ბაზა `meetany_layout_inv`; ცოცხალ ბაზას/Neon Auth-ს არ შევხებივართ. შესვლა ლოკალური JWT-ით (`/__mint`, როგორც `a11y-audit.mjs:135-145`). Chrome (სისტემური), viewport 1440×1000, 390×844, 360×844; `reducedMotion: reduce`, ანიმაციები გათიშულია.
- **ლოდინი:** `main`-ში ტექსტი, `[aria-busy]`/skeleton არ არის, `document.fonts.ready`, networkidle (მაქს. 8 წმ), გვერდის ერთხელ გადასქროლვა lazy სურათებისთვის და scrollHeight-ის სტაბილურობა 3 ჯერ ზედიზედ.
- **რას ზომავს:** `document.scrollHeight` და მისი ეკრანების რაოდენობა (`/innerHeight`); `main`-ის padding (ხშირად 0 — padding ცხოვრობს პირველ wrapper-ზე `.ma-page`/`Terms_page`/…, ამიტომ ცხრილში „padding“ = პირველი wrapper-ის ზედა/ქვედა, `pageWrap` JSON-ში); შინაარსის სიგანე და მარჯვენა მინდორი = ყველა ტექსტის/მედიის/კონტროლის ყველაზე მარჯვენა კიდე (`content`), ასევე ყველაზე განიერი ბლოკი (`widest`); ფორმის სიგანე = ყველაზე მაღალი `form`/`.ma-form` ≥2 ველით, `fieldMaxWidth` = ყველაზე განიერი input/textarea.
- **ვერტიკალური ინტერვალები (ტოპ-5):** `main`-ის ხილული ბლოკური ელემენტები სიღრმე ≤4 (მოთხოვნილი ≤3 არ კმარა, რადგან გვერდს 1–2 გამჭვირვალე wrapper აქვს), თითოეულისთვის უახლოესი ზემოთა არა-მშობელი/არა-შვილი ბლოკი, რომელსაც ჰორიზონტალურად ≥50% ემთხვევა; ინტერვალი ≥8px. ასევე `main`-ის დასაწყისი/დასასრული.
- **„ცარიელი“ ვერტიკალური px:** `main`-ის ზოლები, რომლებშიც არც ერთი ტექსტის (Range rect), სურათის/svg-ის, ველის ან ღილაკის მართკუთხედი არ კვეთს y-ღერძს; ჯამი / `scrollHeight` (`empty.pctOfScroll`; `pctOfMain` — `main`-ის სიმაღლიდან). ეს **ზედა ზღვარია**: ბარათის შიგნითა padding-იც ცარიელად ითვლება, სურათის ფონი/ჩარჩო — არა; გვერდს ორი სვეტიც რომ ჰქონდეს, ზოლი ცარიელია მხოლოდ თუ ორივეში არაფერია. 390-ზე 25–50% ნორმაა, ამიტომ მნიშვნელოვანია **ცვლილება** after-ში, არა აბსოლუტური მნიშვნელობა.
- **განმეორებადობა:** სკრიპტი სამივე როლზე (1440+390) ორჯერ გავუშვი: 68 გაზომვა, scrollHeight სხვაობა ≤2px **ყველგან** (0 გადახრა), pageerror 0, შეცდომა 0. ერთადერთი მდგომარეობაზე დამოკიდებული გვერდია `/requests/new/` — სკრიპტი ყოველთვის იწყებს `?step=1`-ით და თვითონ ავსებს ველებს; ბაზაში შენახული მონახაზი ბანერს („მონახაზი აღდგენილია“) ამატებს ≈46px-ს 1440-ზე, ამიტომ ნაკადმა after-ში იგივე სკრიპტი ორჯერ გაუშვას და მეორე გაშვების ციფრი აიღოს.
- **გაშვება:** `BASE=… AUTH=… ROLE=guest|client|company PAGES='regex' OUT=<საქაღალდე> WIDTHS=1440,390,360 node qa/LAYOUT-2026-10-14/measure.mjs` (`NO_SHOTS=1` — კადრების გარეშე). ID-ები გადაიფარება `REQUEST_ID`, `OWN_REQUEST_ID`, `OPEN_REQUEST_ID`, `COMPANY_ID`, `DEAL_ID`-ით. `/requests/new/`-ზე ნაბიჯები 1→2→3 იშლება ველების შევსებით, **გაგზავნის გარეშე** (კატეგორია „ავეჯი“, თარიღი +10 დღე).
- **გაზომილი გვერდები:** 9 სტუმარი + 12 კლიენტი + 13 კომპანია = 34 გვერდი × 3 სიგანე = 102 გაზომვა, 0 შეცდომა, 0 pageerror, ჰორიზონტალური overflow 0 ყველგან. `/onboarding/` კომპანიისთვის `74cc28fc-…` **არ გადამისამართდა** (`onboarding_completed_at IS NULL`), ამიტომ ნორმალურად გაიზომა. კლიენტის როლისთვის `/matching/`, `/offers/new/` არ ზომავს (მხოლოდ კომპანიის გვერდებია). **ვერ გაზომილი: არაფერი.** დამატებით გაიზომა კომპანიის `account-opportunities` ჩანართი (რეალური ჩანართია `offers`-ის გვერდით).
- **შენიშვნა sticky/fixed ბლოკებზე:** `/requests/new/`-ზე 390-ზე ტოპ-ინტერვალად ჩანს „538px nav.post-steps → .post-actions“ — ეს **მოჩვენებითი** მნიშვნელობაა: `.post-actions` ფიქსირებული/sticky ქვედა ზოლია (გვერდის ქვედა padding 157px მისი სიმაღლისთვისაა), სამართლიანი გაზომვა ცარიელ ზოლებშია (`empty`).

## 2. ცხრილი: გვერდი × სიგანე

ფრჩხილებში — ეკრანების რაოდენობა (scrollHeight / innerHeight). „padding“ = პირველი wrapper-ის ზედა/ქვედა px (`main` თვითონ ≈ ყველგან 0/0, გარდა მთავარისა/„როგორ მუშაობს“-ის: ქვედა 80). „შინაარსი“ = ყველაზე მარჯვენა ტექსტი/მედია/კონტროლი 1440-ზე: სიგანე / მარჯვენა მინდორი (კონტეინერი ცენტრშია, ამიტომ 120 მარჯვნივ = 120 მარცხნივ; რეალური დანაკარგი ისაა, რაც კონტეინერშივე ცარიელია).

| გვერდი | სქროლი 1440 px (ეკრ.) | სქროლი 390 px (ეკრ.) | 360 px | padding ზ/ქ 1440 | padding ზ/ქ 390 | შინაარსი 1440: სიგანე / მარჯვ. მინდორი | ფორმა 1440 / 390 | ცარიელი % 1440 / 390 |
|---|---:|---:|---:|---|---|---|---|---|
| guest/home | 5353 (5.35) | 7104 (8.42) | 7432 | 56/56 | 32/32 | 1200 / 120 | — / — | 24.3 / 31.5 |
| guest/requests | 2910 (2.91) | 7681 (9.1) | 7502 | 0/64 | 0/64 | 1200 / 120 | — / — | 21 / 28.9 |
| guest/companies | 3594 (3.59) | 5059 (5.99) | 5231 | 0/64 | 0/64 | 1248 / 72 | — / — | 24.1 / 26 |
| guest/request-view | 1695 (1.7) | 2812 (3.33) | 2914 | 24/64 | 16/64 | 1200 / 120 | — / — | 25.5 / 30.3 |
| guest/company-view | 2434 (2.43) | 3635 (4.31) | 3860 | 32/64 | 24/64 | 1175 / 145 | — / — | 28.1 / 31.4 |
| guest/how-it-works | 4006 (4.01) | 6026 (7.14) | 6255 | 64/64 | 32/32 | 1200 / 120 | — / — | 42.1 / 41.3 |
| guest/terms | 3223 (3.22) | 4937 (5.85) | 5403 | 48/64 | 32/48 | 602 / 498 | — / — | 47.8 / 36.9 |
| guest/account-login | 1361 (1.36) | 1653 (1.96) | 1681 | 40/64 | 16/40 | 404 / 518 | 404 / 318 | 44.4 / 26.3 |
| guest/account-register | 1474 (1.47) | 2014 (2.39) | 2042 | 40/64 | 20/32 | 655 / 393 | 654 / 316 | 36.4 / 25.3 |
| client/account-overview | 1361 (1.36) | 2344 (2.78) | 2372 | 24/80 | 24/48 | 1188 / 120 | — / — | 38.2 / 32.6 |
| client/account-requests | 3139 (3.14) | 6011 (7.12) | 6147 | 24/80 | 24/48 | 1171 / 137 | — / — | 40.8 / 43.9 |
| client/account-deals | 1699 (1.7) | 3615 (4.28) | 3763 | 24/80 | 24/48 | 1152 / 156 | — / — | 41.5 / 50.7 |
| client/account-saved | 1361 (1.36) | 1811 (2.15) | 1839 | 24/80 | 24/48 | 1158 / 150 | — / — | 45.9 / 33.8 |
| client/account-messages | 1361 (1.36) | 2061 (2.44) | 2089 | 24/80 | 24/48 | 1308 / 0 | — / — | 3.8 / 9.8 |
| client/account-notifications | 1361 (1.36) | 4785 (5.67) | 4929 | 24/80 | 24/48 | 1171 / 137 | — / — | 22 / 32.8 |
| client/account-profile | 1653 (1.65) | 2489 (2.95) | 2535 | 24/80 | 24/48 | 1171 / 137 | 894 / 324 | 31.4 / 31.1 |
| client/requests-new-1 | 1854 (1.85) | 2608 (3.09) | 2694 | 24/125 | 24/157 | 1104 / 184 | 1136 / 350 | 35.5 / 27 |
| client/requests-new-2 | 1558 (1.56) | 2388 (2.83) | 2474 | 24/125 | 24/157 | 1104 / 184 | 1136 / 350 | 40 / 32.5 |
| client/requests-new-3 | 1476 (1.48) | 2459 (2.91) | 2545 | 24/125 | 24/157 | 1104 / 184 | — / — | 40.6 / 33.1 |
| client/deal-view | 1731 (1.73) | 2595 (3.07) | 2643 | 24/80 | 24/80 | 1117 / 171 | — / — | 32.2 / 33.9 |
| client/request-view-own | 2642 (2.64) | 4431 (5.25) | 4491 | 24/64 | 16/64 | 1200 / 120 | — / — | 37.1 / 34.8 |
| company/account-overview | 1380 (1.38) | 2670 (3.16) | 2740 | 24/80 | 24/48 | 1188 / 120 | — / — | 30.3 / 37.8 |
| company/account-opportunities | 1766 (1.77) | 2498 (2.96) | 2604 | 24/80 | 24/48 | 1308 / 0 | — / — | 11.7 / 13.2 |
| company/account-offers | 3619 (3.62) | 4821 (5.71) | 5299 | 24/80 | 24/48 | 1169 / 139 | — / — | 15.3 / 16.1 |
| company/account-deals | 1699 (1.7) | 3691 (4.37) | 3815 | 24/80 | 24/48 | 1152 / 156 | — / — | 40.4 / 50.8 |
| company/account-profile-details | 2796 (2.8) | 4576 (5.42) | 4792 | 24/80 | 24/48 | 1171 / 137 | 894 / 324 | 31.3 / 27.2 |
| company/account-profile-legal | 1474 (1.47) | 2412 (2.86) | 2440 | 24/80 | 24/48 | 1171 / 137 | 894 / 324 | 26.7 / 27.9 |
| company/account-profile-documents | 1361 (1.36) | 1771 (2.1) | 1799 | 24/80 | 24/48 | 1171 / 137 | — / — | 38.7 / 24.1 |
| company/account-profile-products | 1486 (1.49) | 2840 (3.36) | 2886 | 24/80 | 24/48 | 1159 / 149 | 894 / 324 | 33.1 / 33 |
| company/account-profile-distribution | 1361 (1.36) | 1653 (1.96) | 1681 | 24/80 | 24/48 | 1129 / 180 | — / — | 50.8 / 34.4 |
| company/account-profile-security | 1361 (1.36) | 1653 (1.96) | 1681 | 24/80 | 24/48 | 1171 / 137 | 894 / 324 | 46.1 / 27.6 |
| company/matching | 1800 (1.8) | 2532 (3) | 2638 | 24/80 | 24/48 | 1308 / 0 | — / — | 12.2 / 13.6 |
| company/offers-new | 1025 (1.02) | 1371 (1.62) | 1399 | 32/80 | 24/80 | 840 / 481 | — / — | 49.6 / 31.1 |
| company/onboarding | 1763 (1.76) | 1863 (2.21) | 1972 | 0/0 | 0/0 | 856 / 152 | 856 / 350 | 31.9 / 33.4 |

### 2.1 ტოპ-5 ვერტიკალური ინტერვალი თითო გვერდზე (px, ზემოთა → ქვემოთა ელემენტი)

სელექტორებიდან CSS-modules ჰეში მოჭრილია; ინტერვალები < 8px არ ჩანს; პირველი ხაზი — 1440, მეორე — 390. ინტერვალები „ბლოკებს შორისაა“ (margin/gap), ხოლო `main`-ის ბოლო `ma-container → main-end` = ქვედა padding/min-height.

- **guest/home** — 1440: 223px `section.home-section.home-wrap`→`h2#live-title`; 189px `section.home-section.home-wrap`→`div.HomeSections_intro_`; 154px `section.home-wrap.HomeSections_block_`→`h2#supplier-title`; 149px `section.home-wrap.HomeSections_block_`→`h2#home-how-title`; 145px `section.home-wrap.HomeSections_block_`→`div.home-wrap`
  - 390: 214px `div.hero-copy.HomeSections_heroEnter_`→`ul.HomeSections_heroStats_`; 162px `h3`→`h3`; 144px `h2#supplier-title`→`ul`; 136px `h3`→`h3`; 132px `div.Catalog_companySummary_`→`div.Catalog_companyActions_`
- **guest/requests** — 1440: 32px `div.Catalog_requestSearchBar_`→`aside.catalog-sidebar`; 13px `header.catalog-header.catalog-header--opportunities`→`div.Catalog_search_`
  - 390: 32px `div.Catalog_requestSearchBar_`→`div.catalog-main#request-results`; 13px `header.catalog-header.catalog-header--opportunities`→`div.Catalog_search_`
- **guest/companies** — 1440: 32px `div`→`aside.catalog-sidebar`
  - 390: 32px `div`→`section.catalog-main#company-results`
- **guest/request-view** — 1440: 52px `div.request-detail-grid`→`section.RequestDetail_similar_`; 20px `nav.detail-breadcrumb.RequestDetail_breadcrumbs_`→`div.request-detail-grid`; 16px `header.RequestDetail_similarHead_`→`div`
  - 390: 52px `div.request-detail-grid`→`section.RequestDetail_similar_`; 24px `div.request-detail-main`→`aside.request-detail-aside#request-contact`; 20px `nav.detail-breadcrumb.RequestDetail_breadcrumbs_`→`div.request-detail-grid`; 16px `header.RequestDetail_similarHead_`→`div`
- **guest/company-view** — 1440: 20px `header.CompanyProfile_hero_`→`div.CompanyProfile_content_`
  - 390: 24px `div.CompanyProfile_identity_`→`div.CompanyProfile_actions_`; 24px `div.CompanyProfile_main_`→`aside.CompanyProfile_sidebar_`; 20px `header.CompanyProfile_hero_`→`div.CompanyProfile_content_`
- **guest/how-it-works** — 1440: 142px `section.How_section_#buyers`→`h2#companies`; 104px `section.How_section_`→`div`; 96px `h1`→`nav.How_paths_`; 94px `header.How_hero_`→`h2#buyers-title`; 94px `section.How_supplier_#suppliers`→`h2#trust-title`
  - 390: 152px `h1`→`nav.How_paths_`; 102px `section.How_section_#buyers`→`h2#companies`; 80px `div.home-wrap.How_page_`→`main-end`; 78px `header.How_hero_`→`h2#buyers-title`; 78px `section.How_supplier_#suppliers`→`h2#trust-title`
- **guest/terms** — 1440: 96px `h1`→`nav.Terms_contents_`; 49px `nav.Terms_contents_`→`h2`; 49px `section#platform`→`h2`; 49px `section#account`→`h2`; 49px `section#requests`→`h2`
  - 390: 124px `h1`→`nav.Terms_contents_`; 68px `h2`→`ul`; 45px `nav.Terms_contents_`→`h2`; 45px `section#platform`→`h2`; 45px `section#account`→`h2`
- **guest/account-login** — 1440: —
  - 390: 200px `div.ma-container`→`main-end`
- **guest/account-register** — 1440: —
  - 390: —
- **client/account-overview** — 1440: 159px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`ul.account_stats_`; 24px `ul.account_stats_`→`div.account-quick-actions`; 24px `div.account-quick-actions`→`section.account-for-you`
  - 390: 24px `header.account_heading_`→`ul.account_stats_`; 24px `ul.account_stats_`→`div.account-quick-actions`; 24px `div.account-quick-actions`→`section.account-for-you`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-requests** — 1440: 24px `header.account_heading_`→`section.account-records`
  - 390: 24px `header.account_heading_`→`section.account-records`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-deals** — 1440: 24px `header.account_heading_`→`ul.account_deals_`
  - 390: 24px `header.account_heading_`→`ul.account_deals_`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-saved** — 1440: 186px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-panel.account-saved`
  - 390: 24px `header.account_heading_`→`div.account-panel.account-saved`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-messages** — 1440: 91px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-wide`
  - 390: 24px `header.account_heading_`→`div.account-wide`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-notifications** — 1440: 53px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-panel.account-alerts#alerts`
  - 390: 24px `header.account_heading_`→`div.account-panel.account-alerts#alerts`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/account-profile** — 1440: 24px `header.account_heading_`→`div.account-main--profile`
  - 390: 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`
- **client/requests-new-1** — 1440: 723px `nav.post-steps`→`div.post-actions_`; 710px `nav.post-steps`→`div.post-actions`; 66px `nav.post-steps`→`fieldset.post-layout`; 46px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`ol`
  - 390: 538px `nav.post-steps`→`div.post-actions_`; 525px `nav.post-steps`→`div.post-actions`; 112px `nav.post-steps`→`fieldset.post-layout`; 92px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`div.post-steps__mobile`
- **client/requests-new-2** — 1440: 723px `nav.post-steps`→`div.post-actions_`; 710px `nav.post-steps`→`div.post-actions`; 66px `nav.post-steps`→`fieldset.post-layout`; 46px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`ol`
  - 390: 538px `nav.post-steps`→`div.post-actions_`; 525px `nav.post-steps`→`div.post-actions`; 112px `nav.post-steps`→`fieldset.post-layout`; 92px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`div.post-steps__mobile`
- **client/requests-new-3** — 1440: 66px `nav.post-steps`→`fieldset.post-layout`; 46px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`ol`; 37px `form#post-request-form`→`div.post-actions_`; 24px `header.post-heading`→`nav.post-steps`
  - 390: 538px `nav.post-steps`→`div.post-actions_`; 525px `nav.post-steps`→`div.post-actions`; 112px `nav.post-steps`→`fieldset.post-layout`; 92px `nav.post-steps`→`form#post-request-form`; 41px `header.post-heading`→`div.post-steps__mobile`
- **client/deal-view** — 1440: 41px `header.deals_header_`→`ol`; 24px `header.deals_header_`→`nav.deals_card_.deals_steps_`; 20px `nav.deals_card_.deals_steps_`→`div.deals_grid_`
  - 390: 45px `header.deals_header_`→`div.deals_mobileSteps_`; 24px `header.deals_header_`→`nav.deals_card_.deals_steps_`; 24px `div.deals_main_`→`aside.deals_aside_`; 20px `div.deals_mobileOnly_`→`div.deals_grid_`; 16px `div`→`div.deals_actions_`
- **client/request-view-own** — 1440: 52px `div.request-detail-grid`→`section.RequestDetail_similar_`; 20px `nav.detail-breadcrumb.RequestDetail_breadcrumbs_`→`div.request-detail-grid`; 16px `header.RequestDetail_similarHead_`→`div`
  - 390: 52px `div.request-detail-grid`→`section.RequestDetail_similar_`; 24px `div.request-detail-main`→`aside.request-detail-aside#request-contact`; 20px `nav.detail-breadcrumb.RequestDetail_breadcrumbs_`→`div.request-detail-grid`; 16px `header.RequestDetail_similarHead_`→`div`
- **company/account-overview** — 1440: 24px `header.account_heading_`→`section.account-profile-status`; 24px `section.account-profile-status`→`ul.account_stats_`; 24px `ul.account_stats_`→`div.account-quick-actions`; 24px `div.account-quick-actions`→`section.account-for-you`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`section.account-profile-status`; 24px `section.account-profile-status`→`ul.account_stats_`; 24px `ul.account_stats_`→`div.account-quick-actions`; 24px `div.account-quick-actions`→`section.account-for-you`; 20px `aside.account_sidebar_`→`div.account_main_`
- **company/account-opportunities** — 1440: 24px `header.account_heading_`→`section.Matching_feed_.Matching_fullFeed_`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`section.Matching_feed_.Matching_fullFeed_`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-offers** — 1440: 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`section.account-records`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-deals** — 1440: 24px `header.account_heading_`→`ul.account_deals_`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`ul.account_deals_`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-details** — 1440: 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-legal** — 1440: 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-documents** — 1440: 258px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-products** — 1440: 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-distribution** — 1440: 384px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 125px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/account-profile-security** — 1440: 384px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-main--profile`; 16px `div.account_spaces_`→`nav.account_nav_`
  - 390: 65px `div.ma-container`→`main-end`; 24px `header.account_heading_`→`div.account-main--profile`; 20px `aside.account_sidebar_`→`div.account_main_`; 16px `div.account_spaces_`→`nav.account_nav_.ma-scroll-row`
- **company/matching** — 1440: —
  - 390: 20px `aside.account_sidebar_`→`div.account_main_`
- **company/offers-new** — 1440: 20px `nav.MakeOffer_breadcrumbs_`→`section.MakeOffer_panel_`
  - 390: 20px `nav.MakeOffer_breadcrumbs_`→`section.MakeOffer_panel_`
- **company/onboarding** — 1440: 91px `h1`→`form`; 32px `fieldset.onboarding_formFieldset_`→`div.onboarding_actions_`
  - 390: 110px `h1`→`form`; 24px `nav.onboarding_mobileProgress_`→`h1`; 24px `div.onboarding_content_`→`aside.onboarding_aside_`

## 3. სად იკარგება სივრცე (ფართობების მიხედვით)

საერთო: ტოკენები PLAN.md §2-დან (`--page-pad-y`, `--section-gap`, `--block-gap`, `--stack-gap`, `--form-gap`, `--card-pad-sm`, `--hero-pad-y`, `--form-col`, `--panel-col`). „ხაზი“ = fail:ხაზი ამ commit-ზე.

### 3.0 გლობალური (ყველა ფართობი; ფაილები T8.2/T8.4/T8.8-ის)

| # | სად | რამდენი | წყარო | შეცვლა |
|---|---|---|---|---|
| 1 | **ფუტერი 390-ზე** — 809px (360-ზე 837) თითო გვერდზე; მოკლე გვერდებზე (login, profile-distribution…) ეს scrollHeight-ის ≈ 50% | −300…400px 390-ზე | `Footer.module.css:3` `.top{gap:--size-48; padding-block:--size-56}`, `:12` მობილურზე ერთი სვეტი `gap:--size-32` | T8.4: მობილურზე 2 სვეტი, `padding-block` → `--section-gap`/`--space-8`; სვეტის სათაური `margin 0 0 12` |
| 2 | **`.ma-page` padding** 24/48 (≤767) და 32/**80** (≥768) | ქვედა 80px ცარიელი 1440-ზე ყველა `.ma-page` გვერდზე | `patterns.css:5-6` | `--page-pad-y` (20/32) ორივე მხარეს |
| 3 | **account min-height** — `.ma-main` ≥ `100svh − header` | მოკლე ჩანართზე 1440-ზე სქროლი ფიქსირებულად **1361px** (936 `main` + 64 + 361 ფუტერი): account-overview, saved, messages, profile-documents/distribution/security (empty 38–51%); 390-ზე 1653 | `pages/account.css:195` | მოხსნა 390-ზე; 1440-ზე მხოლოდ ფუტერის ქვემოთ ფონის შესავსებად (`flex:1` body) და არა `main` min-height |
| 4 | **ბლოკებს შორის 40px** ანგარიშის ჩანართებში | `account-main` gap 40 ყველა ბლოკს შორის | `pages/account.css:14` `.account-main,.account-wide{gap:var(--space-10)}` | `--block-gap` (16/20) |
| 5 | **ფორმის ველებს შორის 20** | ყოველ ველზე +4px | `primitives.css:46` `.ma-form{gap:--space-5}`, `pages/account.css:49`, `ProfileForm.module.css:37,2` (`account-form-group` padding-top 20) | `--form-gap` 16 |

### 3.1 (ა) პროფილი / პარამეტრები / onboarding / /requests/new/

- **კომპანიის პროფილი (`account-profile-*`)**: 1440-ზე `form.ma-form#account-profile-form` **894px** (ველის მაქს. 894px), მარჯვნივ 137px ცარიელი + 240px sidebar მარცხნივ; არავითარი გვერდითი პანელი. `account-profile-details` = 2796px (2.8 ეკრ.), 390-ზე **4576px (5.42 ეკრ.)**. 390-ზე `heading → account-main--profile` 24px, სვეტი `account_sidebar → account_main` 20px, მაგრამ დიდი დანაკარგი ბლოკების შიგნით: `account-main` gap 40 × 6 ბლოკი, `account-form-group` padding-top 20 + legend mb 12, `.account-form-actions` padding-top 20 (`ProfileForm.module.css:2,4,28`).
  - ფორმის სვეტი: `pages/account.css:43` `.account-main--profile{max-width:calc(--space-24*9 + --space-8 + --space-1)}` = 900px → `max-width: var(--form-col)` (640) + `--panel-col` 320 მარჯვნივ (`FormLayout`).
  - ჩანართების ზოლი: `pages/account.css:2` `.ma-tabs{margin:0 0 --space-8}` (32px ჩანართებსა და ბლოკებს შორის) → `--block-gap`.
- **ანგარიშის გვერდები (overview, deals, offers…)**: `header.heading → ul.stats/section` 24px (`account.module.css:16`, flex gap 16), `ul.stats` gap 12 (`:138`) — ეს უკვე კომპაქტურია; ზედმეტი სივრცე ძირითადად `.ma-page` 80px ქვედა და min-height (იხ. 3.0). `account-deals` 390-ზე: 3615px, ცარიელი 50.7% (ბარათის შიგნით; `account.css:558` `.account-offer` padding-block 16 + gap 12 — `--card-pad-sm`).
- **onboarding 1440**: `.shell` max-width 1200, padding **40/32/64** (`onboarding.module.css:17`) + gap 40 rail↔content → `--page-pad-y`/`--section-gap`; `.lead{margin:8px 0 32px}` (`:20`) → h1→form 91–110px (`h1 → form` ტოპ-ინტერვალი); `.card{padding:--space-6}` (`:51`) → `--card-pad`; `.cardHeading{margin-bottom:20}` (`:52`) → `--stack-gap`. ფორმა 856px + 280px aside (`:26` `minmax(0,1fr) var(--size-280)` container query ≥820) — უკვე ფორმა+პანელია.
- **/requests/new/ 1440**: ფორმა + `aside.Post_aside` (360px, sticky) უკვე არსებობს (`Post.module.css:14,68`); ველების სვეტი ≈ 722px (`fieldMaxWidth`), შინაარსი 1104px, მარჯვნივ 184px. `.post-page{padding-top:--space-6; padding-bottom:calc(--space-12 + post-actions-height)}` (`pages/post.css:4`) → ქვედა padding 125px (1440) და 157px (390), ორივე ფიქსირებული `.post-actions`-ის სიმაღლის ხარჯზე. `post-steps` ბარათი 62px + `post-heading` mb 24 (`post.css:6,9`). 390-ზე 3.09 ეკრანი (step 1), ფუტერამდე.

### 3.2 (ბ) კატალოგი `/requests/`, `/companies/`

- **hero/ძიება**: `catalog-header` padding-block `--space-12` (`pages/catalog.css:19-27`), ვარიანტი `--center`: `--size-72/--size-64` (≥1320, `:131`), `--space-10 / --size-132` (≤1179, `:224`), `--space-8` (`:256`). 390-ზე h1 `top=88`, **პირველი ბარათი იწყება 453px-ზე** (requests) / 564px-ზე (companies): ფილტრები+საძიებო ზოლი+რაოდენობა ჭამს ეკრანის 54–67%-ს. `Catalog.module.css:121` `.requestSearchBar{padding:--space-3; gap:--space-3}` + 13px/32px ინტერვალები (`header → search` 13, `requestSearchBar → catalog-main` 32) → `--hero-pad-y`, `--block-gap`.
- **ბარათები 390-ზე — მთავარი დანაკარგი**: `/requests/` ბარათი `OpportunityCard` (`Catalog_fullCard`) = **538px** (ფოტო `aspect-ratio:16/8`→ 358×179, `OpportunityCard.module.css:3`; body padding 16, `.facts` margin-top 12, ორი ღილაკი); 12 ბარათი = 6 000+px; `/requests/` სულ **7681px = 9.1 ეკრ.**. `/companies/` რიგი `Catalog_company` = **318px** (padding `--space-5`=20, gap `--space-3`, `Catalog.module.css:35`), გვერდი 5059px (6 ეკრ.).
- **1440**: ბადე/რეილი: `content 1200`, მარჯვნივ 120 (companies: 1248 / 72); ბარათის padding `--space-5` ხელს არ უშლის; ზედა ინტერვალი: `requestSearchBar → catalog-sidebar` 32px.
- რეკომენდაცია: ბარათის/რიგის padding → `--card-pad`/`--card-pad-sm`; 390-ზე ფოტო პატარა მინიატიურად რიგის მარცხნივ (≈ 96×64, როგორც DS §4) → სიმაღლე ≈ 130–150; ორი ღილაკი ერთ ხაზზე.

### 3.3 (გ) დეტალის გვერდები

- **მოთხოვნა (`request-view`, 390 = 2812px / 3.33 ეკრ.; own = 4431px)**: `h1 top=223, bottom=363` — სათაური მხოლოდ მეორე ეკრანის წინ მთავრდება (breadcrumb + hero padding): `.detail-hero` (`pages/detail.css:120`), `wrap 16/64`. ტოპ-ინტერვალები: `div.request-detail-grid → section.RequestDetail_similar` **52px** (`RequestDetail.module.css:3` `.similar{margin-top:--space-8}` + grid ქვედა), `request-detail-main → aside#request-contact` 24px (მობილურზე contact ბარათი ქვემოთ, 358px), ქვედა padding 64px. `.request-workspace .request-detail-main{gap:--size-28}` (`detail.css:847`) და `gap: --space-5` (`:940`) ერთმანეთს ეჯახება (ორი განსხვავებული მნიშვნელობა ერთ სელექტორზე).
- **კომპანია (`company-view`, 390 = 3635px / 4.31 ეკრ.; 1440 = 2434px)**: wrap 24/64; ტოპ-ცარიელი ზოლები: `p → h2.detail-section-title#company-about` 73px, `span → h2.detail-section-title` 72px — სექციების სათაურებამდე ≈ 72px, ე.ი. `--section-gap` (32) უნდა იყოს; `CompanyProfile_identity → _actions` 24px; ბოლო ღილაკის ქვემოთ 85px.
- **გარიგება (`deal-view`, 390 = 2595px)**: `deals_header → deals_mobileSteps` **45px**, `header → steps` 24 (`deals.module.css`); ქვედა padding 80.
- **1440**: მოთხოვნა 1695px, aside 400px; შინაარსი 1200/120. დეტალს 1440-ზე არ აქვს მნიშვნელოვანი დანაკარგი, რაც 1.7 ეკრანში ეტევა.

### 3.4 (დ) მთავარი + ტელეფონი ზოგადად

- **მთავარი 390 = 7104px (8.42 ეკრ.)**, 1440 = 5353px (5.35 ეკრ.). ტოპ-ინტერვალები 1440-ზე: **223px** `section.home-section → h2#live-title`, **189px** `home-section → HomeSections_intro`; 390-ზე **214px** `hero-copy → ul.heroStats` (stats ბლოკი `position:absolute; inset:auto 10px 10px` + `heroStat:first-child{margin-bottom:56}` — `HomeSections.module.css:79-81`, 171) და 162px `h3 → h3`.
- წყაროები: `homepage.css:37` `.home-hero{padding-block:--size-56}`; `:124` `.home-section{margin-top:--size-56}`; `HomeSections.module.css:111` `.block{margin-top:--size-80}`, `:116` `.block>.intro{margin-bottom:--size-32}`, `:12,49` `.how{padding-block:--size-64 → 48}`, `:107` `.live{gap:--size-56}`, `homepage.css:35` `.home-page{padding-bottom:--size-80}` (მთავარს ქვედა 80). ანუ სექციებს შორის 56 + 80 + 64 + ბარათების შიდა padding → ჭეშმარიტი ინტერვალი 190–220px. → ყველა `--section-gap` (32 / 56).
- **„როგორ მუშაობს“** 390 = 6026px: `How.module.css:10` `.section{margin-block:--size-64}` (≥768) / `--size-48` (`:56`) — მარჯინები ორმხრივია → სექციებს შორის 96–128px (`142px`/`104px` ტოპ-ინტერვალი 1440-ზე; 152px `h1 → nav.How_paths` 390-ზე). → `--section-gap`.
- **Terms** 390 = 4937px, 1440-ზე შინაარსი მხოლოდ **602px** (მარჯვნივ 498px — სვეტი `max-width: --size-760`, `Terms.module.css:1`; ეს გონივრულია კითხვადობისთვის, მაგრამ `h1 → nav.contents` **96/124px** და `.page padding-block --size-48 / --size-64`, `section{padding:24; margin-top:24}` `Terms.module.css:1,6`). `scrollHeight` 3223 (1440), 36–48% ცარიელი.
- **ავტორიზაცია** `account-login`: 1361px 1440-ზე (ფუტერი 361 + `.ma-page.auth-page` min-height), 390-ზე ქვემოთ 200px ცარიელი (`pages/account.css:209`).

## 4. ბარათებისა და რიგების სიმაღლეები 390-ზე (Mobbin სამიზნე 90–130px, MOBBIN-REFS §1)

| რიგი | სიმაღლე 390 (px) | პირველი რიგი იწყება (y) | სრული რიგი ეტევა 844-ში, პირველ ეკრანზე | რიგი 844-ზე (ქვემოთ სქროლისას) | კოდი |
|---|---:|---:|---:|---:|---|
| `/requests/` — `OpportunityCard` full | 517–538 | 453 | 0 | ≈1.6 | `OpportunityCard.module.css:3,23`, `Catalog.module.css` `.fullCard` |
| `/companies/` — `Catalog_companyRow` | 318–342 | 564 | 0 | ≈2.6 | `Catalog.module.css:35` |
| მთავარი — `OpportunityCard compact` | 368–427 (360-ზე 445) | 1513 | 0 | ≈2.1 | `OpportunityCard.module.css:4,17-18` (`aspect-ratio:16/10`) |
| `request-view` — მსგავსი (compact) | 357 | 1583 | 0 | ≈2.4 | იგივე |
| **სამიზნე** (LinkedIn/Braintrust, MOBBIN §1) | **90–130** | — | ≥3 (DS §4: „390×844-ზე ≥3 რიგი“) | 6.5–9 | — |

დასკვნა: ამჟამინდელი ბარათები **4–6×** მაღალია სამიზნეზე; პირველ ეკრანზე 0 სრული რიგი (hero/ძიება + ფილტრები 450–570px). `fitInFirstScreen` = 0 სამივე გვერდზე 390-ზე და 360-ზე. DS-ის მიზანი (≥3 რიგი) არ სრულდება ამ ეტაპზე.

## 5. ფორმების სვეტი 1440-ზე vs 640px სამიზნე; არსებული გვერდითი ელემენტები

| ფორმა | form სიგანე (1440) | ველის მაქს. სიგანე | გვერდითი ელემენტი | სიგანე | sticky | რა დარჩეს / რა დაემატოს |
|---|---:|---:|---|---:|:---:|---|
| `/account/?tab=profile` (კლიენტი, `form.ma-form#account-profile-form`) | 894 | 894 | **არაფერი** (მარცხნივ ანგარიშის nav 240) | — | — | `FormLayout aside`: preview (`CompanyListingCard`/ავატარი), პროფილის შევსების პროგრესი |
| კომპანიის პროფილი `profile-details` | 894 | 894 | **არაფერი** (მარცხნივ nav 240) | — | — | იგივე + ბლოკური შენახვა (T8.8) |
| `profile-legal` / `security` | 894 | 766 / 894 | არაფერი | — | — | იგივე |
| `profile-products` | 894 | 198 (ბადე) | არაფერი | — | — | იგივე |
| `/onboarding/` | 856 | — (fieldset) | `aside.onboarding_aside` + `OnboardPreview` | **280** | კი (`top: --space-8`) | უკვე არის; გადატანა `FormLayout`-ზე: `--form-col` 640 + `--panel-col` 320; მარცხენა rail 240 მცირდება/ზემოთ გადადის |
| `/requests/new/` | 1136 (form-ი მოიცავს aside-ს) | **722** | `aside.Post_aside` (`MatchingPreview`, preview ბარათი) | **360** | კი (`top: header+20`) | ველის სვეტი ≈722 → 640, aside 360 → 320; ნაბიჯების ზოლი უკვე არსებობს |
| `/offers/new/` (`MakeOffer`) | — | — | არაფერი | — | — | `FormLayout`-ის კანდიდატი (შინაარსი 840px, მარჯვნივ 481px ცარიელი) |

წმინდა დასკვნა: **პროფილის ფორმა 894px** → 640-ზე დაგვიტოვებს 254px; ფორმა+პანელი (640+32+320=992) ეტევა 1171px სვეტში (ანგარიშის nav-ის გვერდით) და 1200px კონტეინერში. `FormLayout`-მა უნდა გამოიყენოს: `Post.module.css` aside-ის sticky `top` ფორმულა (`header-h + space-5` → `--panel-top`), onboarding-ის `@container` ≥820 გადამრთველი (უფრო საიმედოა, ვიდრე `@media`, რადგან ანგარიშის nav ცვლის ხელმისაწვდომ სიგანეს), და `MatchingPreview`/`OnboardPreview`-ის „ასე ჩანს“ ბარათის შიგთავსი (ნუ დააკოპირებთ).

## 6. ტოპ-5 დანაკარგი ფართობების მიხედვით (შეჯამება)

1. **(ა) პროფილი/პარამეტრები/onboarding:** (1) ფორმა 894px მარჯვენა პანელის გარეშე; (2) `.account-main` gap 40 (`account.css:14`); (3) `.ma-page` ქვედა 80 + `.ma-main` min-height (`patterns.css:5-6`, `account.css:195`); (4) `.ma-form` gap 20 / `account-form-group` padding 20 (`primitives.css:46`, `ProfileForm.module.css:2`); (5) onboarding `.shell` 40/32/64 და `.lead` mb 32 (`onboarding.module.css:17,20`).
2. **(ბ) კატალოგი:** (1) ბარათი 538px 390-ზე; (2) კომპანიის რიგი 318px; (3) hero+ძიება 453–564px პირველ ბარათამდე (`catalog.css:19-27,131,224`, `Catalog.module.css:121`); (4) ბარათის padding `--space-5`/16 + ფოტო 16:8; (5) ქვედა padding 64 + ფუტერი 809.
3. **(გ) დეტალი:** (1) h1 ბოლო 363px-ზე (hero/breadcrumb); (2) `.similar` margin-top 32 + grid 52px; (3) სექციების სათაურებამდე 72px (`detail-section-title`); (4) `request-detail-main` gap 28 vs 20 (`detail.css:847,940`); (5) wrap ქვედა 64 + ფუტერი.
4. **(დ) მთავარი+ტელეფონი:** (1) სექციებს შორის 190–220px (`home-section` 56 + `.block` 80 + `.how` 64); (2) heroStats absolute + margin 56 (`HomeSections.module.css:79-81`); (3) `home-page` ქვედა 80; (4) ფუტერი 809px 390-ზე (`Footer.module.css:3,12`); (5) „როგორ მუშაობს“ `.section` margin-block 64/48 (`How.module.css:10,56`).
5. **ყველგან:** ფუტერი 361 (1440) / 809 (390); `.ma-page` 80 ქვედა; account min-height-ის იატაკი 1361.
