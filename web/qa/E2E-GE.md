# MeetAny — E2E

გაშვება: `npm run e2e`; სურვილისამებრ `QA_ORIGIN=http://localhost:3001`. Chrome: `QA_BROWSER_PATH` ან macOS Google Chrome. მხოლოდ auth-probe; სხვა ჰოსტი უარყოფილია. პაროლები ledger-იდან მხოლოდ მეხსიერებაში იკითხება; trace/video არ იწერება.

თარიღი: 2026-09-30T13:43:26.889Z. ხანგრძლივობა: 348.7 წმ. თითო სცენარის სრული ლიმიტი 89 წმ (სამუშაო 75 წმ + cleanup). ჩავარდნა შემდეგ სცენარს არ აჩერებს.

| სცენარი | PASS/FAIL | მიზეზი | დრო |
|---|---|---|---|
| სტუმარი | FAIL | მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება: locator.selectOption: Timeout 12000ms exceeded.; კომპანიები: ძიება, ფილტრი და დალაგება: locator.selectOption: Timeout 12000ms exceeded.; გამშვები: პროცესი ლიმიტზე შეწყდა; cleanup ვერ დადასტურდა | 44.2 წმ |
| რეგისტრაცია / აღდგენა | PASS | ყველა ნაბიჯი შესრულდა | 32.6 წმ |
| კომპანია — პროფილი | FAIL | კოორდინატების რედაქტირების UI: locator.fill: Timeout 12000ms exceeded. | 24.4 წმ |
| კომპანია / კლიენტი — ჩატი | FAIL | ჩატი მოთხოვნიდან და წაუკითხავი ბეიჯი: locator.click: Timeout 12000ms exceeded. | 47.0 წმ |
| კლიენტი — მოთხოვნა | FAIL | მოთხოვნის შექმნა ფოტოთი: locator.selectOption: Error: Element is not a <select> element | 6.1 წმ |
| კლიენტი — შეთავაზების არჩევა | PASS | ყველა ნაბიჯი შესრულდა | 21.9 წმ |
| ადმინი — მომხმარებლები | FAIL | მომხმარებლების სია და T4.4 რაოდენობა: locator.innerText: Timeout 12000ms exceeded. | 41.3 წმ |
| ადმინი — მოთხოვნები / კონტაქტები | PASS | ყველა ნაბიჯი შესრულდა | 23.8 წმ |
| უფლებები | PASS | ყველა ნაბიჯი შესრულდა | 20.1 წმ |

Seed --verify: **FAIL**. Cleanup CLI: **PASS**. დემო profiles/requests/offers ზუსტი before/after შედარება: **უცვლელია**.

```json
მონაცემების ოპერაცია შეჩერდა: Expected all but the chosen request open

10 !== 13
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
- **FAIL — მოთხოვნები: ძიება, ფილტრი, ჩანართი, დალაგება**. მოსალოდნელი: URL და ხილული შედეგები შეესაბამება მონაცემებს. რეალური: locator.selectOption: Timeout 12000ms exceeded. Call log:   - waiting for locator('#request-city-desktop')  [კადრი](../qa/shots/e2e/guest-1.png)
- **FAIL — კომპანიები: ძიება, ფილტრი და დალაგება**. მოსალოდნელი: URL იცვლება; ID-ები, ქალაქი და სახელების მიმდევრობა სწორია. რეალური: locator.selectOption: Timeout 12000ms exceeded. Call log:   - waiting for locator('#company-city-desktop')  [კადრი](../qa/shots/e2e/guest-2.png)
- **FAIL — გამშვები**. მოსალოდნელი: სცენარის დასრულება. რეალური: პროცესი ლიმიტზე შეწყდა; cleanup ვერ დადასტურდა

Cleanup: `[]`

## რეგისტრაცია / აღდგენა

- **PASS — რეგისტრაცია / შესვლა / გასვლა: company**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შემოწმება შესრულდა.
- **PASS — რეგისტრაცია / შესვლა / გასვლა: client**. მოსალოდნელი: ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია. შემოწმება შესრულდა.
- **PASS — პაროლის აღდგენა: ვალიდაცია, კოდი, შეცდომა**. მოსალოდნელი: არასწორი ელფოსტა/ცარიელი კოდი ქართულად; არასწორი კოდი უარყოფილია. {"limitation":"რეალური OTP-ის მიღება/წარმატებული reset ელფოსტის გარეშე არ შემოწმებულა"}
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0},{"accountsBlocked":2,"incompleteAccountsDeleted":0}]`

## კომპანია — პროფილი

