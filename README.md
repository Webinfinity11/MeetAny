# MeetAny

B2B დამაკავშირებელი პლატფორმა საქართველოში. მოთხოვნას წერს კომპანია ან კერძო პირი; კომპანიები აგზავნიან წერილობით შეთავაზებებს. კატალოგში ტელეფონი საჯაროა, ელფოსტა — კერძო. შეთავაზების ფორმაში ფასი არ არის.

## ერთი მოქმედი კოდი

- `web/` — Next.js 16 App Router, React, TypeScript; გვერდები, API, CSS და საჯარო რესურსები.
- `db/` — სქემა, API კონტრაქტი და ლოკალური PostgreSQL ტესტები.
- `archive/v1/` — ძველი დიზაინი, შენარჩუნებულია და საიტიდან არ ქვეყნდება.
- `archive/design/` — დამტკიცებული დიზაინის სპეციფიკაცია.

ძველი `dist`, დამოუკიდებელი `api`, გენერატორები და სტატიკური JavaScript აღარ გამოიყენება. ყველა runtime დამოკიდებულება არის `web/package.json`-ში. ფუნქციების შესაბამისობა: [web/FEATURES.md](web/FEATURES.md).

## ლოკალური გაშვება

```sh
cd web
npm ci
npm run dev
```

საიტი: `http://localhost:3000`.

`web/.env.local` (gitignored) მოიცავს `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `REQUIRE_EMAIL_VERIFICATION=off` და ფოტოს ატვირთვისთვის `BLOB_READ_WRITE_TOKEN`-ს. საიდუმლო მნიშვნელობები არ დაბეჭდოთ და არ დააკომიტოთ. საჯარო Neon Auth მისამართი მითითებულია `web/app/lib/market-store.js`-ში; ის უნდა შეესაბამებოდეს სერვერის იმავე გარემოს. კლიენტი იყენებს Neon Auth-ს პირდაპირ, მონაცემებისთვის — `/api/db`, ფოტოებისთვის — `/api/blob-upload`. RLS და ვალიდაცია ბაზაში რჩება.

## შემოწმება

```sh
cd web
npm run lint
npm run build
npx playwright install chromium
node qa/browser.mjs
QA_DEMO=1 node qa/browser.mjs
node qa/accounts.mjs
```

ბრაუზერის ალტერნატიული executable: `QA_BROWSER_PATH=/absolute/path/to/chromium`. სკრინშოტები ინახება `web/qa/shots/`-ში; ანგარიშები — `web/qa/report.json`, `demo-report.json`, `accounts-report.json`. სადემო სცენარი მუშაობს მხოლოდ `auth-probe` branch-ზე და ქმნის საკუთარ QA მოთხოვნას, რომელსაც შემდეგ შლის. წარუმატებლობისას დარჩენილი QA მოთხოვნა შეიძლება წაიშალოს მისი ავტორის ანგარიშიდან. პაროლები იკითხება `DEMO-ACCOUNTS.local.md`-იდან მეხსიერებაში და არ იბეჭდება.

```sh
# site/ საქაღალდიდან; დროებითი ლოკალური ბაზა ავტომატურად იშლება
bash db/tests/run.sh
```

სადემო მონაცემების სკრიპტი: `node web/scripts/seed-demo.cjs --verify`. ხელახლა დათესვა ცვლის `auth-probe`-ის მონაცემებს; გამოიყენეთ მხოლოდ საჭიროებისას. `DEMO-ACCOUNTS.local.md` რჩება კერძო და gitignored.

## გამოქვეყნება

ამ სამუშაოში deploy არ სრულდება. Vercel-ის production ჯერ ძველი ვერსიაა. გადართვა ცალკე, მფლობელთან შეთანხმებული ნაბიჯია: Root Directory — `web` (რეპოს ძირი `site`), გარემოს ცვლადები და საბოლოო production deploy.
