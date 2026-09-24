# MeetAny — E2E

**წინასწარი გაშვება, შერეული API.** სრული ხელახალი გაშვება API/მიგრაციების სტაბილიზაციამდე არ ჩატარებულა. ქვემოთ არის დაფიქსირებული შედეგები და არა საბოლოო მიღება.

გამშვები: `npm run e2e`; `QA_ORIGIN` ნაგულისხმევად `http://localhost:3001`. Chrome: `QA_BROWSER_PATH` ან macOS Google Chrome. სერვერი არ იტვირთება ხელახლა.

დაწყება: 2026-09-24T18:16:12.670Z. შესრულებული ქვეკეისების ჯამი: 352.7 წმ. თითოეული <90 წმ. ცხრა დამოუკიდებელი ქვეკეისი ფარავს ექვს მიმართულებას: სტუმარი, რეგისტრაცია, კლიენტი, კომპანია, ადმინი, უფლებები. გამშვების ლიმიტი თითო ქვეკეისზე 89 წმ-ია; სრული გაშვება — მაქსიმუმ 12 წუთი, seed-ის შემოწმების ჩათვლით.

| ქვეკეისი | შედეგი | წამი | მიზეზი |
|---|---|---:|---|
| სტუმარი | FAIL | 54.1 | მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება: locator.click: Timeout 12000ms exceeded. |
| რეგისტრაცია / აღდგენა | PASS | 60.8 | ყველა ნაბიჯი შესრულდა |
| კომპანია — პროფილი | FAIL | 38.1 | პროფილის მისამართი და პროდუქტები: locator.fill: Timeout 12000ms exceeded.; კოორდინატების რედაქტირების UI: პროფილში კოორდინატების ველები არ არსებობს; API p_lat/p_lng-ს იღებს |
| კომპანია / კლიენტი — ჩატი | FAIL | 76.0 | კლიენტის პასუხი და კომპანიის ინბოქსი: locator.waitFor: Timeout 12000ms exceeded.; მოთხოვნის წაშლის შემდეგ ჩატის კონტრაქტი: Unexpected end of JSON input |
| კლიენტი — მოთხოვნა | FAIL | 5.9 | სცენარის შესრულება: Unexpected end of JSON input |
| კლიენტი — შეთავაზების არჩევა | PASS | 41.2 | ყველა ნაბიჯი შესრულდა |
| ადმინი — მომხმარებლები | FAIL | 45.2 | მომხმარებლების სია და T4.4 რაოდენობა: T4.4: {"ui":28,"api":28,"list":30,"total":30,"nonadmin":28,"active":20} |
| ადმინი — მოთხოვნები / კონტაქტები | PASS | 31.5 | ყველა ნაბიჯი შესრულდა |
| permissions | NOT RUN | 0.0 | შერეული API-ის გამო არ გაშვებულა |

## Cleanup და მონაცემები

- მხოლოდ `auth-probe`: DB ჰოსტი `ep-withered-glade-b54ts1g5[‑pooler]`, Auth URL იმავე endpoint-ზე; `QA_BRANCH` სხვა მნიშვნელობას უარყოფს.
- მარკერი: `[e2e:<runId>]`. შექმნილი მოთხოვნის/შეთავაზების/შეტყობინების/საუბრის/ანგარიშის/contact-event ID-ები ინახება ლოკალურ `qa/e2e/runs/<runId>.json`-ში; პაროლები და JWT-ები იქ არ იწერება.
- `finally` წმენდს თითო ქვეკეისს; გამშვები ბოლოს ცალკე cleanup CLI-საც იძახებს. ხელით: `node qa/e2e/cleanup.mjs --run-id <suite-or-scenario-id> --dry-run`, შემდეგ იგივე ბრძანება `--dry-run`-ის გარეშე.
- წაშლამდე: ჰოსტი/branch, ჟურნალი, ზუსტი ID-ები, მარკერი და SELECT count. შემდეგ DELETE messages → conversations → requests. WHERE-ის გარეშე DELETE არ არის. სხვა საუბრის/შეტყობინების აღმოჩენისას cleanup უარყოფილია.
- პროფილი ზუსტი ID+email-ით უბრუნდება საწყის მნიშვნელობებს. რეგისტრაციის ანგარიშები admin RPC-ით იბლოკება; auth-only არასრული ანგარიშები ზუსტი email+ID-ით იშლება. დასრულებული ჟურნალი განმეორებით პროფილს აღარ ცვლის.
- სატესტო ფოტოები და ზუსტად ამ ბრაუზერის contact-event-ები იშლება. დაბლოკილი ანგარიშები და მოდერაციის audit ისტორია განზრახ რჩება.

