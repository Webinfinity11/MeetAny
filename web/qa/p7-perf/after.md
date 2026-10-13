# T7.6 — after

Production build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.

| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| guest | request-view/desktop | 404 → 208 | 304 → 171 | 85 → 88 | 4 → 2 | 295.9 → 293.7 | 188.7 → 61.8 | 0 |
| guest | request-view/mobile | 1508 → 1856 | 1440 → 1436 | 57 → 56 | 4 → 2 | 243.8 → 234.9 | 188.7 → 61.8 | 0 |
| guest | company-view/desktop | 88 → 184 | 163 → 401 | 81 → 79 | 4 → 2 | 284.5 → 278.7 | 188 → 76.9 | 0 |
| guest | company-view/mobile | 1212 → 2112 | 4651 → 5720 | 55 → 54 | 4 → 2 | 226.6 → 218.2 | 188 → 76.9 | 0 |
| client | request-view/desktop | 88 → 404 | 216 → 1160 | 97 → 96 | 6 → 3 | 306.7 → 302.9 | 182.5 → 59.7 | 0 |
| client | request-view/mobile | 1336 → 2428 | 5432 → 5689 | 79 → 77 | 6 → 3 | 305.6 → 301.8 | 182.5 → 59.7 | 0 |
| client | company-view/desktop | 132 → 432 | 276 → 622 | 68 → 66 | 5 → 3 | 227.7 → 219.3 | 188 → 76.9 | 0 |
| client | company-view/mobile | 1528 → 2092 | 5684 → 5778 | 56 → 54 | 5 → 3 | 226.6 → 218.2 | 188 → 76.9 | 0 |

## შედეგი და ზღვარი

**ორივე გვერდისთვის <2.5 წმ მიზანი მიღწეული არ არის.** შემცირდა HTML, JS და RPC-ების რაოდენობა; ყველა სცენარში ready-ის გაუმჯობესება არ დადასტურდა. ზემოთ მოცემულია სრული before/after, რეგრესიების ჩათვლით. `ready` არსებული `measure.mjs`-ის busy/skeleton კრიტერიუმია; სტუმრის optional პირობები/დანართები ამ მაჩვენებლის შემდეგაც შეიძლება დაბრუნდეს. დროები და წონები 3 გაშვების მედიანაა; `/api` სვეტი არსებული საზომის მიერ შენახული ბოლო sample-ის waterfall-ის რაოდენობაა.

## ეტაპები — mobile ready, ms

| სცენარი | before | მხოლოდ SSR | + RPC | + dynamic | საბოლოო |
|---|---:|---:|---:|---:|---:|
| guest request-view | 1440 | 1194 | 1314 | 1443 | 1436 |
| guest company-view | 4651 | 4675 | 4992 | 5101 | 5720 |
| client request-view | 5432 | 4904 | 4746 | 5586 | 5689 |
| client company-view | 5684 | 4934 | 5242 | 5462 | 5778 |

ყოველი ეტაპი ცალკე production build-ით გაიზომა. `dynamic` ეტაპის პირველი გაზომვა ბრაუზერულ QA-ს დაემთხვა და გაუქმდა; შენახულია გამეორება ცალკე გაშვებული საზომით. საბოლოო გაზომვის დროს ამ ნაკადში სხვა ტესტი/ბრაუზერული QA არ მუშაობდა. იგივე კომპიუტერზე სხვა ნაკადების ფონური დატვირთვა სრულად იზოლირებული არ არის.

## კოდის ცვლილებები

