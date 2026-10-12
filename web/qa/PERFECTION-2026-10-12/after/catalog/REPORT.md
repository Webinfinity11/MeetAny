# ეტაპი 3 — კატალოგი, დეტალი, კომპანია, საჯარო გვერდები

სკრიპტი: `scripts/catalog.mjs` (სტუმარი, owner_user, owner_company; 1440/390; ჩაწერის RPC-ები ბრაუზერში ლოკალურად პასუხდება — ბაზა არ იცვლება). შედეგები: `_results-*.json`.
შემოწმება: console 0 (გარდა `/nope`-ის თვით 404-ისა და Neon auth-ის 429-ისა, რომელიც სხვა ნაკადების პარალელური შესვლებით იყო გამოწვეული); overflow 0 ყველგან; ქვედა ზოლი 390-ზე viewport-ის ბოლოშია (top 775 / 844). tsc ✓, eslint 0 შეცდომა, lint:design ✓, unit 53/53.

| ID | რა გაკეთდა | ფაილი |
|---|---|---|
| public-01 | არასავალდებულო დეტალები/ფაილები: სტუმარს შეცდომა არ უჩანს (ბლოკი არ ჩანს), ავტორს — ერთი `Notice` + „ხელახლა ცდა“; ცარიელი დამატებითი პირობები ავტორს — ერთი ხაზი | `RequestPreferences.tsx`, `FileAttachments.tsx` (`optional`) |
| public-03/22/23 | aside: „გაზიარება“ + „შენახვა“ ერთ რიგში ერთი ghost სტილით, ქვემოთ ერთი ბმული „დარღვევის შეტყობინება“ (`ReportButton` ერთი რეჟიმით ყველგან); კომპანიაზე — „დეტალების“ პანელის ბოლოს; ინიციალები `avatarInitials`-ით (მოთხოვნა, ბარათი) | `RequestViewPageContent.tsx`, `ReportButton.tsx`, `CompanyProfilePageContent.tsx`, `OpportunityCard.tsx`, `detail.css` |
| public-04/20 | /terms/: placeholder ამოღებულია, „კონტაქტი“ = კავშირი პლატფორმის შიგნით (მიწერა, დარღვევის შეტყობინება, პრობლემის შეტყობინება); „განცხადება“ → „მოთხოვნა“; ვადა კოდიდან: 14 დღე, +7, მაქს. 21 დღე დღეიდან; პროფილის ველები რეალურ სახელებით | `(terms)/terms/page.tsx` |
| public-05/30 | თქვენობითი ჩემს ფაილებში; კლიენტს „შეთავაზებებს კომპანიები აგზავნიან“, „თქვენც გჭირდებათ მსგავსი?“ → „მოთხოვნის განთავსება“ | კატალოგი, დეტალი, Save*, Report |
| public-06 | H1/title „ღია მოთხოვნები“, breadcrumb „მოთხოვნები“, „მსგავსი მოთხოვნები“, „ნაპოვნია N მოთხოვნა“ | `RequestsPageContent.tsx`, `(requests)/layout.tsx` |
| public-07 | კატეგორიის ერთი ლეიბლი (`group.name`) sidebar-ში, sheet-ში და კომპანიებზე; „კატეგორიები“/„ადგილმდებარეობა“/„ფილტრები“ ყველგან | `RequestsPageContent.tsx`, `catalog/CatalogFilters.tsx` |
| public-08, Q8 | ფოტოს გარეშე მოთხოვნა: კატეგორიის ხატულა ღია ნეიტრალურ ფონზე (არა ერთი სტოკ-ფოტო); `RequestCatalogCover({ category })` ავსებს მშობელს — ფორმის preview-ს შეუძლია მუდმივ ადგილად გამოიყენოს | `RequestCatalogCover.tsx/.module.css` |
| public-09, O5, O7, C-21 | ფაქტები auto-fit (ცარიელი იმალება; 390-ზე ბოლო კენტი სრულ სიგანეზე); „სპეციფიკაცია“ ამოღებულია; ვადა მხოლოდ aside-ში (დღეები + თარიღი); ფოტო ერთხელ; მფლობელს „მყიდველი“ ბარათი არ აქვს; breadcrumb „ჩემი მოთხოვნები“ | `RequestViewPageContent.tsx`, `detail.css`, `RequestDetail.module.css` |
| public-10, C-24 | ლოგო = კატალოგის მინიატურა (`companyImage`), კატალოგში ცარიელი ყუთის ნაცვლად `Avatar`; ფოტოს გარეშე სერვისი ჩიპად; „სადემო პროდუქტი · ფოტო საილუსტრაციოა“ არ ჩანს; სვეტები რაოდენობით (5 → 3+2); „კომპანიის შესახებ“ | `CompanyProfilePageContent.tsx`, `CompanyProducts.tsx`, `ProductCard.tsx`, `CompanyListingCard.tsx` |
| public-11 | შეფასების თარიღი `dateShort`; რეიტინგის ვარსკვლავი სავსე | `company/CompanyReviews.tsx` |
| public-12 | /ideas/ noindex, sitemap-იდან ამოღებული | `(ideas)/layout.tsx`, `sitemap.ts` |
| public-16 | „მესიჯი“ → „მიწერა“; საერთო `AuthModal` (რეგისტრაცია როლის გარეშე) | `company/CompanyActions.tsx` |
| public-17 | ბიუჯეტის ფასეტი იმალება, როცა ყველა 0 | `RequestsPageContent.tsx` |
| public-18 | „„zzzz“-ზე ვერაფერი მოიძებნა“ + „ძიების გასუფთავება“; 0-იანი ბეიჯი არ ჩანს (ორივე კატალოგი) | `RequestsPageContent.tsx`, `CompaniesPageContent.tsx` |
| public-19 | „შეთავაზების გაგზავნა“ / „მოთხოვნის ნახვა“, „პროფილის ნახვა“, „ყველა მოთხოვნა“ | `OpportunityCard.tsx`, `CompanyListingCard.tsx`, `RequestRow.tsx` |
| public-25 | რუკა: Esri Light Gray Base (ლეიბლების გარეშე; CARTO ახლა გასაღებს ითხოვს); CSP-ში დომენი | `CompaniesMap.tsx`, `next.config.ts` |
| public-26/28 | uuid კლიენტზე და სერვერზე — RPC არ იგზავნება; „შესაძლოა წაიშალა ან ვადა გაუვიდა“; title: მოთხოვნის/კომპანიის სახელი ან „… ვერ მოიძებნა“ | `lib/ids.ts`, `use-request-detail.ts`, `use-company-detail.ts`, `(company-view)/…/page.tsx`, `(request-view)/…/page.tsx` |
| public-27 | ცივ/თბილ კონტექსტში აღარ განმეორდა; `SaveCompanyButton`-ის `window` render-ში გადატანილია click-ზე | `SaveCompanyButton.tsx` |
| C-01 | დაუდასტურებელ კომპანიას „შეთავაზების გაგზავნის“ ნაცვლად ვერიფიკაციის მინიშნება + „დოკუმენტების ატვირთვა/შესწორება“ (ტექსტი = `onboarding-client` verification*; ინტეგრაციის შემდეგ ლოკალური `verificationStep` → იმ helper-ებით) | `RequestViewPageContent.tsx` |
| C-13 | ზუსტი მისამართი მხოლოდ მფლობელს, ადმინს და არჩეულ კომპანიას (UI); დანარჩენს — ქალაქი | `RequestViewPageContent.tsx` |
| C-19 | „შეთავაზება ჯერ არ მიღებულა“ / aside „ჯერ არ არის“ | `RequestViewPageContent.tsx` |
| D-02 (ნაწილი) | არჩეულ შეთავაზებაზე, თუ გარიგება არსებობს — პირდაპირი ბმული „გარიგების ნახვა“ (`list_my_deals`) | `RequestViewPageContent.tsx` |

