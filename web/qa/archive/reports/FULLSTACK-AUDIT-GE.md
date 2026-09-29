> ისტორიული ჩანაწერი: გადატანილია QA არქივში 2026-09-29. ქვემოთ აღწერილი მდგომარეობა და ბრძანებები მიმდინარე საიტის შემოწმების ინსტრუქცია არ არის.

# MeetAny — full-stack აუდიტი (P12), 2026-09-24

გარემო: dev `http://localhost:3001`, ბაზა Neon `auth-probe`, დემო-ანგარიშები (client `hotel`/`cafe`, company `wood`/`linen`, admin). კოდი და ბაზა არ შეცვლილა; სკრიპტის ტესტ-ჩანაწერები (1 მოთხოვნა + 1 შეთავაზება) ადმინის `admin_delete_request`-ით წაიშალა, შემთხვევით შექმნილი ცალი საუბარი (`a6ffbb61…`, ცარიელი) ხელით წავშალე auth-probe-დან. შემოწმება: 109 უფლების-შემოწმება (`qa/audit-perms.mjs`), 1100+965 SQL-ტესტი, ბრაუზერული გავლა 4 როლით, `tsc` სუფთაა, lint 0 error / 25 warning.

## რეზიუმე

1. **ლოკალურად ძირითადი გზები მუშაობს** (სტუმარი, კლიენტი, კომპანია, ადმინი: კატალოგები, დეტალები, ანგარიში, ჩატი, ადმინი), უფლებების ხვრელი **არ ვიპოვე**: 107/109 შემოწმება ✅, ორი ❌ — ერთი ნამდვილი (500 არასწორ არგუმენტებზე), ერთი დაკვირვება.
2. **მთავარი ტექნიკური რისკი — ბაზასთან კავშირი**: `/api/db` წყვეტილად პასუხობს 500 MA999-ით (ვნახე `/companies/`-ზე, SSR snapshot-ზე, dev-ის პირველ მოთხოვნაზე), ყოველი გამოძახება ~1 წმ, SSR cache-miss 4–12 წმ (ლოკალურად, Neon-მდე დიდი RTT-ით).
3. **auth-probe-ზე არ არის გამოყენებული Admin API v1** (`admin_search_users/_requests`, `admin_list_audit`) — ადმინის „ჟურნალი“ ჩანართი არ მუშაობს, ძიება მხოლოდ ბოლო 1000 მოთხოვნაზეა; მიგრაციის ფაილიც არ არსებობს `db/migrations/`-ში.
4. **წარმოებამდე სავალდებულო**: ელფოსტის დადასტურება ბაზაში `off`-ია, Auth URL კლიენტის კოდშია ჩაწერილი, უსაფრთხოების header-ები არ არის, არ არის `not-found`/`error` გვერდები (ინგლისური 404).
5. **დასკვნა**: ლოკალური full-stack მზადაა მიღებისთვის მცირე P1-ებით (#2, #3); დეპლოის წინ საჭიროა #1, #4, #5, #11. მკვდარი კოდი: 5 კომპონენტი.

## ხარვეზები

| # | პრიორ. | სად | რა | როგორ გავამრავლო | როგორ გავასწორო |
|---|---|---|---|---|---|
| 1 | P0 (მხოლოდ prod-ისთვის) | ბაზა `meetany_private.settings`: `require_email_verification='off'`; env `REQUIRE_EMAIL_VERIFICATION=off` (`neon-jwt.js:23`, `schema.sql:508`) | ელფოსტის დადასტურების გარეშე რეგისტრაცია → სხვისი ელფოსტით ანგარიში, ყალბი „კომპანია“ | `select key,value from meetany_private.settings` | prod-ზე `on` + Neon Auth OTP; ეს „prod switch“-ის stop-წესია — მხოლოდ მფლობელის გადაწყვეტილებით |
| 2 | P1 | `db.js:12-33`, `db-handler.js:109` | წყვეტილი `500 MA999` /api/db-ზე. მიზეზი (სავარაუდო, ორი დამოუკიდებელი დაკვირვებით): Neon WebSocket-ის კავშირის შეცდომა (`ErrorEvent`, დავიჭირე ცალკე სკრიპტშიც) + cold compute; არ არის retry, `pool.on('error')`, `connectionTimeoutMillis`. შედეგი: `list_companies` 500 → `loadFailed`, „სერვისი მიუწვდომელია“; SSR: „Public snapshot failed“; dev-ის პირველი `capabilities` = 10.6 წმ → 500 | Playwright: კლიენტით `/companies/` (ვნახე 1 გავლაში), ან 10 პარალელური `rpc/list_companies` curl-ით | `db.js`: `pool.on('error')`, `connectionTimeoutMillis: 5000`, 1 retry connect-ის შეცდომაზე (კოდის გარეშე/`ErrorEvent`/`ECONNRESET`), `asCaller`-ის 5 RT (begin, set_config, set role, query, commit) → 2–3 (ერთი multi-statement `begin; select set_config…; set local role …`) |
| 3 | P1 | `AdminPageContent.tsx:177`, `use-admin-data.ts:21`; `scripts/apply-migration.mjs` (plans-ში არ არის) | auth-probe-ზე არ არსებობს `admin_search_users/admin_search_requests/admin_list_audit` (`pg_proc`-ში 41 ფუნქცია, სქემაში +3) → 404 PGRST202; ადმინი „legacy“ რეჟიმშია: „ჟურნალი“ ცარიელია, `admin_stats` არ აბრუნებს `adminApiVersion` | `rpc/admin_search_users` ადმინით → 404 | გამოაცალკევე `schema.sql:912-1180` → `db/migrations/20260923-admin-api.sql`, დაამატე plan `apply-migration.mjs`-ში, გაუშვი auth-probe-ზე (`ADMIN-MIGRATION.md`: „not applied“) |
| 4 | P2 | არ არის `not-found.tsx`, `error.tsx`, `global-error.tsx`; არ არის root `layout.tsx` (ყოველ ჯგუფს თავისი) | უცნობი URL → Next-ის ინგლისური „404: This page could not be found.“; render-შეცდომა → ნაგულისხმევი გვერდი | `/nosuch/` | დაამატე ქართული `not-found` და `error` ჯგუფებში/ან root-ში (იერსახე არ შეეხოს `/`-ს) |
| 5 | P2 | `next.config.ts`, `vercel.json` | არ არის `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By: Next.js` | `curl -sI /requests/` | `headers()` `next.config.ts`-ში, `poweredByHeader:false`; CSP-ში Neon Auth, `*.public.blob.vercel-storage.com` (img), wa.me |
| 6 | P2 | `db-handler.js:86,99,109` | არასრული არგუმენტები (`create_request {}`, `send_offer` სათაურის გარეშე) → PG `42883` → **500 MA999** (უნდა იყოს 4xx) | `POST /api/db/rpc/create_request` `{}` | `rpcCall`-ში შეამოწმე required (`pronargs - pronargdefaults`) → 400 `PGRST202`; ან `42883` → 400 |
| 7 | P2 | `db-handler.js:70-81` | RPC-ის სახელი არ არის allowlist-ში: ყოველი უცნობი სახელი = 1 DB-მოთხოვნა + `signatures` Map-ის უსაზღვრო ზრდა (ანონიმურ ტოკენს ყველა იღებს უფასოდ); body-ის ლიმიტი მოწმდება წაკითხვის შემდეგ (`:131`) | ციკლი `rpc/x<N>` | `Set` საჯარო RPC-ებისა → 404 ბაზის გარეშე; `content-length` წინასწარ; უარყოფითი შედეგი არ ქეშდეს |
| 8 | P2 | `market-client.ts:26` + `market-store.js:270` | ყოველი კატალოგის ვიზიტი ორჯერ იტვირთება: Header ქმნის singleton-ს (load #1), გვერდის კომპონენტი `existing && initial` → `refresh()` (load #2): `requests`, `list_companies`, `company_stats`, `offer_counts`, `profiles` ×2 (+`offers`, `my_profile`, `engagement_state`, `contact_for_request` ×2 შესულს) | DevTools Network `/requests/` (სტუმარი: 10 გამოძახება 5-ის ნაცვლად) | გამოტოვე `refresh()`, თუ `running` ან ბოლო load < ~5 წმ; ან მხოლოდ მაშინ, თუ snapshot ახალია |
| 9 | P2 | `chat-client.ts:104,111` | ღია ჩატი ყოველ 5 წმ-ში იძახებს `mark_read`-ს (ჩაწერა + `for update` საუბარზე) ახალი შეტყობინების გარეშეც: ~2 tx / 5 წმ / ჩატი; `useUnreadMessageCount`+`useConversationList` ცალ-ცალკე 60 წმ-იანი polling (`unread` ×2–4 გვერდზე) | გახსენი ჩატი, Network | `markRead` მხოლოდ თუ `incoming` შეიცავს მეორე მხარის შეტყობინებას ან `conversation.unreadCount>0`; unread/list ერთ ბუნებაში |
| 10 | P2 | `public-snapshot.js:47-60` | SSR cache-miss (ყოველ 30 წმ-ში) სინქრონული: `/requests/` 11.7 → 4.5 წმ, `/companies/` ტლ-ის შემდეგ 5.2 წმ (ლოკალურად; Vercel-ზე იმავე რეგიონში ნაკლები, **არ გამომიცდია**) | `curl -w %{time_total}` 31 წმ-ის შემდეგ | stale-while-revalidate: ძველი snapshot მაშინვე, განახლება ფონზე; 5 შეკითხვა ერთ tx-ში |
| 11 | P2 (prod-gate) | `market-store.js:64` | `authUrl` (auth-probe-ის ჰოსტი) ჩაწერილია კლიენტის ბანდლში | — | `NEXT_PUBLIC_NEON_AUTH_URL` env (prod-ის მნიშვნელობა deploy-ზე; ეს T6.x-ია — არ შეეხოს ახლა) |
| 12 | P2 | `db-handler.js:14-21` | `SNAPSHOT_READS` ინვერსიულია (სია „არ-ინვალიდაციისა“): `list_saved_companies`, `request_alert_preferences`, `mark_notification_read`, `set_saved_company`, `set_notification_email`, `set_request_alert_preferences` წარმატებისას ასუფთავებს საჯარო SSR cache-ს — ნებისმიერი ავტორიზებული მომხმარებელი ცივი cache-ის (#10) გამომწვევია | ანგარიში → „შენახული“ ჩანართი | გადააბრუნე: სია იმ RPC-ებისა, რომლებიც ცვლის საჯარო მონაცემს (`create/update/close/extend/delete_request`, `send_offer`, `withdraw/choose_offer`, `update_my_profile`, `complete_profile`, `admin_*`) |
| 13 | P2 | `market-store.js:167,266` | `refreshEngagement` და `refresh` შეცდომას ჩუმად ყლაპავს: მუტაციის შემდეგ 500-ის დროს UI ძველ მონაცემს აჩვენებს შეტყობინების გარეშე | ჩააგდე `/api/db` 500 ერთხელ (DevTools block) | `refresh` შეცდომაზე `toast`/`isStale` ალამი, რომ `mutate`-ის შემდეგ დარჩეს ხილული |
| 14 | P3 | `schema.sql:1783` (`start_conversation`) | ლიმიტის გარეშე: ნებისმიერ კომპანიას შეუძლია ნებისმიერ ღია მოთხოვნაზე საუბარი გახსნოს, კლიენტს — ნებისმიერ კომპანიასთან; `list_my_conversations` მეორე მხარეს ცარიელ საუბარს აჩვენებს (მაგ. ტესტმა ერთი დატოვა) | `start_conversation` ×N | `list_my_conversations`-ში დამალე საუბარი `last_message_at is null`, თუ `me` არ არის შემქმნელი; ან დღიური ლიმიტი |
| 15 | P3 | `db-handler.js:116` | `?path=` query-პარამეტრი გადაფარავს URL-ის გზას (`/api/db/requests?path=profiles` → profiles); უსაფრთხოა (RLS/grants), მაგრამ გაუგებარია | ❌ #109 | წაშალე `searchParams.get('path')` (თუ catch-all route არ საჭიროებს) |
| 16 | P3 | `phones.ts:26`, `RequestViewPageContent.tsx:160`, `Inbox.tsx:113`, `CompanyProfilePageContent.tsx:39` | `usePublicPhone` ცალკე `/profiles?select=id,phone` (~1 წმ), თუმცა store-ის `cache.profiles[id].phone` უკვე შეიცავს ტელეფონს (`PUBLIC_PROFILE`); ტელეფონი გვიან ჩნდება | request/inbox გვერდი | `store.userById(id)?.phone ?? fetch` |
| 17 | P3 | `app/(request-view)/requests/view/page.tsx` | დეტალის გვერდს SSR snapshot არ აქვს (ბმულით გაზიარებისას პირველი ხატვა token → ensureRequest → profiles ჯაჭვის შემდეგ; OG/SEO არა) | გახსენი ბმული ცივი სესიით | snapshot-იდან ჩასათესი ან `generateMetadata` |
| 18 | P3 | `RequestsPageContent.tsx:165-167`, `tier-demo.ts` | „PROTOTYPE ONLY“ სათაურით-ბმული VIP/TOP ტიერები production კოდშია (T9.6 გადაწყვეტილებამდე) | `/requests/` | ან ბაზის ველი, ან ამოღება |
| 19 | P3 | მკვდარი კოდი | იხ. ქვემოთ | — | წაშლა/არქივი |
| 20 | P3 | `public/`, `app/` | არ არის `sitemap.xml`, `robots.txt` (404) | `curl /sitemap.xml` | `app/sitemap.ts`, `robots.ts` |
| 21 | P3 | `qa/*.mjs` | ძველი სცენარები ვერ ეშვება: `browser.mjs` (`#city-desktop`), `discovery.mjs` (`main article`), `contact.mjs` (`.listing-heading h3 a`) — სელექტორები მოძველდა; `resilience`, `request-detail` — ჩაწერილია `:3000` | გაუშვი | განახლება ახალ DOM-ზე ან `qa/_unused/` |

## უფლებების შემოწმებები (`node qa/audit-perms.mjs`, ბოლო გაშვება 107/109)

| შემოწმება | მოსალოდნელი | რეალური | |
|---|---|---|---|
| ანონიმი `profiles?select=*` / `email`; კლიენტი `select=email` | 401 / 401 / 403 | 401 42501 / 401 / 403 | ✅ |
| ანონიმი `profiles?select=id,phone,role` (საჯარო ტელეფონი) | 200 | 200 | ✅ |
| ანონიმი `offers`; PATCH/PUT/DELETE/POST `profiles`, POST `requests` | 401; 405 | 401; 405 | ✅ |
| კლიენტი A `offers` — მხოლოდ საკუთარ მოთხოვნებზე; კომპანია — მხოლოდ საკუთარი | ✅ | 10 / 6 ჩანაწერი, უცხო არ ჩანს | ✅ |
| უცხო შეთავაზება id-ით (A, C1) | `[]` | `[]` | ✅ |
| A → B-ის მოთხოვნაზე `update/close/extend/delete_request`; კომპანია `delete_request` | MA107 | 400 MA107 | ✅ |
| ანონიმი `close/extend/delete_request`, `send_offer`, `choose/withdraw_offer` | 401/MA001 | 400 MA001 | ✅ |
| კლიენტი `send_offer`; მფლობელი საკუთარზე | MA201 | 400 MA201 | ✅ |
| „შეთანხმებით“ + ფასი | MA211 | 400 MA211 | ✅ |
| C2 / A ხედავს C1-ის შეთავაზებას B-ის მოთხოვნაზე (დალუქული) | `[]` | `[]`; მფლობელი B ხედავს 1 | ✅ |
| A, C2, ანონიმი: `choose_offer`, `withdraw_offer` სხვისზე | უარი | 400 MA206 / MA001 | ✅ |
| `contact_for_request` არჩევამდე (A, C2, ანონიმი) | ცარიელი | `[]` | ✅ |
| `update_my_profile` უცხო `p_id`, `p_role` | 404 (უცნობი არგ.) | 404 PGRST202 | ✅ |
| `complete_profile(p_role='admin')` არსებულზე | როლი უცვლელი | `client` | ✅ |
| ადმინ-RPC (`admin_set_blocked/_hidden/_verified`, `admin_delete_request`, `admin_list_users`, `admin_stats`, `admin_contact_*`, `admin_list_conversations`, `admin_conversation_messages`, `admin_message_stats`) — ანონიმი / კლიენტი / კომპანია | 401 / MA003 | 401 42501 / 400 MA003 / 400 MA003 | ✅ |
| `admin_search_users/_requests`, `admin_list_audit` | MA003 | 404 PGRST202 (არ არსებობს, #3) | ✅* |
| უცხო საუბარი: C2, B, ანონიმი — `list_messages`, `send_message`, `mark_read` | MA501 / 401 | 400 MA501 / 401 | ✅ |
| `list_my_conversations` უცხოს არ შეიცავს | არ შეიცავს | არ შეიცავს | ✅ |
| `start_conversation` კლიენტთან; A → B-ის მოთხოვნაზე | MA502; MA504 | 400 MA502; 400 MA504 | ✅ |
| `send_message` უცნობ საუბარში; 2001 სიმბოლო | MA501; MA505 | 400 MA501; 400 MA505 | ✅ |
| `log_contact_event` უცნობი/კლიენტი-სამიზნე/ცუდი kind/source-ის შეუსაბამობა/ყალბი request; `p_actor_id` | 400; 404 | 400 22023 ×5; 404 | ✅ |
| `create_request` `photo_url`: უცხო დომენი, `javascript:`, სხვისი uuid, `http://localhost` | MA109 | 400 MA109 ×4 | ✅ |
| `set_saved_company` ანონიმი; კლიენტის დამახსოვრება | 401; MA302 | 401; MA302 | ✅ |
| `rpc/pg_sleep, set_config, to_json, version, meetany_private.uid` | 404 | 404 PGRST202 | ✅ |
| `create_request` `{}` (არასრული არგუმენტები) | 4xx | **500 MA999** | ❌ (#6) |
| `update_request` არასწორი uuid | 400 | 400 22P02 | ✅ |
| `select=id;drop…`, `order=…;select`, `limit=-1/abc`, უცნობი ფილტრი, უცნობი ცხრილი | 4xx | 400 PGRST100 / 404 PGRST205 | ✅ |
| `requests?path=profiles` | `path` უგულებელყოფა | 401 (გადაფარა, #15) | ❌ (დაკვირვება) |
| JWT სხვა `sub`-ით; `alg=none`; ნაგავი | 401 | 401 PGRST301 | ✅ |
| `/api/blob-upload`: ანონიმი POST/DELETE; უცხო uuid-ის გზა; უცხო ფოტოს წაშლა | 401 / 403 | 401 / 403 / 403 | ✅ |
| შესვლის brute force (უცნობი ელფოსტა ×8) | ლიმიტი | 401 ×7 → **429** (Neon Auth; ორჯერ დადასტურდა) | ✅ |

\* უფლება დაცულია (ფუნქცია არ არსებობს), მაგრამ ფუნქცია უნდა არსებობდეს — იხ. #3.

## route → კომპონენტი → store → endpoint → ცხრილი

| გვერდი | კომპონენტი | store მეთოდი | endpoint / RPC | ცხრილი |
|---|---|---|---|---|
| `/` | `HomeLive`, `DiscoverySearch` (`home-data.ts` — ტექსტი კოდში) | — (ძიება → `/requests/`, `/companies/`) | — | — |
| `/requests/` | `RequestsPageContent`, `RequestRow`, `CatalogSearch`, `FacetList`, `MobileFilterSheet` | `listRequests`, `offerCount`; SSR `loadPublicSnapshot` | GET `requests`; `list_companies`, `company_stats`, `offer_counts`; GET `profiles` | requests, profiles, offers |
| `/requests/new/` | `RequestFormSheet`, `PhotoField` | `createRequest` (+ `uploadPhoto`) | `rpc/create_request`; POST/DELETE `/api/blob-upload` | requests, Vercel Blob |
| `/requests/view/?id=` | `RequestViewPageContent`, `OfferCard`, `ChooseOfferSheet`, `ChatPopup` | `ensureRequest`, `visibleOffers`, `sendOffer`, `withdrawOffer`, `chooseOffer`, `closeRequest`, `extendRequest`, `deleteRequest`, `contactFor`, `startConversation`… | GET `requests`, `offers`, `profiles`; `offer_counts`, `contact_for_request`, `send_offer`, `withdraw_offer`, `choose_offer`, `close/extend/delete_request`, `log_contact_event` | requests, offers, profiles, contact_events |
| `/companies/` | `CompaniesPageContent`, `CompanyListingCard`, `CallButton`, `SaveCompanyButton` | `listCompanies`, `companyStats`, `setSavedCompany`, `logContactEvent` | `list_companies`, `company_stats`, `set_saved_company`, `log_contact_event` | profiles, saved_companies, contact_events |
| `/companies/view/?id=` | `CompanyProfilePageContent` | `getCompany`, `directionsUrl`, `startConversation` | იგივე + `start_conversation`; GET `profiles` (`usePublicPhone`) | profiles, conversations |
| `/account/` | `AccountPageContent`, `AuthForms` | `register`, `login`, `verifyEmailCode`, `resendCode`, `requestPasswordReset`, `resetPassword`, `logout`, `updateProfile`, `listRequests`, `myOffers` | Neon Auth (`/sign-in/email`, `/sign-up/email`, `/email-otp/*`, `/get-session`, `/token`); `complete_profile`, `my_profile`, `update_my_profile` | neon_auth.user, profiles |
| `/account/?tab=saved` | `EngagementPanels`, `SaveCompanyButton` | `refreshEngagement`, `listSavedCompanies`, `setSavedCompany` | `capabilities`, `engagement_state`, `list_saved_companies`, `set_saved_company` | saved_companies |
| `/account/?tab=messages` | `Inbox`, `ChatPopup` (`chat-client.ts`) | `listConversations`, `listMessages`, `sendMessage`, `markRead`, `unreadMessageCount` | `list_my_conversations`, `list_messages`, `send_message`, `mark_read`, `unread_message_count` | conversations, messages |
| `/account/?tab=profile` (+`notifications`) | `RequestAlertSettings`, `EngagementPanels` | `setRequestAlertPreferences`, `setNotificationEmail`, `markNotificationRead` | `request_alert_preferences`, `set_request_alert_preferences`, `list_notifications`, `set_notification_email`, `mark_notification_read` | notifications, notification_preferences, request_alert_* |
| `/admin/` (requests/users/audit/contacts) | `AdminPageContent`, `AdminContacts`, `AdminAuditTable`, `ModerationSheet` | `stats`, `allUsers`, `adminSetHidden/DeleteRequest/SetBlocked/SetVerified`, `adminSearch*`, `adminListAudit`, `adminContact*`, `adminMessageStats` | `admin_stats`, `admin_list_users`, `admin_set_*`, `admin_delete_request`, `admin_contact_events/stats`, `admin_message_stats` (`admin_search_*`, `admin_list_audit` — **404**) | profiles, requests, moderation_audit, contact_events |
| `/terms/` | სტატიკური | — | — | — |

ყველა ჰედერის/ფუტერის/ბარათის შიდა ბმული (`/requests/`, `/requests/new/`, `/requests/view/`, `/companies/`, `/companies/view/`, `/account/?tab=…`, `/admin/?tab=…`, `/terms/`) არსებულ route-ზე მიდის; `href="#"` და ცარიელი `onClick` არ არის. არასწორი `?id=` სწორად აჩვენებს „ვერ მოიძებნა“-ს. TODO/FIXME კოდში: 0.

## მკვდარი კოდი

- **კომპონენტები, არსად იმპორტირდება:** `market/CompanyRow.tsx`, `market/DirectionPhotoCard.tsx`, `market/MobileActionBar.tsx`, `market/PartnershipCTA.tsx`, `market/SectionHead.tsx`.
- **store-ის ექსპორტები, გარეთ არ გამოიყენება:** `QUANTITY_MAX`, `DELIVERY_DAYS_MAX`, `REQUEST_DAYS`, `PASSWORD_MIN`, `UNAVAILABLE_MESSAGE`, `CHECK_EMAIL_MESSAGE`, `normalizePhone` (`market-store.js:732`).
- **კოდში ჩაწერილი მონაცემი:** `tier-demo.ts` (სათაურით VIP/TOP), `home-data.ts` (მთავარის ტექსტები — მთავარი დამტკიცებულია, არ შეეხოს), `market-store.js` `categories/cities/units` (სიები ბაზასთან უნდა ემთხვეოდეს `meetany_private.categories()/cities()`-ს — ორი წყარო).
- **ტელეფონი/ელფოსტა/id კოდში:** არ არის (მხოლოდ `tel:` ბმულის შაბლონი).
- **ძველი `qa/*.mjs`:** იხ. #21; `lint` — 25 warning (`no-unused-vars` qa-სკრიპტებში).

## ნელი მოთხოვნები

| რა | დრო | შენიშვნა |
|---|---|---|
| ერთი `/api/db` გამოძახება (curl, ანონიმი) | 0.9–2.0 წმ | ~5 ბაზისკენ RT/გამოძახება; `capabilities` 0.9–1.1 წმ |
| 10 პარალელური `rpc/list_companies` | 1.0 → 3.8 წმ (გამოძახებებით იზრდება) | pool `max:5`, თითო ტრანზაქცია სერიული |
| SSR `/requests/`, cache-miss | 4.5–11.7 წმ; hit 0.12 წმ | TTL 30 წმ (#10) |
| SSR `/companies/` ტლ-ის შემდეგ | 5.2 წმ | — |
| გვერდის ჩატვირთვა Playwright-ით (dev, `networkidle`) | 6–27 წმ | dev-კომპილაცია + ჩატვირთული მანქანა + #8; ერთეული API-გამოძახება ბრაუზერში 1 წმ-ს არ აღემატებოდა |
| N+1 | ნამდვილი N+1 არ არის (`chunks(500/100)`-ით ჯგუფდება); დუბლირება: #8, `usePublicPhone` (#16), `unread_message_count` ×2–4 | polling: unread/list 60 წმ, ღია ჩატი 5 წმ (+`mark_read`, #9) |

## ტესტები

| რა | შედეგი |
|---|---|
| `db/tests/run.sh` (ლოკალური Postgres, throwaway ბაზა; auth-probe არ ეხება) | ✅ 367+67+72+145+77+39+34+164 (=965) + 135 messaging (=1100) + 32 address — ყველა გავიდა |
| `qa/notification-worker.mjs` | ✅ |
| `qa/audit-perms.mjs` (ახალი) | 107/109 (#6, #15) |
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | 0 error, 25 warning |
| `qa/browser.mjs`, `discovery.mjs`, `contact.mjs` | ❌ მოძველებული სელექტორები (#21) |
| `qa/resilience.mjs`, `request-detail.mjs` | ❌ `:3000` ჩაწერილი (#21) |
| `qa/engagement.mjs`, `address.mjs`, `archive/scripts/accounts.mjs`, `saved-live.mjs`, `request-alerts-live.mjs`, `admin-*.mjs` | არ გამიშვია (წერენ ბაზაში/პროფილებში); `qa/e2e/*` — სხვა ნაკადის |
