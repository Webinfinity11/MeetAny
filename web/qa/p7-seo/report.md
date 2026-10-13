# T7.8 — SEO და OG

თარიღი: 2026-10-13. ლოკალური ბაზა: `meetany_preview_p7_seo`; სერვერი: `http://localhost:3705`.

## ცვლილებები

- Root metadataBase, ქართული locale/siteName, Twitter large image; საჯარო layout-ების canonical-ები trailing slash-ით.
- დეტალების სათაური/აღწერა/canonical და OG სურათები; უცნობი UUID და არასწორი ID — noindex.
- `/opengraph-image` ბრენდის ბარათი და `/og?kind=request|company&id=…`: 1200×630 PNG, Noto Sans Georgian (Google Fonts TTF, module-scope memo), ლოგო ან ინიციალები, SVG ვერიფიკაციის ნიშანი; უცნობი ID → ბრენდის სურათი HTTP 200.
- OG cache: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`. ლოგოს fetch მხოლოდ აპლიკაციის assets-იდან ან Vercel public Blob-იდან; შეცდომაზე ინიციალები.
- JSON-LD: მთავარი WebSite/SearchAction (`q`) + Organization; მოთხოვნა BreadcrumbList + Demand; კომპანია Organization. `<` უსაფრთხოდ იცვლება `\u003c`-ით. ორკესტრატორის დაზუსტებით სერვერული script რჩება #main-ში, Suspense-ის გარეთ; SiteShell უცვლელია.
- sitemap: 5 სტატიკური + 41 ღია/ხილული/ვადაუგასვლელი მოთხოვნა + 16 კომპანია = **62 URL**; `revalidate = 3600`. Next-ის ლოკალური sitemap დოკუმენტაცია ადასტურებს metadata route-ის ქეშირებას და dynamic config მხარდაჭერას.
- robots: matching/deals/onboarding/offers/compare-offers აკრძალულია; `/og` ხელმისაწვდომია. ideas-ის არსებული noindex შენარჩუნებულია.

## შემოწმებები

| შემოწმება | შედეგი |
|---|---|
| `npx tsc --noEmit` | 0 შეცდომა, exit 0 |
| `npx eslint app` | 0 error / 11 არსებული warning; შეცვლილ ბოლო ფაილებზე დამატებითი შემოწმებაც 0 |
| `npm run lint:design` | წარმატებული |
| `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test` | 118 pass / 0 fail |
| `BASE=http://localhost:3705 node qa/seo-check.mjs` | 62 URL HTTP 200, noindex-ის გარეშე; 11 metadata ნიმუში; 0 შეცდომა |
| `node qa/p7-seo/visual.mjs` | 15 შემოწმება (1440/390/360 × 5 გვერდი), overflow 0, pageerror 0 |
| `node qa/p7-seo/navigation.mjs` | მოთხოვნისა და კომპანიის ბარათზე click → შესაბამისი დეტალი; pageerror 0 |
| `git diff --check` | წარმატებული |

Node 26-ზე საწყისი unit გაშვება auth-ის ტესტებთან არ დასრულდა და შევაჩერე; Node 22.23.2-ზე სრული სუიტა 6.3 წამში წარმატებით დასრულდა. Production build არ გამიშვია. Dev მუშაობდა `SITE_URL=http://localhost:3705 npx next dev --webpack -p 3705`-ით.

## გვერდების metadata