## დარჩა / სხვა ნაკადებს
- `AuthModal`-ს სჭირდება `intent: "message"` („შედით, რომ მისწეროთ კომპანიას“) — ჩემთან cast-ით; მანამდე სათაური შეთავაზების ტექსტია. (საერთო UI)
- ფუტერის „კონტაქტი“ → `/terms/#contact`; ჰედერის „შესაძლებლობები“ → „მოთხოვნები“ და მფლობელის გვერდზე აქტიური პუნქტის მოხსნა (O3); sheet-ის არჩეული ჩიპი შავი (public-29); `ConfirmSheet`-ის „გაუქმება“ → „დაბრუნება“. (საერთო UI)
- C-25 (`matching/FullMatchingFeed.tsx`) — ანგარიშის ნაკადი.
- OfferCard-ის „ძალაშია —“ — გარიგების ნაკადი.
- C-13: `address_note` საჯარო API-ში ისევ ბრუნდება — სრული დაფარვა DB-ის ცვლილებაა (მფლობელი).
- ანგარიშის წაშლის მოთხოვნის არხი საიტზე არ არსებობს (წესებში ნახსენებია) — მფლობელის გადაწყვეტილება (ელფოსტა?).
- owner_company-ის ლოგოს blob 1440-ზე ერთხელ 403 (ჰედერი, მონაცემი).