- `public-snapshot.js`: `loadPublicRequest(id)` / `loadPublicCompany(id)` — პარამეტრიზებული, anonymous RLS, იგივე პროექცია; მოთხოვნა+ავტორი+counts ან კომპანია+stats+მისი ღია მოთხოვნები. ორივე გვერდის default export იყენებს შესაბამის loader-ს. `generateMetadata` უცვლელია და სერვერზე კვლავ სრულ snapshot-ს კითხულობს; კლიენტს ის აღარ გადაეცემა.
- `20261014-detail-extras.sql`: მოთხოვნის preferences, request/offer file metadata და business features ერთ RPC-ში; კომპანიის პროდუქტები, შეფასებები და stats — მეორეში. Wrappers SECURITY INVOKER-ია; anonymous offers ცხრილს არ კითხულობს, authenticated offers RLS-ს იყენებს. ძველი RPC-ები რჩება.
- Store-ში დეტალის წაკითხვები initial bootstrap-ს ელოდება და caller/data revision-ით ნაწილდება; გაერთიანების ფანჯარა 1 წამია. Preferences/files ცვლილება ქეშს აუქმებს; logout-ის ძველი პასუხი აღარ ბრუნდება. PGRST202-ზე fallback, offer files-ის ძველი micro-batcher-ის შენარჩუნებით.
- `ChatPopup.tsx` ინარჩუნებს საჯარო ღილაკებსა და unread ინდიკატორს; `ChatPopupContent.tsx` dynamic chunk პირველი გახსნისას იტვირთება. ბრაუზერის ტესტმა პირველ click-ზე ერთი ახალი script დააფიქსირა და ხელახლა გახსნაც შეამოწმა. RequestFormSheet და ChooseOfferSheet მხოლოდ გახსნისას იტვირთება.
- კომპანიის ხილულ ლოგოს აქვს `priority` და `sizes="64px"`; მოთხოვნის ქვემოთ მდებარე thumbnail-ს `sizes="112px"`. მოთხოვნის ფოტო hero არ არის და priority არ მინიჭებია. LCP ტექსტია: მოთხოვნაზე `h1.detail-hero__title` ან `p.ma-prose`; კომპანიაზე `p.company-profile-description`. არსებული font preload არ იყო; ახალი preload არ დამატებულა.

## JS — build და chunk-ები

Next 16.3-ის ამ build output-ში First Load JS სვეტი არ არის. `chunks.mjs` ითვლის გვერდის client-reference manifest-ში ჩამოთვლილ უნიკალურ chunk-ებს (`.next/static/chunks`); ეს არის manifest-ის footprint და არა მთელი navigation transfer. რეალური browser transfer ზედა ცხრილშია და prefetch-საც მოიცავს.

| გვერდი | manifest decoded KB before → after | manifest gzip KB before → after |
|---|---:|---:|
| request | 423.4 → 407.4 | 145.6 → 142.2 |
| company | 389.8 → 360.6 | 135.7 → 125.0 |

ცალკე Leaflet/admin UI-ის static import დეტალის კომპონენტებში არ დამატებულა. საერთო `market-store` ჯერ მონოლითურია — მისი auth/admin API მეთოდების დაყოფა დარჩენილია.

## დარჩენილი შეფერხება

`diagnostic.json`: თითო გვერდზე ერთი დამატებითი diagnostic run, იგივე mobile throttle; ეს მონაცემები ზემოთ მოცემულ 3-run მედიანებში არ შედის.

| შესული მომხმარებელი | bootstrap start → end ms | bootstrap transfer KB | >50ms main-thread tasks, ჯამი ms | ready ms |
|---|---:|---:|---:|---:|
| request-view/mobile | 1825 → 4670 | 133.2 | 2574 | 7225 |
| company-view/mobile | 2039 → 4848 | 133.2 | 1766 | 5661 |

შემდეგი ნაბიჯები: დეტალზე caller-scoped მცირე bootstrap (სრული კატალოგის ნაცვლად), bootstrap response-ის transport compression და საერთო market-store-ის დაყოფა. ამ გაზომვაში bootstrap-ის transfer და decoded ზომები პრაქტიკულად ტოლია; `curl`-ით gzip მოთხოვნაზეც Content-Encoding არ დაბრუნდა. bootstrap კონკურენციაშია საწყის JS/font რესურსებთან; მის შემდეგ რჩება React-ის მუშაობა და extras-ის ერთი round trip. Long-task ჯამი მთელი hydration CPU-ის ზუსტი გაზომვა არ არის. პროდუქტის/შეფასების პირველი public render-ის სერვერზე გადატანა ასევე შეამცირებდა readiness-ის დამოკიდებულებას კლიენტის ჩატვირთვაზე. ეს დამატებითი ცვლილებები ამ ნაკადში არ გაკეთებულა.

