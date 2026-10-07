# ახალი ფლოუების მონაცემთა მოდელი — პროექტი, 2026-10-07

**ხუთივე მიგრაცია გამოყენებულია მხოლოდ ლოკალურ preview ბაზაზე. Production-ზე არ არის გამოყენებული. SQL-ის თავდაპირველ სვლაში UI და HTTP API არ შეცვლილა; შემდგომი UI integration აღწერილია დოკუმენტის ბოლოში.**
საფუძველი: `schema.sql`, არსებული მიგრაციები/ტესტები, compare-offers, matching,
ხუთი deal-* და შვიდი onboard-* artboard, `design-system.tsx`-ის საერთო კომპონენტები.
ზუსტი RPC კონტრაქტი დაემატა [CONTRACT.md](CONTRACT.md)-ს.

## ფაილები და რიგი

1. `migrations/20261007-offer-terms.sql`: არსებული price/delivery_days-ის გამოყენება,
   payment_terms/valid_until/commercial_terms, შეთავაზების დამატებითი პირობების RPC,
   მფლობელის შედარების სია და საერთო `flow_fail`.
2. `migrations/20261007-deals.sql`: კერძო deals/deal_events, ეტაპები, ვერსიები,
   ორივე თანხმობა, მყიდველის დასრულება, კერძო შეფასება; engagement შეტყობინებების metadata.
3. `migrations/20261007-contact-visibility.sql`: ტელეფონის საჯარო grant-ის გაუქმება,
   deal-ის კონტაქტი, ძველი contact/log API-ის თავსებადი შეზღუდვა.
4. `migrations/20261007-matching.sql`: ზუსტი კატეგორიები, კატეგორია/ქალაქის ქულა.
5. `migrations/20261007-onboarding.sql`: მხოლოდ ახალი profile ველები და ადმინის
   დოკუმენტების სტატუსი; არსებული იდენტობა/მისამართი/მედია აღარ დუბლირდება.

ტესტები: `tests/offer_terms_tests.sql`, `deals_tests.sql`,
`contact_visibility_tests.sql`, `matching_tests.sql`, `onboarding_tests.sql`;
გამაერთიანებელი: `tests/flows_20261007.sql`.
`web/scripts/apply-migration.mjs` საწყის მდგომარეობაში დაბრუნდა — ახალი ხუთი
ჩანაწერი ამოღებულია. ახალი `web/scripts/apply-migration-local.mjs` არის მხოლოდ ლოკალური გამშვები.
`schema.sql` და `tests/run.sh` არ შეცვლილა, როგორც ამოცანის ფაილების ფარგლები მოითხოვდა.

## მიღებული უსაფრთხო გადაწყვეტილებები

- შეთავაზებაში ფასი კვლავ არასავალდებულოა; შეთანხმებულ პირობებში ფასი აუცილებელია.
  ერთეულის ფასსა და მთლიან ფასს შედარებისას ვარჩევთ. უცნობი რაოდენობა/ფასი არ იღებს
  „საუკეთესო ფასს“. თანაბარი მინიმუმები ყველა იღებს ნიშანს, დღგ-ს არ ვიგონებთ.
- პირობების ყოველი გადახედვა აუქმებს ორივე თანხმობას. revision-ის შემოწმება იცავს
  ძველი ეკრანიდან მოქმედებისგან; მწკრივის საკეტი კონკურენტულ ჩაწერას ასერიალებს.
- შეფასება მხარეებსა და ადმინს უჩანს, არა საჯარო company_reviews-ს. ეს ორი განსხვავებული
  შეფასების მექანიზმია; ახალი შეფასება ძველ საშუალო რეიტინგს არ ცვლის.
- ადმინი ხედავს deal-სა და ორივე კონტაქტს, მათ შორის გაუქმებულზე; ვერ ასრულებს გარიგებას
  მხარის ნაცვლად. მხარეს გაუქმების შემდეგ კონტაქტის API ეკეტება. უკვე ნანახი ნომრის
  დავიწყებას სისტემა ვერ უზრუნველყოფს.
- ტელეფონები/ელფოსტები ბაზაში უცვლელი რჩება; იცვლება წაკითხვის უფლება. პირადი
  `my_profile` და ადმინის არსებული RPC-ები ფუნქციონირებს. public `list_companies`
  ისედაც არ აბრუნებდა ამ ველებს; მთავარი ცვლილებაა raw `/api/db/profiles`.
- ძველი `choose_offer` უცვლელია: ახალი UI იყენებს `select_offer_deal`, რომელიც
  არჩევის არსებულ ტრანზაქციულ ლოგიკას ეყრდნობა. ძველი chosen მოთხოვნები ავტომატურად
  არ კონვერტირდება; მფლობელს მხოლოდ იმავე offer-ის deal-ად გადაყვანა შეუძლია.
