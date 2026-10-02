# MeetAny database contract (frontend <-> Neon)

This file is the **only** interface the frontend (`web/app/lib/market-store.js`) and the upload
function (`web/app/lib/blob-upload-handler.js`) may rely on.
Source of truth: `db/schema.sql`. Tests: `db/tests/run.sh`.

Stack: **Neon Postgres** + **Neon Auth** (managed Better Auth, email + password, email code) +
**Neon Data API** (PostgREST-compatible REST over the database, validates Neon Auth JWTs) +
**Vercel Blob** (request photos, uploaded from the browser through `web/app/lib/blob-upload-handler.js`).

- Client: plain `fetch()` (no SDK). Public config in the config in `web/app/lib/market-store.js`:

  | key | example | notes |
  |---|---|---|
  | `authUrl` | `location.origin + '/api/auth'` (same-origin rewrite, preferred) or `https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth` | Neon Auth base URL |
  | `dataApiUrl` | `https://ep-xxx.apirest.<region>.aws.neon.tech/neondb/rest/v1` | Data API base URL |
  | `uploadUrl` | `/api/blob-upload` | Vercel Function that authorizes Blob uploads |

  All three are public values. No connection string, password, Blob token or signing key is ever
  in `web/public/` or git.
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
| `phone` | text | საჯარო ნომერი კომპანიისა და კერძო პირისთვის, ფორმატი `+995 5XX XXX XXX` |
| `industry` | text \| null | category key; non-null for companies, null for clients |
| `verified` | boolean | set by admin only |
| `verified_at` | timestamptz \| null | when the company was verified (`admin_set_verified`); null when not verified. Existing verified companies were back-filled with `created_at`. A trigger keeps it consistent with `verified` on every write path |
| `blocked_reason` | text \| null | admin's reason for blocking (3–500 chars), set by `admin_set_blocked`; null when not blocked (a trigger clears it). **Not** in the public column grant: the user reads it through `my_profile`, admins through `admin_list_users` |
| `city` | text | city key |
| `about` | text | public company description, ≤ 1000 chars (`update_my_profile`) |
| `offers` / `seeks` | text[] | ≤ 8 items of 1–120 chars each |
| `service_cities` | text[] | city keys, fixed city order |
| `created_at` | timestamptz | |
| `logo_url` | text \| null | public company logo (Vercel Blob, `<origin>/<owner id>/logo-….<ext>`); set by `update_my_profile(p_logo_url)`, §Company logo |

- ანონიმი და ავტორიზებული მომხმარებელი კითხულობენ მხოლოდ დაუბლოკავ პროფილებს (`not blocked`). დაბლოკილი პროფილის მთელი რიგი საჯარო კითხვიდან დამალულია; საკუთარი სრული პროფილი და ადმინისტრატორის წვდომა ქვემოთ მოცემული RPC-ებით რჩება.
- **Always list columns explicitly.** `select=*`, or selecting `name`, `email`, `blocked`,
  fails with `42501 permission denied` (column-level grants), even for your own row.
- Own full row -> `rpc/my_profile`. Everybody's full row (admin) -> `rpc/admin_list_users`.
- A signed-in user whose profile is not completed yet (§5.3) has no row here.

