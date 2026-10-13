# ბაზის გასუფთავება — 2026-10-14

გასაშვები სკრიპტი: `db/maintenance/20261014-cleanup.sql`. ეს maintenance ოპერაციაა; მიგრაციების ჯაჭვი არ შეცვლილა. ცოცხალ ბაზაზე არ გაშვებულა.

წყარო: `meetany_live_snapshot_20261014` (მხოლოდ READ ONLY ინვენტარი); საცდელი ბაზა: `meetany_preview_p7_dbclean`. საწყისი რაოდენობები: 42 მოთხოვნა, 56 პროფილი, 90 შეთავაზება, 143 public / 58 private ფუნქცია. `inventory.sql` → `inventory.json`; დამატებითი ინვენტარი: `relations.sql/json`, `markers.sql/json`, `counts.sql`.

## შედეგი და უსაფრთხოების საზღვრები

პირველი გაშვება: 25 დაბლოკილი, დაუსრულებელი e2e პროფილი + 1 რეგისტრაციის სესია + მისი 4 მოვლენა + 1 ანონიმური ობოლი contact event წაიშალა. მეორე გაშვება: ოთხივე DELETE კატეგორიაში **0**, დარჩენილი მიზნობრივი პროფილები/ანონიმური ობოლი **0**. შედეგებია `run-1.log` და `run-2.log`.

სკრიპტი იყენებს `begin/commit`, `lock_timeout=5s`, `statement_timeout=60s`, ზუსტ UUID+email წყვილებს და ledger-ის 22 UUID-ის ცხად `NOT IN` სიას. სტატუსი უნდა იყოს blocked და onboarding დაუსრულებელი. შეცვლილი პროფილის ან ახალი ბიზნესკავშირის აღმოჩენა აჩერებს ტრანზაქციას. სამიზნე პროფილები იკეტება `FOR UPDATE`-ით, FK-ები და ტრიგერები ჩართული რჩება. ბოლო SELECT-ები აჩვენებს წაშლილ/დარჩენილ რაოდენობებს. გაუთვალისწინებელი დამოკიდებულებისას ახალი ინვენტარია საჭირო; `CASCADE` DDL არ გამოიყენება.

წაშლის რიგი: `registration_events` → `registration_sessions` → `profiles` → დამოუკიდებელი `contact_events`. FK წესები შენახულია `inventory.json.foreign_keys`-ში; ძირითადი ცხრილები და შვილები გადამოწმებულია `psql \d`-ით. კანდიდატებს სხვა mutable ცხრილებში UUID კავშირები არ აქვთ (`relations.json`, `references:*`). ამიტომ offers/deals/messages/reviews/saved/alerts/attachments/drafts/reports-ის კასკადური წაშლა საჭირო არ გახდა.

37 ცხრილზე დარჩენილი ჩანაწერების დალაგებული JSON-ის MD5 შედარება სნეპშოტსა და ასლს შორის იდენტურია (`preservation.json`, `verify-preservation.py`). ეს ამოწმებს შიგთავსსაც და არა მხოლოდ რაოდენობას. `list_companies()`-ის 10 UUID უცვლელია (`catalog-before.txt`, `catalog-after.txt`).

## კატეგორიები

