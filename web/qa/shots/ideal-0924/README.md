# P11 T11.4 — კატალოგები ცივი კრიტიკის შემდეგ, 2026-09-24

`v1/` = T11.3-ის კადრები **კრიტიკამდე** (`../../DESIGN-CRITIQUE-GE.md`). ამ საქაღალდის კადრები = T11.4, კრიტიკის #1–#12 და #15 გამოსწორების შემდეგ (#13/#14 განზრახ არ შეცვლილა).

წყარო: `http://localhost:3001`, Chrome/Playwright. გაშვება `site/web`-იდან:

```sh
node qa/ideal-shots.mjs companies requests
node qa/ideal-qa.mjs
node qa/ideal-qa.mjs --fixtures
npm run lint
npx tsc --noEmit
```

| კადრი | ზომა / შინაარსი |
| --- | --- |
| companies-1440.png | 1440×1000, fullPage |
| companies-1440-phone-open.png | 1440, პირველი რიგის ნომერი გახსნილია; ნომრის ტექსტი გახსნამდე CSS-ით დაფარულია |
| companies-390.png | 390×844, fullPage |
| companies-390-fold.png | 390×844, პირველი ეკრანი |
| requests-1440.png | 1440×1000, fullPage |
| requests-390.png | 390×844, fullPage |
| requests-390-fold.png | 390×844, პირველი ეკრანი |
| request-states-fixture-1440.png | რეალური RequestRow-ის სატესტო props (მათ შორის 12 დღე — ვადის გარეშე), desktop |
| request-states-fixture-390.png | იგივე, mobile |

## საზომები (`ideal-shots.mjs`)

| გვერდი · viewport | navy თავი | ტექსტის მარცხენა ღერძი | სრული რიგი პირველ ეკრანზე |
| --- | ---: | --- | ---: |
| companies · 1440 | 132px | h1/ძიება/„დარგი“ = 120 | 4 |
| companies · 390 | 108px | 16 | 2 |
| requests · 1440 | 132px | h1/ძიება/პირველი ჩანართი/უფოტო სათაური = 120 | 5 |
| requests · 390 | 108px | 16 | 2 |

ნომრის გახსნა: ღილაკი 44px სიმაღლე, 253px სიგანე, ერთ ხაზზე; რიგი 175→175px (აღარ იზრდება). overflow 0, pageerror 0.

## რა შეიცვალა (კრიტიკის #)

- **#1** გახსნილი ნომერი `nowrap`; მარჯვენა სვეტი `minmax(204px,max-content)`, კონტაქტის ბლოკი მაქს. 260px; 390-ზე 100%. CallButton-ის markup უცვლელია.
- **#2/#15** თეთრი გარსი მოხსნილია — input თავად თეთრია (border 0, radius 10, 52/44px, ფოკუსზე `--focus-ring`), თავი padding 16, gap 8.
- **#3** /requests/ 390: ჩანართები ერთ ხაზზე (horizontal scroll, scrollbar-ის გარეშე) + „ფილტრი · N“ ღილაკი → MobileFilterSheet (კატეგორია, ქალაქი) + დალაგება. Desktop-ზე ერთი რიგი უცვლელია.
- **#4** ავატარი 48×48, `--avatar-bg`=`--blue-100`, `--avatar-text`=`--blue-700`, 600 18px (ტოკენები მხოლოდ კატალოგში გამოიყენება).
- **#5** დალაგება — ტექსტური „დალაგება: უახლესი ▾“ (32px, ჩარჩოს გარეშე); /companies/-ზე „დარგი“-ს ხაზზეა.
- **#6/#11** სათაური 20/28 (mobile 18/26); პროდუქტები 14/22 `--text-2`; VIP სათაური 24/32 (mobile 21/28), ფოტო 200×133, padding-block 24.
- **#7/#8** შეთავაზების რიცხვი 18/600 + „შეთავაზება“ 12px, ცენტრში; ვადა მხოლოდ ≤7 დღეზე ან დახურულ მდგომარეობაზე; mobile-ზე მეტა-ხაზის ბოლოს.
- **#9** აქტიური ჩანართი ფონის გარეშე (`--text` 600 + 2px ხაზი), ჩანართები x=120-დან, gap 20; ბმულისებრი ღილაკები padding 0.
- **#10** facet რიგი 36px (`pointer:fine`, ≥1024), touch-ზე 44; ნულოვანი დარგები ბოლოში მკრთალად რჩება.
- **#12** 390: [ნომრის ნახვა][↗ 44×44], ბმულის ხილული ტექსტი დამალულია, aria-label უცვლელი („<სახელი> — მიმართულება Google Maps-ზე“).

## შემოწმება

- `ideal-qa.mjs`: ნომრის reveal → tel/ფოკუსი; მიმართულება; companies და requests mobile sheet (ქალაქი, „ფილტრი · 1“, ფოკუსის დაბრუნება); სტუმრის/ავტორიზებული შენახვა; ჩანართები; reset; reduced-motion; fixture-ები — ყველა PASS, pageerror 0.
- `npm run lint`: 0 შეცდომა, 16 არსებული გაფრთხილება; `npx tsc --noEmit`: PASS. Build/deploy არ გაშვებულა.
- `home.css`, `app/(home)`, PageBand, დეტალების გვერდები არ შეცვლილა.