- გაუქმების შემდეგ ხელახალი არჩევა არ ხდება; progress-ის გაუქმება არ დავუშვი.
  დასრულება არ ცვლის requests-ის ძველ status-ს: chosen_offer_id უკვე ხურავს მის
  ბიზნეს-მდგომარეობას `request_state`-ში.
- Deal-ის FK-ები RESTRICT/NO ACTION-ია: მოთხოვნის/შეთავაზების/პროფილის წაშლას
  deal-ის არსებობა შეაფერხებს. ეს შეგნებული ისტორიის დაცვაა და ადმინისტრაციულ
  წაშლის ფლოუში გასათვალისწინებელია. ისტორიის cascade-ით დაკარგვა არ ავირჩიე.
- შეტყობინებები იყენებს არსებულ inbox-ს. `offer_chosen` რჩება storage kind-ად,
  მაგრამ ახალ კლიენტში `deal_action` არის ნაჩვენები შინაარსის წყარო. თითო მიმღებთან
  მიმდინარე deal-ის შეტყობინება ერთიანდება; სრული ქრონოლოგია deal_events-ში ინახება.
  ეტაპების email არ იგზავნება — ახალი შაბლონების გარეშე ძველ არჩევის წერილს არ ვიმეორებთ.
- account_intent არის preference და არა ახალი auth role. საწყისი `both` არ ცვლის
  არსებულ უფლებებს. ბაზაში არსებობს free-text offers/seeks და products; ახალი კატეგორიები
  მათ გვერდით ცალკეა და არ ხდება ტექსტიდან კატეგორიის სახიფათო ავტომატური გამოცნობა.
- matching = კატეგორია 70 + ქალაქი/მომსახურების არეალი 30; კატეგორია აუცილებელია.
  ქალაქით ფილტრი დამატებითი არჩევანია. need_categories კერძოა და ჯერ ცალკე feed-ს
  არ ქმნის; supplier feed კონკრეტული მოთხოვნის კატეგორიას იყენებს.
- onboarding-ის employee band-ის ვარიანტები პროექტულია; artboard-ის `8–50` შენარჩუნებულია.
  markets/languages ჯერ მოკლე ტექსტებია, არა ახალი გლობალური taxonomy.
  ჩიპებზე გამოყენებულია არსებული `valid_items` (8 ელემენტი), მიუხედავად artboard-ის
  tags 10-იანი მაჩვენებლისა — ერთიანი არსებული ვალიდაციის სასარგებლოდ.
- დოკუმენტების მხოლოდ საერთო სტატუსია; ფაილის ატვირთვის/შენახვის backend არ არსებობს
  ამ ამოცანაში. თვითდადასტურება აკრძალულია. სტატუსს ადმინი ცვლის და business_audit
  იწერება; `profiles.verified` ცალკე, ძველი approval-ის მექანიზმია.
- იურიდიული იდენტობის ცვლილება დოკუმენტების განხილვას თავიდან მოითხოვს, მაგრამ
  არსებულ `verified`-ს ავტომატურად არ ხსნის. ეს პოლიტიკა მფლობელმა უნდა დაადასტუროს.
- არ დამატებულა შეთავაზების PDF storage, onboard ქავერის ცალკე upload,
  პროდუქტების აქტიურობის ახალი სისტემა ან KYC: ესენი artboard-შია, მაგრამ მოთხოვნილი
  ხუთი მონაცემთა ცვლილების ფარგლებს სცდება. არსებული პროდუქტები/გალერეა რჩება.

## კლიენტისა და API-ის ჩართვის წინაპირობები — SQL სვლის ისტორიული ჩანაწერი

SQL-ის თავდაპირველ ეტაპზე ქვემოთ ჩამოთვლილი ფაილები **არ იყო შეცვლილი**.
ეს არის იმ ეტაპის სამუშაო სია და არა მიმდინარე UI-ის სტატუსი; შემდგომი
განხორციელება აღწერილია ბოლო ნაწილში. სქემის კონსოლიდაცია კვლავ ცალკე ამოცანაა:

- `web/app/lib/market-store.js`: `PUBLIC_PROFILE`-დან `phone` ამოსაღებია;
  public projection-ის ყველა გამოძახება უნდა დარჩეს უსაფრთხო სვეტებზე.
  ძველი projection მიგრაციის შემდეგ მთლიანად 403/permission denied გახდება,
  რადგან PostgreSQL აკრძალულ სვეტს ჩუმად არ ამოაგდებს.
- `web/app/lib/db-handler.js`: ახალი RPC-ების allowlist და MA901–MA906-ის mapping;
  `log_contact_event` public-write სიიდან ამოღება. მხოლოდ SQL-ის grant საკმარისია
  მონაცემის დასაცავად, მაგრამ კლიენტის მოთხოვნებიც უნდა გასწორდეს.
