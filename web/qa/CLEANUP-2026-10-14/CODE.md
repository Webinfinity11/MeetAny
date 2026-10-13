# T7.14 — კოდის დალაგება

ლოკალური ბაზა: meetany_preview_p7_codeclean. dev 3711, auth fixture 3721. Production, Neon Auth-ის რეალური შესვლა, push და db/** ცვლილება არ შესრულებულა.

## წაშლილი კოდი

გამოყენება შემოწმდა app/scripts/qa წყაროში სახელებისა და import-ების ძიებით; განმეორებადი ინვენტარი: code-audit.mjs და code-audit-before.json. Framework-ის ექსპორტები (მაგ. generateStaticParams) და ლოკალური /dev/ui/, /dev/qa-layout/ დარჩა.

ფაილები:

- app/components/DiscoverySearch.tsx
- app/components/market/FacetList.tsx (მათ შორის Facet ტიპი)
- app/components/market/SimilarCompanies.tsx
- app/components/ui/CompactMultiSelect.tsx
- app/components/ui/compact-multiselect.module.css; მისი ზუსტი lint-design გამონაკლისიც მოცილებულია.

ექსპორტები/მათთან დაკავშირებული ლოკალური კოდი:

- lib/admin-helpers.ts: isTestAccount, lastDays, dayKey, perDay, windowCounts, Person.
- lib/format.ts: sinceMonthLabel, SINCE_MONTHS.
- lib/home-data.ts: categories, industries, sectors, suggestions.
- lib/auth-session-preload.js: SESSION_CACHE_KEY (inline სკრიპტის საკუთარი literal უცვლელია).
- market/PhotoField.tsx: GALLERY_MAX.
- market/Distribution.tsx: DistributionProfile და მისი მხოლოდ ადგილობრივი import-ები.

CSS: 49 ზუსტი local class და 10 გლობალური class; ქვემოთ სიაა. Header-ის h() string-ები შემოწმდა; Header-ის კლასები არ წაშლილა. გლობალური BEM/dynamic ვარიანტების ავტომატური წაშლა არ გაკეთებულა. compact-multiselect.module.css სრულად წაშლილია და ამ 59 კლასში არ ითვლება.

- web/app/components/home/HomeSections.module.css: stepMeta.
- web/app/components/market/MakeOffer.module.css: offerSummary.
- web/app/components/market/Matching.module.css: offerBuyer, offerRow, offerSheet, offerTitle.
- web/app/components/market/account/account.module.css: buyerAvatar.
- web/app/components/market/admin.module.css: chartAxis, chartBar, chartBarActive, chartBase, chartHit, chartPlot, chartTip, charts, deltaDown, deltaUp, demoExamples, demoGlossary, demoIntro, demoStep, demoStepNumber, demoSteps, overviewSecondary, presentationHint, testSwitch, wrapAny.
- web/app/components/market/company/CompanyProfile.module.css: productsEmpty.
- web/app/components/market/engagement.module.css: contextInAside, contextRequest, emptyIcon, messageNotices, messageUnread, noticeKind, noticeTop, previewTitle, statusPill.
- web/app/components/market/onboarding.module.css: allCategories, categoryCount, categoryFooter, categoryGrid, chipCheck, coverAction, coverFrame, coverPlaceholder, itemRows, largeAvatar, logoAction, profileMedia.
- web/app/styles/pages/catalog.css: catalog-facet, catalog-facet--child, catalog-facet-group, catalog-facet-more, catalog-facet__children, catalog-facet__count, catalog-facet__icon, catalog-facet__label, catalog-facets.
- web/app/styles/pages/homepage.css: discovery-search.

## npm

21 პაკეტი შემოწმდა; ამოღებული 0. package.json/package-lock.json უცვლელია, npm uninstall არ იყო საჭირო; npm install არ გაშვებულა. @types პაკეტები ტიპების ინფრასტრუქტურაა, Next/ESLint — config/CLI, TypeScript გამოიყენება lint/test tooling-ში.

| პაკეტი | გამოყენების მაგალითი |
|---|---|
| @neondatabase/serverless | app/lib/db.js |
| @vercel/blob | app/lib/blob-upload-handler.js |
| jose | app/lib/neon-jwt.js |
| leaflet | app/components/market/CompaniesMap.tsx |
| leaflet.markercluster | app/components/market/CompaniesMap.tsx |
| next | app/global-not-found.tsx |
| pg | app/lib/db.js |
| react | app/global-error.tsx |
| react-dom | app/components/market/Inbox.tsx |
| @types/leaflet | ტიპების/config ინფრასტრუქტურა |
| @types/leaflet.markercluster | ტიპების/config ინფრასტრუქტურა |
| @types/node | ტიპების/config ინფრასტრუქტურა |
| @types/react | ტიპების/config ინფრასტრუქტურა |
| @types/react-dom | ტიპების/config ინფრასტრუქტურა |
| axe-core | qa/a11y-audit.mjs |
| eslint | qa/CLEANUP-2026-10-14/code-audit.mjs |
| eslint-config-next | qa/CLEANUP-2026-10-14/code-audit.mjs |
| pixelmatch | qa/cleanup-visual.mjs |
| playwright | scripts/apply-reviewed-fixture-copy.mjs |
| pngjs | qa/category-icons.mjs |
| typescript | app/components/market/request/loginAccount.test.mjs |

## არქივი

92 ზედა დონის სახელი, 2352 tracked ფაილი გადავიდა git mv-ით qa/archive/<იგივე სახელი>-ში. tracked PNG-ებიც თან გადავიდა; ახალი shots PNG-ები არ დაკომიტებულა. სრული old→new სია: code-archive-moves.json. README-ების ბმულები განახლებულია, root STRUCTURE.md დაემატა.

- ADMIN-PANEL-2026-09-29.md
- ALERTS-2026-09-29.md
- BRIEF-AUDIT-2026-10-12
- CATEGORIES-RESEARCH-2026-09-29.md
- CHAT-CHECK-2026-09-29.md
- CLEANUP-2026-09-29.md
- DEMO-CYCLE-2026-10-08.md
- DEPLOY-2026-09-29.md
- DEPLOY-2026-09-30.md
- DEPLOY-2026-10-02.md
- DEPLOY-2026-10-08.md
- DESIGN-GAP-2026-10-08.md
- DISTRIBUTORS-SPEC-2026-09-30.md
- FLOWS-2026-09-29.md
- OLD-VS-NEW-2026-09-29.md
- OWNER-DEFECTS-2026-10-13
- PERFECTION-2026-10-12
- QA-FULL-2026-09-30.md
- REDESIGN-2026-09-29.md
- REVIEW-2026-09-29.md
- ROLES-AUDIT-2026-09-29.md
- ROLES-DESIGN-2026-09-29.md
- ROLES-E2E-2026-09-29.md
- ROLES-PLAN-2026-09-29.md
- SITE-FINAL-2026-09-29.md
- SITE-WALK-A-2026-09-29.md
- SITE-WALK-B-2026-09-29.md
- STATUS-2026-10-01.md
- STATUS-2026-10-02.md
- STRICT-2026-10-08.md
- UX-2026-10-13
- account-offers-readonly.mjs
- business-features-regressions.mjs
- business-live-readonly.mjs
- catalog-regressions.mjs
- category-icons-2026-10-13
- chat-dock-regressions.mjs
- deals-local.mjs
- deploy-20261009
- design-completion-2026-10-09
- fixes-20261009
- functionality-2026-10-08
- gap-2026-10-08
- header-identity-readonly.mjs
- home-review-20261009
- home-v2-2026-10-13
- live-functional-1791544653878
- live-functional-1791544685774
- live-functional-1791544751799
- live-functional-1791544870293
- live-functional-1791545053310
- live-registration-1791543795353
- live-registration-1791544041565
- loading-catalog-20261009
- map-smoke.mjs
- matching-offer-local.mjs
- matching-v2-2026-10-13
- modal-layout-1791545344297
- modal-layout-1791545438655
- modal-layout-1791545747671
- modal-layout-1791545839148
- modal-layout-1791545908667
- modal-layout-1791546323738
- modal-layout-1791546360736
- modal-layout-1791546423801
- modal-layout-1791546502468
- modal-layout-1791546820123
- modal-layout-1791546947402
- modal-layout-review.mjs
- new-screens-qa-2026-10-12
- onboarding-v2-2026-10-13
- performance-2026-10-09
- presentation-production-check.mjs
- qa-full-0930-flows.mjs
- qa-full-0930-vip.mjs
- registration-2026-10-09
- request-chat-readonly.mjs
- request-draft-local.mjs
- request-workspace-regressions.mjs
- role-menu-check.mjs
- search-dropdown-regressions.mjs
- site-walk-a-sessions.mjs
- site-walk-b-error.mjs
- strict-2026-10-08
- strict-pair.mjs
- strict-shoot.mjs
- type-site-2026-10-13
- ui-polish-2026-10-09
- usability-audit.mjs
- usability-regressions.mjs
- ux-2026-10-08
- ux-final-2026-10-09

ადგილზე დარჩა მოთხოვნილი მუდმივი runner-ები, e2e/unit/visual, p7-*, CLEANUP-2026-10-14 და perf-2026-10-12. QA-2026-10-13 არის აქტიური e2e-full.mjs-ის output, ამიტომ დარჩა. დამატებით დარჩენილი 69 სახელის სია code-archive-plan.json-შია: მათ სხვა აქტიური სკრიპტი ახსენებს ან ფაილის მდებარეობაზე დამოკიდებული import/root აქვთ. მათი ავტომატური გადატანა განმეორებით გაშვებას დააზიანებდა. root archive/, DB.md და inventory.* უცვლელია.

## მოთხოვნისას ჩატვირთვა

AdminPageContent-ში AdminContentEditor, AdminReviews, AdminDeals, AdminBusinessAudit, AdminContacts და AdminPhotos იტვირთება next/dynamic-ით, შესაბამისი tab-ის გახსნისას. SSR არ გამორთულა. ექვსივე განყოფილებაზე ნავიგაცია fixture JWT-ით შემოწმდა (code-admin.json).

T7.6-ის ChatPopupContent, RequestFormSheet, ChooseOfferSheet შენარჩუნებულია. CompaniesMap უკვე dynamic/ssr:false იყო, Leaflet მხოლოდ browser effect-ში იტვირთება. XLSX-lite API-ს სერვერული ნაწილია. ProductsImport ხილულ ფორმაშია, AdminActivityChart overview-ის პირველ ეკრანზეა: გადადება პირველ რენდერს შეცვლიდა, ამიტომ დარჩა.

## Bundle

ორივე npx next build --webpack წარმატებულია (code-build-before.log / code-build-after.log). Next.js 16.3.8-ის build output **First Load JS-ს არ ბეჭდავს**, ამიტომ ამ მეტრიკაზე ყველა route-ის მნიშვნელობა N/A-ა; რიცხვები არ გამოგვიგონია. ქვემოთ ცალკე დამატებითი საზომია: თითო page-ის client-reference manifest-ში მითითებული უნიკალური chunks-ის მოცულობა, gzip-ით. ეს First Load JS ან რეალური network transfer არ არის: runtime/shared ლოგიკა და on-demand მოთხოვნები განსხვავდება. API/metadata routes-ს page client manifest არ აქვს და მათი JS არის N/A. build-ის metadataBase გაფრთხილება საწყის ვერსიაშიც იყო და ამ scope-ში არ შეცვლილა. code-bundle.mjs გამეორებადია.

| გვერდის manifest route | JS KiB მანამდე | JS KiB შემდეგ | gzip KiB მანამდე | gzip KiB შემდეგ |
|---|---:|---:|---:|---:|
| /(home)/page | 285.46 | 284.82 | 100.18 | 99.95 |
| /_global-error/page | 285.46 | 284.82 | 100.18 | 99.95 |
| /_not-found/page | 281.60 | 280.96 | 98.66 | 98.43 |
| /(account)/account/page | 475.62 | 473.53 | 156.24 | 156.36 |
| /(admin)/admin/page | 535.08 | 502.18 | 162.65 | 155.80 |
| /(companies)/companies/page | 315.56 | 314.92 | 110.97 | 110.74 |
| /(how)/how-it-works/page | 286.98 | 286.33 | 101.01 | 100.78 |
| /(ideas)/ideas/page | 299.91 | 299.26 | 104.47 | 104.24 |
| /(matching)/matching/page | 324.11 | 323.28 | 113.24 | 112.94 |
| /(onboarding)/onboarding/page | 394.60 | 392.65 | 135.14 | 134.44 |
| /(requests)/requests/page | 349.35 | 348.71 | 123.42 | 123.19 |
| /(terms)/terms/page | 285.75 | 285.11 | 100.41 | 100.18 |
| /dev/qa-layout/page | 341.85 | 341.21 | 119.87 | 119.64 |
| /dev/ui/page | 332.58 | 331.94 | 115.73 | 115.50 |
| /(company-view)/companies/view/page | 361.59 | 360.95 | 125.42 | 126.19 |
| /(compare-offers)/requests/compare/page | 387.61 | 386.97 | 136.36 | 136.13 |
| /(deals)/deals/view/page | 374.73 | 374.09 | 127.07 | 126.84 |
| /(ideas)/ideas/[slug]/page | 300.80 | 300.16 | 104.99 | 104.76 |
| /(make-offer)/offers/new/page | 353.59 | 352.91 | 122.63 | 122.39 |
| /(request-view)/requests/view/page | 405.68 | 405.05 | 141.39 | 141.16 |
| /(requests-new)/requests/new/page | 412.14 | 411.51 | 142.69 | 142.46 |

Build output-ის ყველა მარშრუტი და მოთხოვნილი მეტრიკის ხელმისაწვდომობა:

| მარშრუტი | First Load JS before | First Load JS after |
|---|---|---|
| /_not-found | N/A | N/A |
| /account | N/A | N/A |
| /admin | N/A | N/A |
| /api/analytics/registration | N/A | N/A |
| /api/blob-upload | N/A | N/A |
| /api/db/[...path] | N/A | N/A |
| /api/files | N/A | N/A |
| /api/products-import | N/A | N/A |
| /companies | N/A | N/A |
| /companies/view | N/A | N/A |
| /deals/view | N/A | N/A |
| /dev/qa-layout | N/A | N/A |
| /dev/ui | N/A | N/A |
| /how-it-works | N/A | N/A |
| /ideas | N/A | N/A |
| /ideas/[slug] | N/A | N/A |
| /ideas/office-supply | N/A | N/A |
| /ideas/brand-packaging | N/A | N/A |
| /ideas/workspace-care | N/A | N/A |
| /matching | N/A | N/A |
| /offers/new | N/A | N/A |
| /og | N/A | N/A |
| /onboarding | N/A | N/A |
| /opengraph-image | N/A | N/A |
| /requests | N/A | N/A |
| /requests/compare | N/A | N/A |
| /requests/new | N/A | N/A |
| /requests/view | N/A | N/A |
| /robots.txt | N/A | N/A |
| /sitemap.xml | N/A | N/A |
| /terms | N/A | N/A |

## შემოწმება

- tsc: 0; eslint app: 0 error / 0 warning. ყოველი თემატური commit-ის შემდგომი ლოგები code-*-commit-*.log-შია.
- lint:design: PASS.
- npm test: 127 PASS, 0 FAIL.
- bash db/tests/run.sh: 2262 SQL assertions PASS (საკუთარი დროებითი ბაზა; runner თვითონ შლის).
- production build: PASS; next start 3731-ზე 8/8 HTTP 200 (code-production-smoke.json).
- მიგრაციები: 0.

ვიზუალური შემოწმება: shots/before-*.png და shots/after-*.png; 8 გვერდი × 1440/390/360. localhost გამოიყენება, რათა Next dev-ის host შემოწმებამ hydration არ დაბლოკოს. საწყისი 127.0.0.1 harness-ის კადრები ჩანაცვლდა baseline b32da08-ის წყაროზე ხელახლა გადაღებული კადრებით; შემდეგ მიმდინარე commit-ების კოდი აღდგა. Auth-ის პასუხები მთლიანად fixture JWT-ითაა ჩანაცვლებული.

| გვერდი | სიგანე | raw pixel diff | ფოტოების არეების გარეშე | overflow | pageerror |
|---|---:|---:|---:|---:|---:|
| home | 1440 | 0 | 0 | 0 | 0 |
| requests | 1440 | 0 | 0 | 0 | 0 |
| companies | 1440 | 0 | 0 | 0 | 0 |
| request | 1440 | 0 | 0 | 0 | 0 |
| company | 1440 | 0 | 0 | 0 | 0 |
| account | 1440 | 0 | 0 | 0 | 0 |
| how | 1440 | 0 | 0 | 0 | 0 |
| admin | 1440 | 0 | 0 | 0 | 0 |
| home | 390 | 0 | 0 | 0 | 0 |
| requests | 390 | 0 | 0 | 0 | 0 |
| companies | 390 | 0 | 0 | 0 | 0 |
| request | 390 | 0 | 0 | 0 | 0 |
| company | 390 | 0 | 0 | 0 | 0 |
| account | 390 | 0 | 0 | 0 | 0 |
| how | 390 | 0 | 0 | 0 | 0 |
| admin | 390 | 0 | 0 | 0 | 0 |
| home | 360 | 0 | 0 | 0 | 0 |
| requests | 360 | 0 | 0 | 0 | 0 |
| companies | 360 | 0 | 0 | 0 | 0 |
| request | 360 | 0 | 0 | 0 | 0 |
| company | 360 | 0 | 0 | 0 | 0 |
| account | 360 | 0 | 0 | 0 | 0 |
| how | 360 | 0 | 0 | 0 | 0 |
| admin | 360 | 0 | 0 | 0 | 0 |

ფოტოების შესაძლო განსხვავება lazy-loading/ქეშის დროზეა დამოკიდებული; imageRects ზუსტად არის ჩაწერილი JSON-ში. ნიღაბი მხოლოდ img-ის bounding box-ებს ფარავს, ტექსტსა და განლაგებას — არა. დამატებითი ადმინის ექვსი განყოფილების 390px კადრები shots/admin-*-390.png-შია.