| კატეგორია | აღმოჩენილი | წაშლილი | მიზეზი / დატოვების საფუძველი |
|---|---:|---:|---|
| public ფუნქციები | 143 | 0 | ყველა ზუსტი ხელმოწერა სქემაში ან მიგრაციებშია განსაზღვრული |
| private ფუნქციები | 58 | 0 | იგივე; მხოლოდ სახელით შედარება არ გამოყენებულა |
| ცხრილები / სვეტები | 37 / 322 | 0 / 0 | კოდში/DDL-ში მოხსენიებულია; 100%-ით მკვდარი შენახვის ობიექტი არ დასტურდება |
| მარკერიანი მოთხოვნები | 0 | 0 | `^\[` და `[e2e]`/`[qa]`/`[QA-…]`/`[strict-qa]`/`[ux-audit]`/`[gap-audit]` ძიება |
| მარკერიანი შეთავაზებები | 0 | 0 | შეთავაზებას სათაური არ აქვს; შემოწმებულია body |
| e2e პროფილები | 25 | 25 | `e2e+<timestamp>-…@meetany.local`, blocked, onboarding_completed_at IS NULL, ledger-ის გარეთ |
| მათი რეგისტრაციის სესიები / მოვლენები | 1 / 4 | 1 / 4 | ზუსტი session UUID და მხოლოდ სამიზნე პროფილის კავშირი |
| სხვა ბიზნესკავშირები | 0 | 0 | ყველა mutable UUID სვეტის ინვენტარი; აუდიტები ცალკე დაცულია |
| ობოლი contact_events | 4 | 1 | 1 ანონიმური; 3 ledger-ის ანგარიშის მონაცემია და დარჩა |
| ობოლი notifications / attachments / request_drafts / conversations | 0 / 0 / 0 / 0 | 0 | FK-ებისა და პოლიმორფული target-ის შემოწმება |
| request_drafts | 2 | 0 | expiry სვეტი/TTL არ აქვს; ორივე ledger-ისაა |
| file_uploads | 1 | 0 | ledger-ის მომხმარებლის დასრულებული upload; მისი attachment არსებობს |
| general conversations (request_id IS NULL) | 12 | 0 | მოქმედი ზოგადი ჩატებია და ობოლ მოთხოვნებად არ ითვლება |
| moderation_audit / business_audit | 132 / 7 | 0 | უცვლელი ჟურნალები; არ წაიშალა და ტრიგერი არ გათიშულა |
| ledger / სადემო კომპანიები | 22 / 10 | 0 | დაცულია ანგარიშები და მათი მონაცემები; ვიტრინის 42 მოთხოვნაც უცვლელია |

`20261013-request-drafts.sql` მხოლოდ updated_at-ს ინახავს; არ ადგენს ვადის გასვლას. თვითნებური 1/7/30-დღიანი TTL არ შემოგვიტანია. `file_uploads`-ის მოქმედ კოდში 1-დღიანი ვადა არსებობს, თუმცა ერთადერთი upload ledger-ის ანგარიშისაა და დაცვის წესი პრიორიტეტულია. `request_draft`/`offer_draft` attachment-ის UUID დამოუკიდებელი draft token შეიძლება იყოს, ამიტომ არ ჩაითვალა ავტომატურად არარსებულ request-ად.

## ფუნქციებისა და შენახვის ინვენტარის მეთოდი

`pg_proc`-დან აღებულია `pg_get_function_identity_arguments`, `oidvectortypes`, სრული ფუნქციის განმარტება და `pg_depend` დამოკიდებულებები. კატალოგი შედარებულია `db/schema.sql` + ყველა `db/migrations/*.sql`-ის CREATE FUNCTION ხელმოწერებთან (DEFAULT არგუმენტები არ ცვლის იდენტობას; public composite ტიპებისა და int/bool/timestamptz alias-ები ნორმალიზებულია). `analyze.py` → `function-analysis.json` თითო ხელმოწერის წყაროსა და `web/app`-ის გამოძახების/იდენტიფიკატორის ფაილებს ინახავს, მათ შორის `market-store.js`, `*-client.ts`, bootstrap/snapshot/server API.

`db-handler.js` RPCS-ში 130 სახელი: ყველა სნეპშოტში არსებობს (`rpc-allowlist-analysis.json`). გადასამოწმებელი მკვდარი RPC გამოძახება არ აღმოჩნდა. ძველი მიგრაციის მიერ განსაზღვრული, დღეს კლიენტიდან გამოუძახებელი API თავისთავად წაშლის საფუძველი არ არის. `pg_depend` მარტო PL/pgSQL ტექსტურ გამოძახებებს სრულად ვერ ხედავს; ამიტომ ფუნქციების ტექსტიც შენახულია და არასრული dependency ინფორმაციის საფუძველზე არაფერი წაშლილა. ტრიგერები/policy-ები ცალკეა `inventory.json`-ში. `DROP FUNCTION` კანდიდატი 0-ია და სკრიპტში DROP არ არის.

მაგალითად დარჩა `public.list_companies()`, `public.contact_for_request(uuid)`, `meetany_private.own_request(uuid, profiles)`, `meetany_private.default_request_alert_preferences(profiles)`, `meetany_private.request_state(requests)` — ყველა ზუსტი ტიპებით არის წყაროებში. დარჩა `request_drafts`, `file_uploads`, `company_products`, `reports`, `site_design`, მათ შორის ცარიელი ცხრილებიც: ცარიელი არ ნიშნავს მკვდარს. 322 სვეტისთვის წყაროში იდენტიფიკატორის არსებობა და მაგალითის წყარო დაფიქსირებულია `storage-analysis.json`-ში; ეს კონსერვატიული დატოვების მტკიცებულებაა და არა სემანტიკური წაშლის ავტორიზაცია.

