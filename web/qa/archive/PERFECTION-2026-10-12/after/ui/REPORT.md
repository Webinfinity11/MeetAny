# ეტაპი 3 — საერთო UI და მობილური (2026-10-12)

სკრიპტი: `scripts/ui.mjs` (`BASE=http://localhost:3303 OUT=after`), სრული გაზომვა `report.json`-ში; baseline — `before/ui/report.json`.

## გაზომვები

| რა | ადრე | ახლა |
|---|---|---|
| drawer გახსნა / დახურვა | 320ms (keyframe არ არსებობდა — ანიმაცია არ ჩანდა) / მყისიერი | 220ms / 160ms, `--motion-overlay-ease` |
| ფილტრის sheet გახსნა / დახურვა | 300ms / მყისიერი | 220ms (ქვემოდან) / 160ms |
| `/requests/` → დეტალი → უკან (390, 360) | დეტალი 900px-ზე იხსნებოდა | დეტალი 0-ზე, „უკან“ აბრუნებს 900-ს |
| CLS `/`, `/requests/`, `/requests/view` (390, 360) | 0 | 0 |
| CLS `/requests/` throttled (390 / 360) | — | 0.033 / 0 |
| CLS `/account/` კომპანია (390 / 360, + throttled) | ≤0.012 | ≤0.013 |
| CLS `/account/` კლიენტი | 0 (baseline-ში მონახაზი არ იყო) | 0.10 (throttled 0.14) — წყარო `MyRequests.tsx:29`: სერვერის მონახაზი სიის შემდეგ იტვირთება და თავში ჩაჯდება (ანგარიშის ნაკადი) |
| ტოსტი 390/360 | ქვემოთ, `.detail-actionbar`-ს offset არ ჰქონდა | ჰედერის ქვეშ (bottom 118px, ზოლი 775/711px — გადაფარვა არ არის), შეცდომა `circle-alert` |
| 404 | body margin 8px, Times, თემის გარეშე | `data-theme="blue"`, `body.ma`, FiraGO |

## ახალი კლასები/props სხვა ნაკადებისთვის

- `.ma-scroll-row` (+ `--bleed`) — ჰორიზონტალური ჩიპების/ჩანართების/ფილტრების ზოლი: scroll-snap, კიდის ფეიდი padding-ში.
- `.ma-form-bar` (+ `.ma-form-bar__note`) — ფორმის sticky ქვედა ზოლი: safe-area, კლავიატურის ზემოთ (`--keyboard-inset`), ტელეფონზე სრული სიგანე და primary ზემოთ.
- `ConfirmSheet cancelLabel` (default „დაბრუნება“); `ConfirmSheet` ახლა `ui/index.ts`-შიც.
- `toastError(message, sub?)` — შეცდომის ტოსტი (danger ტონი, `role="alert"`). `toast("…")` სტრიქონით კვლავ success-ია.
- `closeDialogWithMotion(dialog, done?)` (`ui/dialog-focus.ts`) — `<dialog>`-ის დახურვა leave-ანიმაციით.
- ტოკენები: `--motion-overlay-in` 220ms, `--motion-overlay-out` 160ms, `--motion-overlay-ease`; `--mask-fade-start|--mask-solid|--mask-fade-end`.
