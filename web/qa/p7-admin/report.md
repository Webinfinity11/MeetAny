# T7.3 — ადმინის ექვსი ფუნქცია

შემოწმდა 2026-10-14, მხოლოდ იზოლირებულ checkout-სა და `meetany_preview_p7_admin` ლოკალურ ბაზაზე. Dev: 3702; ლოკალური Neon Auth fixture: 3712. რეალური ავტორიზაცია, production, deploy და push არ გამოყენებულა.

## ცვლილებები

- როლის შეცვლა client ↔ company — მიზეზით, ადმინისა და საკუთარი როლის დაცვის წესებით; ვერიფიკაცია/ონბორდინგი იცვლება შეთანხმებული წესით.
- ანონიმიზაცია — პირადი ველების გასუფთავება, დაბლოკვა, ღია მოთხოვნების დამალვა, გაგზავნილი შეთავაზებების `withdrawn` სტატუსი, შენახულებისა და alerts-ის წაშლა. მიმოწერა რჩება. UI განმარტავს, რომ ავტორიზაციის ანგარიში რჩება დაბლოკილი; Neon Auth ჩანაწერი არ იშლება.
- კომპანიის კატალოგიდან დამალვა/დაბრუნება — ანგარიშის დაბლოკვის გარეშე. დაფარულია საჯარო სია/snapshot/მთავარის კომპანიები, პროფილის RLS და სექციები, matching-ის ორივე გზა და საჯარო სტატისტიკა. admin_search_users-ის არსებული `p.*` პროექცია ახალ ველებსაც აბრუნებს.
- შეთავაზების ცხრა ველის რედაქტორი — `AdminOfferEditPanel.tsx`, მიზეზითა და არსებული send_offer/set_offer_terms ვალიდაციით. შენახვის შემდეგ დეტალი ახლდება; შეთანხმებული deal პირობები უცვლელია. ადმინის შეთავაზებებში `withdrawn` სტატუსის ფილტრიც დამატებულია.
- შეფასებისა და მიმოწერის საჩივრები — მომხმარებლის ღილაკები, საკუთარი შეფასებისა და უცხო საუბრის დაცვა, ადმინის დეტალის ფანჯარა და მიზეზიანი გადაწყვეტილება. შენარჩუნებულია contact_change და ძველი საჩივრების ქცევა.
- გარიგების პრობლემაზე ადმინისტრაციის კომენტარი — ფორმა სიასა და დეტალში, ორივე მხარისთვის შეტყობინება და ტექსტის ჩვენება პრობლემის სექციაში, გარიგების ეტაპის მიუხედავად.

მიგრაცია: `db/migrations/20261014-admin-actions.sql`. დამატებით საჭირო გახდა `anonymized_at`, ანონიმიზებული დაბლოკილი პროფილის ცარიელი ტელეფონის/კომპანიის დაშვება და ტელეფონის partial unique index; client→company გადასვლისას დაუმთავრებელ ონბორდინგში industry შეიძლება ჯერ არ იყოს. ძველი ვალიდაცია ჩვეულებრივი პროფილებისთვის შენარჩუნებულია.

## RPC-ები და აუდიტი

| RPC | შედეგი | moderation_audit.action |
|---|---|---|
| `admin_set_role(p_user_id uuid, p_role text, p_reason text)` | void | `user.role` |
| `admin_anonymize_user(p_user_id uuid, p_reason text)` | void | `user.anonymize` |
| `admin_set_company_hidden(p_user_id uuid, p_hidden boolean, p_reason text)` | void | `company.hide`, `company.show` |
| `admin_edit_offer(p_id uuid, p_patch jsonb, p_reason text)` | public.offers | `offer.edit` |
| `admin_comment_deal_issue(p_issue_id uuid, p_body text)` | void | `deal.issue_comment` |
| `report_content(p_kind text, p_target_id uuid, p_reason text, p_text text default '')` | jsonb | მომხმარებლის საჩივარი; გადაწყვეტილება ქვემოთ |
| `admin_resolve_report(p_id uuid, p_action text, p_reason text)` | jsonb | `report.resolve` |

`admin_list_reports(p_status text default 'new', p_offset integer default 0)` გაფართოვდა ახალი ტიპებითა და შეფასების ტექსტით. `company_reviews` აბრუნებს author_id-ს, რათა ავტორთან საჩივრის ღილაკი არ გამოჩნდეს. ახალი შეცდომები: `MA309`, `MA310`, `MA311`; დეტალური პირობები `db/CONTRACT.md`-შია.

`web/app/lib/db-handler.js`: ხუთივე ახალი ადმინისტრატორის RPC დაემატა RPCS-ს; role/anonymize/company_hidden/offer_edit — PUBLIC_WRITES-საც. report resolve უკვე ორივე სიაში იყო. ყველა ახალი ადმინისტრატორის RPC იყენებს require_admin/security definer-ს და authenticated grant-ს; anonymous/PUBLIC execution აკრძალულია.

## შემოწმებები