## მაგალითები

წაშლილი პროფილების მაგალითები (სრული 25-ეული SQL-ში და `relations.json.candidates`-ში):

- `a1b3d831-b513-4d96-a4ff-b7cdf19d8f17` — `e2e+1791543795353-client-0@meetany.local` — QA რეგისტრაცია.
- `2314ad31-cddf-4f03-9444-b89338856f12` — `e2e+1791544041565-company-2@meetany.local` — QA 1791544041565.
- `00f283bd-8a4c-4047-ab57-e0908507445d` — `e2e+1790276755145-registration-company@meetany.local` — მიწოდების ჯგუფი [e2e:1790276755145-registration].
- `d578e0f4-547d-48f3-a5ae-e6aabef917b5` — `e2e+1790677953780-password-client@meetany.local` — მიწოდების ჯგუფი [e2e:1790677953780-password].
- `ab660790-4da9-4ac9-8cea-3e3ffacc59c6` — `e2e+1791543795353-client-1@meetany.local` — QA რეგისტრაცია.

წაშლილი რეგისტრაციის session: `21ead4e8-2b34-499c-ac7f-4dff3daab339`; მოვლენები:

- `1a6306fc-c5e1-49d4-a2e1-c7572315bf94` — `form_open`.
- `1f213d07-2b72-4690-916b-435b0c1a3134` — `form_started`.
- `8198ff67-aefa-4ebb-a662-c9fb6fbd5d30` — `form_submitted`.
- `b15063c7-9f86-4180-af93-df50fe6c182d` — `profile_created`.

ობოლი contact_events-ის ოთხივე მაგალითი:

- `e7211d40-a381-479c-b997-1e186b84234d` → არარსებული request `58caa46e-d4e4-4fd2-a743-1c6a6df11786`; დარჩა (ledger actor `bacf1572-7493-4ac9-bfc7-95719e911c4c`).
- `3ddffef7-4040-4e58-b7a7-a06b1455ed87` → არარსებული request `a59b4fe6-c9ff-4fc7-a8d9-a6e7bd980bb0`; დარჩა (ledger actor `bacf1572-7493-4ac9-bfc7-95719e911c4c`).
- `7946c958-443d-496f-aeca-f15498e2d07d` → არარსებული request `a96618c0-5ab5-41a5-8ecf-718aea3df71f`; წაიშალა (ანონიმური).
- `c5f757b4-88ea-4e0d-9115-741cad11c3d1` → არარსებული request `c2fe18aa-bad4-48c9-a969-6b83c5145815`; დარჩა (ledger actor `bacf1572-7493-4ac9-bfc7-95719e911c4c`).

დაცული მაგალითები: მოთხოვნები `427e5d7d-fb9d-4de9-aa00-e05b8b7c8cfa` — „100 კომპლექტი მაგიდა-სკამი“, `1cb43d7c-90cf-4b0e-af2e-72cbe348f214` — „ტესტრექ“, `3c6c7198-9e2c-4950-9dfb-f32a1545ec26` — „ტესტა“; კომპანიები `74cc28fc-47de-45cb-9563-93735b86855e` — „ხის ხაზი“, `3d12ff1f-0d72-4a53-a92f-1830cfd5b290` — „რბილი სივრცე“. სახელში „ტესტ“-ის არსებობა არ გამოიყენება წაშლის ზოგად ფილტრად. აუდიტის ანგარიშები (`audit-…@example.com`) დარჩა: მოცემული ზუსტი მარკერებით მათი წაშლა დასაბუთებული არ არის.

## ყველა ცხრილის before/after

