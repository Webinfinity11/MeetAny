# T7.6 — rpc

Production build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.

| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| guest | request-view/desktop | 404 → 284 | 304 → 219 | 85 → 87 | 4 → 2 | 295.9 → 296.4 | 188.7 → 61.2 | 0 |
| guest | request-view/mobile | 1508 → 1524 | 1440 → 1314 | 57 → 56 | 4 → 2 | 243.8 → 244.4 | 188.7 → 61.2 | 0 |
| guest | company-view/desktop | 88 → 204 | 163 → 556 | 81 → 77 | 4 → 2 | 284.5 → 285 | 188 → 72.1 | 0 |
| guest | company-view/mobile | 1212 → 1636 | 4651 → 4992 | 55 → 54 | 4 → 2 | 226.6 → 227.2 | 188 → 72.1 | 0 |
| client | request-view/desktop | 88 → 260 | 216 → 599 | 97 → 96 | 6 → 3 | 306.7 → 307.3 | 182.5 → 61.7 | 0 |
| client | request-view/mobile | 1336 → 1320 | 5432 → 4746 | 79 → 76 | 6 → 3 | 305.6 → 306.1 | 182.5 → 61.7 | 0 |
| client | company-view/desktop | 132 → 240 | 276 → 370 | 68 → 68 | 5 → 4 | 227.7 → 228.3 | 188 → 72.1 | 0 |
| client | company-view/mobile | 1528 → 1712 | 5684 → 5242 | 56 → 56 | 5 → 3 | 226.6 → 227.2 | 188 → 72.1 | 0 |
