# MeetAny — E2E

სრული გაშვება სტაბილურ API-ზე: **5 PASS / 4 FAIL**, 411.5 წმ. ყველა ქვეკეისი <90 წმ. CSP: **0 დარღვევა, 9 ქვეკეისი**.

გარემოს შეზღუდვა: გაშვებისას სხვა ნაკადი ცვლიდა UI ფაილებს, მათ შორის RequestViewPageContent/AccountPageContent/Inbox/ChatPopup-ს. არჩევის გვერდი skeleton-ზე დარჩა (ERR_ABORTED); HMR-თან კავშირი არ დადასტურებულა. კლიენტის FAIL ტესტის სელექტორის შეცდომაა: სათაური ტექსტად ჩანს, heading არ არის. სელექტორი გასწორდა, მაგრამ უცვლელი UI-ის მოლოდინში ხელახლა არ გაშვებულა; FAIL შენარჩუნებულია.

სინტაქსი PASS; გამშვების 5 ტესტი PASS. ყველა cleanup PASS, დარჩენილი ჩანაწერები 0, რეგისტრაციის 2 ანგარიში დაბლოკილია.

გაშვება: `npm run e2e`; სურვილისამებრ `QA_ORIGIN=http://localhost:3001`. Chrome: `QA_BROWSER_PATH` ან macOS Google Chrome. მხოლოდ auth-probe; სხვა ჰოსტი უარყოფილია. პაროლები ledger-იდან მხოლოდ მეხსიერებაში იკითხება; trace/video არ იწერება.

თარიღი: 2026-09-24T18:41:41.743Z. ხანგრძლივობა: 411.5 წმ. თითო სცენარის სრული ლიმიტი 89 წმ (სამუშაო 75 წმ + cleanup). ჩავარდნა შემდეგ სცენარს არ აჩერებს.

| სცენარი | PASS/FAIL | მიზეზი | დრო |
|---|---|---|---|
| სტუმარი | PASS | ყველა ნაბიჯი შესრულდა | 17.8 წმ |
| რეგისტრაცია / აღდგენა | PASS | ყველა ნაბიჯი შესრულდა | 45.7 წმ |
| კომპანია — პროფილი | FAIL | კოორდინატების რედაქტირების UI: პროფილში კოორდინატების ველები არ არსებობს; API p_lat/p_lng-ს იღებს | 15.1 წმ |
| კომპანია / კლიენტი — ჩატი | PASS | ყველა ნაბიჯი შესრულდა | 49.8 წმ |
| კლიენტი — მოთხოვნა | FAIL | მოთხოვნის შექმნა ფოტოთი: locator.waitFor: Timeout 12000ms exceeded. | 66.5 წმ |
| კლიენტი — შეთავაზების არჩევა | FAIL | შეთავაზების არჩევა კომპანიის ნაბიჯების შემდეგ: locator.click: Timeout 12000ms exceeded. | 36.2 წმ |
| ადმინი — მომხმარებლები | FAIL | მომხმარებლების სია და T4.4 რაოდენობა: T4.4: {"ui":30,"api":30,"list":32,"total":32,"nonadmin":30,"active":20} | 37.1 წმ |
| ადმინი — მოთხოვნები / კონტაქტები | PASS | ყველა ნაბიჯი შესრულდა | 27.4 წმ |
| უფლებები | PASS | ყველა ნაბიჯი შესრულდა | 20.1 წმ |

Seed --verify: **PASS**. Cleanup CLI: **PASS**. დემო profiles/requests/offers ზუსტი before/after შედარება: **უცვლელია**.

```json
{"accounts":19,"companies":12,"requests":14,"open":13,"chosen":1,"fresh":4,"owners":{"hotel":3,"cafe":3,"shop":2,"winery":2,"dental":2,"garage":2},"photos":["linen","cleaning","produce"],"offers":42,"offerCounts":{"0":2,"1":2,"2":2,"3":2,"4":2,"5":2,"6":2},"expiryDays":[2,3,5,6,8,11,14,17,19,21,26,27,30],"verified":["wood","linen","web","food","port","ads"],"industries":{"food":1,"marketing":1,"logistics":1,"technology":2,"textiles":2,"furniture":3,"cleaning":1,"construction":1},"sent":{"wood":6,"linen":4,"supply":7,"cleaning":5,"build":6,"web":1,"food":0,"port":2,"oak":5,"code":1,"ads":3,"stay":2},"joinedDays":{"wood":92,"linen":78,"supply":64,"build":51,"cleaning":37,"oak":30,"stay":26,"web":23,"port":19,"code":11,"ads":8,"food":4},"checks":"passed"}
```

## საზღვრები და cleanup

