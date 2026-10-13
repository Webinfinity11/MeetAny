# T7.6 — dynamic

Production build, ლოკალური Postgres, auth fixture :3718; 3 გაშვება, მედიანა. Mobile: 390×844, 150 ms RTT, 1.6 Mbps, 4× CPU. Desktop: 1366×900.

| როლი | გვერდი/პროფილი | LCP ms | ready ms | requests | /api | JS KB | HTML KB | errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| guest | request-view/desktop | 404 → 356 | 304 → 267 | 85 → 88 | 4 → 2 | 295.9 → 293.6 | 188.7 → 59.2 | 0 |
| guest | request-view/mobile | 1508 → 2028 | 1440 → 1443 | 57 → 56 | 4 → 2 | 243.8 → 234.9 | 188.7 → 59.2 | 0 |
| guest | company-view/desktop | 88 → 284 | 163 → 870 | 81 → 78 | 4 → 2 | 284.5 → 278.6 | 188 → 70.9 | 0 |
| guest | company-view/mobile | 1212 → 1352 | 4651 → 5101 | 55 → 53 | 4 → 2 | 226.6 → 218.2 | 188 → 70.9 | 0 |
| client | request-view/desktop | 88 → 240 | 216 → 606 | 97 → 96 | 6 → 3 | 306.7 → 302.8 | 182.5 → 59.7 | 0 |
| client | request-view/mobile | 1336 → 1772 | 5432 → 5586 | 79 → 77 | 6 → 3 | 305.6 → 301.7 | 182.5 → 59.7 | 0 |
| client | company-view/desktop | 132 → 352 | 276 → 751 | 68 → 65 | 5 → 3 | 227.7 → 219.3 | 188 → 70.9 | 0 |
| client | company-view/mobile | 1528 → 2160 | 5684 → 5462 | 56 → 54 | 5 → 3 | 226.6 → 218.2 | 188 → 70.9 | 0 |
