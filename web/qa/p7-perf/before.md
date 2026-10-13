# T7.6 — before

Production build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.

| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| guest | request-view/desktop | 404 | 304 | 85 | 4 | 295.9 | 188.7 | 0 |
| guest | request-view/mobile | 1508 | 1440 | 57 | 4 | 243.8 | 188.7 | 0 |
| guest | company-view/desktop | 88 | 163 | 81 | 4 | 284.5 | 188 | 0 |
| guest | company-view/mobile | 1212 | 4651 | 55 | 4 | 226.6 | 188 | 0 |
| client | request-view/desktop | 88 | 216 | 97 | 6 | 306.7 | 182.5 | 0 |
| client | request-view/mobile | 1336 | 5432 | 79 | 6 | 305.6 | 182.5 | 0 |
| client | company-view/desktop | 132 | 276 | 68 | 5 | 227.7 | 188 | 0 |
| client | company-view/mobile | 1528 | 5684 | 56 | 5 | 226.6 | 188 | 0 |

გაზომვის fixture-ები: სტუმარი `012ca27c-5913-46e2-899f-254785bd3d23`; მფლობელის მოთხოვნა `0101aaac-f4e6-4ed4-b1bd-5a52e0942db9`; user `bacf1572-7493-4ac9-bfc7-95719e911c4c`; კომპანია `74cc28fc-47de-45cb-9563-93735b86855e`. ბაზა `meetany_preview_p7_perf`.

თავდაპირველი სტუმრის ID დამალულია (`hidden=true`) და anonymous RLS მას არ აბრუნებს. გამოყენებულია ორკესტრატორის მითითებული SQL-ის პირველი ხილული შედეგი, ერთი შეთავაზებით. მას `status=open` აქვს, მაგრამ მომწოდებელი უკვე არჩეულია; ამიტომ სტუმრის „ready“ ძირითადად SSR შინაარსის მზადყოფნას ზომავს. იმავე fixture-ებით იზომება ყველა შემდგომი ეტაპი. ახალი baseline ძველი 2026-10-12 ანგარიშის აბსოლუტურ რიცხვებთან პირდაპირ შესადარებელი არ არის.

Auth fixture-ის მისამართი საჭიროა **build-ის დროსაც**: `NEON_AUTH_BASE_URL=http://127.0.0.1:3718 npx next build --webpack`. მხოლოდ `next start`-ის გარემოს შეცვლა client bundle-ში ჩაკერილ Auth URL-ს არ ცვლის. გაზომვაში რეალური შესვლა არ გამოიყენება.

`ready` არსებული `measure.mjs`-ის განსაზღვრებაა: აღარ ჩანს busy/skeleton ან „იტვირთება“. ეს არ არის ყველა optional RPC-ის დასრულების დრო; სტუმრის მოთხოვნის preferences/files მოგვიანებითაც შეიძლება დაბრუნდეს. raw JSON-ში API waterfall შენახულია.