- რეგისტრაციის ანგარიშები admin RPC-ით იბლოკება; არასრული signup ზუსტი email+ID-ით იშლება. დაბლოკილი ანგარიშები და უცვლელი მოდერაციის audit ისტორია რჩება განზრახ.
- ხელით აღდგენა: `node qa/e2e/cleanup.mjs --run-id <id>` (ჯერ `--dry-run`). ზუსტი ID-ები და `[e2e:<runId>]` მარკერი ინახება `qa/e2e/runs/`-ში. გამშვები cleanup-ს ბოლოსაც იძახებს.
- მოთხოვნა/შეთავაზება/ფოტო, ჩატი და ამ ბრაუზერის მიერ დაბრუნებული contact-event ID-ები finally-ში იშლება. ჩატამდე SELECT count; DELETE messages → conversations; დარჩენილი ჩანაწერები მოწმდება. არსებული დემო საუბრები არ იცვლება.
- გრძელი ნაკადები იყოფა დამოუკიდებელ ქვეკეისებად, საკუთარი fixture-ით და cleanup-ით: კომპანიის პროფილი / ჩატი, კლიენტის მოთხოვნა / არჩევა. არჩევის ქვეკეისში კომპანია ჯერ აგზავნის შეთავაზებას. დახურვა მოწმდება არჩევამდე, რადგან არჩეულ მოთხოვნას UI აღარ ხურავს.
- წინასწარ API-ზე delete_request საუბარს request_id=NULL-ით ტოვებდა. ახალი მიგრაციის შედეგი მოწმდება messaging ქვეკეისში; ცალკე SQL cleanup ორივე მდგომარეობას ამუშავებს.
- contact_events GET არ არის გამოქვეყნებული; შემოწმება იყენებს admin_contact_events RPC-სა და ადმინის UI-ს.
- ელფოსტის გარეშე სწორი OTP და წარმატებული password reset არ მოწმდება; მხოლოდ ხელმისაწვდომი UI ეტაპები და უარყოფა.

## სტუმარი

- **PASS — მოთხოვნები: სია და დეტალი**. მოსალოდნელი: სიის ID-ები GET requests-შია; დეტალის სათაური ემთხვევა. შემოწმება შესრულდა.
- **PASS — მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება**. მოსალოდნელი: URL და ხილული შედეგები შეესაბამება მონაცემებს. შემოწმება შესრულდა.
- **PASS — კომპანიები: ძიება, ფილტრი და დალაგება**. მოსალოდნელი: URL იცვლება; ID-ები, ქალაქი და სახელების მიმდევრობა სწორია. შემოწმება შესრულდა.
- **PASS — კომპანიის დეტალი, ნომერი, tel:, მიმართულება, contact_events**. მოსალოდნელი: გამოჩენა/დარეკვა აღირიცხება; Maps სწორი ბმულია. {"contactEvents":["f7c76347-7123-4e7b-8df2-c3e4532f9af2","84ca0a61-ed0b-465c-91cc-c88da1fa126b"],"maps":"https://www.google.com/maps/dir/?api=1&destination=41.7846,44.7712"}
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete-contacts","contacts":2},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":2,"photos":0,"remaining":0}]`

## რეგისტრაცია / აღდგენა

- **PASS — რეგისტრაცია / შესვლა / გასვლა: client**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შემოწმება შესრულდა.
- **PASS — რეგისტრაცია / შესვლა / გასვლა: company**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შემოწმება შესრულდა.
- **PASS — პაროლის აღდგენა: ვალიდაცია, კოდი, შეცდომა**. მოსალოდნელი: არასწორი ელფოსტა/ცარიელი კოდი ქართულად; არასწორი კოდი უარყოფილია. {"limitation":"რეალური OTP-ის მიღება/წარმატებული reset ელფოსტის გარეშე არ შემოწმებულა"}
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0},{"accountsBlocked":2,"incompleteAccountsDeleted":0}]`

## კომპანია — პროფილი