საბოლოო შემოწმება: `{"requests":"0","offers":"0","messages":"0","active_accounts":"0"}`. საწყისი დემო ჩანაწერები უცვლელი იყო; პარალელურად სხვა ნაკადმა დაამატა 2 AUDIT მოთხოვნა და 1 შეთავაზება — მათ არ შევხებივარ. ახალი გამშვები before/after-ს მხოლოდ ledger-ის seed ID-ებით ადარებს, რათა ასეთი პარალელური QA დამატებები არ აურიოს.

**seed --verify: PASS**, 2026-09-24T18:35:13.438Z; 19 ანგარიში, 12 კომპანია, 14 მოთხოვნა, 42 შეთავაზება. [შედეგი](e2e/seed-verify.json).

## ხარვეზები და საზღვრები

- კოორდინატების რედაქტირების UI ველები არ არის; API `p_lat/p_lng`-ს იღებს.
- T4.4 წინასწარ გაშვებაში: UI/API 28 მომხმარებელი, რეალურად 30 პროფილი — მთვლელი ორ ადმინს გამორიცხავდა.
- ძველ API-ზე `delete_request` ტოვებდა საუბარს `request_id=NULL`-ით. ახალი cascade მიგრაცია და ინბოქსის ცვლილებები სრული ხელახალი გაშვებისას უნდა შეფასდეს. SQL cleanup ორივე მდგომარეობას ამუშავებს.
- contact_events GET არ არსებობს; მოწმდება admin_contact_events RPC და ადმინის UI.
- სწორი OTP/წარმატებული reset ელფოსტის გარეშე არ მოწმდება. ფორმის ეტაპები, ვალიდაცია და არასწორი კოდის უარყოფა შემოწმებულია.
- ძიების Escape, 204/ცარიელი RPC პასუხი და გამშვების cleanup-ის აღდგენა კოდში გასწორებულია; ძველი FAIL ჩანაწერები არ შეცვლილა PASS-ით ახალი E2E გაშვების გარეშე.

ვალიდაცია: ყველა .mjs-ზე `node --check` PASS; `node --test qa/e2e/runner.test.mjs` — 5 PASS. cleanup-ის dry-run, ცარიელი run-ის გასუფთავება და განმეორებითი გამოძახება PASS.

## სტუმარი

- **PASS: მოთხოვნები: სია და დეტალი**. მოსალოდნელი: სიის ID-ები GET requests-შია; დეტალის სათაური ემთხვევა. შესრულდა.
- **FAIL: მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება**. მოსალოდნელი: URL და ხილული შედეგები შეესაბამება მონაცემებს. რეალური: locator.click: Timeout 12000ms exceeded. Call log:   - waiting for getByRole('link', { name: 'ახალი', exact: true })     - locator resolved to <a href="/requests/?city=batumi&tab=new">ახალი</a>   - attempting click action     2 × waiting for element to be visible, enabled and stable       - element is visible, enabled and stable       - scrolling into view if needed       - done scrolling       - <p class="search-suggestions__heading">სწრაფი ძიება</p> from <header class="catalog-header">…</header> subtree intercepts pointer events     - retrying click action     - waiting 20ms     2 × waiting for element to be visible, enabled and stable       - element is visible, enabled and stable       - scrolling into view if needed       - done scrolling       - <p class="search-suggestions__heading">სწრაფი ძიება</p> from <header class="catalog-header">…</header> subtree intercepts pointer events     - retrying click action       - waiting 100ms     22 × waiting for element to be visible, enabled and stable        - element is visible, enabled and stable        - scrolling into view if needed        - done scrolling        - <p class="search-suggestions__heading">სწრაფი ძიება</p> from <header class="catalog-header">…</header> subtree intercepts pointer events      - retrying click action        - waiting 500ms  [კადრი](shots/e2e/guest-1.png)
- **PASS: კომპანიები: ძიება, ფილტრი და დალაგება**. მოსალოდნელი: URL იცვლება; ID-ები, ქალაქი და სახელების მიმდევრობა სწორია. შესრულდა.
- **PASS: კომპანიის დეტალი, ნომერი, tel:, მიმართულება, contact_events**. მოსალოდნელი: გამოჩენა/დარეკვა აღირიცხება; Maps სწორი ბმულია. {"contactEvents":["bede8933-9f2c-4e33-a8de-20372ed43c94","5057065d-0cfe-471a-b7c6-7eb5503ffef6"],"maps":"https://www.google.com/maps/dir/?api=1&destination=41.7846,44.7712"}

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":2,"photos":0,"remaining":0}]`

## რეგისტრაცია / აღდგენა

