# MeetAny — როლების სრული აუდიტი (კლიენტი / კომპანია / ადმინი), 2026-09-29

**გარემო და მეთოდი.** კოდი და ბაზა არ შეცვლილა. dev `:3001` არ გადავტვირთე, production build არ გამიშვია. DB: Neon `auth-probe` (`ep-withered-glade-b54ts1g5*`), მხოლოდ `set local transaction read only` მოთხოვნები (`pg_proc`, `information_schema`, `pg_policies`) — ჩანაწერი, პაროლი თუ `DEMO-ACCOUNTS.local.md` არსად წამიკითხავს/დამიბეჭდავს. წყაროები: `site/web/app/**`, `site/db/schema.sql` (2012 ხაზი), `site/db/migrations/*`, ცოცხალი DB ინტროსპექცია, და წინა აუდიტი `qa/archive/reports/FULLSTACK-AUDIT-GE.md` (2026-09-24, 109 უფლების-შემოწმება — იქ დადასტურებული საკითხები აქ არ მეორდება დეტალურად, მხოლოდ როლების კუთხით რელევანტური ნაწილი და მას შემდეგ მომხდარი ცვლილებები).

---

## 1. ამჟამინდელი მდგომარეობა ფაქტებით

### 1.1 რეგისტრაცია, შესვლა, პაროლის აღდგენა

