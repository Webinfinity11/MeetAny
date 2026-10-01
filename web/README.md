# MeetAny web

Next.js App Router application for the Georgian business marketplace. Pages, database API routes, photo uploads, and shared styles live in this directory.

Setup, environment variables, database tests, and production details: [project README](../README.md). Feature map: [FEATURES.md](FEATURES.md). UI conventions: [design system](../DESIGN-SYSTEM.md).

```sh
npm ci
npm run dev
```

Validation:

```sh
npm run lint
npm test
npm run build
# Run the production build in a second terminal for browser QA:
npm run start -- --port 3002
```

Browser scripts use private demo credentials from the ignored local credentials file. Set `QA_BROWSER_PATH` when Chromium is outside the default location.

## 2026-10-01 validation

Current completion record: [qa/STATUS-2026-10-01.md](qa/STATUS-2026-10-01.md).
`npm run lint` includes shared-button/CSS-token checks. New scenarios:

```sh
QA_ORIGIN=http://localhost:3002 node qa/features-1001.mjs
QA_ORIGIN=http://localhost:3002 node qa/business-ui.mjs
QA_ORIGIN=http://localhost:3002 node qa/links-check.mjs
QA_ORIGIN=http://localhost:3002 node qa/links-check.mjs --second
```

`features-1001` creates and cleans an isolated QA request/report on auth-probe. Business form writes are mocked. The links scan is read-only. `node qa/live-1001.mjs` checks the pinned public demo with API writes blocked. `DEMO_API_ORIGIN=http://localhost:3002 node scripts/seed-demo-v2.cjs --refresh-dates` updates only the registered demo timeline; `--verify` alone is read-only.

Admin presentation guide: `/admin/?tab=demo` (admin only). Section labels come from `app/lib/admin-sections.ts`. Run `node qa/admin-presentation.mjs` against localhost:3002, or set `PRESENTATION_ORIGIN=https://meet-any.vercel.app` for the public demo. The check covers labels, navigation, demo links, desktop/mobile layout, reduced motion and text-only VIP badges.

Admin redesign (`35753e9`): grouped sidebar, mobile disclosure menu, compact analytics, expandable work queues and unified record lists. The presentation QA also checks menu keyboard behavior, detail drawers, selection reset and filter recovery.

UX/სივრცეების QA: `UX_ORIGIN=http://localhost:3003 node qa/ux-refinement.mjs` (production build 3003-ზე). საჯარო შემოწმება: `UX_ORIGIN=https://meet-any.vercel.app node qa/ux-refinement.mjs`. მაკეტი მოწმდება 1440/1024/768/390/320 სიგანეებზე; ანგარიშები და მონაცემები იკითხება, შეთავაზების ერთადერთი ფორმის ჩაწერა mock-ით ჩანაცვლებულია.

სადემო ფუნქციების შემოწმება: `QA_ORIGIN=http://localhost:3001 node scripts/enrich-demo-features.mjs --verify`. `--verify` ბაზაში არ წერს. მის გარეშე სკრიპტი ავსებს მხოლოდ ცნობილ `demo-…@meetany.ge` ანგარიშებს auth-probe-ზე; გამოიყენება შესაბამისი მომხმარებლისა და ადმინის RPC-ები. კერძო ჟურნალი `../DEMO-FEATURES.local.json` git/deploy-ში არ იტვირთება.