```
GET {dataApiUrl}/profiles?select=id,role,company,phone,industry,verified,verified_at,city&id=in.(<id1>,<id2>)
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
| `create_request` | `p_title text, p_body text, p_category text, p_city text, p_photo_url text default null, p_quantity numeric default null, p_unit text default null, p_needed_by date default null, p_address_note text default null` | `requests` row | yes* | require_user; ≥5 open -> `MA105`; title trimmed + cut to 120, <5 -> `MA101`; body trimmed + cut to 2000, <10 -> `MA102`; category -> `MA103`; city -> `MA104`; photo_url (blank = null) not a Blob URL of the configured store inside the caller's own folder -> `MA109` (see §6); then the terms: quantity not null and (NaN, ≤0, >1e9, or rounds to 0 at 3 decimals) -> `MA111`; quantity set and unit not a unit key -> `MA112` (unit without quantity is ignored, both stored null); needed_by before today or after today + 2 years (Asia/Tbilisi date) -> `MA113` |
| `close_request` | `p_request_id uuid` | `requests` row | yes* | require_user; missing (or hidden and caller not owner/admin) -> `MA106`; not owner and not admin -> `MA107`. Sets `status='closed'` |
| `extend_request` | `p_request_id uuid` | `requests` row | yes* | require_user; `MA106`; `MA107`; state `chosen`/`hidden` -> `MA108`; reopening a closed/expired one while owner already has 5 open -> `MA105`. Sets `status='open'`, `expires_at = min(max(now, expires_at) + 7 days, now + 21 days)` (repeated extensions cannot push it further than 21 days ahead) |
| `update_request` | `p_request_id uuid, p_title text, p_body text, p_category text, p_city text, p_quantity numeric default null, p_unit text default null, p_needed_by date default null, p_address_note text default null` | `requests` row | yes* | require_user; `MA106`; `MA107` (owner or admin); state `chosen`/`hidden` or any offer exists -> `MA110`; then the `create_request` checks `MA101`–`MA104`, `MA111`–`MA113`. **Full replacement**: an omitted quantity/unit/needed_by clears it, so always send the current values. A `needed_by` equal to the stored one is accepted even if it is now in the past |
| `delete_request` | `p_request_id uuid` | void | yes* | require_user; `MA106`; `MA107` (owner or admin). Offers, and the request's conversations with their messages, are deleted with it |
| `send_offer` | `p_request_id uuid, p_body text, p_price numeric default null, p_price_type text default null, p_vat_included boolean default null, p_delivery_days integer default null, p_delivery_included boolean default null` | `offers` row | yes* | require_user; request missing or hidden -> `MA106`; caller role ≠ company -> `MA201`; own request -> `MA202`; state ≠ open -> `MA203`; body trimmed + cut to 2000, <10 -> `MA204`; price type (omitted/null = `total` when a price is given, else `negotiable`) not `unit`/`total`/`negotiable` -> `MA210`; `negotiable` with a price -> `MA211`; `unit`/`total` without a price -> `MA212`; price not null and (NaN, ≤0, >1e9, or rounds to 0.00) -> `MA205`; delivery_days not null and outside 0–365 -> `MA213`. Price rounded to 2 decimals; null flags -> `false`; `vat_included` stored `false` for `negotiable`. **Upsert**: a second call by the same company replaces all its terms (same id, `updated_at` bumped, status kept) |
| `withdraw_offer` | `p_offer_id uuid` | void | yes* | require_user; not found or not caller's own -> `MA206`; status `chosen` -> `MA207`. Deletes the offer |
| `choose_offer` | `p_offer_id uuid, p_expected_updated_at timestamptz default null` | `offers` row (the chosen one) | yes* | require_user; offer missing -> `MA206`; caller not the request author: offer author or admin -> `MA107`, anyone else -> `MA206`; request state ≠ open -> `MA208`; `p_expected_updated_at` given and the offer was edited since (its `updated_at` differs) -> `MA209`, nothing chosen. Pass the offer's `updated_at` string exactly as read (microseconds). Atomic: chosen offer `status='chosen'`, all other offers on the request `declined`, `requests.chosen_offer_id` set |
| `contact_for_request` | `p_request_id uuid` | `setof {name, company, phone, email}` (0 or 1 row) | yes | Only when an offer is chosen: request author gets the chosen company's contact; the chosen company gets the author's. Everyone else (incl. admin, anonymous, a user without profile, and a **blocked** caller) gets 0 rows. Never raises |
| `update_my_profile` | `p_name text, p_company text, p_city text, p_industry text default null, p_about text default '', p_offers text[] default '{}', p_seeks text[] default '{}', p_service_cities text[] default '{}', p_address text default null, p_lat double precision default null, p_lng double precision default null, p_logo_url text default null` | `profiles` row (all columns) | yes* | require_user; `MA401`; `MA402` (companies); `MA104`; `MA407` (companies); about > 1000 -> `MA410`; offers/seeks > 8 items or an item > 120 chars -> `MA411`; unknown service city -> `MA104`; `p_logo_url`: null = unchanged, `''` = removed, otherwise must be `<photo_origin>/<caller id>/logo-<name>.<jpg|jpeg|png|webp|gif>` -> else `MA115`. Phone, email, role, verified, verified_at, blocked are not editable |
| `company_stats` | `ids uuid[]` | `setof {company_id uuid, offers_sent int, offers_chosen int}` | yes | Companies only; numbers only (offer contents stay sealed). Max 1000 ids |
| `list_companies` | – | `setof {id, company, industry, verified, verified_at, city, about, offers, seeks, service_cities, created_at, address, lat, lng, logo_url}` | yes | Active (not blocked) companies, verified first, then newest; max 1000 |
| `admin_set_hidden` | `p_request_id uuid, p_hidden boolean, p_reason text default null` | `requests` row | no | require_user; not admin -> `MA003`; reason given but not 3–500 chars after trimming -> `MA304`; missing -> `MA106`. Stores the trimmed reason in `hidden_reason` when hiding, clears it when showing. The reason is optional for the API; the request page's admin bar requires it |
| `admin_delete_request` | `p_request_id uuid` | void | no | require_user; `MA003`. Missing id is a no-op. Deletes the request's conversations and messages like `delete_request`; writes a `request.delete` audit row |
| `admin_set_blocked` | `p_user_id uuid, p_blocked boolean, p_reason text default null` | void | no | require_user; `MA003`; reason not 3–500 chars -> `MA304`; own id -> `MA301`; unknown -> `MA302`. Stores / clears `blocked_reason` like `admin_set_hidden` |
| `admin_set_verified` | `p_user_id uuid, p_verified boolean` | void | no | require_user; `MA003`; unknown or not a company -> `MA303`. `verified_at` = now() when newly verified, unchanged when already verified, null when verification is removed |
| `admin_list_users` | – | `setof profiles` (all columns, newest first) | no | require_user; `MA003` |
| `admin_stats` | – | `jsonb {adminApiVersion:2, hidden, blocked, users, companies, verified, open, requests, offers, chosen}` (integers) | no | require_user; `MA003`. hidden = all hidden requests; blocked = blocked non-admin profiles. Same definitions as beta `stats()`: users = non-admins, requests/chosen exclude hidden, open = state open |

| `admin_search_offers` | `p_q text default null, p_status text default null, p_cursor jsonb default null, p_limit integer default 25` | paginated complete offer rows + company_name, request_title, request_hidden | no | require_admin; `MA003`; literal search over ID/body/company/name/request title; status sent/chosen/declined; invalid filters/cursor/limit -> `22023` |
| `admin_delete_offer` | `p_offer_id uuid, p_reason text` | void | no | require_admin; `MA003`; reason required, trimmed 3–500 -> `MA304`; missing -> `MA206`; chosen -> `MA207`; atomic offer.delete audit |
| `admin_delete_request_v2` | `p_request_id uuid, p_reason text` | void | no | require_admin; `MA003`; reason required, trimmed 3–500 -> `MA304`; missing -> `MA106`; atomic request.delete audit and conversation/message cleanup |
| `admin_list_audit_v2` | `p_cursor jsonb default null, p_limit integer default 25, p_action text default null, p_target_type text default null` | paginated audit rows with actor_name, actor_email, target_name, target_exists, target_context, target_context_id | no | require_admin; `MA003`; eight actions and request/user/offer targets; invalid filters/cursor/limit -> `22023` |

`yes*` = anonymous may execute but always gets `MA001`. "no" = anonymous has no EXECUTE privilege
(the Data API answers with code `42501`); authenticated non-admins get `MA003` (a user without a
profile gets `MA001` first).

Admin = `profiles.role = 'admin' and not blocked`. Admins can close/extend/delete any request and
see all requests and offers; they cannot choose offers (author only) and do not get contacts via
`contact_for_request` (they use `admin_list_users`).

Admin v2 readers return `{items,nextCursor,hasMore,filteredTotal,asOf}`; default 25 rows, capped at 100, descending `(created_at,id)`. Audit actor/target names and actor email join current records at read time; deleted targets have null name and false existence. Offer context retains the request ID and joins its current title. Offer moderation requires a reason and stores identifiers/status only, never offer body, price or contact data. Legacy request deletion remains idempotent and reason-optional.

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

### 6.1 Upload (browser -> `web/app/lib/blob-upload-handler.js` -> Vercel Blob)

- Public Blob store, files served at `https://<storeId>.public.blob.vercel-storage.com/<pathname>`.
- Browser (pinned CDN module, no bundler):
  ```js
  import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/client/+esm';
  const pathname = `${me.id}/${Date.now().toString(36)}-${rand}.jpg`;   // name: [A-Za-z0-9_-]{1,64}
  const blob = await upload(pathname, file, { access: 'public', handleUploadUrl: cfg.uploadUrl,
    contentType: 'image/jpeg', headers: { Authorization: 'Bearer ' + userJwt } });
  // blob.url -> pass as p_photo_url to create_request
  ```
- `web/app/lib/blob-upload-handler.js` (`handleUpload`, `onBeforeGenerateToken`) must, before minting a client token:
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
| `adminSearchOffers(args) / adminDeleteOffer(id, reason)` | `admin_search_offers / admin_delete_offer` (trimmed reason required) |
| `adminDeleteRequest(id, reason?) / adminListAudit(args)` | With a supplied reason use `admin_delete_request_v2`, otherwise legacy deletion; audit selects `admin_list_audit_v2` when cached stats `adminApiVersion>=2`, otherwise v1 |
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
   - Configuration -> Application Name `MeetAny`; Domains -> add `https://www.meetany.ge`,
     `https://meetany.ge`, and the retained legacy origin `https://meet-any.vercel.app`
     (and preview domains if used); turn "Allow localhost" off in production.
   - Email provider: the shared Neon sender works for testing (rate-limited); use custom SMTP for
     production.
3. **Data API** -> enable for `neondb` with **Neon Auth** as the auth provider. Leave
   **"Grant public schema access" unchecked** (schema.sql sets every grant itself). Exposed schema:
   `public` only (never `meetany_private`). If using the Data API directly from the browser,
   its CORS origins must include `https://www.meetany.ge`, `https://meetany.ge`, and any retained
   legacy frontend. The current application uses its same-origin `/api/db` server endpoint;
   Neon Auth trusted domains are still required for browser sign-in.
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

