# მთავარი გვერდი v2 — სიჩქარე before/after (2026-10-13)

## მეთოდი

- ორი production build ერთდროულად: **before** — `HEAD 6d96971` დროებით worktree-ში, `next start -p 3322`;
  **after** — ეს ცვლილება, `next start -p 3320`. ერთი და იგივე ბაზა და public snapshot.
- `qa/home-v2-2026-10-13/measure.mjs` — `qa/perf-2026-10-12/measure.mjs`-ის მეთოდი (ცივი context, cache გამორთული,
  ready = skeleton/aria-busy აღარ არის), დამატებით **CLS** (layout-shift, input-ის გარეშე), **ბაიტები** (CDP, wire)
  და LCP-ის ელემენტი.
- **mobile:** 390×844, DPR 3, Lighthouse throttling (150 ms RTT, 1.6 Mbps, 4× CPU). **desktop:** 1440×900, throttling-ის გარეშე.
- მანქანაზე load average 4–7 იყო (სხვა პროცესები), ამიტომ before და after **მონაცვლეობით** გაიზომა: 3 რაუნდი × 5
  ჩატვირთვა თითოეულზე (+1 warm-up). ცხრილში 15 ჩატვირთვის მედიანაა. ნედლი მონაცემები: `before.json`, `after.json`.
- სტუმარი, scroll-ის გარეშე (პირველი ეკრანი).

## შედეგი

| profile | metric | before | after |
|---|---|---:|---:|
| mobile | FCP | 1028 ms | 1048 ms |
| mobile | **LCP** | 1056 ms (H1) | **1340 ms** (ფოტო), დიაპაზონი 1100–1548 |
| mobile | CLS | 0 | **0** |
| mobile | ready | 1023 ms | 1040 ms |
| mobile | requests | 45 | 42 |
| mobile | სულ / სურათები / JS | 728 / 194 / 222 KB | 749 / 217 / 222 KB |
| desktop | FCP | 76 ms | 92 ms |
| desktop | **LCP** | 76 ms (H1) | **92 ms** (ფოტო) |
| desktop | CLS | 0.0017 | 0.0023 |
| desktop | ready | 70 ms | 88 ms |
| desktop | requests | 74 | 67 |
| desktop | სულ / სურათები / JS | 884 / 280 / 264 KB | **796 / 191** / 264 KB |

overflow ორივეზე 0. console error-ები: 0 (გრძელ სერიაში ჩნდებოდა მხოლოდ `429` — ლოკალური rate-limit
ზედიზედ ~60 ჩატვირთვის გამო, before-შიც იგივე).

## რას ნიშნავს

- **desktop:** LCP და ready იგივე დონეზეა (ხმაურის ფარგლებში, 16 ms). ბაიტები **−88 KB**, მოთხოვნები 74 → 67:
  hero-ში აღარ იტვირთება კარუსელის 8 ფოტო; კარუსელი ქვემოთ, lazy ფოტოებით.
- **mobile:** FCP და ready არ შეცვლილა. **LCP +0.28 წმ** — ეს ახალი hero ფოტოს ფასია: ადრე LCP ტექსტი (H1) იყო,
  ახლა სლაიდის მოთხოვნით hero-ში დიდი ფოტოა და ის ხდება LCP. 1.34 წმ კვლავ „კარგის“ ზღვარზე (2.5 წმ) ბევრად
  დაბლაა, 4×-CPU / 1.6 Mbps-ზე.
- ფოტოს LCP რაც შეიძლება დაბლა რომ იყოს:
  - `next/image`, `fill` + `aspect-ratio`-ით დაჯავშნილი ყუთი → CLS 0;
  - `preload` (`<link rel="preload">` head-ში);
  - ტელეფონზე `sizes="(max-width: 639px) 50vw, …"` → 640w webp (**22 KB**) 1080w-ის (42 KB) ნაცვლად, ~2× სიმკვრივე.
    ამან LCP 1.70 → 1.34 წმ ჩამოიყვანა.
  - `fetchPriority="high"`-იც გაიზომა (preload-ის ნაცვლად): LCP ≈ FCP, მაგრამ ფოტო CSS-სა და ფონტებს ეჯიბრება და
    **FCP ~150–250 ms-ით გვიანდება** (1.25–1.30 წმ), LCP კი იგივე რჩება (1.27–1.37 წმ). ამიტომ დარჩა `preload`.
- Supplier-ის პანელის ფოტო (`warehouse-team.jpg`) ახლა optimized `next/image`-ია `sizes`-ით (ადრე `unoptimized`
  ორიგინალი JPEG იყო) და lazy — პირველ ეკრანზე არ მოქმედებს.

## გაზომვის გამეორება

```
cd web && npm run build && PORT=3320 npm start
node qa/home-v2-2026-10-13/measure.mjs --origin http://127.0.0.1:3320 --out /tmp/after.json --runs 5
node qa/home-v2-2026-10-13/shots.mjs --origin http://127.0.0.1:3320 --prefix after   # 1440/390/360, overflow, console
```
