# MeetAny Georgian prototype

Static home and catalog routes plus eight dedicated `/companies/{slug}/` profile pages. Georgian UI, original logo asset and supplied visual reference interpreted as an airy rounded layout. Functional demo company search, category/city/language filters, URL state, profile details, request/profile draft preparation and text download. Companies are explicitly fictional. No requests are transmitted and no personal data is persisted. Drafts exist only in page memory until the user downloads them.

Run with a static HTTP server pointing to `dist`. No build or package installation is required. Hosting configuration is in `.openai/hosting.json`.

The local reference was `ec62b8c77f017d9e28a6123ab0164157.jpg`. Logo supplied by the project owner. Decorative connection sculpture generated with imagegen. Typography uses Google Fonts Noto Sans Georgian with a system sans-serif fallback.

Validation: JavaScript syntax, local asset and route references, and focused filtering/invalid-input checks. Browser visual and interaction checks were completed. Optional WebMCP tool `set_catalog_filters` registers only if the page-scoped API is present; no supported WebMCP execution context was available for contract verification. Backend submission, real accounts and IP-based multilingual redirects are outside this Georgian design prototype.

## Photography redesign

The updated design uses an open full-page composition: no outer mockup frame or enclosing company/category card borders. It includes six real Pexels photographs, subject-specific Lucide icons, and a mobile navigation menu. Source and credit records are in `dist/assets/photos/sources.json`; the Lucide license is in `dist/assets/icons/LICENSE`. Generic stock photos do not depict or endorse the fictional demo companies.

Visual validation during the redesign covered desktop and 390px mobile layouts, plus 320px overflow checks on both routes. A legacy unbounded search SVG was replaced with the shared icon component; long Georgian headings and grid children were adjusted. Both pages measured scrollWidth equal to viewport width at 320px. Category filtering and the profile-to-request dialog flow were checked in the browser. The original optional WebMCP contract validation gap remains unchanged.

## Company profiles and identity

Company data uses stable IDs and slugs. Each company owns multiple offers (8 companies, 24 offers); catalog entries link to dedicated static profiles rather than a detail modal. Profiles include offer-specific request drafts, terms, FAQs and validated links back to filtered results. Regenerate profiles after shared markup/data changes with `node scripts/generate-profiles.cjs`.

Industry, collaboration and service format filters supplement role, service territory and language, with contextual counts and URL state. The eight fictional company logomarks are original imagegen assets served locally in a shared sprite. Loading failures show a neutral Lucide building icon without retry loops. Real company identities including Credo Bank are not in the demo dataset.

Validation: all eight logo images loaded in-browser; desktop and 320px profile layouts, filtered catalog to profile return URL, and offer-specific request prefill checked. Focused checks passed for combined/invalid filters, unsafe return URLs, unique profiles, 24 offers and logo error fallback.

## Presentation readiness

Main journey copy now describes discovery, offers and draft preparation precisely. Profile facts, offers, terms and request requirements have consistent quiet information surfaces; forms group need/company information separately from contact/service details. Draft confirmation shows the complete contact and request summary. Whitespace-only required fields are rejected and valid values are trimmed. A skip link and current navigation semantics support keyboard navigation. `PRESENTATION-GE.md` provides a five-minute Georgian walkthrough and distinguishes existing demo behavior from production work. This pass validated JavaScript, all ten static pages' local references/anchors, and draft whitespace correction; prior browser checks remain documented above.

## FiraGO and visual refinement

`dist/refinement.css` provides the shared responsive visual pass: consistent heading hierarchy, spacing, photo proportions, navigation emphasis, card metadata and navy footer. Four original FiraGO 1.001 WOFF2 weights (400/500/600/700) are hosted locally; the previous Google Fonts import is removed. Headings, buttons, inputs and body use FiraGO; the MeetAny wordmark retains its existing treatment. Font provenance and OFL license are in `dist/assets/fonts/`. Validated all ten pages' style/asset links, WOFF2 signatures and Georgian glyph coverage for every weight, plus JavaScript syntax and whitespace checks.

## Industry directory and 3D accent

The home page now distinguishes partner role from seven industry links. Each industry lists its description and company count, linking to the existing catalog industry filter. The local connection-sculpture image is reused as the single 3D accent, preserving the real business photography elsewhere. `generate-profiles.cjs` runs `generate-industries.cjs` first so directory counts follow the canonical data. Validation confirmed seven populated filter destinations, correct logistics count, and valid local assets/routes.

The industry accent now uses `connection-transparent.png`, a newly generated square 3D render with genuine RGBA transparency, replacing the opaque-background image. All corners are fully transparent; the image is displayed without a background or border radius. Generation prompt and provenance are in `connection-transparent.source.json`.

