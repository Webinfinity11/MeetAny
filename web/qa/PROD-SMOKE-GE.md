# MeetAny — production build და smoke :3002 (P12 T12.5, 2026-09-24)

**შედეგი: build ✅ · smoke 21/21 PASS · console/pageerror/failed request/CSP დარღვევა — 0 ყველა გვერდზე.** HEAD `6c814d2` (P12 T12.3f-ის შემდეგ). სკრიპტი `qa/prod-smoke.mjs`, ნედლი შედეგი `qa/shots/prod-0924/report.json`, კადრები `qa/shots/prod-0924/<role>-<page>-1440.png` (16).

## იზოლაცია
Next 16 `next dev` წერს `.next/dev`-ში, `next build` — `.next`-ში (`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md:60`, `upgrading/version-16.md:909`), ასე რომ dev :3001-ის dist-ს build არ ეხება. მაინც ავირჩიე **git worktree** (`../meetany-build`, detached HEAD): მთავარ ხეში სხვა ნაკადის დაუკომიტებელი ცვლილებებია (მაგ. `EngagementPanels.tsx`), build კი ზუსტად HEAD-იდან უნდა ყოფილიყო. `.env.local` დაკოპირდა (მნიშვნელობები არ დაბეჭდილა), `node_modules` — APFS clone-ით (`cp -c`, 6 წმ; symlink-ის ნაცვლად, რადგან Turbopack-ის `root` worktree-ია და მის გარეთ მიმავალ ბმულს შეიძლება არ მიჰყვეს). `next.config.ts` არ შეცვლილა; 3001 (PID 83101) მთელი დროის განმავლობაში უსმენდა. ბოლოს 3002 (next-server 18684 + npm 18660, cwd worktree-ში — შემოწმდა) გაჩერდა, worktree წაიშალა.

## Build
`npm run build` — 19 წმ, Turbopack, **0 error, 0 warning**; TypeScript 5.3 წმ; 15 სტატიკური გვერდი.

| მარშრუტი | ტიპი |
|---|---|
| `/`, `/account`, `/admin`, `/terms`, `/_not-found`, `/robots.txt`, `/sitemap.xml` | ○ static |
| `/companies`, `/companies/view`, `/requests`, `/requests/new`, `/requests/view`, `/api/db/[...path]`, `/api/blob-upload` | ƒ dynamic |

ზომები (Next 16 ცხრილში აღარ ბეჭდავს): `.next/static` 1.4 მბ, 30 JS chunk, უდიდესი 232/160/132 კბ; `.next/server` 17 მბ. HEAD-ზე `npm run lint` — 0 error, 29 warning; `npx tsc --noEmit` — ✅.

## Header-ები (`curl -sI` — `/`, `/requests/`, `/nosuch/`)
- `Content-Security-Policy`: `script-src 'self' 'unsafe-inline'` — **`unsafe-eval` არ არის**; `connect-src`-ში `ws:`/`wss:` არ არის; **`upgrade-insecure-requests` არის**; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()`; `X-Powered-By` არ არის.
- `/` — `Cache-Control: s-maxage=31536000` (static); `/requests/` და 404 — `private, no-cache, no-store`. `/nosuch/` → HTTP 404. HSTS ლოკალურად არ არის (Vercel-ი ამატებს).

## Smoke (1440×1000, დრო = `goto` → `networkidle`)
| როლი | გვერდი | შედეგი | დრო |
|---|---|---|---:|
| სტუმარი | `/` | PASS | 5.0 წმ |
| სტუმარი | `/requests/` (14 ბმული) | PASS | 3.4 წმ |
| სტუმარი | `/companies/` (12 ბმული) | PASS | 3.8 წმ |
| სტუმარი | მოთხოვნის დეტალი | PASS | 5.8 წმ |
| სტუმარი | კომპანიის პროფილი | PASS | 4.6 წმ |
| სტუმარი | `/nosuch/` → 404 | PASS | 3.3 წმ |
| კლიენტი (hotel) | შესვლა | PASS | 3.8 წმ |
| კლიენტი | მოთხოვნები (3) / შენახული / მიმოწერები / პროფილი | PASS ×4 | 7.0 / 5.3 / 6.3 / 6.1 წმ |
| კლიენტი | მოთხოვნის დამატების მოდალი (10 ველი, submit არა) | PASS | 6.7 წმ |
| კომპანია (wood) | შესვლა | PASS | 3.9 წმ |
| კომპანია | პროფილი: ლოგოს ველი, განედი/გრძედი 41.7438, 44.7793 | PASS | 5.1 წმ |
| კომპანია | ინბოქსი (საუბარი არ გახსნილა) | PASS | 5.8 წმ |
| კომპანია | დეტალზე შეთავაზების ფორმა (submit არა) | PASS | 5.7 წმ |
| ადმინი | შესვლა | PASS | 4.7 წმ |
| ადმინი | მოთხოვნები 15 / მომხმარებლები 25 / ჟურნალი 17 / კონტაქტები 35 რიგი | PASS ×4 | 6.4 / 6.2 / 5.5 / 6.4 წმ |

## ნელი მოთხოვნები
ფორმალურად **ყველა 21 გვერდი >3 წმ-ია**, მაგრამ სერვერი სწრაფია: TTFB `/` 10 მწ, `/requests/` 16 მწ; DOMContentLoaded 45–120 მწ, `load` 0.2–0.6 წმ. `networkidle`-ს აგვიანებს კლიენტის store-ის **მიმდევრობითი** ჯაჭვი ყოველ გვერდზე (სტატიკურ `/`-ზეც): Neon Auth `token/anonymous` ×2 (0.85/1.0 წმ) → `/api/db/requests` → `rpc/list_companies` → `rpc/company_stats` → `rpc/offer_counts` → `profiles?select=…` — თითო 0.5–1.2 წმ, ჯამი 4–5 წმ. ეს იგივეა, რაც `qa/FULLSTACK-AUDIT-GE.md` #8 (დუბლირებული/სერიული refresh, pool `max:5`); ავტორიზებულ გვერდებს +1–2 წმ ემატება (unread, me). გამოსწორება ამ დავალების ფარგლებს გარეთაა: პარალელური `Promise.all`, anonymous token-ის ერთჯერადი მიღება და `/` გვერდზე store-ის დაყოვნება.

## ნაპოვნი
- `/requests/` სიაში (კადრი `client-request-new-1440.png`) ჩანს **„AUDIT test request“** — ადრინდელი `qa/audit-perms.mjs` გაშვების ნარჩენი, რომელიც cleanup-მა არ წაშალა. ბაზა არ შემიცვლია; წასაშლელია ადმინით ან `scripts/e2e-cleanup.mjs`-ით.

## გამოტოვებული
- `qa/audit-perms.mjs` — **არ გაშვებულა**: ბაზაში წერს (სატესტო მოთხოვნა + შეთავაზება, ადმინის RPC-ები; ფაილის ხაზი 3).
- submit-ები (მოთხოვნა, შეთავაზება, პროფილის შენახვა), საუბრის გახსნა (`mark_read`), ზარის reveal (`contact_events`) — განზრახ, ბაზა არ იცვლება. შესვლამ შექმნა მხოლოდ Neon Auth სესიები.
- 390/320 viewport — ამ smoke-ში მხოლოდ 1440.
