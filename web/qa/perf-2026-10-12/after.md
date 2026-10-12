# ჩატვირთვის სიჩქარე — ცვლილების შემდეგ (2026-10-12)

მეთოდი და ბაზა იგივეა, რაც `before.md`-ში: ლოკალური production build, `next start -p 3002`, 3 ცივი ჩატვირთვა,
მედიანა. ცოცხალ საიტზე after არ გაზომილა, რადგან დეპლოი აკრძალულია. ლოკალური baseline ცოცხალ რიცხვებს იმეორებს
(mobile: requests LCP 14.9 vs 14.8 წმ, company-view ready 6.4 vs 6.1 წმ).

**შედეგი phone-ზე (throttled):**
- `/requests/` LCP: **15 წმ → 3.2 წმ**.
- მთავარი გვერდი ready: **5.0–5.3 წმ → 1.2 წმ**.
- მოთხოვნის დეტალი ready (მფლობელი): **8.8 წმ → 4.8 წმ**; `/api` გამოძახებები **14 → 6**.
- კომპანიის გვერდი ready: **6.4–6.8 წმ → 4.5–4.7 წმ**.
- account ready: **5.3 წმ → 3.8 წმ**.
- სურათების წონა: `/requests/` **3.5 MB → 0.74 MB**, დეტალის გვერდები **2 MB → 0.06–0.15 MB**.

## რა შეიცვალა

| მიზეზი | გასწორება | ფაილები |
|---|---|---|
| Blob-ის ორიგინალი ფოტოები (1.4 MB PNG 356 px-ზე), 516 KB ლოგო | `next/image` + `images.remotePatterns` (`*.public.blob.vercel-storage.com`), `qualities: [75]`, `sizes`. სხვა src-ები (blob:/data:) `unoptimized` რჩება | `next.config.ts`, `lib/image.ts`, 15 კომპონენტი |
| `/api/db/bootstrap` hydration-ის შემდეგ იწყებოდა | preload სკრიპტი bootstrap-ს get-session-ის მერე იწყებს; სტუმრისთვის (hint `meetany.session`-ის გარეშე) პარალელურად. store იყენებს ერთხელ, მხოლოდ იმავე actor/JWT-ისთვის; profile-ის ჩაწერის შემდეგ თავიდან კითხულობს | `lib/auth-session-preload.js`, `lib/market-store.js` |
| მთავარზე skeleton client bootstrap-მდე | SSR public snapshot (როგორც `/requests/`), სერვერის `now` hydration-ისთვის | `(home)/page.tsx`, `HomeLive.tsx`, `HomeBusinessScene.tsx` |
| `request_preferences`/`list_attachments` 2–3-ჯერ, ჯერ ანონიმურად | იტვირთება მხოლოდ `sessionReady`-ის შემდეგ, ერთხელ, სწორი მომხმარებლით | `RequestViewPageContent.tsx` (ხ. 276) |
| `list_attachments` თითო OfferCard-ზე (N+1) | `list_attachments_many` + store-ის micro-batcher. ერთი tick-ის target-ები ერთ RPC-ში მიდის; წაუკითხავი target ან სერვერი მიგრაციის გარეშე (PGRST202) ძველ RPC-ზე გადადის | `db/migrations/20261012-perf-attachments-batch.sql`, `db-handler.js`, `market-store.js`, `FileAttachments.tsx` |

შემოწმებული და უცვლელად დატოვებული:
- ახალი RPC-ები (`list_my_deals`, `company_public_stats`, `my_request_draft` …) — თითო ერთხელ, პარალელურად.
- Link prefetch — 7–14 KB.
- ფონტები — უკვე subset, ~40 KB.
- JS — ~205–265 KB transfer, 6 KB-ით შემცირდა.

`type="module"` preload სცადეს და დააბრუნეს: get-session ადრე არ დაიწყო (1246 vs 1250 ms), ამიტომ preload ისევ
ჩვეულებრივი inline script-ია.

## Before → after, სტუმარი (`before-local-guest.json` → `after-local-guest.json`)

| page | profile | LCP | ready | requests | /api calls |
|---|---|---:|---:|---:|---:|
| home | mobile | 1.21 s → **1.15 s** | 4.96 s → **1.17 s** | 46 → 45 | 1 → 1 |
| requests | mobile | 14.91 s → **3.27 s** | 1.23 s → **1.32 s** | 58 → 55 | 1 → 1 |
| request-view | mobile | 1.42 s → **1.67 s** | 5.71 s → **4.67 s** | 54 → 48 | 6 → 4 |
| companies | mobile | 1.40 s → **1.42 s** | 1.40 s → **1.37 s** | 55 → 54 | 2 → 2 |
| company-view | mobile | 1.12 s → **1.46 s** | 6.38 s → **4.52 s** | 49 → 46 | 4 → 4 |
| home | desktop | 64 ms → **64 ms** | 134 ms → **51 ms** | 70 → 69 | 1 → 1 |
| requests | desktop | 904 ms → **268 ms** | 56 ms → **98 ms** | 80 → 78 | 1 → 1 |
| request-view | desktop | 160 ms → **528 ms** | 144 ms → **484 ms** | 68 → 66 | 6 → 4 |
| companies | desktop | 64 ms → **332 ms** | 51 ms → **221 ms** | 79 → 77 | 2 → 2 |
| company-view | desktop | 68 ms → **124 ms** | 155 ms → **235 ms** | 66 → 66 | 4 → 4 |