### UI: საჯარო ტელეფონი და შეთავაზების წინა ფორმა (2026-09-22)

ტელეფონი წაიკითხეთ `GET /api/db/profiles?select=id,role,company,phone`-ით, საჭიროებისას `&id=eq.<uuid>` ფილტრით. ანონიმურ მოთხოვნას ავტორიზაციის სათაური არ სჭირდება. ელფოსტა საჯარო სვეტი არ არის; `select=*` და `select=email` აკრძალულია. `contact_for_request` უცვლელად რჩება არჩეული შეთავაზების მხარეებისთვის ელფოსტის მისაღებად.

ფასის ველის გარეშე UI-მ უნდა გამოიძახოს `POST /api/db/rpc/send_offer` შემდეგი JSON-ით: `{"p_request_id":"<uuid>","p_body":"<შეთავაზების ტექსტი>","p_price":null,"p_price_type":"negotiable"}`. ქართულად ეს არის „შეთანხმებით“; API-ში იგზავნება `negotiable`. ორივე ფასის არგუმენტის გამოტოვებაც იგივე შედეგს იძლევა. `negotiable` რიცხვით ფასს არ იღებს (`MA211`); `unit`/`total` ფასის გარეშე უარყოფილია (`MA212`). არსებული ფასის სვეტები და ძველი შეთავაზებები შენარჩუნებულია.

### UI: არჩევითი ფასი და შედარება (2026-10-01)

UX შეფასების შემდეგ მომხმარებლის მოთხოვნით ფასის ველი დაბრუნდა არჩევითად. საწყისი ვარიანტია `negotiable` („შეთანხმებით“); სურვილისამებრ კომპანიას შეუძლია მიუთითოს `unit` ან `total` თანხა **ლარში (GEL/₾)**, დღგ-ის ჩათვლასა და მიწოდების ხარჯის ჩათვლასთან ერთად. სხვა ვალუტა და ავტომატური გადახდა ამ UI-ში არ არის. გადახდის გრაფიკი, გარანტია და სხვა პირობები შეთავაზების ტექსტში იწერება. არსებული RPC/სვეტები და მათი ვალიდაცია გამოიყენება; ახალი მიგრაცია საჭირო არ არის. რედაქტირება ინარჩუნებს არსებულ ფასის პირობებს, ხოლო ფორმის მონახაზი ამ ველებსაც ინახავს. შედარების ხედში არჩევის ღილაკები ხელმისაწვდომია.

`rpc/<function>` არგუმენტების გადაცემისას `json`/`jsonb` მნიშვნელობები მთლიანად JSON-ად სერიალიზდება, მასივების ჩათვლით. `text[]` და სხვა SQL მასივები საკუთარ ტიპში რჩება. ეს ასწორებს `set_my_products(p_items jsonb)`-ის HTTP გზაზე პროდუქტების რეალურ შენახვას.

საჯარო სიები და ძიება არ აჩვენებს ამოცნობილ შიდა QA ანგარიშებსა და სათაურების მკაფიო სატესტო მაგალითებს. ეს არის კატალოგის პრეზენტაციის წესი და არა წვდომის შეზღუდვა: პირად ანგარიშში, პირდაპირ ბმულზე და ადმინში მონაცემები შენარჩუნებულია. ადმინისტრატორის საერთო რაოდენობები მონაცემების მთლიანობას მოიცავს.

### სიების სერვერული წაკითხვა (2026-09-23)

`/requests/`, `/companies/` და `/requests/new/` იყენებს `connection()`-ით დინამიურ SSR-ს და `app/lib/public-snapshot.js`-ს. snapshot პირდაპირ `asCaller({role:'anonymous'}, …)`-ით კითხულობს მოთხოვნებს (მაქს. 1000), `list_companies`, `company_stats`, `offer_counts` და პროფილების საჯარო სვეტებს, ტელეფონის ჩათვლით; ელფოსტა არ იკითხება. დამოუკიდებელი მოთხოვნები პარალელურია, თითოეული საკუთარ RLS ტრანზაქციაში. JSON თარიღები სტრიქონებად რჩება.

მხოლოდ საჯარო snapshot ინახება პროცესის მეხსიერებაში მაქსიმუმ 30 წამით; ვადის გასვლის შემდეგ წაკითხვა თავიდან სრულდება, ერთდროული მოთხოვნები ერთ promise-ს იზიარებს. წარუმატებელი წაკითხვა არ ქეშდება და კლიენტის არსებული retry მუშაობს. ცივი ქეშის შევსება Neon-მდე ქსელის დაყოვნებაზეა დამოკიდებული. ბრაუზერის cache თავდაპირველად snapshot-ით ივსება; არსებული ფონური refresh ავტორიზებული მომხმარებლის პროფილს, შეთავაზებებსა და კონტაქტებს ჩვეულებრივად კითხულობს. კერძო მონაცემები სერვერულ ქეშში არ ხვდება.

წარმატებული ჩაწერის RPC საჯარო snapshot-ის ქეშს იმავე პროცესში მაშინვე აუქმებს (მიმდინარე ძველი წაკითხვაც ვეღარ აღადგენს მას); Vercel-ის სხვა ინსტანსებზე მაქსიმუმ 30-წამიანი TTL რჩება. წაკითხვისა და `log_contact_event` RPC-ები ქეშს არ აუქმებს. კატალოგზე დაბრუნებისას კლიენტის singleton API-დან ფონურად ახლდება; `mutate()` refresh-ს ელოდება და `emit → setStore` სიას თავიდან აგებს. Next-ის გვერდისა და Route Handler-ის მოდულები პროცესის ერთ საჯარო ქეშს `globalThis`-ით იზიარებს.

## Contact events (2026-09-23)

Additive, rerunnable migration: `migrations/20260923-contact-events.sql`; the same SQL is included in `schema.sql`. Applied and verified on **auth-probe** only. `web/scripts/apply-migration.mjs` is pinned to that branch's endpoint, uses `@neondatabase/serverless`, reads credentials only from environment/`.env.local`, and prints only object verification or an error code.

`meetany_private.contact_events` has UUID `id`, nullable `actor_id`, server-derived `actor_role`, `target_kind` (`company|request`), UUID `target_id`, `kind` (`reveal|call`), `source`, and server `created_at`. RLS is enabled and all direct privileges are revoked from anonymous/authenticated roles. There are no client write/read policies. Actor/target identifiers survive deletion; names are resolved on read and deleted targets have `target_exists=false`. No phone, IP, email, JWT, or anonymous fingerprint is stored. These events are untrusted analytics, never billing or proof of a completed call.

