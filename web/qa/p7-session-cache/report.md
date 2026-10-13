# T7.13 — სტუმრის სესიის ქეში

სტუმრის წარმატებული get-session პასუხი, მათ შორის JSON `null`, კანონიკურდება `{ data: { user: null, session: null }, jwt: null }` ფორმად და ინახება sessionStorage-ში 300000 ms-ით. ქეში ამოწმებს endpoint/generation/TTL-ს; ვალიდური მომხმარებლის ჩანაწერს დაგვიანებული guest პასუხი არ ანაცვლებს. ფუნქცია კვლავ თვითკმარია inline preload-ისთვის.

`market-store.js` უცვლელია: preload და loadUserJwt `data.user === null`-ს სტუმრად აღიქვამენ; არსებული საერთო invalidate ფარავს შესვლას, რეგისტრაციას, OTP-ს, გასვლასა და სხვა ჩანართიდან storage event-ს.

## შედეგები

- რეალური Neon Auth, cookie-ს გარეშე, ლოკალური dev `3701`, ბაზა `meetany_preview_p7_session`.
- 10 სრული ნავიგაცია: **before 10 → after 1 get-session** (90%-ით შემცირება).
- სხვა ჩანართიდან revision=`x`: პირველი ჩანართის sessionStorage ჩანაწერი წაიშალა; შემდეგი ნავიგაციის შემდეგ ჯამური get-session **2**.
- მარშრუტები და თითოეულის ზარების რაოდენობა: `browser.json`.
- დეტალების მარშრუტები შემოწმდა ცარიელი `id`-ით; კონკრეტული ჩანაწერის ფუნქციონალი ამ შემოწმებაში არ შედიოდა.
- 1440/390/360 px: horizontal overflow **0**, pageerror **0**.
- სქრინშოტები ვიზუალურად შემოწმებულია: `shots/home-1440.png`, `shots/home-390.png`, `shots/home-360.png` (PNG არ არის დაკომიტებული).
- browser სვეტის CLI timeout-ით დასრულდა; გაზომვა და სქრინშოტები შესრულდა Playwright Chrome-ით.

## ტესტები

- მიზნობრივი auth-session-cache + auth-bootstrap: **31/31**.
- `npm test`: **127/127**, 9 ახალი ტესტი.
- `npx tsc --noEmit`: **0 შეცდომა**.
- `npx eslint app`: **0 შეცდომა / 11 არსებული გაფრთხილება**.
- `npm run lint:design`: წარმატებული.
- `git diff --check`: წარმატებული.

ტესტები ფარავს TTL-ს, 10 ახალ ინსტანსს, იმავე და სხვა ჩანართის ინვალიდაციას, generation/endpoint შეუსაბამობას, preload-ის ერთ bootstrap-ს, 429-ზე guest bridge-ის აკრძალვას, მომხმარებლის ჩანაწერის დაცვას და რეალურ JSON null პასუხს.

წინა ბლოკერი (რეალური Auth-ის JSON null) მოგვარებულია დავალების ავტორის დაზუსტებით. დარჩენილი ბლოკერი არ არის. რეალური შესვლა, მიგრაცია, production მონაცემების ცვლილება, deploy და push არ შესრულებულა.