- **PASS: რეგისტრაცია / შესვლა / გასვლა: client**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შესრულდა.
- **PASS: რეგისტრაცია / შესვლა / გასვლა: company**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შესრულდა.
- **PASS: პაროლის აღდგენა: ვალიდაცია, კოდი, შეცდომა**. მოსალოდნელი: არასწორი ელფოსტა/ცარიელი კოდი ქართულად; არასწორი კოდი უარყოფილია. {"limitation":"რეალური OTP-ის მიღება/წარმატებული reset ელფოსტის გარეშე არ შემოწმებულა"}

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0},{"accountsBlocked":2,"incompleteAccountsDeleted":0}]`

## კომპანია — პროფილი

- **FAIL: პროფილის მისამართი და პროდუქტები**. მოსალოდნელი: შეცვლილი მნიშვნელობები UI-სა და GET profiles-ში რჩება. რეალური: locator.fill: Timeout 12000ms exceeded. Call log:   - waiting for locator('#address')  [კადრი](shots/e2e/company-1.png)
- **FAIL: კოორდინატების რედაქტირების UI**. მოსალოდნელი: პროფილის ფორმაში განედი და გრძედი რედაქტირებადია. რეალური: პროფილში კოორდინატების ველები არ არსებობს; API p_lat/p_lng-ს იღებს [კადრი](shots/e2e/company-2.png)
- **PASS: კოორდინატების API და პროფილის დაბრუნება**. მოსალოდნელი: API კოორდინატებს ინახავს; თავდაპირველი მონაცემები სრულად აღდგება. შესრულდა.

Cleanup: `[{"restore":"PASS","fields":["address","lat","lng","offers"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კომპანია / კლიენტი — ჩატი

- **PASS: კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შესრულდა.
- **PASS: ჩატი მოთხოვნიდან და წაუკითხავი ბეიჯი**. მოსალოდნელი: შეტყობინება RPC-შია და მიმღების ჰედერში წაუკითხავი იზრდება. შესრულდა.
- **FAIL: კლიენტის პასუხი და კომპანიის ინბოქსი**. მოსალოდნელი: ?tab=messages&c=id აჩვენებს საუბარს; პასუხი ბაზაშია; კომპანიის unread იზრდება. რეალური: locator.waitFor: Timeout 12000ms exceeded. Call log:   - waiting for locator('.ma-chat-badge').first() to be visible  [კადრი](shots/e2e/messaging-1.png)
- **FAIL: მოთხოვნის წაშლის შემდეგ ჩატის კონტრაქტი**. მოსალოდნელი: წაშლა მუშაობს; შენახული საუბარი ზუსტად აღირიცხება SQL cleanup-ისთვის. რეალური: Unexpected end of JSON input [კადრი](shots/e2e/messaging-2.png)

Cleanup: `[{"messages":2,"conversations":1,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კლიენტი — მოთხოვნა

- **FAIL: სცენარის შესრულება**. მოსალოდნელი: სცენარის დასრულება. რეალური: Unexpected end of JSON input [კადრი](shots/e2e/client-1.png)

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კლიენტი — შეთავაზების არჩევა

- **PASS: კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შესრულდა.
- **PASS: შეთავაზების არჩევა კომპანიის ნაბიჯების შემდეგ**. მოსალოდნელი: chosen_offer_id და offers.status შეესაბამება არჩეულ შეთავაზებას. შესრულდა.

Cleanup: `[{"messages":0,"conversations":0,"requests":1,"offers":1,"contacts":0,"photos":0,"remaining":0}]`

## ადმინი — მომხმარებლები

- **FAIL: მომხმარებლების სია და T4.4 რაოდენობა**. მოსალოდნელი: UI-ის მთვლელი ემთხვევა admin_list_users-სა და რეალურ პროფილებს. რეალური: T4.4: {"ui":28,"api":28,"list":30,"total":30,"nonadmin":28,"active":20}  28 !== 30  [კადრი](shots/e2e/admin-1.png)
- **PASS: ვერიფიკაცია/ბლოკი და დაბრუნება**. მოსალოდნელი: UI ქმედებები იცვლება; RPC და საჯარო GET სტატუსს ადასტურებს. შესრულდა.

Cleanup: `[{"restore":"PASS","fields":["blocked","blocked_reason","verified","verified_at"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## ადმინი — მოთხოვნები / კონტაქტები

- **PASS: მოთხოვნის დამალვა და დაბრუნება**. მოსალოდნელი: საჯარო GET-ში ქრება და ჩნდება; UI სტატუსი იცვლება. შესრულდა.
- **PASS: ადმინის კონტაქტების აღრიცხვა**. მოსალოდნელი: ახალი contact_event-ის ID და მოქმედება UI ცხრილში ჩანს. შესრულდა.

Cleanup: `[{"messages":0,"conversations":0,"requests":1,"offers":0,"contacts":1,"photos":0,"remaining":0}]`

## permissions



Cleanup: `[]`