- `log_contact_event(p_target_kind text, p_target_id uuid, p_kind text, p_source text) -> {recorded:boolean,id?:uuid}` is executable by anonymous and authenticated callers. Identity comes from verified caller claims, never arguments. Signed-in callers require an existing, unblocked profile. Companies must exist, have role `company`, and be unblocked; requests must exist, be visible, and have an unblocked owner. Company sources: `company-list`, `company-profile`, `company-partnership`; request sources: `request-owner`, `chosen-offer`. Mismatched source/target pairs, null or invalid arguments, and unavailable targets return SQLSTATE `22023`.
- Dedupe is a **rolling 60-second** window on `(actor_id or shared anonymous bucket, target_kind, target_id, kind)` across all sources. All anonymous callers share that bucket, so counts can undercount separate visitors; they are not unique-person counts. An additional shared anonymous cap accepts at most **120 events per rolling minute** across all targets/kinds. Transaction advisory locks serialize anonymous ingestion and each authenticated actor's ingestion. Suppressed events succeed with `{recorded:false}`. Different actions count separately. Authenticated callers are independent of the anonymous cap. Telemetry failures never block number disclosure or telephone-link activation; no retry queue/backfill is promised.
- `admin_contact_stats(p_period text default 'month')` requires `require_admin()`. Returns `totals.{day,week,month}.{reveals,calls}`, plus `companies` and `requests` arrays (top 10 each for selected period). `day` starts at midnight **Asia/Tbilisi**, `week` is the trailing 7 days, `month` the trailing 30 days. Tops are ordered by combined reveal+call count descending, then target UUID; rows include separate counts, target name/ID/kind, and existence flag.
- `admin_contact_events(p_cursor jsonb default null, p_kind text default null, p_target_kind text default null, p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 25)` requires `require_admin()`. Date range is `[from,to)`. Invalid enum, nonfinite/inverted dates, malformed cursor, or nonpositive limit returns `22023`. Limit is capped at 100. Response follows admin API v1: `{items,nextCursor,hasMore,filteredTotal,asOf}`. Order is `(created_at DESC,id DESC)` with `meetany_private.admin_page_cursor`; filters and exact count apply before cursor slicing. This insertion boundary is not a long-lived MVCC snapshot. Items add `actor_name`, `actor_company`, `target_name`, `target_exists`. Deleted signed-in actors are distinguished from anonymous actors.

No new MA codes: existing `MA001` (missing profile), `MA002` (blocked actor), `MA003` (non-admin) apply. Anonymous admin calls and all direct table access are denied by `42501`. There is no retention cleanup or historical backfill in this migration. Browser QA creates real test-branch analytics events, which remain visible there.

## Messaging / T10.7 stage 1 (2026-09-23)

`migrations/20260923-messaging.sql` is additive and rerunnable; the same SQL is appended to `schema.sql`. Apply only to **auth-probe** with `node web/scripts/apply-migration.mjs messaging` (pinned endpoint, DATABASE_URL from environment, error codes only). No UI, realtime service, emails, or catalog refresh is part of this stage.

Private tables have RLS enabled, no app-role table privileges/policies, and are accessible only through `SECURITY DEFINER` RPCs with empty `search_path`. `conversations` references both profiles with `ON DELETE CASCADE`; `messages` references conversation and sender with cascade. Deleting either participant removes the entire conversation and its messages. Request deletion (any path: `delete_request`, `admin_delete_request`, `admin_delete_request_v2`, owner SQL, author-profile cascade) deletes that request's conversations and their messages via the `requests_delete_conversations` trigger (since 2026-09-24; previously `request_id` was set to null and the history kept). A request conversation has no other link — its `context_key` is the request UUID — so nothing else is lost; `general` conversations are never touched. A trigger prevents changing participants or context; `(client_id,company_id,context_key)` is unique. Context is the original request UUID text or `general`. General and deleted-request conversations never merge.

`client_id` means the customer side of the conversation, not necessarily a profile whose role is `client`. A company may initiate with a request author: call `start_conversation(own_company_id, request_id)`, which sets `client_id` to that request's author. The request author can call the same RPC with the target company ID and gets the same conversation. A third party cannot attach another user's request. Without a request, the caller is `client_id`. `company_id` must identify a nonblocked company; participants must differ. Hidden/missing requests and blocked request authors cannot start new conversations. Existing history remains accessible independently of the request's current state. All participant RPCs use `require_user`, so blocked callers receive MA002 (including reads); admin reads use `require_admin`.

| RPC | Result / behavior |
|---|---|
| `start_conversation(p_company_id uuid, p_request_id uuid default null)` | Conversation object; creates or returns the unique existing conversation. |
| `send_message(p_conversation_id uuid, p_body text)` | Message object. Sender comes only from caller identity. Trims leading/trailing whitespace; 1–2000 Unicode characters, not bytes. |
| `list_my_conversations()` | Array of the caller's conversations that have at least one message, plus empty ones the caller started (`started_by = me`); the other participant does not see an empty conversation. Ordered by `last_message_at DESC NULLS LAST`, then `created_at DESC,id DESC`; conversation fields plus `other_id`, `other_name`, `other_company`, `last_message` (message object or null), `unread_count`. |
| `list_messages(p_conversation_id uuid, p_after timestamptz default null)` | Array ordered by `created_at,id` ascending; strictly later than `p_after`, or complete history when null. Unauthorized and nonexistent IDs both return MA501. |
| `mark_read(p_conversation_id uuid)` | `{marked,read_at}`; marks only unread messages sent by the other participant and updates the caller's `client_last_read_at` or `company_last_read_at`. Idempotent. |
| `unread_message_count()` | Integer count of incoming unread messages over the caller's conversations. |
| `admin_list_conversations(p_cursor jsonb default null)` | Existing admin page envelope: `{items,hasMore,nextCursor,filteredTotal,asOf}`, 25 rows, descending immutable `(created_at,id)`. Includes participant names/companies and latest message. |
| `admin_conversation_messages(p_conversation_id uuid,p_cursor jsonb default null)` | Same admin page envelope, 25 messages, newest first. Does not mark messages read. |
| `admin_message_stats()` | `{totals:{day:{conversations,messages},week:{conversations,messages},month:{conversations,messages}}}`. Counts records created today (Asia/Tbilisi midnight), last 7 days, last 30 days; these are not counts of active conversations. |

Conversation fields: `id,client_id,company_id,request_id,context_key,created_at,last_message_at,client_last_read_at,company_last_read_at,started_by`. `started_by` is the participant whose `start_conversation` created the row (a later call by the other side keeps it); null on rows created before 2026-09-24, which stay hidden from both lists until the first message. Last-message/read timestamps start null. Message fields: `id,conversation_id,sender_id,body,created_at,read_at`. Only the receiving participant marks read; sending does not implicitly mark incoming messages read. Admin cursor validation uses the existing `admin_page_cursor`; pagination fixes the creation-time horizon, while read state and latest-message metadata remain current.

**Limits and concurrency:** at most 20 accepted messages per sender in a sliding minute across all conversations; at least two seconds between messages from the same sender in one conversation (MA506 for either limit). Opposite participants have independent limits. A transaction advisory lock serializes sends per sender; a conversation row lock serializes sends with `mark_read`. Server message timestamps strictly increase per conversation, preserving polling order. Preserve the raw timestamp string, including PostgreSQL microseconds, for `p_after`; do not round through JavaScript `Date`. Poll every 5–10 seconds in the future UI. `p_after` only retrieves new messages, not updated receipts on old messages; fetch full history when receipt reconciliation is needed.

Indexes cover participant lists, request deletion, admin pagination, `(conversation_id,created_at,id)`, sender time windows and incoming unread messages. There is no direct participant or admin table access. Message bodies are plain text; future UI must render them as text, never unescaped HTML.