- CallButton/company/request cards: საჯარო ნომერი აღარ უნდა მიიღონ profile cache-დან.
  SupplierContact კითხულობს `get_deal_contact`; ადმინის პასუხი ორივე მხარის მასივია,
  ჩვეულებრივი მხარისთვის — მხოლოდ პარტნიორის. ძველი contact_for_request რჩება
  legacy არჩევებისთვის, გაუქმების გამონაკლისით.
- არჩევა: ახალი endpoint `select_offer_deal`; შეინახოს დაბრუნებული deal.id.
  DealShell იყენებს get_deal-ს; ყველა ცვლილებაზე აგზავნის revision-ს და შემდეგ
  განაახლებს მონაცემებს. MA904 → ხელახალი წაკითხვა და პირობების ხელახალი განხილვა.
- compare-offers იღებს სერვერის total_gel/best_price/fastest-ს; UI ფილტრებმა
  არ უნდა შექმნას სხვა „საუკეთესო“ მნიშვნელობა. ფასი/დღგ/ერთეული ხილული უნდა დარჩეს.
- notifications UI-მ `deal_id/deal_action/deal_revision` უნდა გამოიყენოს
  ლეიბლისა და deal ბმულისთვის; ძველი kind-ის ჩვენება ცვლილებისას მცდარ ტექსტს გამოიტანს.
- onboarding უნდა ინახავდეს კომპანიის intent-ს და ახალ ველებს, გამოიყენოს არსებული
  profile/media/products API-ები, არ მიანიჭოს მომხმარებელს document approval.
  „3/3 დოკუმენტი ატვირთულია“ ვერ გამოჩნდება რეალური private upload backend-ის გარეშე.
- `schema.sql`-ის საბოლოო კონსოლიდაცია ცალკე ეტაპია: ძველი schema ხელახლა რომ
  ჩაიტვირთოს ამ მიგრაციების შემდეგ, phone grant-სა და list_notifications-ის ძველ
  პროექციას დააბრუნებს. ამ პროექტს არ უნდა მოექცნენ როგორც უკვე კონსოლიდირებულ სქემას.

## გადამოწმება — პირველი სვლის ისტორიული ანგარიში

ქვემოთ აღწერილი auth-probe dry-run-ები შესრულდა ლოკალური-only შეზღუდვის მიღებამდე.
ახალი მითითების შემდეგ production-ზე dry-run-იც აკრძალულია; გამშვები აღარ შეცვლილა
და არცერთი შემდგომი კავშირი production-ზე არ განხორციელებულა.

გამშვები თავიდან წავიკითხე: საბოლოო `commit;` იჭრება, SQL იმავე კავშირზე იწყებს
ტრანზაქციას, მოწმდება ობიექტები, `--dry-run` ასრულებს `rollback`-ს; შეცდომის გზაც
rollback-ს აკეთებს. **არცერთი apply/commit არ გაშვებულა auth-probe-ზე.**

| მიგრაცია | auth-probe dry-run |
|---|---|
| offer-terms | PASS — ობიექტები შემოწმდა, rollback |
| deals | PASS — ობიექტები შემოწმდა, rollback |
| contact-visibility | BLOCKED — `42704`, წინაპირობა deals rollback-იან dry-run-ს არ გადაურჩა; შეცდომის შემდეგ rollback |
| matching | PASS — ობიექტები შემოწმდა, rollback |
| onboarding | PASS — ობიექტები შემოწმდა, rollback |

ინდივიდუალური dry-run მხოლოდ DDL/ობიექტების შემოწმებაა და RPC-ების ქცევით ტესტს
არ ნიშნავს. დამოკიდებულების გამო contact-visibility production-ზე არ გამოვიყენე.
სრული ჯაჭვი და მისი RPC-ები ლოკალურ დროებით PostgreSQL ბაზაზე შემოწმდა.

გამოიყენება პროექტის `db/tests/run.sh` უცვლელი ლოგიკა, რომლის დროებით ასლში ბოლოში
ემატება `flows_20261007.sql`. ბაზა თვითონ იქმნება და `trap`-ით იშლება. ყოველი ახალი
მიგრაცია ორჯერ იტვირთება, შემდეგ სრული ჯაჭვი უკვე შევსებულ მონაცემებზეც მეორდება.
რეპროდუქცია პროექტის ძირიდან (მხოლოდ ლოკალური PostgreSQL):

```sh
python3 - <<'PY'
from pathlib import Path
import tempfile, subprocess
root = Path.cwd()
s = (root / 'db/tests/run.sh').read_text()
s = s.replace('HERE="$(cd "$(dirname "$0")" && pwd)"',
              'HERE=' + "'" + str(root / 'db/tests') + "'")
s = s.replace('echo "== tests finished"',
              '"${PSQL[@]}" -f "$HERE/flows_20261007.sql"\necho "== tests finished"')
with tempfile.NamedTemporaryFile(mode='w', suffix='.sh') as f:
    f.write(s)
    f.flush()
    subprocess.run(['bash', f.name], check=True)
PY
```