| ცხრილი | მანამდე | შემდეგ | შემცირება |
|---|---:|---:|---:|
| `meetany_private.attachments` | 1 | 1 | 0 |
| `meetany_private.business_audit` | 7 | 7 | 0 |
| `meetany_private.company_business` | 2 | 2 | 0 |
| `meetany_private.company_plans` | 4 | 4 | 0 |
| `meetany_private.company_products` | 5 | 5 | 0 |
| `meetany_private.company_reviews` | 6 | 6 | 0 |
| `meetany_private.contact_events` | 72 | 71 | 1 |
| `meetany_private.conversations` | 24 | 24 | 0 |
| `meetany_private.deal_events` | 42 | 42 | 0 |
| `meetany_private.deal_issues` | 0 | 0 | 0 |
| `meetany_private.deal_proposals` | 0 | 0 | 0 |
| `meetany_private.deal_reviews` | 0 | 0 | 0 |
| `meetany_private.deal_updates` | 0 | 0 | 0 |
| `meetany_private.deals` | 10 | 10 | 0 |
| `meetany_private.file_uploads` | 1 | 1 | 0 |
| `meetany_private.messages` | 39 | 39 | 0 |
| `meetany_private.moderation_audit` | 132 | 132 | 0 |
| `meetany_private.notification_outbox` | 0 | 0 | 0 |
| `meetany_private.notification_preferences` | 0 | 0 | 0 |
| `meetany_private.notifications` | 134 | 134 | 0 |
| `meetany_private.plan_requests` | 2 | 2 | 0 |
| `meetany_private.registration_events` | 33 | 29 | 4 |
| `meetany_private.registration_sessions` | 20 | 19 | 1 |
| `meetany_private.reports` | 0 | 0 | 0 |
| `meetany_private.request_alert_email_items` | 0 | 0 | 0 |
| `meetany_private.request_alert_emails` | 0 | 0 | 0 |
| `meetany_private.request_alert_preferences` | 1 | 1 | 0 |
| `meetany_private.request_drafts` | 2 | 2 | 0 |
| `meetany_private.request_preferences` | 2 | 2 | 0 |
| `meetany_private.saved_companies` | 6 | 6 | 0 |
| `meetany_private.saved_requests` | 0 | 0 | 0 |
| `meetany_private.settings` | 4 | 4 | 0 |
| `meetany_private.site_content` | 0 | 0 | 0 |
| `meetany_private.site_design` | 0 | 0 | 0 |
| `public.offers` | 90 | 90 | 0 |
| `public.profiles` | 56 | 31 | 25 |
| `public.requests` | 42 | 42 | 0 |

## Neon Auth-ში დარჩენილი ანგარიშები

ამ 25 პროფილის შესაბამისი Auth ანგარიში სნეპშოტში ნამდვილად არსებობს. SQL მხოლოდ აპის პროფილებს შლის; Neon Auth-ში ქვემოთ ჩამოთვლილი ანგარიშები დარჩება. პაროლები არ წაკითხულა ანგარიშში/ლოგებში და არ დაკომიტებულა.

- `e2e+1790272582086-registration-client@meetany.local`
- `e2e+1790273123900-registration-client@meetany.local`
- `e2e+1790273123900-registration-company@meetany.local`
- `e2e+1790273772670-registration-client@meetany.local`
- `e2e+1790273772670-registration-company@meetany.local`
- `e2e+1790275301743-registration-client@meetany.local`
- `e2e+1790275301743-registration-company@meetany.local`
- `e2e+1790276755145-registration-client@meetany.local`
- `e2e+1790276755145-registration-company@meetany.local`
- `e2e+1790278824902-registration-client@meetany.local`
- `e2e+1790278824902-registration-company@meetany.local`
- `e2e+1790669700000-registration-client@meetany.local`
- `e2e+1790669700000-registration-company@meetany.local`
- `e2e+1790677953780-password-client@meetany.local`
- `e2e+1790681404609-registration-client@meetany.local`
- `e2e+1790681404609-registration-company@meetany.local`
- `e2e+1790775806890-registration-client@meetany.local`
- `e2e+1790775806890-registration-company@meetany.local`
- `e2e+1790840603000-registration-client@meetany.local`
- `e2e+1790840603000-registration-company@meetany.local`
- `e2e+1790844719213-registration-client@meetany.local`
- `e2e+1790844719213-registration-company@meetany.local`
- `e2e+1791543795353-client-0@meetany.local`
- `e2e+1791543795353-client-1@meetany.local`
- `e2e+1791544041565-company-2@meetany.local`

## შეუძლია თუ არა უკან დაბრუნება

| ცვლილება | უკან დაბრუნება commit-ის შემდეგ | გზა |
|---|---|---|
| 25 პროფილის წაშლა | არა | წინასწარი backup-იდან ზუსტი რიგების აღდგენა |
| 1 სესია / 4 მოვლენა | არა | backup; FK რიგით აღდგენა |
| 1 ობოლი contact event | არა | backup |
| ფუნქციები / ცხრილები / სვეტები | ცვლილება არ არის | აღდგენა არ სჭირდება |
| ledger / სადემო მონაცემები / აუდიტები / Auth | ცვლილება არ არის maintenance SQL-ით | დაცულია |