| Code | Meaning |
|---|---|
| MA501 | Conversation missing or caller is not a participant. |
| MA502 | Company missing, wrong role or blocked. |
| MA503 | Cannot message oneself. |
| MA504 | Request missing/hidden, author blocked, or caller is neither author nor target company. |
| MA505 | Message must contain 1–2000 characters after whitespace trim. |
| MA506 | Sender minute cap or conversation two-second cooldown exceeded. |
| MA507 | Conversation participants/context cannot change. |

Errors use existing `meetany_private.fail` (`P0001`, MA code prefix and hint). Store `MSG` maps MA501–MA507 to Georgian. Store methods `startConversation(companyId,requestId?)`, `sendMessage(id,body)`, `listConversations()`, `listMessages(id,after?)`, `markRead(id)`, `unreadMessageCount()` call `rpc()` directly; object fields are camelCase (`lastMessage` is also mapped). `startConversation` returns base metadata, with unavailable enrichment fields null/zero; `listConversations` supplies names, latest message and unread count. No store cache, `mutate()`, `refresh()` or public snapshot invalidation occurs. All nine messaging RPCs are explicitly excluded from `db-handler.js` snapshot invalidation.

Validation: `db/tests/messaging_tests.sql` is included in `bash db/tests/run.sh`; schema loads twice and the migration is reapplied before tests. The suite checks identities/permissions, body limits, rate limits, polling, unread/read receipts, both initiation directions, deletion semantics, RLS and admin cursor traversal.

Verified on 2026-09-23: **auth-probe applied**, information_schema confirms 2 private tables and 9 public RPCs. Local suite: **135 messaging assertions, 1100 total**, all passed. `npx tsc --noEmit` passed; `npm run lint` reports 0 errors and 16 pre-existing warnings. Live smoke used real demo hotel/wood authentication, dev `3001` API and all six store methods: camelCase mapping, trimmed body, send/read, strict-after polling, unread **1 → 0**, and no catalog refresh. The smoke conversation and cascading messages were deleted through owner SQL. Production was untouched; no deployment/build or UI changes were needed.


## Addresses — T10.8 (2026-09-23)

`db/migrations/20260923-addresses.sql` is additive and rerunnable; the same definitions are included in `schema.sql`. Apply only to the authorized **auth-probe** branch with `node scripts/apply-migration.mjs addresses`; the script verifies the four columns through `information_schema` and the four RPCs. No production changes.

- `profiles.address text NULL`: optional street and number, trimmed, at most 200 characters. Empty text becomes NULL. City remains in `city`.
- `profiles.lat double precision NULL`, `profiles.lng double precision NULL`: both NULL or both set, latitude in [-90, 90], longitude in [-180, 180]. NaN/infinity rejected; no Georgia-only restriction. Table CHECK constraints also protect owner writes.
- `requests.address_note text NULL`: optional address/district, trimmed, at most 120 characters; empty text becomes NULL.
- `update_my_profile` appends `p_address`, `p_lat`, `p_lng`, each default NULL. Both client and company accounts may set them. It follows the existing **full replacement** convention: explicit NULL **or omission clears** these fields. Direct RPC omission still clears these fields. The store preserves cached address/lat/lng individually when the input is undefined; explicit NULL or an empty string clears the supplied field (coordinates must remain a valid pair).
- `create_request` and `update_request` append `p_address_note text default null`. An omitted/NULL note is NULL on creation and clears it on editing. Old argument lists still work; the old SQL overloads are removed, leaving one signature per RPC.
- `address`, `lat`, `lng` are publicly selectable profile columns under the existing `not blocked` RLS policy. `list_companies`, `PUBLIC_PROFILE`, the SSR snapshot and `mapUser` expose them. Email/private fields remain unchanged. `mapRequest` exposes `addressNote`.
- Store `updateProfile`, `createRequest`, `updateRequest` pass the new named arguments. store არსებულ მნიშვნელობას ინარჩუნებს, თუ არგუმენტი არ არის გადმოცემული: `updateProfile` uses `me.address/lat/lng`, and `updateRequest` uses the cached request’s `addressNote`; explicit NULL or an empty string clears it. `directionsUrl(profile)` returns a Google Maps directions URL, preferring valid coordinate pairs (including zero); otherwise it uses the encoded address plus Georgian city label. It returns NULL without either a valid pair or an address. No API key required.

| Code | Georgian user message |
|---|---|
| `MA114` | მისამართი ან რაიონი უნდა შეიცავდეს მაქსიმუმ 120 სიმბოლოს. |
| `MA412` | მისამართი უნდა შეიცავდეს მაქსიმუმ 200 სიმბოლოს. |
| `MA413` | მიუთითე ორივე კოორდინატი: განედი −90-დან 90-მდე და გრძედი −180-დან 180-მდე. |

The API caches RPC signatures in process memory. A running process that has already cached old write signatures must reload its handler before accepting the new parameter names; a fresh process reads the migrated signatures. The address migration does not change this existing cache mechanism.

Demo-only locations (approximate coordinates, fictional businesses): ხის ხაზი — აკაკი წერეთლის გამზირი 116, თბილისი (41.7438, 44.7793); რბილი სივრცე — ფარნავაზ მეფის ქუჩა 82, ბათუმი (41.6447, 41.6340); რეგიონის მომარაგება — ილია ჭავჭავაძის გამზირი 32, ქუთაისი (42.2543, 42.6760). The accounts array and profile RPC arguments in `seed-demo.cjs` carry the same values; the seed itself is not run as part of this migration.

Verification (2026-09-23): applied to auth-probe, four columns and four RPCs verified. All 1132 SQL assertions pass (32 address assertions), both on the updated schema and on the previous schema followed by this migration twice. `npx tsc --noEmit` passes; lint has zero errors and 16 pre-existing warnings. Anonymous HTTP selects/catalog on localhost:3001 return all three demo addresses; new RPC argument names resolve and anonymous writes return MA001. Store mappings and directions links pass Node smoke checks. No server restart, seed execution, UI edits, or deployment.

## Conversation cleanup — T12.3b (2026-09-24)

Migration `migrations/20260924-empty-conversations.sql` (rerunnable; apply after `20260923-messaging.sql`): adds `conversations.started_by`, the `requests_delete_conversations` BEFORE DELETE trigger (private SECURITY DEFINER function, no app-role execute), the new `start_conversation` (records `started_by`) and `list_my_conversations` (hides empty conversations from the non-starter), and deletes conversations already orphaned by earlier request deletions (`request_id is null and context_key <> 'general'`). The same block is appended to `schema.sql`. Signatures and grants are unchanged. **Applied to auth-probe** on 2026-09-24 (`node web/scripts/apply-migration.mjs empty-conversations`, twice): 1 orphan conversation removed; the script asserts the column, the trigger and zero orphans. Production untouched. Local suite: `db/tests/conversation_cleanup_tests.sql` (22 assertions) plus the updated deletion checks in `messaging_tests.sql`.

## Company logo — T12.4a (2026-09-24)