მხოლოდ ახალ ტესტებამდე არსებული suite: **1,570 assertion PASS**.
ახალი suite: **67 assertion PASS** (არჩევა, sealed comparison, stale revision,
ორმხრივი თანხმობა და reset, ეტაპების აკრძალული ნახტომი, დასრულება, შეფასება,
დაბლოკვა, RLS, admin/partner contact, cancellation, legacy არჩევა, expired offer,
matching, onboarding, audit, populated idempotence).

სცენარებმა გამოავლინა და საბოლოო კოდში გასწორდა: revoke-ის შემდეგ უსაფრთხო column
grant-ების აღდგენა; matching-ში PL/pgSQL ცვლადის/alias-ის კონფლიქტი; ძველი მოთხოვნის
რაოდენობის გარეშე კონვერტაციისას nullable unit-ის CHECK.

## მფლობელის გადასაწყვეტი კითხვები

პროექტი არ ელოდება პასუხებს; ზემოთ ჩამოთვლილი უსაფრთხო ვარიანტები უკვე არჩეულია.
production-ზე ჩართვის პოლიტიკა ცალკე დასადასტურებელია:

1. შეთავაზებაშიც გახდეს ფასი სავალდებულო, თუ მხოლოდ შეთანხმებულ პირობებში დარჩეს?
2. დასრულების შეფასება გახდეს საჯარო და შევიდეს company_reviews/საშუალო რეიტინგში?
3. ადმინმა შეინარჩუნოს ორივე მხარის კონტაქტის წვდომა, მათ შორის cancelled გარიგებაზე?
4. უკვე საჯაროდ ნაჩვენები ტელეფონები ბაზაში უცვლელად შევინახოთ და მხოლოდ ახალი წვდომა შევზღუდოთ?
5. ძველი choose_offer დარჩეს legacy გზად, თუ მომავალ ცალკე მიგრაციაში ყველა არჩევამ ავტომატურად შექმნას deal და ძველი chosen მოთხოვნები backfill-ით გადავიტანოთ?
6. გაუქმებამ გახსნას მოთხოვნა ხელახალი არჩევისთვის, და როგორ დამუშავდეს progress-ის გაუქმება/დავა?
7. deal-ის ისტორიის გამო ადმინისტრაციული hard-delete-ის შეზღუდვა მისაღებია, თუ გვჭირდება anonymization/archive პროცესი?
8. იურიდიული იდენტობის ცვლილებამ დოკუმენტის სტატუსთან ერთად `verified`-ც გააუქმოს?
9. მისაღებია inbox-ში ცვლილებების გაერთიანება, თუ საჭიროა თითოეული ეტაპის ცალკე შეტყობინება და email?
10. დოკუმენტების ინდივიდუალური ატვირთვა/სტატუსები, 10-ელემენტიანი tags და პროდუქტის აქტიურობა რომელ მომდევნო ეტაპში დაემატოს?


## ლოკალური-only გამშვები და გამოყენება — განახლება 2026-10-07

მფლობელის ახალი მითითებით ხუთივე მიგრაცია ლოკალურ preview ბაზაზე შემოწმდა და
გამოყენებულია. არსებული production გამშვები დაუბრუნდა საწყის მდგომარეობას.
ახალი გამშვები `web/scripts/apply-migration-local.mjs`:

- კითხულობს მხოლოდ `MEETANY_LOCAL_DATABASE_URL`-ს; `.env.local` სკრიპტის შიგნით იტვირთება.
  წინასწარ მოცემულ იმავე environment ცვლადს პრიორიტეტი აქვს. `DATABASE_URL` არ გამოიყენება.
- მხოლოდ `postgres/postgresql` URL, host `localhost/127.0.0.1/::1`; სხვა host-ზე exit 1.
  URL query/hash უარყოფილია, რათა `?host=...`-მა შემოწმება ვერ აუაროს. `localhost`
  პირდაპირ 127.0.0.1-ად გადაიცემა; pg იღებს explicit host/port/user/database-ს.
- დამატებით ამოწმებს PostgreSQL-ის `host(inet_server_addr())` loopback მისამართს.
- კავშირის დეტალებს, პაროლებსა და exception ტექსტს არ ბეჭდავს; მხოლოდ ფიქსირებულ
  ნაბიჯს, შედეგსა და უსაფრთხო error code-ს.
- `all` არის ნაგულისხმევი: ხუთივე SQL სრულდება ზემოთ განსაზღვრული რიგით **ერთ**
  ტრანზაქციაში. ფაილების BEGIN/COMMIT wrappers იჭრება მხოლოდ ზუსტი ფორმატის შემოწმების შემდეგ.
  ასე contact-visibility ხედავს იმავე dry-run-ის deals-საც.
- `--dry-run` ბოლოს ასრულებს ROLLBACK-ს; ჩვეულებრივი გაშვება — COMMIT-ს.
  ნებისმიერი ჩავარდნა მთელ ჯგუფს აბრუნებს. შედეგები იბეჭდება მხოლოდ ტრანზაქციის დასრულების შემდეგ.