## Before → after, შესული demo-hotel (`before-local-client.json` → `after-local-client.json`)

| page | profile | LCP | ready | requests | /api calls |
|---|---|---:|---:|---:|---:|
| home | mobile | 1.13 s → **1.17 s** | 5.30 s → **1.17 s** | 47 → 46 | 2 → 2 |
| requests | mobile | 15.10 s → **3.18 s** | 1.30 s → **1.22 s** | 61 → 56 | 4 → 2 |
| request-view (მფლობელი) | mobile | 1.35 s → **1.48 s** | 8.83 s → **4.75 s** | 65 → 50 | 14 → 6 |
| companies | mobile | 1.38 s → **1.42 s** | 1.38 s → **1.32 s** | 56 → 54 | 3 → 3 |
| company-view | mobile | 1.11 s → **1.58 s** | 6.83 s → **4.66 s** | 50 → 47 | 5 → 5 |
| account | mobile | 5.41 s → **3.87 s** | 5.32 s → **3.84 s** | 72 → 67 | 4 → 4 |
| home | desktop | 68 ms → **112 ms** | 177 ms → **77 ms** | 67 → 60 | 2 → 2 |
| requests | desktop | 780 ms → **208 ms** | 63 ms → **116 ms** | 74 → 67 | 2 → 2 |
| request-view (მფლობელი) | desktop | 60 ms → **68 ms** | 176 ms → **202 ms** | 78 → 68 | 14 → 6 |
| companies | desktop | 152 ms → **320 ms** | 120 ms → **219 ms** | 74 → 69 | 3 → 3 |
| company-view | desktop | 52 ms → **76 ms** | 135 ms → **165 ms** | 57 → 57 | 5 → 5 |
| account | desktop | 244 ms → **200 ms** | 149 ms → **209 ms** | 89 → 87 | 4 → 4 |

signed-in after-ში localStorage-ის hint `meetany.session=1` წინასწარ დგას, როგორც ამ ბრაუზერში უკვე შესულ
მომხმარებელს. hint-ის გარეშე (`after-local-client-nohint.json`) პირველ ვიზიტზე ზედმეტი ანონიმური bootstrap-იც
ეშვება; მაინც request-view ready 4.98 წმ-ია, account 4.64 წმ.

**desktop-ის სვეტზე:** loopback-ზე სხვაობები 0.1–0.4 წმ-ია, და FCP-იც, რომელიც ცვლილებებამდე ხდება, იმავე
პროპორციით გაიზარდა (72 → 190–360 ms). გაზომვისას მანქანის load average 8–9 იყო: სხვა პროექტის `next-server`
და სისტემური პროცესი. იზოლირებულად იგივე გვერდის FCP 48 ms-ია (`fcp-check.mjs`). ამიტომ desktop-ის ეს
სხვაობები გაზომვის ხმაურად მიმაჩნია, არა რეგრესიად. ფოტოების რეალური დაჩქარება Vercel CDN-ზე (`/_next/image`
ქეში) ლოკალურ რიცხვებზე უკეთესი უნდა იყოს.

### waterfall, request-view/mobile, მფლობელი (after)

```
 1175  get-session          ┐ preload: HTML-ის პარსისას
 1469 → ~4.0 s  /api/db/bootstrap ┘ (ადრე 4063-ზე იწყებოდა)
 ~4.8 s  request_preferences, list_attachments (მოთხოვნა), list_attachments_many (5 შეთავაზება),
         company_business_features, unread_message_count — ერთად, ~0.4 s
```

ახლა mobile-ზე დარჩენილი ზღვარი hydration-ია: 4× CPU-ზე ~4.5 წმ, JS ~205–265 KB transfer. შემდეგი ნაბიჯი
client bundle-ის დაყოფაა: market-store და chat popup ყველა გვერდზე იტვირთება.

## წონა, 390 px / DPR 3, scroll-ით (`weight-before-local.json` → `weight-after-local.json`, KB)

| page | images | სულ |
|---|---:|---:|
| / | 567 → **363** | 1105 → 994 |
| /requests/ | 3470 → **741** | 4056 → **1394** |
| /requests/view/ | 2056 → **55** | 2663 → **718** |
| /companies/ | 2026 → **57** | 2616 → **718** |
| /companies/view/ | 792 → **151** | 1363 → **794** |

ცოცხალ საიტზე სურათები იგივეა, რაც ლოკალურ baseline-ში (`weight-before-live.json`: /requests/ 3467,
/requests/view/ 2055, /companies/ 2024 KB).

## შემოწმება

- `bash db/tests/run.sh` — **TOTAL 1954 SQL ASSERTIONS PASSED** (1937 + 17 ახალი `PERF ATTACHMENTS BATCH`).
- `npx tsc --noEmit` — 0.
- `npm run lint` — 0 errors; warnings 30-დან 15-მდე (`no-img-element` შემცირდა). `lint:design` გავიდა.
- `npm test` — 49 pass.
- `/_next/image` ლოკალურად: ლოგო 516 KB → 2.7 KB webp; 1.4 MB PNG → 25 KB webp (828w). გაზომვისას
  page error არ ყოფილა.