| გვერდი | title | description | სიგრძე |
|---|---|---|---|
| `/` | MeetAny — იპოვეთ თქვენი ბიზნესპარტნიორი | ერთი მოთხოვნა — რამდენიმე შეთავაზება. აღწერეთ საჭიროება და შეადარეთ ვერიფიცირებული კომპანიების შეთავაზებები. | 108 |
| `/requests/` | ღია მოთხოვნები — MeetAny | ბიზნესების ღია მოთხოვნები: გაუგზავნეთ შეთავაზება ან განათავსეთ საკუთარი მოთხოვნა და მიიღეთ კომპანიების შეთავაზებები. | 116 |
| `/companies/` | კომპანიები — MeetAny | MeetAny-ზე დარეგისტრირებული მომწოდებლები და მომსახურების კომპანიები: რას სთავაზობენ და სად მუშაობენ. | 100 |
| `/how-it-works/` | როგორ მუშაობს — MeetAny | როგორ იპოვოთ მომწოდებელი ან მიიღოთ შეკვეთები MeetAny-ზე: ნაბიჯები მყიდველისა და კომპანიისთვის, ნდობა და ხშირი კითხვები. | 119 |
| `/terms/` | წესები და კონფიდენციალურობა — MeetAny | MeetAny-ს გამოყენების წესები და პერსონალური მონაცემების დამუშავება. | 67 |
| `/requests/view/?id=012ca27c-5913-46e2-899f-254785bd3d23` | ხის მაგიდების შესყიდვა 1791905313872 — MeetAny | თბილისი. [e2e] 1791905313872 გვჭირდება 12 ხის მაგიდა სასტუმროსთვის, თბილისში მიწოდებით და აწყობით. | 98 |
| `/requests/view/?id=ed931c31-b6c4-44c1-ba1d-7a0ad4e98af1` | ხის მაგიდების შესყიდვა 1791904926341 — MeetAny | თბილისი. [e2e] 1791904926341 გვჭირდება 12 ხის მაგიდა სასტუმროსთვის, თბილისში მიწოდებით და აწყობით. | 98 |
| `/requests/view/?id=2d72f9f1-30ce-4788-ac9a-bb9ef1a86908` | ხის მაგიდების შესყიდვა 1791899932067 — MeetAny | თბილისი. [e2e] 1791899932067 გვჭირდება 12 ხის მაგიდა სასტუმროსთვის, თბილისში მიწოდებით და აწყობით. | 98 |
| `/companies/view/?id=1877f069-837f-49fa-b4c6-91b79de45601` | [e2e] 1791905313872 კომპანია — MeetAny | ავეჯი · თბილისი. [e2e] 1791905313872 ვამზადებთ ავეჯს ბიზნესებისთვის თბილისში. | 77 |
| `/companies/view/?id=010b3204-1ca1-4ca9-bd22-601ea36a942b` | [e2e] 1791904926341 კომპანია — MeetAny | ავეჯი · თბილისი. [e2e] 1791904926341 ვამზადებთ ავეჯს ბიზნესებისთვის თბილისში. | 77 |
| `/companies/view/?id=64c86d01-83a5-4f47-945b-93a9d3e89985` | [e2e] 1791898427870 კომპანია — MeetAny | ავეჯი · თბილისი. [e2e] 1791898427870 ვამზადებთ ავეჯს ბიზნესებისთვის თბილისში. | 77 |

ყველა ნიმუშზე canonical შეესაბამება გვერდს; OG title/description ემთხვევა metadata-ს; OG image აბრუნებს 200-სა და image/png|jpeg|webp-ს. JSON-LD პარსდება მოსალოდნელი @type-ებით. დამატებით შემოწმდა უცნობი UUID-ის noindex/ბრენდის fallback, robots და OG ქეში/ზომები.

## სურათების ვიზუალური QA

- `shots/og-request-0.png` … `og-request-2.png`: ქართული სათაური ორ ხაზში, კატეგორია/ქალაქი, MeetAny.
- `shots/og-company-0.png` … `og-company-2.png`: ლოგოს data URL-ის branch; ადგილობრივი E2E fixture-ის ლოგო თითქმის გამჭვირვალეა და თეთრ ფილად ჩანს (იგივე ჩანს პროფილზეც).
- `shots/og-company-3.png` / `og-company-no-logo.png`: „მთის ბაღი“, ინიციალები „მბ“, ქართული ტექსტი და SVG ვერიფიკაცია სწორად რენდერდება.
- `shots/og-request-unknown.png`, `og-company-unknown.png`: ბრენდის fallback, ქართული სლოგანი სწორად ჩანს.
- `shots/page-{1440,390,360}-{0..4}.png`: მთავარი, მოთხოვნები, კომპანიები, მოთხოვნის დეტალი, კომპანიის დეტალი.

ქართული ასოების ნაცვლად □ არ ჩანს. პირველი რენდერის ტექსტური ✓ ფონტში აკლდა; შეიცვალა SVG-ით და საბოლოო სურათები ხელახლა შემოწმდა. PNG-ები მხოლოდ checkout-შია, commit-ში არ შედის. შედეგები: `results.json`, `visual.json`, `navigation.json`.

## შეზღუდვები და ინტეგრაცია

- `requests`-ის საჯარო ბიუჯეტის ველი არ არსებობს: priceSpecification/ბიუჯეტი არ გამოგვიგონია. Company sameAs დაემატება მხოლოდ snapshot-ში რეალური website-ის არსებობისას (მიმდინარე list_companies მას არ აბრუნებს).
- RLS anonymous-ს hidden მოთხოვნებს უმალავს, closed-ს აჩვენებს; sitemap-ის დამატებითი ფილტრი closed/expired-ს გამორიცხავს. Snapshot-ის არსებული 1000 მოთხოვნის ლიმიტი შენარჩუნებულია.
- Google Fonts-ის მიუწვდომლობისას სისტემური fallback გამოიყენება; ქართული ფონტის წარმატებული რენდერი ლოკალურად დადასტურებულია.
- Facebook/Twitter debugger ლოკალურ localhost-ს ვერ ამოწმებს; მათი დისტანციური შემოწმება არ ჩატარებულა.
- მიგრაციები, production DB ცვლილებები, deploy და push არ შესრულებულა. დამხმარე worktree/clone არ შექმნილა.
- ინტეგრაციას ასრულებს მფლობელი: `agent integrate AFAC28E2-3393-4209-B354-5EAB51817F1D`. დეტალის გვერდებზე initial snapshot/connection/Suspense ლოგიკა შენარჩუნებულია; სიჩქარის ნაკადის ცვლილებებთან შერწყმისას JsonLd ფრაგმენტები შეინარჩუნეთ.
