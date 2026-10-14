# ჩამოსაშლელი ველები — 2026-10-14

## ცვლილება

საერთო `Combobox` და `MultiCombobox`: CustomSelect-ის ტრიგერის ვიზუალი, ძიება, კატეგორიის ხატულები და ჯგუფები, შიდა გადახვევა, კლავიატურა, ARIA, მობილური Sheet, ტოკენები, ლიმიტი, ექსკლუზიური ქალაქი და საკუთარი ტექსტის დამატება. `CustomSelect.tsx` უცვლელია.

ჩანაცვლებულია რეგისტრაცია, კომპანიის პროფილი/განახლება, onboarding, დისტრიბუცია და `/dev/ui/`. შეთავაზება/ძებნის ტექსტური მნიშვნელობები კვლავ `string[]`-ია; დარგისა და ქალაქის მნიშვნელობები კვლავ მათი გასაღებებია. ძველი CategoryChips/CityChips/ChipsInput და მათი CSS წაშლილია. რეგისტრაციასა და პროფილში ქალაქი/დარგი desktop-ზე ერთ რიგშია.

## გადამოწმებული

- `npx tsc --noEmit`: 0 შეცდომა (`tsc.log`).
- `npx eslint app`: 0 შეცდომა (`eslint.log`).
- `npm run lint:design`: წარმატებული (`design.log`).
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 131/131, ახალი 4 unit ტესტის ჩათვლით (`unit.log`). ნაგულისხმევი npm lifecycle Node 26-ს ირჩევდა და არსებული auth ტესტები აღარ სრულდებოდა; Node 22-ით ყველა დასრულდა.
- `bash db/tests/run.sh`: 2262 SQL assertion; სკრიპტის დროებითი ლოკალური ბაზა წაიშალა (`sql.log`).
- `check.mjs`: 1440/390/360, single/multi ძიება, Enter/ისრები/Esc, ფოკუსის დაბრუნება, ლიმიტი, შექმნა, ქალაქების ექსკლუზიურობა, overflow 0. axe — `main`-ისა და მასში არსებული ღია სიების შემოწმება, გამორთული წესების გარეშე (`components.json`).
- სტუმრის კომპანიის რეგისტრაცია სამივე ზომაზე: axe 0, overflow 0 (`after-pages.json`).
- `before-register-*` გადაღებულია საწყისი `9e70953`-ის UI წყაროებით; გადაღების შემდეგ მიმდინარე ცვლილებები სრულად აღდგა. `after-register-*`, `after-single-*`, `after-multi-*` აჩვენებს შედეგს. მობილური Sheet-ის კადრები ვიზუალურად შემოწმებულია.

## ტოკენების მეორე შემოწმება

ტოკენები ახლა ჩვეულებრივ flex განლაგებაშია: სრული ტექსტი, 8px gap, ჩარჩოს გარეშე pill, ავტომატურად მზარდი ველი. ორ რიგში ჩატევის რაოდენობა ითვლება რეალური ზომებით; `+N` მხოლოდ ამის შემდეგ ჩანს. ისარი და ამოღების ღილაკები ზედა ხაზზეა.

მთავარი სესიის მიერ მოწოდებული `company-local.storage.json` მუშაობს და `.gitignore`-ით გამორიცხულია. ხელახალი შესვლა არ შესრულებულა. `token-layout.mjs` რეალურ კომპანიის პროფილზე ამოწმებს 1440/390/360 ზომებს: ტოკენების გადაფარვა/ტექსტის მოჭრა 0, გვერდითი ჩარჩო 0, მაქსიმუმ ორი რიგი, ხილული ისარი ზედა ხაზზე, ძიება, Esc და ფოკუსის დაბრუნება. ღია პროფილის სიის axe 0. შედეგები: `token-layout.json`; კადრები: `after-profile-*`, `after-profile-tokens-*`, `after-profile-open-*`.

პროფილი და onboarding-ის `need` ნაბიჯი სამივე ზომაზე შემოწმებულია: axe 0, overflow 0 (`after-company-pages.json`).

## დარჩენილი ფორმების დასრულებული შემოწმება

მთავარი სესიისგან მიღებული `company-seller-local.storage.json` ეკუთვნის `demo-food` კომპანიას (`both`, ჩართული დისტრიბუცია). ფაილი `.gitignore`-ით გამორიცხულია. ხელახალი შესვლა არ შესრულებულა.

`seller.mjs`-მა onboarding-ის `provide` და დისტრიბუციის ფორმა 1440/390/360-ზე შეამოწმა: გახსნა/ძიება/არჩევა/არჩევის დაბრუნება/Esc/ფოკუსი PASS; დახურულ და ღია სიებზე axe 0; გვერდის overflow 0. Onboarding-ის დროებითი მონახაზი გაუქმდა, ფორმები არ გაგზავნილა; ჩაწერის RPC მოთხოვნები 0 (`seller.json`). კადრები: `after-onboarding-provide-*`, `after-distribution-*`, ღია სიებისთვის `*-open-*`.

საწყისი `9e70953`-ის UI წყაროებით გადაიღო ოთხივე კომპანიის ეკრანის before კადრები სამივე ზომაზე (`before-company-pages.json`, `before-profile-*`, `before-onboarding-need-*`, `before-onboarding-provide-*`, `before-distribution-*`). მიმდინარე წყაროები გადაღების შემდეგ ბაიტობრივად აღდგა; `web/app`-ში ამ QA ეტაპს ცვლილება არ დაუტოვებია. საბოლოო კომპანიის შედეგები გაერთიანებულია `after-company-pages.json`-ში: 12/12, დარჩენილი ბლოკერი არ არის.

სერვერი: `next dev --webpack -p 3430`; ლოკალური DATABASE_URL და MEETANY_LOCAL_DATABASE_URL: `postgresql://kapana@localhost:5432/meetany_perf_20261014`. Production DB/deploy და სადემო პროფილების შენახვა არ შესრულებულა. CompanyProfilePageContent/market-store/public-snapshot არ შეცვლილა.

## გაშვება

`web/`-დან:

```sh
node qa/DROPDOWNS-2026-10-14/check.mjs
QA_ROLE=guest node qa/DROPDOWNS-2026-10-14/pages.mjs
node qa/DROPDOWNS-2026-10-14/token-layout.mjs
node qa/DROPDOWNS-2026-10-14/seller.mjs
```

სკრიპტები ფორმებს არ აგზავნის და ბაზაში მონაცემებს არ ცვლის. მოქმედი სესიის გარეშე კომპანიის QA უნდა დარჩეს წარუმატებლად მონიშნული.
