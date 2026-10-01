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