- **ფორმა**: `app/components/market/AuthForms.tsx` — `LoginForm` (:41-101), `RegisterForm` (:103-251, როლის რადიო :154-162 „კლიენტი / კომპანია"), `RecoveryForm` (:284-328, კოდით აღდგენა და ელფოსტის დადასტურებაც ამავე კომპონენტით). `?next=` — მხოლოდ იმავე-origin ბილიკი (`safeNext`, :13-15).
- **კლიენტის ნაკადი**: `app/lib/market-store.js` — `register()`/`login()`/`verifyEmailCode()`/`resendCode()`/`requestPasswordReset()`/`resetPassword()` (:343-468) Neon Auth REST-ს პირდაპირ სთხოვს: `/sign-up/email`, `/sign-in/email`, `/email-otp/send-verification-otp`, `/email-otp/verify-email`, `/email-otp/request-password-reset`, `/email-otp/reset-password` (:386,406,418,425,449,460). ტოკენი 15 წთ, `/token`-იდან განახლდება (:78-102); ანონიმური სესიისთვის `/token/anonymous` (:108-112).
- **პროფილის შექმნა**: მხოლოდ ელფოსტის კოდის დადასტურების/შესვლის მერე, `complete_profile` RPC-ით (`market-store.js:357` → `schema.sql:495-539`). **გადამწყვეტი: `p_role` კლიენტიდან მოდის, მაგრამ სერვერი კრავს მას** — `v_role text := case when p_role = 'company' then 'company' else 'client' end` (`schema.sql:504`) — ანუ `'admin'`-ის გაგზავნა უშედეგოა (დადასტურებულია `audit-perms.mjs`-ში: `complete_profile(p_role='admin')` არსებულზე → როლი უცვლელი, ახალზე → `client`).
- **ელფოსტის დადასტურების მოთხოვნა**: `complete_profile` amoწმებს `neon_auth."user"."emailVerified"`-ს, გარდა იმ შემთხვევისა, როცა `meetany_private.settings.require_email_verification = 'off'` (`schema.sql:516-519`). **დღეს, ცოცხალ `auth-probe`-ზე, ეს მნიშვნელობა `off`-ია** (გადამოწმებულია პირდაპირ ბაზაში) — ეს იგივეა, რაც `qa/archive/reports/FULLSTACK-AUDIT-GE.md`-ის #1-ში 2026-09-24-ს იყო დაფიქსირებული, არაფერი შეცვლილა; იხ. §4.
- **პაროლის შეცვლა შესულ მომხმარებელს**: ანგარიშის გვერდზე (`AccountPageContent.tsx` → `ProfileForm`, :49-261) პაროლის ველი **საერთოდ არ არსებობს** — მხოლოდ ტექსტია „ტელეფონისა და ელფოსტის შესაცვლელად დაუკავშირდი გუნდს" (:242), პაროლზე კი არაფერია ნათქვამი. შესულ მომხმარებელს პაროლის შეცვლის ერთადერთი გზაა გასვლა და login-ფორმიდან „პაროლი დაგავიწყდა?" → OTP ნაკადი (`RecoveryForm`) — ცალკე „authenticated change-password" endpoint/გვერდი კოდში არ ჩანს. (ეს ასწორებს ჩემს წინა ვარაუდს `/change-password`-ის არსებობის შესახებ — ცალკე გვერდი არ არსებობს, მხოლოდ Neon Auth-ის `email-otp/reset-password` REST-გზა ლოგაუთის შემდეგ.)

### 1.2 კომპანიის რეგისტრაცია და პროფილის შექმნა

- რეგისტრაციისას `role="company"` არჩევისას სავალდებულოა კომპანიის დასახელება და მიმართულება (`AuthForms.tsx:129,132`); `complete_profile`-ში კომპანიისთვის: `MA402` (სახელი <2 სიმბ.), `MA407` (არასწორი კატეგორია) (`schema.sql:522,526`).
- `profiles` ცხრილს აქვს constraint `profiles_company_industry`: `role <> 'company' or industry is not null` (`schema.sql:179`) — ბაზის დონეზეც არ დაუშვება კომპანია `industry`-ის გარეშე.
- კომპანიის საჯარო პროფილი (about/offers/seeks/service_cities/address/lat/lng/logo) რედაქტირდება მხოლოდ `update_my_profile`-ით (`schema.sql:838-897`), საკუთარ `id`-ზე (`meetany_private.require_user()`); `role`, `phone`, `email`, `verified`, `blocked` **ამ RPC-ის არგუმენტებშიც კი არ არსებობს** — ანუ საკუთარი როლის/დადასტურების შეცვლა კლიენტის მხრიდან შეუძლებელია არა UI-ის, არამედ RPC-ის ხელმოწერის დონეზე.
- ლოგო: `app/components/market/PhotoField.tsx` (`LogoField`) → `app/lib/blob-upload-handler.js` — ატვირთვის ტოკენი მხოლოდ `<sub>/logo-<name>.<ext>`-ზე, ≤2MB, 5 წთ ვადა (:8,58); `update_my_profile` იღებს მხოლოდ `<Blob origin>/<caller id>/logo-...`-ს (`schema.sql:862-868`, MA115).

### 1.3 როლის მინიჭება, შენახვა, შეცვლა

| მოქმედება | ვინ | სად | შენიშვნა |
|---|---|---|---|
| `client`/`company` მინიჭება რეგისტრაციისას | სისტემა (არა მომხმარებელი) | `complete_profile`, `schema.sql:504` | კლიენტის `p_role` მხოლოდ ორ მნიშვნელობად იკვრება |
| `admin` მინიჭება | მხოლოდ ბაზის მფლობელი, პირდაპირი SQL-ით | `schema.sql:18-19` კომენტარი: `update public.profiles set role='admin' where email=...` | RPC/API-ში `role`-ის დაწერის გზა **საერთოდ არ არსებობს** |
| ადმინობის შემოწმება | ყოველ ადმინ-მოქმედებაზე თავიდან | `meetany_private.require_admin()` (`schema.sql:425-433`) → `require_user()` + `role='admin'` შემოწმება; `is_admin()` (`:364-368`) RLS-ისთვის | დაბლოკილი ადმინიც ითვლება non-admin-ად (`not p.blocked`) |
| `verified` (კომპანია) | მხოლოდ ადმინი | `admin_set_verified`, `schema.sql:1031-1050` | მხოლოდ `role='company'` მწკრივზე (MA303) |
| `blocked` | მხოლოდ ადმინი | `admin_set_blocked`, `schema.sql:1010-1029` | საკუთარი თავის დაბლოკვა აკრძალულია (MA301) |
| როლის შეცვლა client↔company რეგისტრაციის მერე | **არავინ** | — | არცერთი RPC არ იძლევა ამის საშუალებას; მომხმარებელს რომ დასჭირდეს მეორე როლი, ახალი ანგარიშია საჭირო (ახალი ტელეფონი, რადგან `phone unique`) |

---

## 2. ხილვადობის მატრიცა

პირობითი აღნიშვნები: ✅ სრულად ჩანს/შესაძლებელია · 🔒 მხოლოდ საკუთარი/მონაწილეთა შორის · ❌ არ ჩანს/არ შეუძლია · — არ ეხება.

| გვერდი / მონაცემი | სტუმარი | კლიენტი | კომპანია | ადმინი |
|---|---|---|---|---|
| `/requests/` კატალოგი, სათაური/აღწერა/ფასის ტიპი-არა | ✅ | ✅ | ✅ | ✅ (+დამალულებიც) |
| მოთხოვნის ავტორის სახელი/კომპანია+ტელეფონი | ✅ (public column, §4.2) | ✅ | ✅ | ✅ |
| შეთავაზების ტექსტი/ფასი კონკრეტულ მოთხოვნაზე | ❌ (`offers` — `authenticated`-ს გრანტი, RLS `offers_select_sealed`) | 🔒 მხოლოდ საკუთარ მოთხოვნაზე მიღებული | 🔒 მხოლოდ საკუთარი გაგზავნილი | ✅ ყველა (`is_admin()` RLS-ში, `schema.sql:476`) |
| შეთავაზებების **რაოდენობა** (`offer_counts`) | ✅ | ✅ | ✅ | ✅ |
| `/companies/` კატალოგი (`list_companies`) | ✅ (ტელეფონის გარეშე ამ RPC-ში) | ✅ | ✅ | ✅ |
| კომპანიის ტელეფონი | ✅ (public column პირდაპირ `profiles`-იდან, §4.2) | ✅ | ✅ | ✅ |
| მოთხოვნის/შეთავაზების ავტორის ელფოსტა | ❌ | 🔒 მხოლოდ არჩეული შეთავაზების მეორე მხარე (`contact_for_request`) | 🔒 იგივე | ✅ (`admin_list_users`/`admin_search_users`) |
| ჩატი/მიმოწერა | ❌ (login-ზე გადამისამართება) | 🔒 მხოლოდ საკუთარი საუბრები | 🔒 იგივე | ✅ ყველა (`admin_list_conversations`, `admin_conversation_messages`) — **მხოლოდ ლოგი, პასუხის გაგზავნის გარეშე** |
| `/account/` — ჩემი მოთხოვნები | ❌ | ✅ | ✅ (კომპანიასაც შეუძლია მოთხოვნის გამოქვეყნება) | — |
| `/account/` — ჩემი შეთავაზებები, „შენი მიმართულების მოთხოვნები" | — | ❌ (განყოფილება არ ჩანს) | ✅ | — |
| შენახული კომპანიები, შეტყობინებები (`request_alert_preferences`) | ❌ | 🔒 (შენახული — კი; alert პრეფერენსები — არა, MA201) | 🔒 ორივე | — |
| `/admin/` პანელი (მოთხოვნები/მომხმარებლები/ჟურნალი/კონტაქტები) | ❌ | ❌ | ❌ | ✅ |
| `contact_events` (ვინ ნახა/დარეკა ვის) | ❌ | ❌ (საკუთარი მოქმედება იწერება, მაგრამ არსად არ იკითხება) | ❌ | ✅ (`admin_contact_events`, `admin_contact_stats`) |
| `moderation_audit` (ვინ დაბლოკა/დამალა/დაადასტურა) | ❌ | ❌ | ❌ | ✅ (`admin_list_audit`) |
| დაბლოკილი პროფილის ნებისმიერი მონაცემი | ❌ (RLS `profiles_select_public`: `not blocked`, ადმინსაც არ აქვს bypass ამ policy-ში) | ❌ | ❌ | ✅, **მხოლოდ** `admin_list_users`/`admin_search_users`-ით (SECURITY DEFINER, არა ნედლი ცხრილით) |

**დაკვირვება**: `profiles`-ის RLS პოლიტიკას (`profiles_select_public`, `schema.sql:463-465`) — განსხვავებით `requests`/`offers`-ის პოლიტიკებისგან — **არ აქვს `is_admin()` bypass**. ესე იგი ნედლი `GET /api/db/profiles` ცხრილიდან ადმინიც კი ვერ ხედავს დაბლოკილ პროფილებს; ეს მონაცემი მხოლოდ აუდიტირებადი `admin_*` RPC-ებით მოდის. ეს კარგი, განზრახული დიზაინია (ადმინის წვდომა მხოლოდ RPC-ებით), არა ხარვეზი — აღვნიშნე, რადგან სამომავლო რეფაქტორისას შემთხვევით არ დაემატოს bypass ამ policy-ს.

---

## 3. ბექენდის ნაკადი მოქმედებების მიხედვით

ყველა მოთხოვნა გადის: **ბრაუზერი → `POST/GET /api/db/...` → `app/lib/db-handler.js` (JWT ვერიფიკაცია, RPC allowlist) → `app/lib/db.js` (`asCaller`: ტრანზაქცია caller-ის როლით + `request.jwt.claims`) → `site/db/schema.sql`-ის RPC/RLS.**

- **ავთენტიფიკაცია**: `verifyCaller` (`app/lib/neon-jwt.js:34-47`) ამოწმებს JWT-ს Neon Auth-ის JWKS-ით (`EdDSA`, pinned `issuer`/`audience`); ტოკენის გარეშე → `{role:'anonymous'}`; ვალიდურ user-ტოკენზე → `{role:'authenticated', sub, email, emailVerified}` (`userClaims`, :26-30). `db.js:30-40` ამ claims-ს დებს `request.jwt.claims`-ში და `SET LOCAL ROLE`-ით გადადის `anonymous`/`authenticated` Postgres-როლზე — ანუ **RLS/გრანტები რეალურად მოქმედებს**, არა მხოლოდ აპლიკაციის კოდი.
- **RPC allowlist**: `db-handler.js:15-25` — 41 დასახელებული ფუნქცია; ყველა დანარჩენი → 404 ბაზამდე მისვლის გარეშე. Table endpoint მხოლოდ `requests`/`offers`/`profiles`-ზეა (`table-query.js:2`), `select=`-ში ნებისმიერი სვეტის სახელი დაიშვება (`IDENT` რეგექსი, `:13-16`) — რას აბრუნებს, წყვეტს მხოლოდ column-grant + RLS (§4.2).

| მოქმედება | RPC | წინაპირობა (fail-კოდი) | რა იწერება/იცვლება |
|---|---|---|---|
| რეგისტრაცია → პროფილი | `complete_profile` | ელფოსტა verified (გარდა `off`), ტელეფონი უნიკალური (MA405), ტელეფონის ფორმატი (MA404) | `profiles` ახალი მწკრივი, `role` სერვერზე კვრილი |
| კომპანიის შექმნა/რედაქტირება | `update_my_profile` | `require_user()`; საკუთარ `id`-ზე მხოლოდ | `profiles.company/about/offers/seeks/service_cities/address/lat/lng/logo_url` |
| მოთხოვნის გამოქვეყნება | `create_request` | `require_user()`; ≤5 ღია მოთხოვნა (MA105); ფოტო მხოლოდ `<Blob origin>/<caller uid>/...` (MA109) | `requests` ახალი მწკრივი; `PUBLIC_WRITES`-ია → SSR snapshot ინვალიდირდება (`db-handler.js:28-32`) |
| შეთავაზების გაგზავნა | `send_offer` | `role='company'` (MA201), არა საკუთარ მოთხოვნაზე (MA202), მოთხოვნა `open` (MA203) | `offers` upsert (`on conflict (request_id, company_id)`); ტრიგერი `notify_offer` → `notifications`+`notification_outbox` |
| შეთავაზების არჩევა | `choose_offer` | მხოლოდ მფლობელი (MA107/206), `open` მდგომარეობა (MA208), ოპტიმისტური ბლოკი `updated_at`-ით (MA209) | `offers.status`, `requests.chosen_offer_id`; ტრიგერი → `offer_chosen` შეტყობინება |
| ნომრის ნახვა („CallButton") | `log_contact_event` | ტარგეტი არსებობს და არ არის დამალული/დაბლოკილი; rate-limit: 1/წთ თითო (actor,target,kind), ანონიმისთვის 120/წთ გლობალურად (`schema.sql:1674-1681`) | `contact_events` — **მხოლოდ ანალიტიკა**, ტელეფონის ხილვადობას არ ცვლის (§4.2) |
| ჩატის დაწყება/გაგზავნა | `start_conversation`/`send_message` | კომპანია უნდა იყოს `role='company'` და არა-დაბლოკილი (MA502); request-კონტექსტში მხოლოდ ორივე მხარე (MA504); rate-limit 20 შეტყ./წთ + 2წმ/საუბარი (MA506) | `conversations`/`messages`; ტრიგერით `last_message_at` |
| ადმინის მოდერაცია (დამალვა/წაშლა/დაბლოკვა/დადასტურება) | `admin_set_hidden/_blocked/_verified`, `admin_delete_request` | `require_admin()` (MA003) | სამიზნე მწკრივი + **ყოველთვის** ჩანაწერი `moderation_audit`-ში (append-only, `schema.sql:949-956` — `UPDATE/DELETE/TRUNCATE` ტრიგერით აკრძალული) |
| ადმინის ძებნა/ჟურნალი | `admin_search_users/_requests`, `admin_list_audit`, `admin_contact_*`, `admin_list_conversations` | `require_admin()`; cursor ვალიდაცია (`admin_page_cursor`, `schema.sql:1063-1086`) | მხოლოდ კითხვა, `SECURITY DEFINER`-ით RLS-ის გვერდის ავლით |

---

## 4. შეცდომები და რისკები, პრიორიტეტით

### მაღალი (production-gate — დემოზე მისაღები, deploy-მდე სავალდებულო)

**4.1 — ელფოსტის დადასტურება გამორთულია.** `meetany_private.settings.require_email_verification = 'off'` (ცოცხლად დადასტურებული ბაზაში) + `neon-jwt.js:23` `REQUIRE_EMAIL_VERIFICATION` env. **სცენარი**: ნებისმიერს შეუძლია დარეგისტრირდეს სხვისი რეალური ელფოსტით (მას არ სჭირდება მასზე წვდომა), `complete_profile` მაინც შექმნის პროფილს — ცრუ „კომპანიის" ან „კლიენტის" ანგარიშები შესაძლებელია მასობრივად. **ეს უკვე იყო დაფიქსირებული** `qa/archive/reports/FULLSTACK-AUDIT-GE.md`-ში 2026-09-24 (#1) როგორც განზრახული დემო-პარამეტრი — არაფერი შეცვლილა, უბრალოდ ვადასტურებ რომ deploy-ის checklist-ში კვლავ ცოცხალია. **შესწორება**: production-ზე `on` + `REQUIRE_EMAIL_VERIFICATION=on`; ეს არის „stop-switch" გადაწყვეტილება, მხოლოდ მფლობელის ხელით.

### საშუალო

**4.2 — ტელეფონის/სახელის მასობრივი harvesting `GET /api/db/profiles`-იდან, rate-limit-ის გარეშე.** `profiles`-ის `phone`, `company` (კლიენტისთვის ეს ველი მისი **პირადი სახელია** — `complete_profile`, `schema.sql:530-531: company := name თუ ცარიელია`) და `role` საჯარო column-grant-შია ყველასთვის (`schema.sql:480-481`, დღეს ცოცხლადაც დადასტურებული) — ეს **განზრახულია** (`schema.sql:10-14` კომენტარი; `CallButton.tsx:9`: „UI disclosure only: phone visibility in the public API is unchanged"). პრობლემა ის კი არ არის, რომ ტელეფონი საჯაროა (ეს პროდუქტის გადაწყვეტილებაა და `audit-perms.mjs`-ითაც ✅-დადასტურებული), არამედ ის, რომ **ამ ცხრილის GET-ს არანაირი request-throttling არ აქვს** — განსხვავებით `log_contact_event`-ისგან, სადაც 1/წთ + 120/წთ ლიმიტია ჩაშენებული (`schema.sql:1674-1681`). ვინმეს შეუძლია ერთი `curl`-ით (`select=phone,company,role,city&limit=1000`) გადმოწოვოს ყველა 36 პროფილის ტელეფონი/სახელი, `CallButton`-ის „ნომრის ნახვა" ღილაკისა და `contact_events`-ის აუდიტის სრული გვერდის ავლით — spam/scraping რისკი, განსაკუთრებით client-ების (ჩვეულებრივი ფიზიკური პირების) მონაცემებზე. **სად**: `app/lib/table-query.js` (`select`-ს არ აქვს ცხრილის მიხედვით allowlist), `app/lib/db-handler.js:114-116`. **შესწორება**: IP-დაფუძნებული rate-limit `/api/db/*`-ზე (Vercel Firewall ან საკუთარი token-bucket Redis/Neon-ში), და/ან `table-query.js`-ში `profiles.phone`/`company` წაკითხვის დაშვება მხოლოდ ცნობილი `select`-სიით (კატალოგის საჭირო ველები), დანარჩენი — მხოლოდ `list_companies()`/`contact_for_request()`-ის მსგავს ვიწრო RPC-ებში.

**4.3 — `start_conversation`-ს არ აქვს „client" მხარის როლის შემოწმება.** `schema.sql:1805-1823` (და განახლებული ვერსია `:1974-1992`) ამოწმებს მხოლოდ რომ `p_company_id` არის `role='company'`, მაგრამ **არაფერს ამოწმებს `client_id`-ზე** (თვითონ `me.id`) — ანუ კომპანია-ანგარიშსაც შეუძლია სხვა კომპანიასთან „კლიენტად" საუბრის გახსნა. `CompanyProfilePageContent.tsx:84`-ზე `MessageButton`-ი ნებისმიერ შესულ მომხმარებელს უჩვენდება (მათ შორის სხვა კომპანიას), UI ტექსტი/schema-ის სვეტების სახელები („client_id"/„company_id") კი client↔company წყვილს გულისხმობს. **გაურკვეველია, პროდუქტის განზრახვაა თუ არა B2B ქსელობა (კომპანია-კომპანია) — თუ არა, საჭიროა ან როლის შემოწმება (`me.role <> 'company'` საკუთარ პროფილზე მინიშნება), ან თუ კი, დოკუმენტაციაში დაფიქსირება.**

### დაბალი

**4.4 — მკვდარი კომპონენტები კვლავ არსებობს.** `app/components/market/CompanyRow.tsx`, `DirectionPhotoCard.tsx`, `MobileActionBar.tsx`, `PartnershipCTA.tsx`, `SectionHead.tsx` — არცერთი არსად არ არის იმპორტირებული (გადამოწმებულია დღეს, `grep`-ით ხელახლა; პირველად დაფიქსირდა `archive/reports/FULLSTACK-AUDIT-GE.md`-ში 2026-09-24). **შესწორება**: წაშლა.

**4.5 — შესულ მომხმარებელს პაროლის შეცვლის გზა არ აქვს ანგარიშის გვერდიდან.** `AccountPageContent.tsx` → `ProfileForm` (:49-261) არ შეიცავს პაროლის ველს; ერთადერთი გზაა გასვლა და login-ფორმიდან „პაროლი დაგავიწყდა?" (`RecoveryForm`, ელფოსტის OTP-ით). ეს არც უსაფრთხოების ხარვეზია და არც ბუგი — უბრალოდ პროდუქტის ხარვეზი UX-ში, რომელიც წინა აუდიტში არ იყო ცალკე დაფიქსირებული.

**4.6 — client↔company როლის მიგრაციის გზა არ არსებობს.** მას შემდეგ რაც ანგარიში შეიქმნა, `role`-ის შეცვლა (client→company ან პირიქით) შეუძლებელია არცერთი RPC-დან (`update_my_profile`-ს `p_role` არგუმენტიც კი არ აქვს); ერთადერთი გზაა ახალი ანგარიშის შექმნა — რაც ახალი ტელეფონის ნომერს მოითხოვს (`phone unique`). დაკვირვება, არა ბუგი — თუ პროდუქტს სჭირდება ეს გადასვლა, საჭიროა ცალკე RPC (მიგრაციისას `industry`/`company`-ის შევსების ვალიდაციით).

### გადაწყვეტილი მას შემდეგ, რაც archive/reports/FULLSTACK-AUDIT-GE.md დაიწერა (2026-09-24 → 2026-09-29)

- **Admin API v1** (`admin_search_users`, `admin_search_requests`, `admin_list_audit`) — მაშინ არ არსებობდა auth-probe-ზე (#3, ჟურნალის ტაბი ცარიელი, ძებნა შეზღუდული). დღეს **მიგრირებულია** (`site/db/migrations/20260923-admin-api.sql`, `git`-ში უკვე არსებობს) **და გამოყენებულია** — ცოცხალ ბაზაში ფუნქციები არსებობს, `admin_stats()` აბრუნებს `adminApiVersion:1`, ანუ `use-admin-data.ts:45` `supported=true` და `AdminPageContent`-ი `"ready"` რეჟიმშია, არა `"legacy"`-ში. **რჩება მხოლოდ დასადასტურებელი ბრაუზერში** (ბრაუზერი არ გამიშვია ამ აუდიტისას, dev-სერვერზე ჩარევის თავიდან ასაცილებლად).

*FULLSTACK-AUDIT-GE.md-ის სხვა, არა-როლური პუნქტები (SSR/connection-retry გამძლეობა, უსაფრთხოების header-ები, 404/error გვერდები, `db-handler.js`-ის `500 vs 400` ხარვეზი (#6), polling-ის დუბლირება) ამ დოკუმენტში არ მეორდება — სტატუსი უცვლელია, დამოუკიდებელია როლებისგან.*

---

## 5. განვითარების გეგმა ეტაპებად

| ეტაპი | რა | დამოკიდებულება | შემოწმების კრიტერიუმი |
|---|---|---|---|
| **1. Rate-limit `/api/db/*`-ზე** | IP-დაფუძნებული ლიმიტი (Vercel Firewall ან token-bucket); პრიორიტეტულად `GET profiles`/`requests` | არცერთზე | 200 თანმიმდევრული `GET /api/db/profiles?limit=1000` მოთხოვნა 1 წთ-ში → ნაწილი 429; ლეგიტიმური მომხმარებლის ნავიგაცია არ ზარალდება |
| **2. `table-query.js`-ში `select` allowlist ცხრილის მიხედვით** | `profiles`-ზე მხოლოდ საჭირო ველების წაკითხვა table-read-ით დაშვება; დანარჩენი (თუ საჭიროა) მხოლოდ ვიწრო RPC | ეტაპი 1 არ არის სავალდებულო წინაპირობა, მაგრამ ერთად უფრო სრულია | `select=email`/`blocked_reason` → 400, არა 200 ცარიელი სვეტებით |
| **3. `start_conversation`-ის როლის დაზუსტება** | გადაწყვეტილება პროდუქტთან (B2B ქსელობა თუ არა) → საჭიროებისამებრ `client_id`-ის როლის შემოწმება ან დოკუმენტში ფიქსაცია | არცერთზე | ტესტი: კომპანია A → კომპანია B-ს `start_conversation`; მოსალოდნელი ქცევა წინასწარ განსაზღვრული და დაფარული ტესტით |
| **4. მკვდარი კომპონენტების წაშლა** | `CompanyRow`, `DirectionPhotoCard`, `MobileActionBar`, `PartnershipCTA`, `SectionHead` | არცერთზე | `npx tsc --noEmit` სუფთაა, `npm run lint` შეცდომების გარეშე, ბანდლის ზომა მცირდება |
| **5. `require_email_verification=on` + Auth URL გატანა env-ში** | production-გახსნის წინაპირობა (T6.x-თან ერთად, deploy-ის დროს) | **დაბლოკილია T6.x-ით** — ამ ეტაპზე არ შეხებია | ახალი რეგისტრაცია მოითხოვს რეალურ OTP-ს; `NEXT_PUBLIC_NEON_AUTH_URL` აღარ არის ჩაკერებული ბანდლში |
| **6 (არასავალდებულო). პაროლის შეცვლა ანგარიშის გვერდიდან** | `ProfileForm`-ში „პაროლის შეცვლა" ბმული → Neon Auth-ის შესაბამის ნაკადზე | არცერთზე | შესული მომხმარებელი პაროლს იცვლის გასვლის გარეშე |
| **7 (არასავალდებულო). client↔company მიგრაციის RPC** | პროდუქტის გადაწყვეტილების შემდეგ | ეტაპი 3-ის მსგავსი გადაწყვეტილება საჭირო | ახალი RPC ტესტებით, ძველი `industry`/`company` ვალიდაციის გამეორებით |

ეტაპები 1-2 დამოუკიდებელია ერთმანეთისგან და შეიძლება პარალელურად; 3-4 დამოუკიდებელია RPC-ის შემოწმებით; 5 იბლოკება T6.x-ით (deploy) და არ უნდა დაწყებულიყო ამ დავალების ფარგლებში.

---

## შეჯამება

**ტოპ-5 რისკი**: (1) `require_email_verification=off` — production-gate, უკვე ცნობილი, deploy-მდე `on`-ზე გადართვაა საჭირო. (2) ტელეფონის/სახელის მასობრივი, rate-limit-გარეშე ამოღება `GET /api/db/profiles`-იდან — ველები განზრახ საჯაროა, მაგრამ მოცულობის დაცვა არ არსებობს. (3) `start_conversation`-ს არ აქვს client-მხარის როლის შემოწმება — კომპანია-კომპანია საუბარი შესაძლებელია, გაურკვეველია განზრახულია თუ არა. (4) 5 მკვდარი კომპონენტი კვლავ დარჩენილია კოდში. (5) შესულს პაროლის შეცვლის გზა ანგარიშიდან არ აქვს (მხოლოდ UX). სამი ამ დროისთვის ცნობილი, ცალკე ხარვეზი (require_email_verification, Admin API v1 არქონა, header-ები) მოძველდა — Admin API v1 **უკვე გამოსწორებულია და ცოცხლად მუშაობს**.

**გეგმის ეტაპები**: 1) rate-limit `/api/db/*`-ზე, 2) `select` allowlist `profiles`-ზე, 3) `start_conversation`-ის როლის გადაწყვეტილება, 4) მკვდარი კომპონენტების წაშლა, 5) `require_email_verification=on` (T6.x-თან ერთად, ახლა არ იწყება), 6-7) არასავალდებულო UX/მიგრაცია.