## მონაცემები და გამეორება

ბაზა: `meetany_preview_p7_perf`; სტუმარი: `012ca27c-5913-46e2-899f-254785bd3d23`; მფლობელის მოთხოვნა: `0101aaac-f4e6-4ed4-b1bd-5a52e0942db9`; user: `bacf1572-7493-4ac9-bfc7-95719e911c4c`; კომპანია: `74cc28fc-47de-45cb-9563-93735b86855e`. რედაქტირების ფორმის QA: `9bb4fc42-e88b-4fe9-bc80-13d142899365`.

თავდაპირველი guest fixture დამალულია; ჩანაცვლებულია მითითებული SQL-ის პირველი anonymous-visible მოთხოვნით. ჩანაცვლებულ ჩანაწერს `status=open` აქვს, თუმცა მომწოდებელი უკვე არჩეულია. ყველა ეტაპში ერთი და იგივე ID-ებია; ძველ 2026-10-12 fixture-სთან აბსოლუტური შედარება არ კეთდება.

```sh
# web/-დან, ცალკე ტერმინალებში
node qa/perf-2026-10-12/auth-fixture.mjs 3718
NEON_AUTH_BASE_URL=http://127.0.0.1:3718 npx next build --webpack
NEON_AUTH_BASE_URL=http://127.0.0.1:3718 npx next start -p 3708
bash qa/p7-perf/run-local.sh after
```

Auth URL build-ის დროსაც აუცილებელია. გაზომვები ლოკალური JWT-ითაა; რეალური მომხმარებლის შესვლა არ გამოყენებულა.

## შემოწმება

- Production webpack build: წარმატებული.
- `npm test`: 127 pass, 0 fail (public-snapshot/auth-bootstrap ჩათვლით).
- `node --test qa/p7-perf/detail-extras.test.mjs`: 8 pass, 0 fail; batching, fallback, mutation invalidation, logout race, bootstrap join.
- `npx tsc --noEmit`: 0.
- `npx eslint app`: 0 error, 11 არსებული warning.
- `npm run lint:design`: წარმატებული.
- `bash db/tests/run.sh`: ზედიზედ ორი წარმატებული გაშვება, 2203 assertion; მათ შორის 20 ახალი DEX assertion; თითო გაშვებაში ახალი მიგრაცია ორჯერ გამოიყენება.
- Chromium visual: 12 სცენარი (2 როლი × 2 გვერდი × 1440/390/360), overflow 0, pageerror 0, busy 0.
- Browser interactions: შეთავაზების არჩევის დიალოგი, preferences, ჩატის პირველი და განმეორებითი გახსნა, მოთხოვნის რედაქტირება, პროდუქტის დიალოგი, გალერეა — ჩვეულებრივად და PGRST202 fallback-ით; pageerror 0. შენახვა/შეთავაზების არჩევის დადასტურება/შეტყობინების გაგზავნა არ შესრულებულა. კომპანიის ტექსტური შინაარსი ორივე რეჟიმში იდენტურია.

სკრინშოტები (`shots/`, gitignore; PNG არ დაკომიტდება):

- [guest-request-1440](shots/guest-request-1440.png), [guest-request-390](shots/guest-request-390.png), [guest-request-360](shots/guest-request-360.png)
- [guest-company-1440](shots/guest-company-1440.png), [guest-company-390](shots/guest-company-390.png), [guest-company-360](shots/guest-company-360.png)
- [client-request-1440](shots/client-request-1440.png), [client-request-390](shots/client-request-390.png), [client-request-360](shots/client-request-360.png)
- [client-company-1440](shots/client-company-1440.png), [client-company-390](shots/client-company-390.png), [client-company-360](shots/client-company-360.png)