## Reference-aligned category navigation

Replaced the large decorative industry composition with compact stacked navigation. Four partner roles use newly generated transparent semantic 3D symbols (parcel, briefcase, cargo truck, handshake). Seven industries appear in a compact lower rail with purpose-specific Lucide symbols and company counts. The standalone ring artwork is no longer rendered. The category sprite has an error fallback to the corresponding line icon. Styles and scripts are versioned to refresh stale browser caches. Checked rendered category links/sprite positions, industry links, local assets, and SVG symbols.

## Structured request form

Request drafts now include scope/quantity, collaboration type, an optional budget limit with GEL/USD/EUR currency, and flexible/soon/month/specific-date timing. Conditional budget and date inputs are enabled and required only when selected. Draft review and downloaded text share the same field formatting; edit returns to the same company/offer and preserves inputs in page memory. Past/impossible dates and invalid amounts are rejected. Focused checks covered export completeness, invalid dates/amounts, and omission of inactive conditional values. Still no transmission or server storage.

The request layout is now a quick single form with four visible essentials (need, location, name/company and email). Quantity, collaboration, budget and timing live in optional expandable details. Existing optional values reopen the section during editing; invalid optional fields reveal it before validation feedback. Removed the secondary profile-copy button to emphasize the request action. Verified generated form structure, default collapsed state, labels and the primary action on every profile.

## MVP page polish

Company cards use shorter photos and labeled service-area/collaboration facts, with a clear offer count and profile action. Removed repeated tag rows and tightened spacing. The home introduction and featured heading are more direct. Company profiles prioritize offers before the longer description. Mobile catalog filtering includes a result-count button that closes the filter panel and returns focus/scroll to results; responsive card/profile rules preserve natural text wrapping. Validated all eight cards and filtered return links, offer-first order, 24 offer actions and local route/asset references. No backend capabilities were added.

Company cards now end in a full-width “View profile” action with a restrained blue surface and clear hover/focus treatment. Offer counts move to the photo, avoiding a split footer. Facts and footer spacing are unified. Verified all eight card actions/counts and preservation of filtered return links.

Profile spacing now groups the short description with the identity and places the compact demo label alongside the request action. Reduced cover/header spacing, removed the redundant offer-section kicker and aligned the facts panel with the offers section. Mobile layouts retain natural text wrapping with a full-width request action at narrow widths. Verified all eight generated summaries and retained offer actions.

Expanded catalog: 11 industries, 12 fictional company profiles and 36 offers. Added IT, construction, legal services and commercial cleaning; four local vector logomarks and licensed Pexels photographs with provenance in assets/photos/new-categories-sources.json. Home shows all eleven industry links and an all-companies tile in a responsive directory.

Catalog selection supports multiple industries, cities and offer types (OR within a group, AND across groups). URLs preserve selections as canonical comma-separated values; old single-value links still work. Secondary groups use native details disclosures with selected counts. Individual choices can be removed from result chips. Distribution can also match product supply; joint projects can also match service provision.

Profile galleries: four images per profile, 24 additional licensed Pexels photographs across eight business groups, captions and native dialog viewer with previous/next, arrow keys and return focus. Provenance in dist/assets/photos/gallery/sources.json. Homepage shows eight featured industries; all eleven remain in the catalog.

## Requests board (Design 02)

Design 02 adds a requests board: a client posts a free-text request (e.g. "1000 chairs"), companies send written offers with an optional price, and only the request owner sees offer text and prices (others see the count). Choosing an offer reveals phone and email to both sides. Registration uses email and password, a verification code sent by email, and requires a +995 mobile number. Requests stay open for 14 days and can be extended by 7 days, closed or deleted; expired requests refuse offers. `/v2/admin/` hides or deletes requests, blocks users and marks companies as verified. Request pages share to WhatsApp and Facebook. Design 01 is unchanged.

Backend: **Neon Postgres + Neon Auth + Neon Data API**, photos in **Vercel Blob**. `dist/market-store.js` talks to Neon Auth and the Data API with plain `fetch()` (no SDK), keeps a synchronous in-memory cache for the UI and maps server error codes to the Georgian messages. The Vercel Blob browser client (`@vercel/blob@2.8.0/client`, jsDelivr) is loaded only when a photo is uploaded. There are no demo accounts and no localStorage data.

### Database (`db/`)

`db/schema.sql` (re-runnable; it stops with a clear message if Neon Auth or the Data API is not enabled yet):