Migration `migrations/20260924-company-logo.sql` (rerunnable; apply after `20260923-addresses.sql`); the same definitions are in `schema.sql`. **Applied to auth-probe** on 2026-09-24 (`node web/scripts/apply-migration.mjs company-logo`): the script asserts the column, the CHECK, a single `update_my_profile` overload, `logo_url` in the `list_companies()` result and the anonymous column grant. Production untouched. RLS unchanged.

- `profiles.logo_url text NULL`, CHECK `profiles_logo_url_check`: `valid_photo_url(logo_url, id)` — same shape as `requests.photo_url`, in the owner's own folder (direct table writes cannot point at another user's file).
- `update_my_profile(..., p_logo_url text default null)` — 12 arguments, the 11-argument overload is dropped. Unlike the other optional fields, **omission keeps** the logo: NULL = unchanged, `''`/blank = removed (NULL), otherwise the trimmed URL must start with `photo_origin()` + `/<caller id>/logo-` and pass `valid_photo_url` -> else `MA115`. Clients and companies may both set it; the UI shows it for companies.
- Publicly readable: column grant for `anonymous`/`authenticated`, `list_companies()` returns `logo_url`, `PUBLIC_PROFILE` (store and SSR snapshot) selects it. `my_profile`, `admin_list_users`, `admin_search_users` return whole rows and include it.
- Upload: `/api/blob-upload` signs `<uid>/logo-<name>.<ext>` with a **2 MB** limit (other files stay 5 MB); DELETE `{url}` removes only the caller's own file (another folder -> 403).
- Store: `uploadLogo(file) -> {url}` (JPG/PNG/WEBP/GIF ≤ 2 MB, else `MA115`); `updateProfile({..., logoUrl})` — `undefined` keeps, `''` removes, a URL from `uploadLogo` sets it. After success the replaced/removed file is deleted (best effort); if the RPC fails, the new upload is deleted. `mapUser` exposes `logoUrl` (string | null).

| Code | Georgian user message |
|---|---|
| `MA115` | ლოგო უნდა იყოს JPG, PNG, WEBP ან GIF სურათი, მაქსიმუმ 2 მბ. |

Verification (2026-09-24): local suite `db/tests/logo_tests.sql` — 23 assertions (1178 in total). Live check against localhost:3001 on auth-probe with a demo company (`web/scripts/verify-company-logo.mjs`, 17 checks): upload -> `update_my_profile` -> `list_companies` / anonymous `profiles` select -> foreign domain, another user's folder and a non-`logo-` file return 400 `MA115` -> DELETE of another user's file 403 -> replace deletes the old file -> `''` sets NULL; test files deleted and the other profile fields unchanged. As with the address migration, a running API process that cached the old `update_my_profile` signature must reload before it accepts `p_logo_url`.

## Company gallery — T12.4b (2026-09-30)

Migration `migrations/20260930-company-gallery.sql` (rerunnable; apply after `20260924-company-logo.sql`); the same definitions are in `schema.sql`. Apply with `node web/scripts/apply-migration.mjs company-gallery` (`--dry-run` first). **Apply before deploying code that selects `gallery`** (`PUBLIC_PROFILE` in the store and the SSR snapshot); the migration itself is safe for older code.

- `profiles.gallery text[] NOT NULL DEFAULT '{}'`, CHECK `profiles_gallery_check`: `meetany_private.valid_gallery(gallery, id)` — at most 8 URLs, each `valid_photo_url` in the owner's own folder.
- `set_my_gallery(p_urls text[]) -> profiles` — companies only; replaces the whole list (order kept, blanks and duplicates dropped, NULL clears). Each URL must start with `photo_origin()` + `/<caller id>/gallery-` -> else `MA116`. `update_my_profile` is unchanged and keeps the gallery.
- Publicly readable: column grant for `anonymous`/`authenticated`, `list_companies()` returns `gallery`, `PUBLIC_PROFILE` selects it. `my_profile` and the admin user lists return whole rows.
- Upload: `/api/blob-upload` signs `<uid>/gallery-<name>.<ext>` with the standard 5 MB limit.
- Store: `setGallery(items)` — items are saved URLs and/or new `File`s (uploaded as `gallery-` files, JPG/PNG/WEBP/GIF ≤ 5 MB, else `MA116`). After success dropped files are removed; on failure the new uploads are removed (best effort). `mapUser` exposes `gallery` (string[]).
- UI: account profile form (`GalleryField`), public profile mosaic (`CompanyGallery`: gallery first, then product photos), catalog/home cards use the first gallery photo (`companyImage`).

| Code | Georgian user message |
|---|---|
| `MA116` | გალერეაში შეიძლება 8-მდე ფოტო: JPG, PNG, WEBP ან GIF, თითო მაქსიმუმ 5 მბ. |

Verification (2026-09-30): local suite `db/tests/gallery_tests.sql` — 22 assertions; dry-run against auth-probe ok (rolled back).

## Admin photo moderation — T12.4c (2026-09-30)

Migration `migrations/20260930-admin-photos.sql` (rerunnable; apply **after** `20260930-company-gallery.sql` and `20260929-admin-v2.sql`): `node web/scripts/apply-migration.mjs admin-photos`.

- `admin_remove_company_photo(p_user_id uuid, p_url text, p_reason text) -> profiles` — admin only (MA003), reason 3–500 (MA304), unknown user MA302. Clears `logo_url` when it is that URL, otherwise removes it from `gallery` (order kept); neither -> `MA305`. Audited as `user.photo_remove` (target_type `user`, `old_flags` = `{field, url}`); `admin_list_audit_v2` accepts the action as a filter.
- `/api/blob-upload` DELETE: another user's file may be removed only by an active admin (profile check); own files as before.
- Store: `adminRemovePhoto(userId, url, reason)` — RPC, then best-effort Blob removal. Admin UI: tab „ფოტოები“ (uploaded Blob files only).

| Code | Georgian user message |
|---|---|
| `MA305` | ფოტო ამ პროფილზე ვეღარ მოიძებნა — შესაძლოა უკვე წაიშალა. |

Verification (2026-09-30): local suite `db/tests/admin_photo_tests.sql` — 13 assertions.

## მოთხოვნების შეტყობინებები ნაგულისხმევად ჩართულია — 2026-09-29

`20260929-request-alerts-default-on.sql` ცვლის მხოლოდ request alerts ქცევას; საჯარო RPC-ების სიგნატურები უცვლელია. auth-probe production-ის ბაზაცაა.

- შენახული რიგის გარეშე კომპანია იღებს პროფილიდან გამოთვლილ პარამეტრებს: `categories=[industry]` (ბაზაში ჯგუფების რუქა არ არის), `cities=service_cities`, ცარიელი მასივისას — `[city]`; `georgia` სხვა ქალაქებს ანაცვლებს. მიმართულების ან ქალაქის გარეშე ნაგულისხმევი გამორთულია.
- `request_alert_preferences()` და ახალი მოთხოვნის ტრიგერი ერთსა და იმავე კერძო `default_request_alert_preferences(profiles)` ფუნქციას იყენებს. ახალი საჯარო RPC არ დამატებულა; helper-ზე API როლებს უფლება არ აქვთ.
- შენახული პარამეტრები ყოველთვის უპირატესია. `set_request_alert_preferences(false,'{}','{}','off')` დასაშვებია, ქმნის გამორთულ რიგს და მომავალ შეტყობინებებს აჩერებს. მომხმარებელს შეუძლია ანგარიშიდან ხელახლა ჩართვა და კატეგორიების/ქალაქების არჩევა.
- ძველი გამორთული არაცარიელი რიგები ერთჯერადად ირთვება; ცარიელი რიგები იშლება და პროფილის ნაგულისხმევზე გადადის. `settings.request_alerts_default_on=on` იმავე ტრანზაქციაში ინახება: განმეორებითი მიგრაცია შემდგომ გამორთვას არ აუქმებს.
- რიგის გარეშე `emailMode='off'` და ელფოსტის job არ იქმნება. შენახული რიგების ელფოსტის რეჟიმი უცვლელია; გაგზავნა არ ჩართულა. ძველი მოთხოვნები არ ბრუნდება შეტყობინებებად; მოქმედებს მხოლოდ ახალი INSERT-ები, არსებული ბლოკირების/ავტორის/ქალაქის/კატეგორიის ფილტრებით.