- თითო ფაილზე მოწმდება routine-ის სრული სიგნატურები და ცხრილები; კონტაქტზე —
  phone/email-ის წვდომის გაუქმება და company-ის უსაფრთხო საჯარო წაკითხვა.
- ცალკე სახელის გადაცემაც შეიძლება, მაგრამ მისი დამოკიდებულებები ბაზაში უკვე უნდა არსებობდეს.

პროექტის ძირიდან:

```sh
node web/scripts/apply-migration-local.mjs all --dry-run
node web/scripts/apply-migration-local.mjs all
```

| მიგრაცია | ლოკალური dry-run | ლოკალური apply |
|---|---|---|
| offer-terms | ok, rolled back | ok, committed |
| deals | ok, rolled back | ok, committed |
| contact-visibility | ok, rolled back | ok, committed |
| matching | ok, rolled back | ok, committed |
| onboarding | ok, rolled back | ok, committed |

Dry-run-ის შემდეგ ცალკე წაკითხვამ დაადასტურა: deals და contact RPC არ არსებობდა,
onboarding ველი არ არსებობდა, საჯარო phone grant უცვლელი იყო. Apply-ის შემდეგ
იგივე შემოწმებამ დაადასტურა სამივე ობიექტის არსებობა და საჯარო phone grant-ის მოხსნა.
გარე host უარყოფილია `LOCAL_HOST_REQUIRED`-ით, loopback URL-ის host override —
`INVALID_LOCAL_DATABASE_URL`-ით. Node syntax check წარმატებულია.

ამ SQL სვლამ შეცვალა მხოლოდ ლოკალური მონაცემთა მოდელი. იმ მომენტში 3001-ზე
ახალი ეკრანები ჯერ მოითხოვდა ზემოთ აღწერილ RPC allowlist/store/UI ცვლილებებს,
მათ შორის PUBLIC_PROFILE-დან phone-ის ამოღებას. UI-ის მუშაობა იმ სვლაში
არ დადასტურებულა; შემდგომი პირველადი ვერსიების QA აღწერილია ქვემოთ.


## მიმდინარე UI integration — საბოლოო target browser QA, 2026-10-07

ინტეგრირებულია რეალურ კონტრაქტზე მომუშავე ეკრანები და საბოლოო source polish. საერთო brand,
Header/Footer და არსებული design-system baseline შენარჩუნებულია. მონაცემები და
ლოკალური QA fixtures artboard-ის მაგალითებს შეიძლება განსხვავდებოდეს; ეს და
ვიზუალური polish-ის სხვაობები თავისთავად backend-ის შეზღუდვა არ არის.
ორკესტრატორის ანგარიშით, polish-ის შემდეგ target-ზე განმეორებითი real onboarding,
deals და matching QA წარმატებულია. ყველა 15 გვერდი ვიზუალურად შედარებულია
ორიგინალ `.shots`-თან 1200/390 სიგანეებზე. ეს არ ნიშნავს 1:1 pixel identity-ს;
დაფიქსირებული განსხვავებები ქვემოთაა აღწერილი.

### მარშრუტები და რეალური ქცევა

- `/deals/view/?id=` — სერვერის ხუთი რეალური ეტაპი: `selected`, `discuss`,
  `terms`, `progress`, `complete`; დამატებით `cancelled`. ეტაპს URL-ით ვერ ვირჩევთ.
  `/requests/compare/?id=` იყენებს `compare_offers`-ის sealed შედეგს და სერვერის
  `total_gel/best_price/fastest` ნიშნებს; არჩევა მიდის `select_offer_deal`-ზე.
- `/matching/` — დამტკიცებული კომპანიის მოთხოვნების feed;
  `/matching/?requestId=` — მხოლოდ ამ მოთხოვნის მფლობელის მომწოდებლები.
  მონაცემები მოდის `list_matching`-ით, ქალაქის ფილტრითა და pagination-ით.
  `/offers/new/?requestId=` — რეალური შეთავაზების შექმნა/რედაქტირება.
- `/onboarding/?step=type|details|profile|provide|need|verify|review` — შვიდი ნაბიჯი
  კომპანიისთვის. არსებული Auth-ის `client/company` role არჩევანი რჩება;
  კომპანიის რეგისტრაციის/ელფოსტის დადასტურების შემდეგ redirect მიდის `type`-ზე.
  `account_intent` მხოლოდ preference-ია და auth role-ს არ ცვლის.
- store-ის საერთო `callRpc` და `mutateRpc` გამოყენებულია ახალი ფლოუებისთვის;
  `mutateRpc` ჩაწერის შემდეგ snapshot-ს აახლებს. HTTP allowlist ახალი RPC-ებისთვის ჩართულია; საერთო HTTP error გზა
  ინარჩუნებს MA კოდებს, store კი MA901–MA906-ს მომხმარებლის ტექსტებად გარდაქმნის. საჯარო profile projection
  აღარ ითხოვს phone/email-ს; კონტაქტი ავტორიზებული API-ით იკითხება.

