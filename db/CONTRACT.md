# MeetAny database contract (frontend <-> Neon)

This file is the **only** interface the frontend (`dist/v2/market-store.js`) and the upload
function (`api/blob-upload.js`) may rely on.
Source of truth: `db/schema.sql`. Tests: `db/tests/run.sh`.

Stack: **Neon Postgres** + **Neon Auth** (managed Better Auth, email + password, email code) +
**Neon Data API** (PostgREST-compatible REST over the database, validates Neon Auth JWTs) +
**Vercel Blob** (request photos, uploaded from the browser through `api/blob-upload.js`).

- Client: plain `fetch()` (no SDK). Public config in `window.MEETANY_CONFIG` (`dist/v2/config.js`):

  | key | example | notes |
  |---|---|---|
  | `authUrl` | `location.origin + '/api/auth'` (same-origin rewrite, preferred) or `https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth` | Neon Auth base URL |
  | `dataApiUrl` | `https://ep-xxx.apirest.<region>.aws.neon.tech/neondb/rest/v1` | Data API base URL |
  | `uploadUrl` | `/api/blob-upload` | Vercel Function that authorizes Blob uploads |

  All three are public values. No connection string, password, Blob token or signing key is ever
  in `dist/` or git.
- **All writes go through RPCs** (`POST {dataApiUrl}/rpc/<name>`). The Data API roles
  `anonymous` / `authenticated` have **no** INSERT/UPDATE/DELETE privilege on any table; a direct
  write fails with `42501`.
- Reads: `requests`, `offers` (RLS-filtered) and the public columns of `profiles`.
- Every Data API call carries `Authorization: Bearer <jwt>`: the user JWT when signed in, else the
  anonymous JWT (§5.4). Never send a request without a token.

---

## 1. Fixed value sets

Category keys (13, same order as `MarketStore.categories`):
`furniture, construction, textiles, food, packaging, logistics, cleaning, technology, marketing, finance, legal, tourism, other`

City keys (8, same order as `MarketStore.cities`):
`tbilisi, batumi, kutaisi, rustavi, zugdidi, telavi, gori, georgia`

Unit keys (5, same order as `MarketStore.units`): `pcs, m2, kg, hour, service`
(ცალი, მ², კგ, საათი, სერვისი).

Offer price types (`MarketStore.priceTypes`): `unit` (ერთეულის ფასი), `total` (ჯამური ფასი),
`negotiable` (შეთანხმებით).

Georgian labels stay in the frontend (`categories` / `cities` / `units` / `priceTypes` maps); the DB stores only keys.

Constants: request lifetime 14 days (`REQUEST_DAYS`), extension 7 days (`EXTEND_DAYS`), max 5 open requests per user.

---

## 2. Readable tables (Data API)

Requests: `GET {dataApiUrl}/<table>?<PostgREST query>`, `Authorization: Bearer <jwt>`.
Response: JSON array. Add `Prefer: count=exact` to get the total in `Content-Range`.

### 2.1 `public.profiles` (public columns only)

| column | type | notes |
|---|---|---|
| `id` | uuid | = `neon_auth."user".id` = JWT `sub` |
| `role` | text | `client` \| `company` \| `admin` |
| `company` | text | 2–100 chars; for clients defaults to `name` |
| `industry` | text \| null | category key; non-null for companies, null for clients |
| `verified` | boolean | set by admin only |
| `verified_at` | timestamptz \| null | when the company was verified (`admin_set_verified`); null when not verified. Existing verified companies were back-filled with `created_at`. A trigger keeps it consistent with `verified` on every write path |
| `blocked_reason` | text \| null | admin's reason for blocking (3–500 chars), set by `admin_set_blocked`; null when not blocked (a trigger clears it). **Not** in the public column grant: the user reads it through `my_profile`, admins through `admin_list_users` |
| `city` | text | city key |
| `about` | text | public company description, ≤ 1000 chars (`update_my_profile`) |
| `offers` / `seeks` | text[] | ≤ 8 items of 1–120 chars each |
| `service_cities` | text[] | city keys, fixed city order |
| `created_at` | timestamptz | |

- Readable by anonymous and authenticated, all rows.
- **Always list columns explicitly.** `select=*`, or selecting `name`, `phone`, `email`, `blocked`,
  fails with `42501 permission denied` (column-level grants), even for your own row.
- Own full row -> `rpc/my_profile`. Everybody's full row (admin) -> `rpc/admin_list_users`.
- A signed-in user whose profile is not completed yet (§5.3) has no row here.

```
GET {dataApiUrl}/profiles?select=id,role,company,industry,verified,verified_at,city&id=in.(<id1>,<id2>)
```

