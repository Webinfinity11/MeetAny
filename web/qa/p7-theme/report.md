# T7.5 — თემის გადამრთველი ფუტერში

`ThemeToggle` იღებს `labelled?: boolean` prop-ს. ფუტერის ქვედა ზოლში ghost ღილაკი აჩვენებს მიმდინარე თემას; უცვლელია aria-label, aria-pressed, title და თემის შენახვის ლოგიკა. © რჩება, ძველი სლოგანი ამოღებულია. ტექსტი და swatch-ის ჩარჩო მუქ ფონზე ტოკენებითაა გაფორმებული; მობილურზე ზოლი იკეცება.

ჰედერში გადამრთველი აღარ არის. `OnboardPage.tsx`-ში რეალურად სამი გამოყენება იყო (loading, fallback shell, შევსების ფორმა) — სამივე ამოღებულია, სხვა ლოგიკა უცვლელია. `/dev/ui/` გადამრთველს არ იყენებს; კომპონენტის ძველი, წარწერის გარეშე ვარიანტი შენარჩუნებულია. `Header.module.css`-ის გამოუყენებელი ძველი წესი scope-ის გამო უცვლელია.

Footer პირდაპირ აქვთ `(home)` და `(how)` layout-ებს. `SiteShell`-ით ფუტერი აქვთ `(account)`, `(companies)`, `(company-view)`, `(requests)`, `(requests-new)`, `(request-view)`, `(make-offer)`, `(matching)`, `(deals)`, `(compare-offers)`, `(ideas)`, `(terms)` ჯგუფებს. `(admin)` იყენებს `footer={false}`-ს, onboarding-ს ცალკე shell აქვს: ამ ორ ადგილას გადამრთველი აღარ არის; შენახული თემა დოკუმენტზე მაინც მოქმედებს.

QA fixture განახლებულია მიმდინარე `/bootstrap`, deals/matching/attachments/draft API-ებსა და ნაგულისხმევ ლურჯ თემასთან შესაბამისობით; selector არის `footer .ma-theme-toggle`, კლავიატურის ტესტამდე — `scrollIntoViewIfNeeded()`. ონბორდინგში შემოწმება ითხოვს გადამრთველის არყოფნას. ჰიდრატაციის მოლოდინი და გაზრდილი navigation timeout იცავს dev რეჟიმის ნაადრევი click/ცივი კომპილაციისგან. ფერი მოწმდება მიმდინარე ტოკენით; მომწოდებლის სექციის არსებული inverse CTA ცალკე მოწმდება თეთრად. `caret: initial` გამორიცხავს Playwright screenshot-ის მიერ SSR input-ებზე დამატებული style-ის ჰიდრატაციის ცრუ გაფრთხილებას.

შემოწმებები:

- `npx tsc --noEmit`: 0 შეცდომა.
- `npx eslint app`: 0 შეცდომა / 11 არსებული გაფრთხილება.
- `npm run lint:design`: წარმატებული.
- `npm test` (Node 22 PATH): 118/118 წარმატებული, 0 ჩავარდნა. გარემოს ნაგულისხმევმა npm-მა თავდაპირველად Node 26 გაუშვა და suite გაჩერდა; იგივე ტესტები Node 22-ით სრულად გავიდა.
- `QA_ORIGIN=http://localhost:3704 QA_OUTPUT=qa/p7-theme/shots/theme-local node qa/theme-local.mjs`: **194 შემოწმება / 69 ხედი**, 0 pageerror / 0 console error / 0 მოულოდნელი API / 0 DB write. ორივე თემა, კლავიატურა, persist, refresh, ჩანართების სინქრონიზაცია, დაბლოკილი საცავი, სტუმარი/კომპანია/კლიენტი. დეტალები `theme-report.json`; სრული ლოკალური შედეგი `shots/theme-local/report.json`.
- `node qa/p7-theme/visual.mjs`: 18 ხედზე 0 overflow / 0 pageerror, ჰედერის ღილაკები ერთ რიგში, გადამრთველი ≥44px. `/`, `/requests/`, `/account/` სტუმრით, 1440/390/360, ორივე თემა. `visual-report.json` შეიცავს გაზომვებს; PNG-ები `shots/{home,requests,account}-{blue,classic}-{1440,390,360}-{footer,header}.png` (არ კომიტდება). სურათები ვიზუალურად შემოწმებულია; screenshot-ში Next dev indicator დამალულია.

მიგრაციები: 0. production build/deploy/push არ გაშვებულა.

Overlay: `BASE=http://localhost:3704 NODE_OPTIONS='--import ./qa/p7-theme/overlay-session.mjs' node qa/overlay-audit.mjs` → **overlaps: 0**, 30 გახსნილი მენიუს შემოწმება (390/980/1440, 6 მარშრუტი). ერთი რეალური owner_company UI შესვლა; შემდგომი გაშვებები `/tmp/p7-theme-owner_company.json` სესიას იყენებს. 429: 0. დამხმარე wrapper ელოდება ჰიდრატაციას და შეტყობინების დინამიკურ aria-label-ს პრეფიქსით პოულობს; ორიგინალი overlay სკრიპტი უცვლელია. 390-ზე პროფილის ღილაკი არსებული CSS-ით დამალულია, შეტყობინებების მენიუ შემოწმებულია.

ბლოკერი: არ არის. ცვლილებები მხოლოდ გამოყოფილ ფაილებშია. დამატებითი worktree/clone არ შექმნილა. ინტეგრაციას ასრულებს ორკესტრატორი.