შეთავაზების წაკითხვა მოიცავს `payment_terms`, `valid_until`, `commercial_terms`-ს:
`offers?select=*` და ცალკე საკუთარი შეთავაზების წაკითხვა ინარჩუნებს არსებულ
SELECT/RLS საზღვარს: ავტორი, მოთხოვნის მფლობელი და ადმინი; anonymous-ს
SELECT არ აქვს. ახალი პირობები კონკურენტ შეთავაზებებს საჯაროდ არ ხდის.
შენახვა ორსაფეხურიანია: `sendOffer` → `send_offer`, შემდეგ `set_offer_terms`.
პირველი პასუხის `updated_at` გადადის `updatedAt`-ში უცვლელი სტრიქონით და RPC2-ს
ეგზავნება `p_expected_updated_at`-ად — Date-ით დამრგვალების გარეშე.
ნაწილობრივი წარმატებისას ინახება offer ID, ვერსია და დამატებითი პირობები;
retry ხელახლა კითხულობს ჩანაწერს და მხოლოდ RPC2-ს იმეორებს, თუ ჯერ საჭიროა.
უკვე შენახული იგივე პირობები აღარ მეორდება. stale/გაურკვეველი RPC1 პასუხი
მოითხოვს ახალი მონაცემების წაკითხვასა და მომხმარებლის ხელახალ განხილვას,
ავტომატური გადაწერის გარეშე. ფასი nullable რჩება `negotiable` რეჟიმში;
`unit/total`, დღგ და მიწოდების ხარჯის ჩართვა ცალ-ცალკე სემანტიკაა.

Deal-ის მუტაციები აგზავნის მიმდინარე `revision`-ს; შეცდომის შემდეგ ხელახალი
წაკითხვა და review საჭიროა. პირობების შეცვლა ორივე თანხმობას აუქმებს;
`progress` მოითხოვს ორივე დადასტურებას, `complete` — მხოლოდ მყიდველს.
დასრულების შეფასება მყიდველის ერთჯერადი კერძო rating/review-ია, ჩანს მხარეებსა
და ადმინთან და არ ცვლის საჯარო company_reviews-ს. კონტაქტის privacy და cancelled-ის
შეზღუდვა კონტრაქტის მიხედვით რჩება; საჯარო ქეშიდან ნომერი არ გამოითვლება.

Onboarding-ის `set_onboarding_details` სრული ჩანაცვლებაა: ყოველი შენახვის წინ
იკითხება მიმდინარე `my_profile`, იცვლება მხოლოდ შესაბამისი ნაბიჯის ველები და
დანარჩენი ინარჩუნებს წაკითხულ მნიშვნელობებს. გამოიყენება არსებული profile,
logo/gallery და products API-ები; კატეგორიები მხოლოდ taxonomy-ის ზუსტი გასაღებებია.
`verify/review` არ აგზავნის document submission/completion RPC-ს და არ ანიჭებს
approval-ს; document status მხოლოდ წასაკითხია. პროფილი შესაბამის ნაბიჯებზე ინახება,
review აჩვენებს შენახულ მონაცემებს და ანგარიშზე გადასვლას.

Account-ის შეთავაზების რიგის არჩევა რეალურ დეტალებს ხსნის, მობილურზე — `Sheet`-ს;
`chosen` პარტნიორის ჩატი იხსნება ავტორიზებულ conversation-ში და სრულ inbox-ში.
მოთხოვნის ტექსტური draft ავტომატურად ინახება `sessionStorage`-ში იმავე tab-ისთვის,
აღდგება დაბრუნების/ავტორიზაციის შემდეგ, აქვს 30-წუთიანი TTL და წარმატებული
შექმნის შემდეგ იშლება. ფოტოები და credentials draft-ში არ ინახება.

### 15 artboard: გვერდი → განსხვავება → მიზეზი

ყველა 15 გვერდზე საერთო Header/Footer-ის ლოგო და მენიუ არსებული პროდუქტის
baseline-ს მიჰყვება. რეალური fixture კონტენტი და ბარათების რაოდენობა გვერდების
სიგრძეს ცვლის. ეს განსხვავებები და ყველა spacing backend-ის შეზღუდვად არ მიიჩნევა.
ცხრილი აერთიანებს კონტრაქტის ქცევას და ორკესტრატორის ვიზუალური შედარების კონკრეტულ
შედეგებს. კონტრაქტის საფუძველი: [CONTRACT.md](CONTRACT.md), განსაკუთრებით ახალი ფლოუები, Messaging,
Company gallery და Marketplace completion.