### 2.2 `public.requests`

| column | type | notes |
|---|---|---|
| `id` | uuid | canonical link: `/v2/requests/view/?id=<id>` |
| `owner_id` | uuid | FK `requests_owner_id_fkey` -> profiles.id |
| `title` | text | 5–120 chars (trimmed) |
| `body` | text | 10–2000 chars (trimmed) |
| `category` | text | category key |
| `city` | text | city key |
| `photo_url` | text \| null | public Vercel Blob URL (see §6) |
| `quantity` | numeric(13,3) \| null | 0 < quantity ≤ 1e9, 3 decimals; JSON number. Set together with `unit` (table CHECK: both or neither) |
| `unit` | text \| null | unit key (`pcs, m2, kg, hour, service`) |
| `needed_by` | date \| null | "საჭიროა თარიღამდე", `YYYY-MM-DD`. RPCs accept today … today + 2 years (Georgian calendar date, Asia/Tbilisi); may lie in the past later |
| `status` | text | `open` \| `closed` |
| `hidden` | boolean | hidden by admin |
| `hidden_reason` | text \| null | admin's reason for hiding (3–500 chars), set by `admin_set_hidden`; null when not hidden (a trigger clears it). Readable wherever the row is readable: a hidden row only by its owner and admins |
| `chosen_offer_id` | uuid \| null | FK `requests_chosen_offer_id_fkey` -> offers.id |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | default `created_at + 14 days` |

Visibility (RLS): rows with `hidden = false` for everyone (anonymous included); hidden rows only for the owner and admins.
`select=*` is fine here.

Derived state (identical to the beta `MarketStore.requestState`), computed in the frontend:
```
hidden                      -> 'hidden'
chosen_offer_id != null     -> 'chosen'
status = 'closed'           -> 'closed'
expires_at <= now           -> 'expired'
otherwise                   -> 'open'
```

```
GET {dataApiUrl}/requests?select=*&order=created_at.desc
GET {dataApiUrl}/requests?select=*&id=eq.<id>                 (0 or 1 rows; check the length yourself)
# optional owner embed:
GET {dataApiUrl}/requests?select=*,owner:profiles!requests_owner_id_fkey(id,role,company,industry,verified,city)
```

### 2.3 `public.offers` (sealed)

