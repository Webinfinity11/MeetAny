# MeetAny — სად რა არის

- `web/app/` — Next.js App Router. ფრჩხილებში მოქცეული route groups გვერდების საერთო layout-ს აერთიანებს: მთავარი, კატალოგები, დეტალები, ანგარიში, ადმინი და სხვა. `components/` — საერთო UI და `market/` ფუნქციები; `lib/` — მონაცემები, ავტორიზაცია და ბიზნესლოგიკა; `styles/` — ტოკენები, საერთო სტილები და გვერდების CSS. `/dev/ui/` და `/dev/qa-layout/` ლოკალური ნიმუშებია.
- `db/` — `schema.sql` საბაზისო სქემაა, `migrations/` ცვლილებებია, `tests/` SQL ტესტებია, `maintenance/` — მოვლის სკრიპტები. კონტრაქტი აღწერილია `db/CONTRACT.md`-ში.
- `web/qa/` — აქტიური E2E, unit, visual და აუდიტის სკრიპტები; მიმდინარე სამუშაო — `p7-*/` და `CLEANUP-2026-10-14/`. `perf-2026-10-12/` ინახავს ლოკალურ auth fixture-სა და გაზომვას. `archive/` — ისტორიული ანგარიშები და ერთჯერადი შემოწმებები; გზამკვლევი — `web/qa/README.md`.
- `web/scripts/` — დიზაინის lint, მონაცემების მომზადებისა და მომსახურების CLI სკრიპტები. გაშვების გარემო და უსაფრთხოების შეზღუდვები თითოეულ სკრიპტშია.
- დოკუმენტაცია: `README.md` და `web/README.md` — დაწყება; `DESIGN-SYSTEM.md` — დიზაინის წესები; `db/CONTRACT.md` — მონაცემთა კონტრაქტი; `web/AGENTS.md` — კოდზე მუშაობის წესები.

ძირითადი შემოწმებები `web/`-დან: `npx tsc --noEmit`, `npx eslint app`, `npm run lint:design`, `npm test`, `npx next build --webpack`. SQL ტესტები root-იდან: `bash db/tests/run.sh`.