- **PASS — პროფილის მისამართი და პროდუქტები**. მოსალოდნელი: შეცვლილი მნიშვნელობები UI-სა და GET profiles-ში რჩება. შემოწმება შესრულდა.
- **FAIL — კოორდინატების რედაქტირების UI**. მოსალოდნელი: პროფილის ფორმაში განედი და გრძედი რედაქტირებადია. რეალური: პროფილში კოორდინატების ველები არ არსებობს; API p_lat/p_lng-ს იღებს [კადრი](../qa/shots/e2e/company-1.png)
- **PASS — კოორდინატების API და პროფილის დაბრუნება**. მოსალოდნელი: API კოორდინატებს ინახავს; თავდაპირველი მონაცემები სრულად აღდგება. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"restore":"PASS","fields":["address","lat","lng","offers"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კომპანია / კლიენტი — ჩატი

- **PASS — კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შემოწმება შესრულდა.
- **PASS — ჩატი მოთხოვნიდან და წაუკითხავი ბეიჯი**. მოსალოდნელი: შეტყობინება RPC-შია და მიმღების ჰედერში წაუკითხავი იზრდება. შემოწმება შესრულდა.
- **PASS — კლიენტის პასუხი და კომპანიის ინბოქსი**. მოსალოდნელი: ?tab=messages&c=id აჩვენებს საუბარს; პასუხი ბაზაშია; კომპანიის unread იზრდება. შემოწმება შესრულდა.
- **PASS — მოთხოვნის წაშლის შემდეგ ჩატის კონტრაქტი**. მოსალოდნელი: წაშლის შემდეგ მოთხოვნა და მასთან დაკავშირებული საუბრები აღარ არსებობს. {"requestDeleted":true,"conversationsRetained":0}
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":0,"offers":0},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კლიენტი — მოთხოვნა

- **FAIL — მოთხოვნის შექმნა ფოტოთი**. მოსალოდნელი: ახალი მოთხოვნა და ატვირთული ფოტო GET requests-შია და UI-ზე ჩანს. რეალური: locator.waitFor: Timeout 12000ms exceeded. Call log:   - waiting for getByRole('heading', { name: 'ხის მაგიდის მიწოდება [e2e:1790275301743-client]', exact: true }) to be visible  [კადრი](../qa/shots/e2e/client-1.png)
- **PASS — რედაქტირება და ვადის გაგრძელება**. მოსალოდნელი: რაოდენობა 3 ხდება; ვადა იზრდება; UI ინახავს ცვლილებას. შემოწმება შესრულდა.
- **PASS — დახურვა და ხელახლა გახსნა**. მოსალოდნელი: UI იცვლება; status closed შემდეგ open ხდება. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":1,"offers":0},{"messages":0,"conversations":0,"requests":1,"offers":0,"contacts":0,"photos":1,"remaining":0}]`

## კლიენტი — შეთავაზების არჩევა

- **PASS — კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შემოწმება შესრულდა.
- **FAIL — შეთავაზების არჩევა კომპანიის ნაბიჯების შემდეგ**. მოსალოდნელი: chosen_offer_id და offers.status შეესაბამება არჩეულ შეთავაზებას. რეალური: locator.click: Timeout 12000ms exceeded. Call log:   - waiting for getByRole('button', { name: 'შეთავაზების არჩევა', exact: true })     - waiting for "http://localhost:3001/requests/view/?id=c8066256-095e-4827-8e7d-20b8ba93b21a" navigation to finish...     - navigated to "http://localhost:3001/requests/view/?id=c8066256-095e-4827-8e7d-20b8ba93b21a"  [კადრი](../qa/shots/e2e/choose-1.png)
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":1,"offers":1},{"messages":0,"conversations":0,"requests":1,"offers":1,"contacts":0,"photos":0,"remaining":0}]`

## ადმინი — მომხმარებლები

- **FAIL — მომხმარებლების სია და T4.4 რაოდენობა**. მოსალოდნელი: UI-ის მთვლელი ემთხვევა admin_list_users-სა და რეალურ პროფილებს. რეალური: T4.4: {"ui":30,"api":30,"list":32,"total":32,"nonadmin":30,"active":20}  30 !== 32  [კადრი](../qa/shots/e2e/admin-1.png)
- **PASS — ვერიფიკაცია/ბლოკი და დაბრუნება**. მოსალოდნელი: UI ქმედებები იცვლება; RPC და საჯარო GET სტატუსს ადასტურებს. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"restore":"PASS","fields":["blocked","blocked_reason","verified","verified_at"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

T4.4: `{"ui":30,"api":30,"list":32,"total":32,"nonadmin":30,"active":20}`

## ადმინი — მოთხოვნები / კონტაქტები

- **PASS — მოთხოვნის დამალვა და დაბრუნება**. მოსალოდნელი: საჯარო GET-ში ქრება და ჩნდება; UI სტატუსი იცვლება. შემოწმება შესრულდა.
- **PASS — ადმინის კონტაქტების აღრიცხვა**. მოსალოდნელი: ახალი contact_event-ის ID და მოქმედება UI ცხრილში ჩანს. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":1,"offers":0},{"phase":"before-delete-contacts","contacts":1},{"messages":0,"conversations":0,"requests":1,"offers":0,"contacts":1,"photos":0,"remaining":0}]`

## უფლებები

- **PASS — უფლებები UI-ზე**. მოსალოდნელი: სხვის მოთხოვნაზე რედაქტირება/გაგრძელება/არჩევა არ ჩანს. შემოწმება შესრულდა.
- **PASS — სხვისი update**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA107"}
- **PASS — სხვისი extend**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA107"}
- **PASS — სხვისი choose**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA206"}
- **PASS — კომპანიის choose**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA107"}
- **PASS — სხვისი საუბარი**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA501"}
- **PASS — არაადმინის RPC**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":400,"code":"MA003"}
- **PASS — სტუმრის admin RPC**. მოსალოდნელი: 401/403 ან მოსალოდნელი MA-კოდი; მდგომარეობა უცვლელია. {"status":401,"code":"42501"}
- **PASS — მდგომარეობა შეტევების შემდეგ**. მოსალოდნელი: GET requests/offers უცვლელია. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":1,"requests":1,"offers":1},{"messages":0,"conversations":1,"requests":1,"offers":1,"contacts":0,"photos":0,"remaining":0}]`