| column | type | notes |
|---|---|---|
| `id` | uuid | |
| `request_id` | uuid | FK `offers_request_id_fkey` -> requests.id (cascade delete) |
| `company_id` | uuid | FK `offers_company_id_fkey` -> profiles.id (the offer author) |
| `body` | text | 10–2000 chars |
| `price` | numeric(12,2) \| null | null exactly when `price_type = 'negotiable'`; otherwise 0 < price <= 1e9. Returned as a JSON number |
| `price_type` | text | `unit` (per unit of the request's `unit`) \| `total` \| `negotiable`. Table CHECK: `negotiable` ⇔ `price is null`. Existing offers were back-filled (`price` -> `total`, no price -> `negotiable`) |
| `vat_included` | boolean | price includes VAT (დღგ); always `false` for `negotiable` |
| `delivery_days` | integer \| null | 0–365; null = not stated |
| `delivery_included` | boolean | delivery is included in the price |
| `status` | text | `sent` \| `chosen` \| `declined` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | bumped when the author edits the offer |

Visibility (RLS, authenticated only): a row is returned only to its author (`company_id = me`),
to the author of the request, and to admins. **anonymous has no SELECT privilege on offers**
(`42501`): do not query offers while signed out. Everyone else learns only counts via `offer_counts`.

```
GET {dataApiUrl}/offers?select=*&request_id=eq.<id>&order=created_at      (author: all; company: its own)
GET {dataApiUrl}/offers?select=*&company_id=eq.<me>&order=created_at.desc  ("my offers")
```
Embedding offers from requests needs the FK hint (`offers!offers_request_id_fkey(...)`), because
requests and offers are linked by two foreign keys.

---

## 3. RPCs

`POST {dataApiUrl}/rpc/<name>` with `Content-Type: application/json` and a JSON object of named
arguments (argument names exactly as listed; omit an argument to use its default).
Results: a function returning a row -> JSON object; `setof`/`table` -> JSON array; `void` -> empty
body (HTTP 204) or `null` (accept both). All are SECURITY DEFINER and check the caller
(`auth.uid()` = JWT `sub`) server side. "anon" column = executable with the anonymous JWT.

`require_user` below means: no user JWT, or signed in but **no profile yet** -> `MA001`;
profile blocked -> `MA002`.

| RPC | args | returns | anon | rules / errors (in check order) |
|---|---|---|---|---|
| `complete_profile` | `p_role text, p_name text, p_company text default null, p_phone text default null, p_city text default null, p_industry text default null` | `profiles` row (all columns, as `my_profile`) | no | Creates the caller's profile once, after the email code was verified (§5.3). Caller must be a Neon Auth user (`sub` in `neon_auth."user"`) -> else `MA001`. **Profile already exists -> returns it unchanged** (no field is updated, no validation, no error; safe to retry). `neon_auth."user"."emailVerified"` false -> `MA408` (the database value is checked, not the JWT claim). Then: `p_role` `'company'` -> company, anything else (incl. `'admin'`) -> client; name trimmed, cut to 80, < 2 -> `MA401`; company trimmed, cut to 100, required (≥ 2) for companies -> `MA402` (clients: defaults to name); email = Neon Auth email lower-cased, bad format -> `MA403`; phone normalized like `normalizePhone` to `+995 5XX XXX XXX`, invalid -> `MA404`; city key -> `MA104`; industry category key required for companies -> `MA407` (stored null for clients); phone used by another profile (also a concurrent sign-up) -> `MA405`. `verified`/`blocked` start `false` |
| `my_profile` | – | `setof profiles` (all columns: `id, role, name, company, phone, email, city, industry, verified, blocked, created_at, about, offers, seeks, service_cities, verified_at`) | yes | 0 rows when signed out **or profile not completed yet**. Works for blocked users (read `blocked`). Take `[0]` |
| `offer_counts` | `ids uuid[]` | `setof {request_id uuid, offers int}` | yes | One row per id that the caller can see (hidden requests only for owner/admin); counts include 0. Max 1000 ids per call. Numbers only |
| `create_request` | `p_title text, p_body text, p_category text, p_city text, p_photo_url text default null, p_quantity numeric default null, p_unit text default null, p_needed_by date default null` | `requests` row | yes* | require_user; ≥5 open -> `MA105`; title trimmed + cut to 120, <5 -> `MA101`; body trimmed + cut to 2000, <10 -> `MA102`; category -> `MA103`; city -> `MA104`; photo_url (blank = null) not a Blob URL of the configured store inside the caller's own folder -> `MA109` (see §6); then the terms: quantity not null and (NaN, ≤0, >1e9, or rounds to 0 at 3 decimals) -> `MA111`; quantity set and unit not a unit key -> `MA112` (unit without quantity is ignored, both stored null); needed_by before today or after today + 2 years (Asia/Tbilisi date) -> `MA113` |
| `close_request` | `p_request_id uuid` | `requests` row | yes* | require_user; missing (or hidden and caller not owner/admin) -> `MA106`; not owner and not admin -> `MA107`. Sets `status='closed'` |
| `extend_request` | `p_request_id uuid` | `requests` row | yes* | require_user; `MA106`; `MA107`; state `chosen`/`hidden` -> `MA108`; reopening a closed/expired one while owner already has 5 open -> `MA105`. Sets `status='open'`, `expires_at = min(max(now, expires_at) + 7 days, now + 21 days)` (repeated extensions cannot push it further than 21 days ahead) |
| `update_request` | `p_request_id uuid, p_title text, p_body text, p_category text, p_city text, p_quantity numeric default null, p_unit text default null, p_needed_by date default null` | `requests` row | yes* | require_user; `MA106`; `MA107` (owner or admin); state `chosen`/`hidden` or any offer exists -> `MA110`; then the `create_request` checks `MA101`–`MA104`, `MA111`–`MA113`. **Full replacement**: an omitted quantity/unit/needed_by clears it, so always send the current values. A `needed_by` equal to the stored one is accepted even if it is now in the past |
| `delete_request` | `p_request_id uuid` | void | yes* | require_user; `MA106`; `MA107` (owner or admin). Offers are deleted with it |
| `send_offer` | `p_request_id uuid, p_body text, p_price numeric default null, p_price_type text default null, p_vat_included boolean default null, p_delivery_days integer default null, p_delivery_included boolean default null` | `offers` row | yes* | require_user; request missing or hidden -> `MA106`; caller role ≠ company -> `MA201`; own request -> `MA202`; state ≠ open -> `MA203`; body trimmed + cut to 2000, <10 -> `MA204`; price type (omitted/null = `total` when a price is given, else `negotiable`) not `unit`/`total`/`negotiable` -> `MA210`; `negotiable` with a price -> `MA211`; `unit`/`total` without a price -> `MA212`; price not null and (NaN, ≤0, >1e9, or rounds to 0.00) -> `MA205`; delivery_days not null and outside 0–365 -> `MA213`. Price rounded to 2 decimals; null flags -> `false`; `vat_included` stored `false` for `negotiable`. **Upsert**: a second call by the same company replaces all its terms (same id, `updated_at` bumped, status kept) |
| `withdraw_offer` | `p_offer_id uuid` | void | yes* | require_user; not found or not caller's own -> `MA206`; status `chosen` -> `MA207`. Deletes the offer |
| `choose_offer` | `p_offer_id uuid, p_expected_updated_at timestamptz default null` | `offers` row (the chosen one) | yes* | require_user; offer missing -> `MA206`; caller not the request author: offer author or admin -> `MA107`, anyone else -> `MA206`; request state ≠ open -> `MA208`; `p_expected_updated_at` given and the offer was edited since (its `updated_at` differs) -> `MA209`, nothing chosen. Pass the offer's `updated_at` string exactly as read (microseconds). Atomic: chosen offer `status='chosen'`, all other offers on the request `declined`, `requests.chosen_offer_id` set |
| `contact_for_request` | `p_request_id uuid` | `setof {name, company, phone, email}` (0 or 1 row) | yes | Only when an offer is chosen: request author gets the chosen company's contact; the chosen company gets the author's. Everyone else (incl. admin, anonymous, a user without profile, and a **blocked** caller) gets 0 rows. Never raises |
| `update_my_profile` | `p_name text, p_company text, p_city text, p_industry text default null, p_about text default '', p_offers text[] default '{}', p_seeks text[] default '{}', p_service_cities text[] default '{}'` | `profiles` row (all columns) | yes* | require_user; `MA401`; `MA402` (companies); `MA104`; `MA407` (companies); about > 1000 -> `MA410`; offers/seeks > 8 items or an item > 120 chars -> `MA411`; unknown service city -> `MA104`. Phone, email, role, verified, verified_at, blocked are not editable |
| `company_stats` | `ids uuid[]` | `setof {company_id uuid, offers_sent int, offers_chosen int}` | yes | Companies only; numbers only (offer contents stay sealed). Max 1000 ids |
| `list_companies` | – | `setof {id, company, industry, verified, verified_at, city, about, offers, seeks, service_cities, created_at}` | yes | Active (not blocked) companies, verified first, then newest; max 1000 |
| `admin_set_hidden` | `p_request_id uuid, p_hidden boolean, p_reason text default null` | `requests` row | no | require_user; not admin -> `MA003`; reason given but not 3–500 chars after trimming -> `MA304`; missing -> `MA106`. Stores the trimmed reason in `hidden_reason` when hiding, clears it when showing. The reason is optional for the API; the request page's admin bar requires it |
| `admin_delete_request` | `p_request_id uuid` | void | no | require_user; `MA003`. Missing id is a no-op |
| `admin_set_blocked` | `p_user_id uuid, p_blocked boolean, p_reason text default null` | void | no | require_user; `MA003`; reason not 3–500 chars -> `MA304`; own id -> `MA301`; unknown -> `MA302`. Stores / clears `blocked_reason` like `admin_set_hidden` |
| `admin_set_verified` | `p_user_id uuid, p_verified boolean` | void | no | require_user; `MA003`; unknown or not a company -> `MA303`. `verified_at` = now() when newly verified, unchanged when already verified, null when verification is removed |
| `admin_list_users` | – | `setof profiles` (all columns, newest first) | no | require_user; `MA003` |
| `admin_stats` | – | `jsonb {users, companies, verified, open, requests, offers, chosen}` (integers) | no | require_user; `MA003`. Same definitions as beta `stats()`: users = non-admins, requests/chosen exclude hidden, open = state open |

`yes*` = anonymous may execute but always gets `MA001`. "no" = anonymous has no EXECUTE privilege
(the Data API answers with code `42501`); authenticated non-admins get `MA003` (a user without a
profile gets `MA001` first).

Admin = `profiles.role = 'admin' and not blocked`. Admins can close/extend/delete any request and
see all requests and offers; they cannot choose offers (author only) and do not get contacts via
`contact_for_request` (they use `admin_list_users`).

There is **no** `phone_available` any more: a taken number is reported by `complete_profile`
(`MA405`). The old per-IP throttle cannot work on the Data API (client-supplied headers), and a
completed profile makes `complete_profile` a no-op, so one account can confirm at most the numbers
it tries before its first free one.

---

## 4. Errors

Data API error body: `{"message", "code", "detail", "hint"}` (note `detail`, singular; PostgREST
itself uses `details`), HTTP status mapped from SQLSTATE (P0001 -> 400, 42501 -> 401/403).

Every business error is raised with SQLSTATE `P0001`, `message = 'MAxxx: <english>'` and
`hint = 'MAxxx'`: `code === 'P0001'`, `hint === 'MA105'`, `message` starts with `MA105:`.
Parse with `/^(MA\d{3})\b/.exec(err.message)?.[1] || (/^MA\d{3}$/.test(err.hint) ? err.hint : null)`.

Frontend maps the code to the exact Georgian text below and throws `Error` with `.userMessage`.

| code | Georgian `userMessage` (verbatim from beta market-store.js / market.js) |
|---|---|
| MA001 | ამისთვის შედი ანგარიშში. |
| MA002 | ანგარიში დაბლოკილია. |
| MA003 | ეს მოქმედება მხოლოდ ადმინისთვისაა. |
| MA101 | სათაური უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს. |
| MA102 | აღწერე საჭიროება მინიმუმ 10 სიმბოლოთი. |
| MA103 | აირჩიე კატეგორია. |
| MA104 | აირჩიე ქალაქი. |
| MA105 | ერთდროულად შეიძლება 5 ღია განცხადება. დახურე ძველი და სცადე თავიდან. |
| MA106 | განცხადება ვერ მოიძებნა. |
| MA107 | ეს განცხადება შენ არ გეკუთვნის. |
| MA108 | არჩეული ან დამალული განცხადება ვერ გაგრძელდება. |
| MA109 | ატვირთე მხოლოდ სურათი. |
| MA110 | განცხადებას ვეღარ შეცვლი: მასზე უკვე მოვიდა შეთავაზება ან მომწოდებელი არჩეულია. |
| MA111 | რაოდენობა უნდა იყოს დადებითი რიცხვი. |
| MA112 | აირჩიე რაოდენობის ერთეული. |
| MA113 | აირჩიე დღევანდელი ან მომავალი თარიღი (არაუგვიანეს 2 წლისა). |
| MA201 | შეთავაზების გაგზავნა შეუძლია მხოლოდ კომპანიის ანგარიშს. |
| MA202 | საკუთარ განცხადებაზე შეთავაზებას ვერ გააგზავნი. |
| MA203 | განცხადება აღარ იღებს შეთავაზებებს. |
| MA204 | აღწერე შეთავაზება მინიმუმ 10 სიმბოლოთი. |
| MA205 | ფასი უნდა იყოს დადებითი რიცხვი. |
| MA206 | შეთავაზება ვერ მოიძებნა. |
| MA207 | არჩეული შეთავაზება ვერ გაუქმდება. |
| MA208 | ამ განცხადებაზე არჩევა აღარ შეიძლება. |
| MA209 | რაღაც ვერ შესრულდა. სცადე თავიდან. (the existing generic text; the store refreshes, so the edited offer is shown before the author can choose again) |
| MA210 | აირჩიე ფასის ტიპი. |
| MA211 | „შეთანხმებით“ შეთავაზებაში ფასი არ მიეთითება. |
| MA212 | მიუთითე ფასი ან აირჩიე „შეთანხმებით“. |
| MA213 | მიწოდების ვადა უნდა იყოს 0-დან 365 დღემდე. |
| MA301 | საკუთარ ანგარიშს ვერ დაბლოკავ. |
| MA302 | მომხმარებელი ვერ მოიძებნა. |
| MA303 | დადასტურება შეიძლება მხოლოდ კომპანიისთვის. |
| MA304 | მიზეზი უნდა იყოს 3-დან 500 სიმბოლომდე. |
| MA401 | მიუთითე სახელი და გვარი. |
| MA402 | მიუთითე კომპანიის დასახელება. |
| MA403 | მიუთითე სწორი ელფოსტა. |
| MA404 | მიუთითე მობილურის ნომერი ფორმატით: +995 5XX XXX XXX. |
| MA405 | ეს ტელეფონის ნომერი უკვე გამოყენებულია. |
| MA407 | აირჩიე საქმიანობის მიმართულება. |
| MA408 | შეამოწმე ელფოსტა (**new**; the existing `CHECK_EMAIL` text: email not verified yet -> show the code step) |
| MA410 | კომპანიის აღწერა მაქსიმუმ 1000 სიმბოლოა. |
| MA411 | ჩამონათვალში შეიძლება 8 პუნქტამდე, თითო 120 სიმბოლომდე. |

Anything else (network, `42501`, unknown code) -> the existing generic UI fallback
`რაღაც ვერ შესრულდა. სცადე თავიდან.` (market.js `showError`) / `ვერ შესრულდა.` (toasts).

Missing / placeholder config (no `authUrl`/`dataApiUrl`) -> `სერვისი დროებით მიუწვდომელია` and no crash.

---

## 5. Auth (Neon Auth, email + password + email code)

All auth calls: `fetch(authUrl + path, { credentials: 'include', ... })`, JSON bodies
(`Content-Type: application/json`). Errors: `{code, message}` with an HTTP status.
The session is an HttpOnly cookie; the frontend never sees or stores it.

### 5.1 Endpoints

| step | request | result |
|---|---|---|
| sign-up | `POST /sign-up/email` `{email, password, name}` | `{token: null, user}` — no session until the code is verified; a code is emailed |
| resend code | `POST /email-otp/send-verification-otp` `{email, type: "email-verification"}` | `{success: true}` |
| verify code | `POST /email-otp/verify-email` `{email, otp}` | `{status, token, user}` + session cookie (auto sign-in) |
| sign-in | `POST /sign-in/email` `{email, password}` | `{token, user}` + session cookie; **403 `EMAIL_NOT_VERIFIED`** when the email is not verified (a fresh code is sent) |
| session | `GET /get-session` | `{session, user}` or `null`; response header `set-auth-jwt: <JWT>` |
| user JWT | `GET /token` | `{token}` (needs the session cookie) |
| anonymous JWT | `GET /token/anonymous` | `{token, expires_at}` |
| sign-out | `POST /sign-out` `{}` | clears the cookie |

### 5.2 JWT

EdDSA (Ed25519), `kid` in the header, JWKS at `{Auth URL}/.well-known/jwks.json`,
`iss` = `aud` = origin of the Neon Auth URL for user tokens (the anonymous token's `iss` is the full `…/neondb/auth` URL; verified live), lifetime **15 minutes**, no refresh token.
Claims: `sub` = `id` = user uuid, `role: "authenticated"`, `email`, `emailVerified`, `name`,
`banned`, `iat`, `exp`. The Data API switches to the Postgres role named in `role`; tokens from
`/token/anonymous` run as `anonymous` (`auth.uid()` is null).
Refresh: before `exp` (or after a 401 `JWT expired`, retry once) call `GET /token` again.

### 5.3 Registration (the only UI addition: the code step)

1. Client validation, in the beta order and with the beta texts: name (MA401) -> company for
   companies (MA402) -> email (MA403) -> phone format (MA404) -> password ≥ 6
   (`პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან.`) -> terms
   (`რეგისტრაციისთვის საჭიროა წესებზე თანხმობა.`) -> city (MA104) -> industry for companies (MA407).
   Keep the form values in memory (and `sessionStorage`, in case of reload during the code step).
2. `POST /sign-up/email {email, password, name}`.
   - `USER_ALREADY_EXISTS` / `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (HTTP 422) ->
     `ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ანგარიშში.`
   - `PASSWORD_TOO_SHORT` -> the password text above; `INVALID_EMAIL` -> MA403 text.
     Note: Better Auth's default minimum is **8** characters and no console setting for it was
     found, so a 6–7 character password passes the client check but gets `PASSWORD_TOO_SHORT`
     (shown with the existing password text). Confirm on the first deploy.
3. Show `შეამოწმე ელფოსტა` and the code step (label „ელფოსტაზე მიღებული კოდი“, button
   „დადასტურება“, link „კოდის ხელახლა გაგზავნა“ -> resend endpoint).
4. `POST /email-otp/verify-email {email, otp}` -> signed in. Wrong/expired code (`INVALID_OTP`,
   `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS` -> resend) -> stay on the code step.
5. `GET /token`, then `rpc/complete_profile` with the kept form values
   (`p_role, p_name, p_company, p_phone, p_city, p_industry`). `MA405` (phone taken) -> show the
   MA405 text on the form; the user fixes the number and submits again (the session already exists,
   so only `complete_profile` is repeated).
6. Cache the returned row as the current user.

### 5.4 Sign-in and session

- `POST /sign-in/email`; 401 `INVALID_EMAIL_OR_PASSWORD` -> `პაროლი არასწორია.`;
  403 `EMAIL_NOT_VERIFIED` -> `შეამოწმე ელფოსტა` + the same code step (then continue at 5.3 step 5).
- Then `rpc/my_profile`:
  - 0 rows -> the profile was never completed (e.g. the tab was closed after the code): show the
    account form (pre-filled from `sessionStorage` if available) and call `complete_profile`.
  - `blocked` -> `POST /sign-out` and `ანგარიში დაბლოკილია. დაუკავშირდი MeetAny-ს გუნდს.`
- Page load: `GET /token`; no token -> anonymous: `GET /token/anonymous`, cache until
  `expires_at` (unit to be confirmed on the first deploy: treat values > 1e12 as milliseconds).
- Sign-out: `POST /sign-out {}`, drop cached JWTs.

The owner edits name, company, city, industry and the public company fields with
`update_my_profile` (§3); phone, email, role and verification are not editable. The profile email is copied from Neon
Auth once, at `complete_profile` (Neon Auth does not support changing the email).

### 5.5 Admins

Promote an existing (completed) account in the Neon SQL editor:
`update public.profiles set role = 'admin' where email = 'someone@example.ge';`
Demote: `... set role = 'client' ...` (or `'company'` for a company with an `industry`).
Neon Auth's own `role` column is not used.

---

## 6. Photos: Vercel Blob

### 6.1 Upload (browser -> `api/blob-upload.js` -> Vercel Blob)

- Public Blob store, files served at `https://<storeId>.public.blob.vercel-storage.com/<pathname>`.
- Browser (pinned CDN module, no bundler):
  ```js
  import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/client/+esm';
  const pathname = `${me.id}/${Date.now().toString(36)}-${rand}.jpg`;   // name: [A-Za-z0-9_-]{1,64}
  const blob = await upload(pathname, file, { access: 'public', handleUploadUrl: cfg.uploadUrl,
    contentType: 'image/jpeg', headers: { Authorization: 'Bearer ' + userJwt } });
  // blob.url -> pass as p_photo_url to create_request
  ```
- `api/blob-upload.js` (`handleUpload`, `onBeforeGenerateToken`) must, before minting a client token:
  - verify the JWT from `Authorization` with `jose` against `{NEON_AUTH_BASE_URL}/.well-known/jwks.json`:
    `algorithms: ['EdDSA']`, `issuer` = `audience` = origin of `NEON_AUTH_BASE_URL`,
    `role === 'authenticated'`, `emailVerified === true`, `sub` a uuid -> else 401;
  - check that the caller has a profile and is not blocked: `POST {NEON_DATA_API_URL}/rpc/my_profile`
    with the same bearer token; 0 rows or `blocked` -> 403 (keeps the old rule "only signed-in,
    non-blocked users can upload"; no database secret is needed);
  - accept only `pathname` matching `^<sub>/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp|gif)$` -> else 403;
  - return `allowedContentTypes: ['image/jpeg','image/png','image/webp','image/gif']` (no SVG),
    `maximumSizeInBytes: 5242880`, `addRandomSuffix: true`, `allowOverwrite: false`,
    a short `validUntil` (e.g. 5 min).
  - answer only `type === 'blob.generate-client-token'` (no `onUploadCompleted`).
- Vercel checks the declared content type, not the bytes. Orphaned files (upload without a request,
  deleted or hidden requests) stay reachable by URL; there is no delete path (as before).

### 6.2 `photo_url` rule (`create_request`, MA109)

Accepted only if **all** hold:
- `meetany_private.settings.photo_origin` is set to a plain `https?://host[:port]` (set per
  deployment, §8); unset or malformed -> every photo is rejected;
- the URL starts with that origin (host compared case-insensitively) followed by
  `/<caller's auth.uid()>/` (lower-case uuid, exactly one folder level);
- the file name matches `^[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png|webp|gif)$` (extension
  case-insensitive; no dots in the name, no `?`, `#`, `%`, spaces, `/`);
- no userinfo (`user@host`), no other port, no http when the origin is https.

The table CHECK `requests_photo_url_check` enforces the shape and the owner folder even for SQL
editor inserts.

---

## 7. MarketStore method -> backend call

| MarketStore | backend |
|---|---|
| `currentUser()` | cached `my_profile()` row (null when signed out or not completed) |
| `userById(id)` | cached public profile columns (`profiles` select); full row only for self (my_profile) and admin (admin_list_users) |
| `register(input)` | client validation -> `/sign-up/email` -> code step -> `/email-otp/verify-email` -> `complete_profile` |
| `login(email, password)` | `/sign-in/email` (403 -> code step) -> `my_profile` (missing -> `complete_profile`; blocked check) |
| `logout()` | `/sign-out` |
| `listRequests / getRequest` | cached `requests` select (RLS decides hidden visibility) |
| `offerCount(id)` | cached `offer_counts(ids)` |
| `visibleOffers(id)` / `myOffers()` | `offers` select (signed-in only) |
| `contactFor(r)` | cached `contact_for_request(r.id)` |
| `createRequest(input)` | Blob upload via `uploadUrl` (optional) -> `create_request` (`input.quantity` -> `p_quantity`, `input.unit` -> `p_unit`, `input.neededBy` `YYYY-MM-DD` -> `p_needed_by`; validated client-side with the same rules) |
| `updateRequest(id, input)` | `update_request` (same fields as `createRequest`, full replacement) |
| `closeRequest / extendRequest / deleteRequest` | `close_request / extend_request / delete_request` |
| `sendOffer(id, input)` | `send_offer(p_request_id, p_body, p_price, p_price_type, p_vat_included, p_delivery_days, p_delivery_included)`; blank price -> `null`; the beta string parsing (comma -> dot) stays client-side, non-numeric -> MA205 text; `input.priceType` omitted -> inferred like the server (price -> `total`, none -> `negotiable`) |
| `updateProfile(input)` / `listCompanies / getCompany / companyStats` | `update_my_profile` / cached `list_companies()` + `company_stats(ids)` |
| `withdrawOffer / chooseOffer` | `withdraw_offer / choose_offer` (chooseOffer passes the cached offer's `updated_at` as `p_expected_updated_at`; on error it refreshes the cache) |
| `adminSetHidden(id, hidden, reason?) / adminDeleteRequest / adminSetBlocked(id, blocked, reason?) / adminSetVerified` | `admin_set_hidden / admin_delete_request / admin_set_blocked / admin_set_verified` (request objects gain `hiddenReason`, admin user objects `blockedReason`) |
| `allUsers()` | `admin_list_users()` (admin); others: public profiles only |
| `stats()` | admin: `admin_stats()`; others: compute from the cache (e.g. `open` = requests in state open) |

The Data API has no realtime channel: refresh on focus / after mutations, as today.

---

## 8. Setup (Neon console, once per project/branch)

1. Create the project in an **AWS** region (Neon Auth requirement); database `neondb`.
2. **Auth** -> enable Neon Auth (Managed Better Auth).
   - Sign-up with Email: on; **Verify at sign-up: on**; method **Verification code** (OTP);
     require email verification: on; auto sign-in after verification: on; send verification email
     on sign-in: on. (API: `PATCH /projects/{id}/branches/{branch}/auth/email_and_password`
     `{"enabled":true,"email_verification_method":"otp","require_email_verification":true,
     "send_verification_email_on_sign_up":true,"send_verification_email_on_sign_in":true,
     "auto_sign_in_after_verification":true,"disable_sign_up":false}`.)
   - Password length: Better Auth default (min 8, max 128); see §5.3 step 2.
   - Configuration -> Application Name `MeetAny`; Domains -> add `https://meet-any.vercel.app`
     (and preview domains if used); turn "Allow localhost" off in production.
   - Email provider: the shared Neon sender works for testing (rate-limited); use custom SMTP for
     production.
3. **Data API** -> enable for `neondb` with **Neon Auth** as the auth provider. Leave
   **"Grant public schema access" unchecked** (schema.sql sets every grant itself). Exposed schema:
   `public` only (never `meetany_private`). CORS allowed origins: `https://meet-any.vercel.app`.
   This creates the roles `authenticated` / `anonymous` and installs `pg_session_jwt` (`auth.uid()`).
4. SQL editor (as the owner role): run `db/schema.sql` (it refuses to run if steps 2–3 are missing),
   then set the Blob store origin:
   ```sql
   insert into meetany_private.settings (key, value)
   values ('photo_origin', 'https://<storeId>.public.blob.vercel-storage.com')
   on conflict (key) do update set value = excluded.value;
   ```
5. Data API -> **Refresh schema cache** (after every schema change).
6. Promote the first admin (§5.5) after that person has registered.

## 9. Vercel environment variables (Project -> Settings -> Environment Variables)

| name | secret | value |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | **yes** | added automatically when the Blob store is connected to the project |
| `NEON_AUTH_BASE_URL` | no | the Neon Auth URL, e.g. `https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth` |
| `NEON_DATA_API_URL` | no | the Data API URL, e.g. `https://ep-xxx.apirest.<region>.aws.neon.tech/neondb/rest/v1` |

No database connection string is needed anywhere (Vercel or browser).

## 10. Tests

`db/tests/run.sh` creates a throwaway database on the local PostgreSQL (socket `/tmp`, port 5432),
loads `stub_neon.sql` (Data API roles, `auth.*` over `request.jwt.claims`, `neon_auth."user"`),
`schema.sql` twice (re-runnability), then `rls_tests.sql`, `security_tests.sql`, `profile_tests.sql`
and `fields_tests.sql` (request/offer terms, sealed terms, `verified_at`), drops the
database, and exits non-zero on the first failing assertion (`TEST FAILED: <name>`).