| გვერდი | განსხვავება | მიზეზი |
|---|---|---|
| deal-selected | პირველი ეტაპი რეალური `selected` ჩანაწერია | არჩევა ქმნის deal-ს; ეტაპი სერვერის მდგომარეობაა |
| deal-discuss | prototype-ის inline negotiation card-ის ნაცვლად რეალური ჩატი და სტრუქტურირებული terms ცალ-ცალკეა; attachments-ის გარეშე | არსებული Messaging და deal terms სხვადასხვა მოქმედებაა; Messaging არის ტექსტური, deal attachments API არ არსებობს |
| deal-terms | რედაქტირებადი პირობები და ორივე მხარის თანხმობა | revision/reset და სავალდებულო პირობების კონტრაქტი |
| deal-progress | რეალური events; წარმოების გამოგონილი substeps/ფოტოები არ ჩანს | კონტრაქტში არის deal_events, არა წარმოების substeps/photo API |
| deal-complete | ერთი კერძო rating/review, ოთხი საჯარო კრიტერიუმის ნაცვლად | `rate_deal`: მყიდველი, ერთხელ; საჯარო რეიტინგში არ შედის |
| compare-offers | რეალური პირობები/სერვერის ნიშნები, fake PDF-ის გარეშე | PDF storage/download კონტრაქტი არ არსებობს |
| matching | request feed და owner-only suppliers; save/bookmarks, fake counts/sort არ ემატება | `list_matching` მხარს უჭერს კატეგორია/ქალაქის score-ს და pagination-ს; აღნიშნული დამატებების API არ აქვს |
| make-offer | რედაქტირებადი ტექსტური პირობები, nullable ფასი; unit/total, VAT და delivery ცალ-ცალკე | `send_offer` + `set_offer_terms`; ციტირებული ფასი არ გულისხმობს დაუდასტურებელ ხარჯს |
| onboard-type | `account_intent` preference | auth role/უფლებებს არ ცვლის |
| onboard-details | ახალი legal ველები არსებულ profile მონაცემებთან ერთად; დამატებითი ველები და შენახვის მოქმედება form height-ს ცვლის | სერვერზე შენახვადი `set_onboarding_details` და არსებული profile API; დუბლირებული იდენტობა არ იქმნება |
| onboard-profile | გალერეის ფოტო, არა ცალკე cover; რეალური კომპანიის/ბრენდის სახელის ველი; მაქს. 8 tags; დამატებითი ველები და შენახვის მოქმედება form height-ს ცვლის | სერვერზე შენახვადი ველები, არსებული `company`/gallery და `valid_items`; ცალკე cover მოდელი არ არსებობს |
| onboard-provide | პროდუქტი: `name/photoUrl/note`, მაქს. 12; არა active/tags/per-product category; დამატებითი ველები და შენახვის მოქმედება form height-ს ცვლის | სერვერზე შენახვადი `set_my_products`; კატეგორიები კომპანიის დონეზეა |
| onboard-need | taxonomy-ის ზუსტი გასაღებები, მაქს. 34; ტექსტური items მაქს. 8; დამატებითი ველები და შენახვის მოქმედება form height-ს ცვლის | სერვერზე შენახვადი კატეგორიები/items: `set_matching_categories` და `valid_items`; ინტერესები მოთხოვნას არ ქმნის |
| onboard-verify | რეალური საერთო document status; upload/submission-ის გარეშე | სტატუსს მხოლოდ admin ცვლის; ინდივიდუალური დოკუმენტების API არ არსებობს |
| onboard-review | შენახული პროფილის შეჯამება და ანგარიშზე გადასვლა, fake approval-ის გარეშე | profile save არ ცვლის `verified`-ს; completion/approval RPC არ არსებობს |

### დაფიქსირებული QA და გამეორების პირობები

ქვემოთ მოცემულია root-ის მიერ მიღებული შედეგები: real browser suite-ები საბოლოო
source polish-ის შემდეგ target-ზე განმეორდა. საბოლოო target-ზე TypeScript/lint/unit
და default mocked onboarding-ის განმეორებაც წარმატებულია.
DB regression და draft ინარჩუნებს ადრე დაფიქსირებულ შედეგებს.
ამ დოკუმენტაციის სვლაში suite-ები ხელახლა არ გაშვებულა.

| შემოწმება | დაფიქსირებული შედეგი |
|---|---|
| საბოლოო target TypeScript | `npx tsc --noEmit` PASS |
| საბოლოო target სრული lint + design lint | `npm run lint` PASS: 0 errors, 29 არსებული img warnings; design checks PASS |
| საბოლოო target unit | `npm test` — 18/18 PASS |
| DB regression + ხუთი flow suite, ephemeral DB | 1,637 assertion PASS (1,570 + 67) |
| საბოლოო target real matching/offer/account | 19 checks PASS |
| საბოლოო target real deal/compare | 10 checks PASS, 33 views; `cleanup=true` |
| საბოლოო target real onboarding | 9 checks PASS; 7 ნაბიჯი × 1200/390/1440 სიგანე; cleanup-ის შემდეგ fixture auth/profiles/products = 0 |
| საბოლოო source-ზე default mocked onboarding | PASS; 0 page errors / unexpected external requests |
| request draft | 9 სცენარი PASS |