- `profiles`: one row per Neon Auth user (`neon_auth."user"`, on delete cascade), created by the `complete_profile` RPC after the email code is verified. Role is `client` or `company`; `admin` is only set by hand. Phone and email are readable only by the owner (`my_profile`) and admins.
- `requests`: public unless hidden; at most 5 open per user; `expires_at` defaults to 14 days; `photo_url` must be a Blob URL inside the uploader's own `<user id>/` folder.
- `offers`: sealed. Only the request author, the offer author and admins can read them; one offer per company per request.
- RPCs (security definer, caller checked server side): `complete_profile`, `my_profile`, `offer_counts`, `create_request`, `close_request`, `extend_request`, `delete_request`, `send_offer`, `withdraw_offer`, `choose_offer`, `contact_for_request` and the `admin_*` functions. All writes go through RPCs; errors carry stable `MA…` codes.
- `meetany_private.settings`: server-only settings (the Blob store origin, `photo_origin`).

`db/CONTRACT.md` documents every table, RPC, error code, the auth endpoints and the upload rules. `db/tests/run.sh` loads a Neon stub and the schema twice into a throwaway local PostgreSQL database and runs the RLS and security tests.

### Accounts (check before touching infrastructure)

| service | account / scope | resource |
|---|---|---|
| Vercel | team `infinity-solutions` (user `webinfinity11-5453`) | project `meet-any` → https://meet-any.vercel.app |
| Neon | `webinfinity11@gmail.com`, org `Infinity` (`org-green-pine-75686842`) | project `MeetAny` (`fancy-surf-61327851`, aws-us-east-2), **working branch `auth-probe`** (`br-round-union-b59brwnl`), endpoint `ep-withered-glade-b54ts1g5`, database `neondb` |
| Neon Auth | same project, branch `auth-probe` | `https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth` (JWKS: `…/neondb/auth/.well-known/jwks.json`) |
| MeetAny API | Vercel Function `api/db.js` (`/api/db/*`) | replaces the Neon Data API; connects with `DATABASE_URL` (secret) |
| Vercel Blob | team `infinity-solutions`, connected to `meet-any` (production + preview) | public store `meetany-photos` (`store_k3KP1SyoWHTMw3eR`, iad1), origin `https://k3kp1syowhtmw3er.public.blob.vercel-storage.com` |

Backend (2026-09-22). The Neon Data API does not accept Neon Auth tokens ("jwk not found", reproduced on a fresh branch set up exactly as documented), so it is not used. `api/db.js` verifies the Neon Auth JWT itself (EdDSA, `api/_neon-jwt.js`), then runs each call in a transaction as `anonymous` or `authenticated` with the claims in `request.jwt.claims` (`api/_db.js`); RLS, column grants and the RPCs in `db/schema.sql` decide access, via `meetany_private.uid()`. It speaks the PostgREST subset the store uses, so `config.js` only sets `dataApiUrl: '/api/db'`.

Branches: `auth-probe` is the working branch (Neon Auth could not be re-enabled on the old default branch `production` after it was disabled; that branch has no auth and is unused). Renaming `auth-probe` to `production` and making it the default, then deleting the old one, is still to do in the Neon console.

Email verification is **off** for now: Neon Auth does not require it or send codes, `meetany_private.settings` has `require_email_verification = off`, and `REQUIRE_EMAIL_VERIFICATION=off` for the functions. To turn it on later: enable it in Neon Auth (`neonctl neon-auth config email-password update --require-email-verification true --send-verification-email-on-sign-up true`), set the setting to `on` (or delete the row), set the env var to `on`, and add custom SMTP.

