# ჩატვირთვის სიჩქარე — გაზომვა ცვლილებამდე (2026-10-12)

**მოკლედ:** სერვერი სწრაფია (TTFB 0.2–0.3 წმ). დრო ბრაუზერში იკარგება, სამი მიზეზით:

1. **ოპტიმიზაციის გარეშე ფოტოები.** Blob-ის ორიგინალები პირდაპირ `<img>`-ით ან `unoptimized`-ით: გვერდზე 0.8–3.5 MB.
   ერთი PNG 1.4 MB-ია (1254×1254), ჩანს კი 356×267-ზე. ჰედერის ლოგო 516 KB PNG-ია ყველა გვერდზე. ამის გამო
   `/requests/`-ის mobile LCP **14.8 წმ**-ია.
2. **კლიენტის bootstrap hydration-ს ელოდება.** inline `meetany-session-preload` 9 stylesheet-ის შემდეგაა, ამიტომ
   ყველა CSS-ის ჩატვირთვამდე არ ეშვება (mobile-ზე `get-session` 1.2–2 წმ-ზე იწყება). `/api/db/bootstrap` კი მხოლოდ
   hydration-ის შემდეგ იწყება, ~4–5.5 წმ-ზე. მასზე დამოკიდებული RPC-ები მერე ეშვება.
3. **ზედმეტი და N+1 გამოძახებები.** მოთხოვნის დეტალზე `request_preferences` და `list_attachments` ორჯერ ეშვება
   ანონიმურად: ჯერ SSR preview store-იდან, მერე სესიამდე singleton-იდან. მფლობელისთვის მესამედ ეშვება სწორი
   მომხმარებლით. `OfferCard` თითო შეთავაზებაზე ცალკე `list_attachments`-ს იძახებს. შედეგად მფლობელის ხედზე
   14 `/api` გამოძახებაა, pool-ის რიგში თითო 2.3–3.3 წმ-ს ელოდება და ready **8.8 წმ**-ია.
   - მთავარ გვერდს SSR snapshot არ ჰქონდა: ჰერო და „ახალი მოთხოვნები“ skeleton-ით ჩანს, სანამ კლიენტის bootstrap
     არ დასრულდება (mobile-ზე ready 4.6–5.3 წმ).

ახალი RPC-ები (`list_my_deals`, `company_public_stats`, `my_request_draft`, `list_saved_requests`,
`mark_request_offers_viewed`, `count_matching_suppliers`) N+1-ს არ ქმნის: თითო ერთხელ ეშვება, პარალელურად. დაფა
ერთ `list_my_deals`-ს იძახებს, `get_deal` მხოლოდ ერთი გარიგების გვერდზე ან არჩეულ შეტყობინებაზე ეშვება. Link prefetch
(`?_rsc=`) გვერდზე 5–9-ჯერ ხდება, ჯამში 7–14 KB — ეს პრობლემა არ არის. ფონტები უკვე subset-ებულია (~40 KB/წონა).

## მეთოდი

- `measure.mjs`: Playwright Chromium, თითო გვერდზე 3 ცივი ჩატვირთვა, მედიანა. **desktop** — 1366×900, throttling-ის
  გარეშე. **mobile** — 390×844, Lighthouse-ის mobile პროფილი: 150 ms RTT, 1.6 Mbps, CPU 4×.
  - **ready** — დრო, როცა გვერდზე აღარ რჩება skeleton, `aria-busy="true"` ან „იტვირთება“.
  - **/api calls** — `/api/*` resource-ები.
  - ცხრილების „images“ სვეტი cross-origin Blob ფოტოებს 0-ად ითვლის (TAO არ აქვს). სურათების წონის ზუსტი
    რიცხვია ქვემოთ, `weight.mjs`-ის ცხრილში.
- `weight.mjs`: წონა ტიპების მიხედვით, 390 px, DPR 3, ბოლომდე scroll-ით (lazy სურათებიც ითვლება).
- **ცოცხალი საიტი** https://www.meetany.ge — სტუმრად, მხოლოდ GET. request `3c6c7198…`, company `74cc28fc…` (demo-wood).
- **ლოკალური production build:** `next build && next start -p 3002`. ბაზა არის `meetany_preview_1791796623000`:
  `make-local-db.sh` (run.sh-ის მიგრაციების ჯაჭვი) + `copy-rows.mjs` (production-იდან READ ONLY ტრანზაქციით;
  ჩაწერა 0). `DATABASE_URL` ცარიელია. ავტორიზაცია — `auth-fixture.mjs`: ლოკალური JWKS, Auth-ის პასუხები
  Playwright-ში ლოკალურად ხელმოწერილი JWT-ით. ცოცხალ Auth-სა და ბაზაში არაფერი იწერება.
  - შესული მომხმარებელი: demo-hotel (`bacf1572…`, client); request `0101aaac…` მისია და 5 შეთავაზება აქვს.

## ცოცხალი საიტი, სტუმარი (`before-live.json`)