- **PASS — პროფილის მისამართი და პროდუქტები**. მოსალოდნელი: შეცვლილი მნიშვნელობები UI-სა და GET profiles-ში რჩება. შემოწმება შესრულდა.
- **FAIL — კოორდინატების რედაქტირების UI**. მოსალოდნელი: პროფილის ფორმაში განედი და გრძედი რედაქტირებადია. რეალური: locator.fill: Timeout 12000ms exceeded. Call log:   - waiting for getByLabel('განედი', { exact: true })     - locator resolved to <input id="lat" maxlength="20" value="41.7438" autocomplete="off" inputmode="decimal" placeholder="41.7151" class="ma-input ma-input--num"/>     - fill("41.72")   - attempting fill action     2 × waiting for element to be visible, enabled and editable       - element is not visible     - retrying fill action     - waiting 20ms     2 × waiting for element to be visible, enabled and editable       - element is not visible     - retrying fill action       - waiting 100ms     24 × waiting for element to be visible, enabled and editable        - element is not visible      - retrying fill action        - waiting 500ms  [კადრი](../qa/shots/e2e/company-1.png)
- **PASS — კოორდინატების API და პროფილის დაბრუნება**. მოსალოდნელი: API კოორდინატებს ინახავს; თავდაპირველი მონაცემები სრულად აღდგება. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"restore":"PASS","fields":["address","lat","lng","offers"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კომპანია / კლიენტი — ჩატი

- **PASS — კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შემოწმება შესრულდა.
- **FAIL — ჩატი მოთხოვნიდან და წაუკითხავი ბეიჯი**. მოსალოდნელი: შეტყობინება RPC-შია და მიმღების ჰედერში წაუკითხავი იზრდება. რეალური: locator.click: Timeout 12000ms exceeded. Call log:   - waiting for getByRole('button', { name: 'მიმოწერის დახურვა' })  [კადრი](../qa/shots/e2e/messaging-1.png)
- **PASS — კლიენტის პასუხი და კომპანიის ინბოქსი**. მოსალოდნელი: ?tab=messages&c=id აჩვენებს საუბარს; პასუხი ბაზაშია; კომპანიის unread იზრდება. შემოწმება შესრულდა.
- **PASS — მოთხოვნის წაშლის შემდეგ ჩატის კონტრაქტი**. მოსალოდნელი: წაშლის შემდეგ მოთხოვნა და მასთან დაკავშირებული საუბრები აღარ არსებობს. {"requestDeleted":true,"conversationsRetained":0}
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":0,"offers":0},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კლიენტი — მოთხოვნა

- **FAIL — მოთხოვნის შექმნა ფოტოთი**. მოსალოდნელი: ახალი მოთხოვნა და ატვირთული ფოტო GET requests-შია და UI-ზე ჩანს. რეალური: locator.selectOption: Error: Element is not a <select> element Call log:   - waiting for locator('#category')     - locator resolved to <button id="category" type="button" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="category-options" class="ma-select ma-custom-select ma-select">…</button>   - attempting select option action     - waiting for element to be visible and enabled  [კადრი](../qa/shots/e2e/client-1.png)
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

## კლიენტი — შეთავაზების არჩევა

- **PASS — კომპანია: შეთავაზების გაგზავნა**. მოსალოდნელი: UI აჩვენებს შეთავაზებას; GET offers შეიცავს იმავე ტექსტსა და ვადას. შემოწმება შესრულდა.
- **PASS — შეთავაზების არჩევა კომპანიის ნაბიჯების შემდეგ**. მოსალოდნელი: chosen_offer_id და offers.status შეესაბამება არჩეულ შეთავაზებას. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"phase":"before-delete","messages":0,"conversations":0,"requests":1,"offers":1},{"messages":0,"conversations":0,"requests":1,"offers":1,"contacts":0,"photos":0,"remaining":0}]`

## ადმინი — მომხმარებლები

- **FAIL — მომხმარებლების სია და T4.4 რაოდენობა**. მოსალოდნელი: UI-ისა და admin_stats-ის მთვლელები ემთხვევა SQL-ისა და სიის არაადმინების რაოდენობას. რეალური: locator.innerText: Timeout 12000ms exceeded. Call log:   - waiting for locator('.ma-stat').filter({ has: getByText('მომხმარებლები (ადმინების გარეშე)', { exact: true }) }).locator('.ma-stat__value')  [კადრი](../qa/shots/e2e/admin-1.png)
- **PASS — ვერიფიკაცია/ბლოკი და დაბრუნება**. მოსალოდნელი: UI ქმედებები იცვლება; RPC და საჯარო GET სტატუსს ადასტურებს. შემოწმება შესრულდა.
- **PASS — CSP დარღვევები**. მოსალოდნელი: ბრაუზერში securitypolicyviolation რაოდენობა 0. {"violations":0}

Cleanup: `[{"restore":"PASS","fields":["blocked","blocked_reason","verified","verified_at"],"method":"auth-probe SQL; exact profile ID + email"},{"messages":0,"conversations":0,"requests":0,"offers":0,"contacts":0,"photos":0,"remaining":0}]`

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