Local: `node scripts/dev-server.cjs` (http://127.0.0.1:4031) serves `dist/`, applies `vercel.json` and runs `api/*` with `.env.dev.local` (gitignored: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `REQUIRE_EMAIL_VERIFICATION`). Neon Auth trusts `https://meet-any.vercel.app`, `http://127.0.0.1:4031`, `http://localhost:4031`, and "Allow localhost" is on. **Before launch**: remove the localhost domains and turn localhost off, and set on Vercel (production + preview): `DATABASE_URL` (pooled `neondb_owner` string of `auth-probe`, sensitive), `NEON_AUTH_BASE_URL` (the URL above), `REQUIRE_EMAIL_VERIFICATION=off`; remove `NEON_DATA_API_URL`.

Not these: Neon `grubela22@gmail.com` is a different account (its "ვაკანსიები" project is another app), and the Vercel Neon integration databases `linenet-db` / `mcdirect-db` belong to other projects. Before any `neonctl` command run `npx neonctl me` and confirm `webinfinity11@gmail.com`; if not, `npx neonctl auth` and sign in as infinity11. Link the site with `vercel link --yes --project meet-any --scope infinity-solutions` (an old `.vercel` link pointing at a `meetany` project in another org is stale). Deploy from `site/` with `vercel deploy --prod`.

### Neon console setup (once per project / branch)

1. Create the project in an AWS region; database `neondb`.
2. **Auth**: enable Neon Auth. Sign-up with Email on, **Verify at sign-up** on, method **Verification code** (OTP), require email verification on, auto sign-in after verification on, send the code again on sign-in on. Application name `MeetAny`; add `https://meet-any.vercel.app` to the domains and turn "Allow localhost" off in production. The shared Neon email sender is rate-limited and meant for testing; use custom SMTP for production. Neon Auth requires passwords of at least 8 characters.
3. **Data API**: enable it for `neondb` with Neon Auth as the provider. Leave "Grant public schema access" **unchecked** (the schema sets its own grants), expose only `public`, allow the origin `https://meet-any.vercel.app`.
   Status 2026-09-22: the Data API answers every Neon Auth JWT (anonymous and user, EdDSA, kid matches the public JWKS) with `400 {"message":"jwk not found"}`. This happened both with `--auth-provider neon_auth` and with an explicit external JWKS (`…/neondb/auth/.well-known/jwks.json`, audience = the Neon Auth origin, role `authenticator`, the current setup). Recreating the Data API and restarting the compute did not help. Until Neon fixes this, the board shows "სერვისი დროებით მიუწვდომელია".
4. SQL editor: run `db/schema.sql`, then save the Blob store origin:
   ```sql
   insert into meetany_private.settings (key, value)
   values ('photo_origin', 'https://<storeId>.public.blob.vercel-storage.com')
   on conflict (key) do update set value = excluded.value;
   ```
5. Data API: **Refresh schema cache** (after every schema change).

### Public config (`dist/config.js`)

| key | value |
|---|---|
| `authUrl` | the Neon Auth URL (`https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth`), or `/api/auth` when the rewrite below is set up |
| `dataApiUrl` | the Data API URL (`https://ep-xxx.apirest.<region>.aws.neon.tech/neondb/rest/v1`) |
| `uploadUrl` | `/api/blob-upload` |

These are public values. Never put a connection string, password, Blob token or signing key in `dist/` or git. Until `config.js` is filled in, the board shows "სერვისი დროებით მიუწვდომელია".

Neon Auth keeps the session in a cookie on its own domain, which Safari treats as a third-party cookie. To make it first-party, add a rewrite to `vercel.json` with your (public) Neon Auth URL and set `authUrl: '/api/auth'`:

```json
"rewrites": [{ "source": "/api/auth/:path*", "destination": "https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth/:path*" }]
```

Tested 2026-09-22: this does **not** work. Neon Auth rejects proxied requests with `400 {"code":"INVALID_HOSTNAME"}` because Vercel forwards `X-Forwarded-Host: meet-any.vercel.app`, so `config.js` uses the direct Neon Auth URL. Neon sets the session cookie with `SameSite=None; Secure; Partitioned` (CHIPS).

### Vercel

- `api/blob-upload.js` (Vercel Function, dependencies in the root `package.json`, installed by `"installCommand": "npm ci"`; the site is still served from `dist/`): verifies the Neon Auth JWT against the Neon JWKS (EdDSA, pinned issuer and audience), checks the caller has a non-blocked profile, and signs a one-file upload token for `<user id>/<name>.<jpg|png|webp|gif>`, image/jpeg, png, webp or gif only, at most 5 MB. `DELETE` removes the caller's own photo when publishing the request failed.
- Create a **public** Blob store and connect it to the project.
- Environment variables (Project → Settings → Environment Variables):

| name | secret | value |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | added automatically when the Blob store is connected |
| `NEON_AUTH_BASE_URL` | no | the Neon Auth URL |
| `NEON_DATA_API_URL` | no | the Data API URL |

No database connection string is needed on Vercel or in the browser.

### Admins

Register the account normally (including the email code), then run in the Neon SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.ge';
```

Pages: `/v2/requests/`, `/v2/requests/view/?id=<uuid>` (the canonical and shared link), `/v2/account/`, `/v2/admin/`, `/v2/terms/`. After changing the market files or v2 markup, run `node scripts/generate-market.cjs` (idempotent). It rebuilds these pages and wires `config.js`, the nav link and the market assets into the existing v2 pages.

## Archive

Design 01 შენარჩუნებულია `archive/v1/`-ში; ძველი გენერატორი, მობილური QA და დემოს სცენარი ასევე `archive/`-შია (იხ. [არქივის აღწერა](archive/README.md)). არქივი deploy-ში არ შედის: საჯარო ფაილების წყაროა `dist/`, ხოლო `.vercelignore` გამორიცხავს `archive`-ს. `/v1` და `/v1/*` დროებით გადამისამართდება `/`-ზე.