შემოწმება: `bash db/tests/run.sh` მთლიანად PASS; request alerts — 45 შემოწმება. მიგრაცია auth-probe-ზე ორჯერ შესრულდა; ცოცხალი API და გასუფთავება აღწერილია `web/qa/ALERTS-2026-09-29.md`-ში.

## Reports („შეატყობინე“) — T15.9 (2026-10-01)

Migration `migrations/20261001-reports.sql` (additive, rerunnable; apply after `20260929-admin-v2.sql` and `20260930-business-features.sql`): `node web/scripts/apply-migration.mjs reports` (`--dry-run` first). **Applied to auth-probe** on 2026-10-01 (dry-run, then real; 2 tables and 3 RPCs verified).

- `meetany_private.reports` — RLS on, no rights for `anonymous`/`authenticated`. One **active** (`status='new'`) report per (reporter, target kind, target id) — partial unique index. No foreign key on the target: history survives deletion (`target_label` and `context_id` are kept).
- `report_content(p_kind text, p_target_id uuid, p_reason text, p_text text default '') -> {id, status, created_at}` — signed-in users only (no `anonymous` grant; blocked -> MA002). `p_kind`: `request` (visible, not own) | `company` (not blocked, not own) | `offer` (only the author of the request it answers). `p_reason`: `spam` | `fake` | `offensive` | `other`; `p_text` up to 500, required (3+) for `other`. At most 10 reports per user per 24 hours.
- `admin_list_reports(p_status text default 'new', p_offset integer default 0) -> {total, newCount, items[]}` — admin only (MA003). `p_status`: `new` | `handled` | null (all). 20 per page, newest first. Items: target (kind, id, current or saved label, `context_id`/`context_label` = the request of an offer, `target_exists`, `target_removed`, `offer_status`), reason, body, reporter name/email, dates, `target_reports`/`target_new` (reports on the same target), resolution, handler.
- `admin_resolve_report(p_id uuid, p_action text, p_reason text) -> {id, action, effect, closed}` — admin only; reason 3–500 (MA304). `hide`: request -> `admin_set_hidden`, offer -> `admin_delete_offer` (a chosen offer -> MA207, report stays new), company -> `admin_set_blocked`; these write `moderation_audit` as before. An already hidden/deleted/blocked target is not changed again. All new reports on that target are marked handled. `reject`: only this report is closed. Every resolution writes `meetany_private.business_audit` (`report_hidden` / `report_rejected`). A handled report -> MA706.
- Data API: all three RPCs are allowlisted; `admin_resolve_report` is a public write (drops the SSR snapshot), `report_content` is not.
- Store: `reportContent(kind, targetId, reason, text)`, `adminListReports(status, offset)`, `adminResolveReport(id, 'hide'|'reject', reason)` (refreshes the cache).
- UI: quiet „შეატყობინე“ text button on the request page (non-owners; guests go to sign-in with `?next=`), company profile (not own) and offer cards (request author only); admin tab „საჩივრები“ with the new-report count.

| Code | Georgian user message |
|---|---|
| `MA701` | აირჩიე მიზეზი. „სხვა“ მიზეზისთვის დაწერე 3–500 სიმბოლო. |
| `MA702` | ეს გვერდი ვეღარ მოიძებნა ან მისი შეტყობინება შეუძლებელია. |
| `MA703` | საკუთარ გვერდზე შეტყობინებას ვერ გააგზავნი. |
| `MA704` | ამაზე უკვე შეგვატყობინე. შეტყობინებას განვიხილავთ. |
| `MA705` | დღეში შეიძლება 10 შეტყობინება. სცადე ხვალ. |
| `MA706` | საჩივარი უკვე დამუშავებულია. განაახლე სია. |

Verification (2026-10-01): local suite `db/tests/report_tests.sql` — 43 assertions (guest denied, self-report, duplicate, validation, offer visibility, daily limit, MA003 for non-admins, hide request/offer/company, chosen offer, reject, audit rows).

## Marketplace completion — 2026-10-01

All new writes use `require_user()` (blocked accounts denied), admin reads use `require_admin()` (MA003). Private tables retain RLS and no direct API role grants.

| RPC | Access | Result and validation |
|---|---|---|
| `admin_market_metrics()` | Admin | `{withoutOffers, averageFirstOfferHours, completed, chosen, chosenShare, gaps[]}`. Visible requests from unblocked authors; unanswered counts open requests without non-withdrawn offers. Average is request creation to earliest non-withdrawn offer, in hours. Conversion denominator is non-open requests (closed, expired, chosen); null when no denominator. Supply matches exact industry plus office/service/national geography. Gap rows sort by company count ascending, demand descending, category/city. |
| `company_distribution_profiles()` | Public | Array of active opted-in companies: id, regions, categories, channels, brands, warehouse, transport, coldChain, minOrder, exclusive. No private contact data. |
| `set_my_distribution(p_categories text[], p_channels text[], p_brands text[], p_warehouse text, p_transport text, p_cold_chain boolean, p_min_order text, p_exclusive boolean, p_regions text[] default null)` | Company | Enables distributor status, atomically updates existing service cities and distribution fields, returns `my_business_settings()`. At least one valid region/channel; max 6 categories, 8 known channels, 20 brands of 1–80 chars; min order <=80 chars. Warehouse none/own/rented; transport none/own/contracted. MA621 invalid input. |
| `my_business_settings()` | Company | Existing membership/application fields plus `distribution`; opting out preserves distribution settings. |
| `company_products(p_company_id uuid)` | Public | Array of `{name, photoUrl, note}` for an active company. Only photos still in its gallery are returned, so moderated or removed gallery images disappear from products too. |
| `set_my_products(p_items jsonb)` | Company | Replaces own list, max 12. Name 2–80 chars, note <=200; photo must belong to the caller's approved Blob origin/path and existing gallery. Empty list removes own products. MA622 invalid input. |

Distribution v1 covers profile, public block, brand search and catalog filters. A distinct distributor request type and its special alert/offer routing are later specification stages, not part of this release. Product photos reuse the existing gallery uploader and ownership validation.


## UX და ადმინის განახლება — 2026-10-02