| შემოწმება | შედეგი |
|---|---|
| `bash db/tests/run.sh` | **2242 assertion გავიდა**, მათ შორის **59 ახალი**; მიგრაცია ორჯერ გაეშვა |
| `npx tsc --noEmit` | 0 შეცდომა |
| `npx eslint app` | 0 შეცდომა / 11 არსებული warning |
| `npm run lint:design` | წარმატებული |
| `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test` | 118 pass / 0 fail |
| Playwright, 1440/390/360 | ექვსივე მოქმედება + შეფასების/მიმოწერის მომხმარებლის საჩივარი; ყველა სიგანეზე pageerror 0, overflow 0 |
| დამატებითი Playwright | საჩივრიდან შეფასებისა და მიმოწერის გახსნა; ადმინისტრაციის კომენტარი მყიდველსა და მომწოდებელთან; დამალული კომპანიის საჯარო გვერდი ვერ მოიძებნა |

SQL ტესტები ამოწმებს არაადმინსა და anonymous წვდომას, საკუთარ/სხვა ადმინისტრატორზე როლის შეცვლის აკრძალვას, არასწორ patch-ს/ფასს/ვადას, მიზეზს, ანონიმიზაციის შედეგებსა და დარჩენილი Auth-ის დაბლოკილ წვდომას, კატალოგსა და matching-ს, ახალი საჩივრების საკუთრებას/მონაწილეობას/დუბლირებას, dismiss/hide_review/block_user-ს, ორივე მხარის შეტყობინებას და აუდიტის actor/action/reason-ს.

საწყისი Node 26 გაშვება session ტესტებზე გაჩერდა; Node 22-ით სრული `npm test` დასრულდა. სესიის კოდში ცვლილება არ გაკეთებულა.

არსებული `qa/admin-management-local-write.mjs` და `qa/admin-novice-local.mjs` უცვლელად არ გაშვებულა: მათი `qa/e2e/lib.mjs` helper უშვებს მხოლოდ კონკრეტულ დისტანციურ auth-probe DSN-ს, ხოლო პირველი runner ძველ „დეტალები“ სელექტორსაც იყენებს. ეს ადგილობრივი ბაზის შეზღუდვა არ შემივლია და რეალური Auth არ გამომიყენებია. ექვსი ფუნქცია შემოწმებულია ახალ, ლოკალურ fixture-ზე მომუშავე runner-ით. ძველი runner-ების უცვლელი გაშვება წარმატებულად არ არის გამოცხადებული.

## გამეორება და მტკიცებულებები

`web/`-დან, უკვე გაშვებული dev/auth fixture-ით:

```sh
node qa/p7-admin/check.mjs
node qa/p7-admin/visibility-check.mjs
```

სკრიპტები თვითონ ქმნის სინთეზურ ანგარიშებს მხოლოდ `meetany_preview_p7_admin` ბაზაში და ყველა ძირითად მოქმედებას UI-დან ასრულებს. შედეგებია `results.json` და `visibility-results.json`. მეორე შემოწმება სინთეზურ მომწოდებლებს დროებით განბლოკავს და ახალ საკონტროლო საჩივარს აგზავნის.

სკრინშოტები: `web/qa/p7-admin/shots/`, სამივე პრეფიქსით `1440-`, `390-`, `360-`:

- `role-sheet/result`, `anonymize-sheet/result`, `hide-sheet/result`, `show-sheet/result`;
- `offer-form/result`, `comment-form/result`, `buyer-comment`, `supplier-comment`;
- `review-report/detail/resolve`, `conversation-report/detail/resolve`, `hidden-public`.

PNG-ები განზრახ არ არის commit-ში. ვიზუალურად გადამოწმდა დესკტოპის მოდალები, მობილური ანონიმიზაციის ფანჯარა, შეთავაზების ფორმა, შეფასების დეტალი, საუბრის საჩივარი და კომენტარის შედეგი.

## ფაილების საზღვრები

DB: ახალი მიგრაცია/ტესტი, run.sh და CONTRACT.md. API: db-handler.js. ადმინი: AdminDetail, AdminUserStatus, AdminPageContent, AdminOfferDetail/EditPanel, AdminOffersTable/Filters, AdminDealDetail/Issues/IssueComment, AdminReports/ReportContent, AdminAuditTable, ModerationSheet, admin-helpers და use-admin-data. მომხმარებელი: ReportButton, company/CompanyReviews, ChatPopup, Inbox, DealCollaboration, DealDiscussion. QA: ეს საქაღალდე.

`CompanyProfilePageContent.tsx` არ შეცვლილა — შეფასების ღილაკი მის `company/CompanyReviews.tsx` ქვეკომპონენტშია. არ შეცვლილა აკრძალული AdminEditPanel/AdminPhotos/AdminContentEditor, Header/Footer, Profile, RequestViewPageContent და სესიის კოდი. ინტეგრაციას აკეთებს გამხსნელი ორკესტრატორი; push/deploy არ შესრულებულა.
