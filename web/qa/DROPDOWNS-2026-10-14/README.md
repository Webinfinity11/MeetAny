# ჩამოსაშლელი ველები — 2026-10-14

## ცვლილება

საერთო `Combobox` და `MultiCombobox`: CustomSelect-ის ტრიგერის ვიზუალი, ძიება, კატეგორიის ხატულები და ჯგუფები, შიდა გადახვევა, კლავიატურა, ARIA, მობილური Sheet, ტოკენები, ლიმიტი, ექსკლუზიური ქალაქი და საკუთარი ტექსტის დამატება. `CustomSelect.tsx` უცვლელია.

ჩანაცვლებულია რეგისტრაცია, კომპანიის პროფილი/განახლება, onboarding, დისტრიბუცია და `/dev/ui/`. შეთავაზება/ძებნის ტექსტური მნიშვნელობები კვლავ `string[]`-ია; დარგისა და ქალაქის მნიშვნელობები კვლავ მათი გასაღებებია. ძველი CategoryChips/CityChips/ChipsInput და მათი CSS წაშლილია. რეგისტრაციასა და პროფილში ქალაქი/დარგი desktop-ზე ერთ რიგშია.

## გადამოწმებული

- `npx tsc --noEmit`: 0 შეცდომა (`tsc.log`).
- `npx eslint app`: 0 შეცდომა (`eslint.log`).
- `npm run lint:design`: წარმატებული (`design.log`).
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 130/130, ახალი 3 unit ტესტის ჩათვლით (`unit.log`). ნაგულისხმევი npm lifecycle Node 26-ს ირჩევდა და არსებული auth ტესტები აღარ სრულდებოდა; Node 22-ით ყველა დასრულდა.
- `bash db/tests/run.sh`: 2262 SQL assertion; სკრიპტის დროებითი ლოკალური ბაზა წაიშალა (`sql.log`).
- `check.mjs`: 1440/390/360, single/multi ძიება, Enter/ისრები/Esc, ფოკუსის დაბრუნება, ლიმიტი, შექმნა, ქალაქების ექსკლუზიურობა, overflow 0. axe — `main`-ისა და მასში არსებული ღია სიების შემოწმება, გამორთული წესების გარეშე (`components.json`).
- სტუმრის კომპანიის რეგისტრაცია სამივე ზომაზე: axe 0, overflow 0 (`after-pages.json`).
- `before-register-*` გადაღებულია საწყისი `9e70953`-ის UI წყაროებით; გადაღების შემდეგ მიმდინარე ცვლილებები სრულად აღდგა. `after-register-*`, `after-single-*`, `after-multi-*` აჩვენებს შედეგს. მობილური Sheet-ის კადრები ვიზუალურად შემოწმებულია.

## დარჩენილი ბლოკერი

კომპანიის რეალური პროფილი/onboarding/დისტრიბუციის before/after და მათი axe/interaction QA **არ დასრულებულა**. `/tmp/717E24C5-company.json` რეალურ Auth-ზე სტუმრად ბრუნდება. შესრულდა მხოლოდ ერთი ახალი შესვლის მცდელობა; QA-ს მოძველებული `.account-tabs` selector-ის ლოდინი ჩავარდა (ეს selector მიმდინარე JSX-ში აღარ არსებობს), ამიტომ ახალი storageState არ შენახულა. ხელახალი შესვლა აღარ შესრულებულა, თითო როლზე ერთი შესვლის შეზღუდვის დასაცავად. საჭიროა მოქმედი კომპანიის storageState; `QA_STORAGE_STATE` პარამეტრით `pages.mjs` გამოიყენებს მას. ავტორიზებული ეკრანის ნაცვლად გადაღებული სტუმრის კადრები წაშლილია და წარმატებად არ ითვლება.

სერვერი: `next dev --webpack -p 3430`; ლოკალური DATABASE_URL და MEETANY_LOCAL_DATABASE_URL: `postgresql://kapana@localhost:5432/meetany_perf_20261014`. Production DB/deploy და სადემო პროფილების შენახვა არ შესრულებულა. CompanyProfilePageContent/market-store/public-snapshot არ შეცვლილა.

## გაშვება

`web/`-დან:

```sh
node qa/DROPDOWNS-2026-10-14/check.mjs
QA_ROLE=guest node qa/DROPDOWNS-2026-10-14/pages.mjs
QA_ROLE=company QA_STORAGE_STATE=/path/to/company-state.json node qa/DROPDOWNS-2026-10-14/pages.mjs
```

სკრიპტები ფორმებს არ აგზავნის და ბაზაში მონაცემებს არ ცვლის. მოქმედი სესიის გარეშე კომპანიის QA უნდა დარჩეს წარუმატებლად მონიშნული.