| page | profile | TTFB | FCP | LCP | ready | requests | JS (transfer) | /api calls |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| home | desktop | 210 ms | 744 ms | 744 ms | 1.92 s | 70 | 252 KB / 18 | 1 |
| home | mobile | 238 ms | 1.29 s | 1.29 s | **4.56 s** | 46 | 210 KB / 13 | 1 |
| requests | desktop | 222 ms | 1.16 s | 2.41 s | 1.15 s | 79 | 271 KB / 20 | 1 |
| requests | mobile | 293 ms | 1.65 s | **14.83 s** | 1.65 s | 58 | 271 KB / 20 | 1 |
| request-view | desktop | 220 ms | 1.40 s | 2.11 s | 2.13 s | 68 | 284 KB / 20 | 6 |
| request-view | mobile | 327 ms | 1.95 s | 1.95 s | **5.90 s** | 54 | 241 KB / 15 | 6 |
| companies | desktop | 226 ms | 900 ms | 900 ms | 882 ms | 79 | 268 KB / 21 | 2 |
| companies | mobile | 293 ms | 1.76 s | 1.76 s | 1.76 s | 55 | 226 KB / 16 | 2 |
| company-view | desktop | 249 ms | 1.10 s | 1.10 s | 2.16 s | 68 | 261 KB / 20 | 4 |
| company-view | mobile | 207 ms | 1.75 s | 1.75 s | **6.10 s** | 49 | 219 KB / 15 | 4 |

ცოცხალი waterfall, request-view/mobile. `get-session`-ის ზედმეტი დრო us-east-2-ის Neon Auth-ის RTT-ია, საქართველოდან.

```
 2076 → 3108  get-session            (preload, მაგრამ CSS-ის შემდეგ)
 5549 → 6387  /api/db/bootstrap      (hydration-ის შემდეგ)
 5578 → 5979  rpc/request_preferences   ┐ ორჯერ, ანონიმურად
 5579 → 6004  rpc/list_attachments      ┘ ორჯერ, ანონიმურად
 6403 → 6704  rpc/company_business_features (bootstrap-ის შემდეგ)
```

## ცოცხალი საიტი, წონა (`weight-before-live.json`, KB)

| page | image | script | font | css | fetch |
|---|---:|---:|---:|---:|---:|
| / | 1251 | 253 | 157 | 79 | 46 |
| /requests/ | **3467** | 272 | 157 | 84 | 47 |
| /requests/view/ | 2055 | 285 | 157 | 94 | 46 |
| /companies/ | 2024 | 270 | 157 | 85 | 45 |
| /companies/view/ | 790 | 262 | 157 | 87 | 45 |

## ლოკალური production build, სტუმარი (`before-local-guest.json`)

| page | profile | FCP | LCP | ready | requests | /api calls |
|---|---|---:|---:|---:|---:|---:|
| home | desktop | 64 ms | 64 ms | 134 ms | 70 | 1 |
| home | mobile | 1.21 s | 1.21 s | 4.96 s | 46 | 1 |
| requests | desktop | 64 ms | 904 ms | 56 ms | 80 | 1 |
| requests | mobile | 1.24 s | 14.91 s | 1.23 s | 58 | 1 |
| request-view | desktop | 72 ms | 160 ms | 144 ms | 68 | 6 |
| request-view | mobile | 1.42 s | 1.42 s | 5.71 s | 54 | 6 |
| companies | desktop | 64 ms | 64 ms | 51 ms | 79 | 2 |
| companies | mobile | 1.40 s | 1.40 s | 1.40 s | 55 | 2 |
| company-view | desktop | 68 ms | 68 ms | 155 ms | 66 | 4 |
| company-view | mobile | 1.12 s | 1.12 s | 6.38 s | 49 | 4 |

## ლოკალური production build, შესული — demo-hotel (`before-local-client.json`)

| page | profile | FCP | LCP | ready | requests | /api calls |
|---|---|---:|---:|---:|---:|---:|
| home | desktop | 68 ms | 68 ms | 177 ms | 67 | 2 |
| home | mobile | 1.13 s | 1.13 s | 5.30 s | 47 | 2 |
| requests | desktop | 72 ms | 780 ms | 63 ms | 74 | 2 |
| requests | mobile | 1.30 s | 15.10 s | 1.30 s | 61 | 4 |
| request-view (მფლობელი) | desktop | 60 ms | 60 ms | 176 ms | 78 | 14 |
| request-view (მფლობელი) | mobile | 1.35 s | 1.35 s | **8.83 s** | 65 | 14 |
| companies | desktop | 132 ms | 152 ms | 120 ms | 74 | 3 |
| companies | mobile | 1.38 s | 1.38 s | 1.38 s | 56 | 3 |
| company-view | desktop | 52 ms | 52 ms | 135 ms | 57 | 5 |
| company-view | mobile | 1.06 s | 1.11 s | 6.83 s | 50 | 5 |
| account | desktop | 52 ms | 244 ms | 149 ms | 89 | 4 |
| account | mobile | 1.25 s | 5.41 s | 5.32 s | 72 | 4 |

request-view/mobile, მფლობელი (ლოკალური):

```
 1266 → 1277  get-session
 4063 → 5634  /api/db/bootstrap                       (hydration-ის შემდეგ)
 4420 → 4792  request_preferences ×2, list_attachments ×2  (ანონიმურად, სანამ სესია ცნობილია)
 5703 → 8992  request_preferences, list_attachments ×6 (1 მოთხოვნა + 5 შეთავაზება — N+1),
              company_business_features, unread_message_count — pool max 5-ის რიგში, თითო 2.3–3.3 წმ
```

ლოკალური წონა (`weight-before-local.json`, KB): image — / 567, /requests/ 3470, /requests/view/ 2056,
/companies/ 2026, /companies/view/ 792.