Default mocked onboarding-ის საბოლოო განმეორებამ მოიცვა raw profile, სრული
ჩანაცვლება, reload/back/retry, შვიდივე ნაბიჯი 1200/390/1440 სიგანეებზე,
guest/client/admin/blocked წვდომა, load failure/missing fields და
registration → verify → complete_profile → onboarding გადასვლა — ყველა PASS.

არსებული QA commands (`web/`-დან; ქვემოთ საიდუმლო მნიშვნელობები არ არის):

```sh
npx tsc --noEmit
npm run lint
npm test
node qa/matching-offer-local.mjs
node qa/deals-local.mjs
node qa/onboarding-local.mjs --real-local
node qa/onboarding-local.mjs
node qa/request-draft-local.mjs
```

- `matching-offer-local.mjs` მოითხოვს წინასწარ მიწოდებულ `QA_LOCAL_DATABASE_URL`-ს:
  host მხოლოდ `localhost/127.0.0.1`, ბაზის სახელი `meetany_preview_` + ციფრები.
  საკუთარ dev/JWKS runtime-ს ქმნის; `QA_PORT` default 3203 (Auth: +10),
  შვილ runtime-ში `DATABASE_URL` ცარიელია და გამოიყენება local DSN.
- `deals-local.mjs` ელოდება უკვე გაშვებულ local Next-ს: `QA_ORIGIN` default
  `http://127.0.0.1:3201`, `NEON_AUTH_BASE_URL` local fixture issuer-ის მისამართი
  (სკრიპტის მაგალითში `http://127.0.0.1:4201`) და `MEETANY_LOCAL_DATABASE_URL`.
  სამივე host loopback უნდა იყოს (`localhost/127.0.0.1`), origin/Auth host ერთნაირი,
  ბაზის სახელი `meetany_preview_` + ციფრები და `DATABASE_URL` ცარიელი.
  სკრიპტი `web/.env.local`-საც კითხულობს; production fallback დაუშვებელია.
- `onboarding-local.mjs --real-local` (ან `QA_REAL_LOCAL=1`) თავად ქმნის runtime-ს;
  `QA_LOCAL_DATABASE_URL` მხოლოდ სკრიპტში ზუსტად დასახელებულ local preview ბაზაზე
  დაიშვება (`postgres/postgresql`, `localhost/127.0.0.1`), ან იყენებს მის local default-ს.
  `QA_PORT` default 3248 (Auth: +1). შვილ runtime-ში `DATABASE_URL` და Blob token
  ცარიელია; საჭიროა preview-ში არსებული photo origin. ეს რეჟიმი remote upload-ს
  არ ადასტურებს და document upload-ს არ ქმნის.
- mocked onboarding-ს სჭირდება local runtime, `QA_ORIGIN` default
  `http://127.0.0.1:3028`, Auth — იმავე origin-ის `/__qa_auth`; DB პასუხები intercepted-ია.
  `request-draft-local.mjs` ანალოგიურად იყენებს local runtime-ს (`QA_ORIGIN` default
  `http://127.0.0.1:3216`, Auth `/__qa_auth`), mocked Auth/RPC-ს და ბლოკავს remote requests-ს.
- Browser override პირველ სამ სკრიპტში არის `QA_BROWSER_PATH`, draft-ში — `CHROME_PATH`;
  default ლოკალური Google Chrome-ია. DB regression-ის ბრძანება ზემოთ, ისტორიულ
  QA ნაწილშია; ის დროებით ბაზას ქმნის და ასუფთავებს.

არტეფაქტები ინახება gitignored `web/qa/shots/*`-ში. ჩვენი runtime fixtures ყველა
წაშლილია. ლოკალური ბაზის საბოლოო დათვლაში public profiles=52, requests=24,
offers=50 და private notifications=64, deals=0, events=0 საწყის რაოდენობებს ემთხვევა.
Conversations=15 და messages=29, საწყისი 14/28-ის ნაცვლად: ერთი დამატებითი
არასატესტო ჩატი და შეტყობინება ძველ Sept22/Sept29 პროფილებსა და Oct2 მოთხოვნას
უკავშირდება (შექმნილია Oct7 14:37Z). ეს ცვლილება ჩვენს QA-ს ვერ მიეწერა და
ხელუხლებლად შენარჩუნდა. ამიტომ მთელი DB-ის უცვლელად აღდგენა არ დასტურდება.
Production DB-ზე ახალი apply ან deploy არ შესრულებულა.
საბოლოო polish-ის target real browser რერანი ზემოთ დაფიქსირებული შედეგებით დასრულდა.
Live Blob upload არ შემოწმებულა; დოკუმენტების upload/submission API არ დამატებულა.
