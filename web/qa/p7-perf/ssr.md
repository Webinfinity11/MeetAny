# T7.6 — ssr

Production build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.

| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| guest | request-view/desktop | 404 → 352 | 304 → 254 | 85 → 86 | 4 → 4 | 295.9 → 295.9 | 188.7 → 61.2 | 0 |
| guest | request-view/mobile | 1508 → 1468 | 1440 → 1194 | 57 → 58 | 4 → 4 | 243.8 → 243.8 | 188.7 → 61.2 | 0 |
| guest | company-view/desktop | 88 → 336 | 163 → 640 | 81 → 80 | 4 → 4 | 284.5 → 284.5 | 188 → 72.1 | 0 |
| guest | company-view/mobile | 1212 → 1340 | 4651 → 4675 | 55 → 56 | 4 → 4 | 226.6 → 226.6 | 188 → 72.1 | 0 |
| client | request-view/desktop | 88 → 192 | 216 → 416 | 97 → 99 | 6 → 6 | 306.7 → 306.7 | 182.5 → 61.7 | 0 |
| client | request-view/mobile | 1336 → 1368 | 5432 → 4904 | 79 → 77 | 6 → 6 | 305.6 → 305.6 | 182.5 → 61.7 | 0 |
| client | company-view/desktop | 132 → 196 | 276 → 439 | 68 → 68 | 5 → 5 | 227.7 → 227.7 | 188 → 72.1 | 0 |
| client | company-view/mobile | 1528 → 1352 | 5684 → 4934 | 56 → 57 | 5 → 5 | 226.6 → 226.6 | 188 → 72.1 | 0 |