მიგრაციები `20261002-admin-management.sql`, `20261002-company-approval.sql`, `20261002-registration-analytics.sql` შესრულებულია იზოლირებულ ადგილობრივ და წარმოების ბაზებზე. წარმოებაზე ყოველი მიგრაციის კონტრაქტი იმავე transaction-ში commit-მდე გადამოწმდა; dry-run-ები მანამდე rollback-ით დასრულდა. თითოეული SQL suite-ში ორჯერ სრულდება; სრული suite — 1,545 შემოწმება PASS (83 ახალი). სარეზერვო ასლი შექმნილია; არსებული მონაცემები არ გასუფთავებულა.

- `admin_edit_profile(uuid,jsonb)` და `admin_edit_request(uuid,jsonb)` — ადმინისტრატორის ვალიდირებული ცვლილებები; `admin_company_settings(uuid)` — დამატებითი კომპანიის პარამეტრები. ცვლილებები იწერება ბიზნესჟურნალში.
- `admin_manage_plan(uuid,text,timestamptz)` — პირდაპირი Premium/VIP ან გაუქმება, ვადა და ისტორია.
- `site_content()` — საჯარო კონტენტი; `admin_save_site_content(jsonb)` — მხოლოდ ადმინის ცვლილება; ნებადართული ველები და ფოტოს მისამართები მოწმდება სერვერზე.
- `admin_business_audit(integer,integer)` — მხოლოდ ადმინის გვერდებად დაყოფილი ჟურნალი, ადამიანისთვის გასაგები მონაცემებით.
- `save_company_review(uuid,integer,text)` — არჩეულ კომპანიაზე ახალი შეფასება პირდაპირ ქვეყნდება. მოდერატორის მიერ დამალული შეფასების ავტორის განახლება დამალვას არ აუქმებს.
- კომპანიის დამტკიცება იყენებს `verified` მდგომარეობას. დაუმტკიცებელი კომპანია საჯარო დირექტორიაში/პროფილში/პროდუქტებში არ ჩანს; მფლობელი და ადმინი ხედავენ. შეთავაზების გაგზავნა უარყოფილია `MA801`-ით. დამტკიცება არსებულ ადმინისტრაციულ მოქმედებას იყენებს.
- `record_registration_event(uuid,uuid,text,text,text,text)` ინახავს მცირე allowlist მოვლენას; პირადი ველები უარყოფილია. `admin_registration_analytics(integer,text)` — პერიოდი, როლი, ეტაპები და მცდელობების ბოლო ეტაპი. `profile_created` მოითხოვს ახლად შექმნილ ავტორიზებულ პროფილს. სტუმრის მოვლენები არ არის უნიკალური ადამიანების ზუსტი რაოდენობა.
- `/api/analytics/registration` POST-ში 512-byte ნაკადის ზღვარი და ფორმატის ვალიდაციაა; ჩართვა — `REGISTRATION_ANALYTICS_ENABLED=true`. ლოკალურად და წარმოებაზე ჩართულია; ძველი რეგისტრაციის ისტორიული ეტაპები არ იგონება.
- ლოკალური `pg.Pool` მხოლოდ `MEETANY_LOCAL_DATABASE_URL` loopback მისამართით მუშაობს; მისი არყოფნისას არსებული Neon გზა უცვლელია. ადგილობრივად დამოწმებული JWT-ის metadata გამოიყენება stub მომხმარებლისთვის; ავთენტიკაციის საიდუმლოებები არ კოპირდება.

ზუსტი QA ფარგლები, კვლევა, მონაცემთა იზოლაცია და გაშვება: `web/qa/STATUS-2026-10-02.md`. ტელეფონის/ელფოსტის დადასტურებისა და გაგზავნის ახალი არხები ამ ეტაპს არ ეკუთვნის.


## ადმინის მიმოხილვა — 2026-10-02

`20261002-admin-overview.sql` ამატებს მხოლოდ ადმინისთვის `admin_overview()` RPC-ს. იგი აბრუნებს ერთ შეჯამებას: სტატისტიკას, თბილისის დროით ბოლო 60 დღის დღიურ რაოდენობებს და სამი სამუშაო რიგის მთლიან რაოდენობებს/მაქსიმუმ 6 ჩანაწერს. დამალული მოთხოვნები აქტივობის გრაფიკში არ ითვლება; რეგისტრაციები მოიცავს ყველა არაადმინ ანგარიშს. კომპანიების რიგი არადაბლოკილ, დაუდასტურებელ კომპანიებს ძველიდან იწყებს. პროფილების ტელეფონი და ელფოსტა შეჯამებაში არ გადადის.

`admin_stats().adminRevision` არის აუდიტის ბოლო ცვლილების გაუმჭვირვალე ნიშნული. ადმინის რედაქტირება განაახლებს დამოკიდებულ სიებს მაშინაც, როდესაც საერთო რაოდენობები უცვლელია; უცვლელი მონაცემები ჩამოტვირთვის ეკრანს არ იწვევს. მიმოხილვა შეცდომისას ინარჩუნებს ბოლო წარმატებულ მონაცემებს და ხელახლა ცდის შესაძლებლობას იძლევა.

მიგრაციის განმეორებადობა, უფლებები, რიგების შეზღუდვა, კალენდარული საზღვრები და აუდიტის ნიშნულის ცვლილება მოწმდება 25 ახალი SQL შემოწმებით; სრული suite: 1,570 PASS. ამ მიგრაციას მომხმარებლის ჩანაწერები არ წაუშლია ან შეუცვლია.

## საჯარო დომენი — 2026-10-02

მთავარი მისამართია `https://www.meetany.ge`; `https://meetany.ge` Vercel-ზე 308-ით მასზე გადადის. ორივე დომენი დადასტურებულია. ძველი `https://meet-any.vercel.app` მოქმედებს. `robots.txt`, `sitemap.xml` და იდეების canonical ბმულები უკვე `www.meetany.ge`-ს იყენებს. `SITE_URL` დამატებული არ არის: `siteUrl()` იღებს Vercel-ის `VERCEL_PROJECT_PRODUCTION_URL` მნიშვნელობას. მომავალში ამ ცვლადის override უნდა ემთხვეოდეს დომენს, რომელზეც გადამისამართება სრულდება.

წარმოების Neon Auth-ის სანდო დომენებს ოფიციალური branch API-ით დაემატა `https://www.meetany.ge` და `https://meetany.ge` (`auth_provider: better_auth`): ორივე დამატება 201-ით დასრულდა და GET-ით გადამოწმდა. ძველი დომენისა და არსებული ადგილობრივი მისამართების დაშვება შენარჩუნდა. ეს აუცილებელი იყო: CORS OPTIONS მოთხოვნა 204-ს აბრუნებდა, მაგრამ ახალი დომენიდან რეალური შესვლის POST ჯერ კიდევ 403-ით იბლოკებოდა. მხოლოდ CORS-ის შემოწმება შესვლის წარმატებას არ ადასტურებს.

ახალი frontend დომენის დამატებისას შეამოწმეთ [Neon Auth trusted domains](https://api-docs.neon.tech/reference/listbranchneonauthtrusteddomains), შემდეგ რეალური ბრაუზერიდან შესვლა და სესიის შენარჩუნება. დომენის გადასვლისთვის მომხმარებლების, პაროლების, ბაზისა და Blob ფოტოების შეცვლა საჭირო არ არის.