ტრანზაქციის შეცდომა commit-მდე მთლიანად rollback-დება; წარმატებული commit-ის ავტომატური inverse SQL არ არსებობს. ამიტომ ცოცხალზე გაშვებამდე backup აუცილებელია (მფლობელის ცნობით აღებულია).

## შემოწმება

- `psql -X -v ON_ERROR_STOP=1 -d meetany_preview_p7_dbclean -f db/maintenance/20261014-cleanup.sql` — ორჯერ წარმატებით; მეორე გაშვებაზე DELETE 0.
- `bash db/tests/run.sh` — **2242 SQL assertions passed**, exit 0; საკუთარი throwaway ბაზა ავტომატურად წაიშალა.
- `npx tsc --noEmit` — exit 0.
- `npx eslint app` — exit 0, 0 error, 0 warning.
- `npm run lint:design` — წარმატებით.
- `npm test` — **127 pass, 0 fail**.
- `verify-preservation.py` — **37/37** ცხრილში გადარჩენილი რიგების hash უცვლელია.

ლოკალური გარემო: snapshot-ს აკლდა `pg_session_jwt` და restore-ს ACL-ები. მხოლოდ preview-ზე შესრულდა `db/tests/stub_neon.sql` და `local-preview-grants.sql` — უკანასკნელი აღადგენს უკვე არსებულ, წყაროში განსაზღვრულ schema usage/public read grants-ს და სხვა ბაზაზე გაშვებას კრძალავს. ეს არ შედის ცოცხალზე გასაშვებ cleanup SQL-ში. სტაბისა და მინიმალური ACL-ების გამო UI გატარება production ACL parity-ის ტესტი არ არის; უსაფრთხოების სრული როლები დამოუკიდებელ SQL ტესტების ჯაჭვში მოწმდება.

ბრაუზერი: dev 3710, auth fixture 3720; JWT ლოკალურია და Auth ზარები Playwright-ში ჩანაცვლებულია. არ გამოყენებულა რეალური ანგარიშის login. PNG ფაილები `shots/`-შია და commit-ში არ შედის.

ბრაუზერის შედეგები: 33 გვერდი×ზომა; HTTP 200 — 33; pageerror — 0; local HTTP ≥400 — 0; overflow — 0. `browser.json` შეიცავს გვერდის სათაურსა და main-ის ტექსტის ნიმუშს.

მარშრუტები: მთავარი, `/requests/`, `/companies/`, მოთხოვნის და კომპანიის დეტალი, `/admin/` overview/users/requests/offers/reports/audit. ზომები: 1440, 390, 360. ადმინის განყოფილების გადასვლა მოწმდება რეალური click-ით, მობილურზე switcher-ის გახსნით.

Auth-only ნარჩენები: დამატებით **10** e2e ანგარიში, რომელსაც სნეპშოტში public პროფილი უკვე არ ჰქონდა. ესენიც რჩება Auth-ში (`auth-inventory.sql`, `auth-test-accounts.json`); ჯამში **35** e2e Auth ანგარიში უცვლელია:

- `e2e+1791892985948@meetany.local`
- `e2e+1791896055671@meetany.local`
- `e2e+1791897117043@meetany.local`
- `e2e+1791897243036@meetany.local`
- `e2e+1791897551477@meetany.local`
- `e2e+1791897936004@meetany.local`
- `e2e+1791898427870@meetany.local`
- `e2e+1791899932067@meetany.local`
- `e2e+1791904926341@meetany.local`
- `e2e+1791905313872@meetany.local`

ბრაუზერის საწყისი გაშვების ტექნიკური დაბრკოლება: Next dev-ის `allowedDevOrigins`-მა `127.0.0.1`-ის HMR დაბლოკა და შეფასებების hydration გაჩერდა. საბოლოო სრული გაშვება `http://localhost:3710`-ზე შესრულდა: 33/33 წარმატებით, ადმინის click გადასვლებიც დასრულდა. აპის/Next კონფიგურაცია არ შეცვლილა. ვიზუალურად დათვალიერებულია desktop კომპანიის დეტალი, მთავარი და მობილური მოთხოვნები/კომპანიები/ადმინის მომხმარებლები; screenshots 1440/390/360. გატარების შემდეგ 37/37 ცხრილის hash და რაოდენობები კვლავ უცვლელია.
