# MeetAny — UX რეფერენსები (Mobbin + design-knowledge)

2026-10-13 · წყარო: Mobbin MCP (`search_flows`, `search_screens`, web + iOS) და design-knowledge MCP. ეს ფაილი ავსებს [MOBBIN-REFS-GE.md](../../MOBBIN-REFS-GE.md)-ს და [COMPETITOR-DESIGN-GE.md](../../archive/reports/COMPETITOR-DESIGN-GE.md)-ს და **არ იმეორებს** მათ: სია/VIP, დეტალის თავი, პროფილის თავი, ჩატის რიგი, 404, თარიღის ველი, auth-ის როლის ბარათები, admin-ის ცხრილი/ჟურნალი, Tripadvisor/eBay-ის ფილტრების sheet — იქ უკვე წერია. ქვემოთ — ახალი ეკრანები.

სქრინშოტები არ ინახება (Mobbin `image_url` ვადაგასულია 30 დღეში და short-link ავტორიზაციას ითხოვს); ბმულები — `mobbin_url`. ტექსტი ქვემოთ ეყრდნობა მხოლოდ იმას, რაც ინსტრუმენტის დაბრუნებულ სურათზე ჩანდა. flow-ის შიგნით ცალკეულ ეკრანს ინსტრუმენტი ცალკე URL-ს არ აძლევს — ვწერ flow-ის ბმულს და ეკრანის სახელს.

## რაც ინსტრუმენტებმა ვერ დააბრუნა (არ გამოვიგონე)

- **Stripe Dashboard, Shopify home, Notion, Linear, Slack, Airbnb host, Thumbtack quotes, Alibaba RFQ, Fiverr order page** — საძიებო მოთხოვნებზე ეს აპები არ დაბრუნდა (დაბრუნდა Vercel, Substack, PandaDoc, Buffer, Jira, Upwork, Fiverr offers და სხვ.). Thumbtack/Airbnb/Alibaba-ს ძველი მასალა — MOBBIN-REFS §8 და COMPETITOR §1. ამ ფაილში მათზე ახალი მტკიცება არ არის.
- **design-knowledge** შეიცავს მხოლოდ ამ page-type პატერნებს: e-commerce catalog, PDP, checkout, **app dashboard**, **mobile app UI**, local business, portfolio, news, docs, event. პატერნი **settings / forms / inbox / onboarding / marketplace listing** — **არ არსებობს**; ძიებამ ქართულადაც ვერ იპოვა. ისინი მოძრაობაზეა (Motion/GSAP), არა ფორმის ანატომიაზე; ქვემოთ ვიყენებ მხოლოდ იმ წესებს, რომლებიც პირდაპირ წერია (dashboard, mobile app UI, checkout, toast, tabs, accordion).
- Mobbin-ში **ერთი ამოცანისთვის ერთი კარგი flow** ვერ მოვძებნე ორ თემაზე: (ა) Airbnb host inbox, (ბ) Thumbtack quotes-შედარების ცხრილი. შედარების ეკრანებად აღებულია Upwork/Fiverr/Airtasker/Contra.

---

## 1. კომპანიის პროფილი / პარამეტრები — სექციები, save bar, ჩიპები

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Laravel Cloud · Settings (General) | [screen](https://mobbin.com/screens/bce31f98-3283-4c47-971c-8a0dda21ca4b) | ჯგუფის სათაური + 1 წინადადება ბარათის გარეთ; თითო რიგი = ლეიბლი+ახსნა მარცხნივ, ველი მარჯვნივ; ქვემოთ მცურავი ბარი „Unsaved changes · Reset · Save“ | ჩვენი ერთი გრძელი ფორმა (MOBBIN §15) დავყოთ სახელიან ჯგუფებად; **ერთი** მცურავი ბარი ქვემოთ, ჩნდება მხოლოდ ცვლილებისას (per-section Save არა — იგივე გადაწყვეტილება, რაც §15) |
| Navan · Profile (unsaved bar) | [screen](https://mobbin.com/screens/3af95a27-f75d-4f13-a288-ba37f67fa365) | ბარი ეკრანის ბოლოში მთელი სვეტის სიგანეზე: „You have unsaved changes“ ტექსტი + Revert (outline) + Save changes (filled) | მობილურზე ბარი სრულსიგანიანი, ორი ღილაკი 44px: „გაუქმება“ / „შენახვა“ |
| Pinterest · Edit profile | [screen](https://mobbin.com/screens/244f7004-6485-41a6-b57c-10638a7c6f17) | Reset + Save ცენტრში, ფიქსირებული ქვედა ზოლი; ველის ქვეშ 12px მინიშნება („Add a link to drive traffic“), URL-ის წინასწარი ხედი ველის ქვეშ | მინიშნება ველის ქვეშ, არა ლეიბლში (✅ §15); „საიტის მისამართი“ — ქვეშ ნაცრისფრად `meetany.ge/c/<slug>` |
| Dub · Profile | [screen](https://mobbin.com/screens/049ed2e5-676e-493f-9d99-54f9871983f3) | ბარათის ბოლოს ნაცრისფერი footer „Save changes“ მარჯვნივ; „Industry interests“ = არჩეული ჩიპები + ერთი ღილაკი **„Edit interests“**; textarea-ს ქვეშ მრიცხველი `74/500` | **კატეგორიების არჩევა**: არჩეული კატეგორიები ჩიპებად + „რედაქტირება“ (ჩიპები ფორმაში არ არის ტოგლები — ფორმა მოკლე რჩება); მრიცხველი `N/1000` აღწერაზე (MOBBIN §15 ➕) |
| Clerk · Plan config | [screen](https://mobbin.com/screens/0dcb1707-a8ae-4218-a23a-4976adb5b4d2) | ჩამრთველი + ახსნა ერთ ხაზზე; „Features“ სია: რიგები + „+ Add feature“ ბმული მარჯვნივ სათაურზე; floating „Unsaved changes“ | „დამატება“ სიებისთვის: ტექსტური ბმული სექციის სათაურის მარჯვნივ, არა მთელსიგანიანი ღილაკი |

**read-only კონტაქტი ახსნით.** Mistral AI · Organization ([screen flow Onboarding](https://mobbin.com/flows/c2b22749-584f-45bc-bf34-617b88cc38f1), ეკრანი „Your organization“): „Organization ID“ — ნაცრისფერ, არარედაქტირებად ველში + copy ხატულა; რედაქტირებადი „Organization name“ გვერდით. გადმოვიტანოთ: ტელეფონი/ელფოსტა ნაცრისფერი ველით + 1 წინადადება მიზეზზე („ტელეფონის შეცვლა — მხარდაჭერით“), copy საჭირო არაა. Mistral-იც აჩვენებს „Danger zone“ ცალკე ბარათს წითელი ღილაკით ბოლოში — ანგარიშის გათიშვა/წაშლა იქ.

**ქალაქების multi-select.** Reddit · Add topics ([screen](https://mobbin.com/screens/27e6e6db-c517-41c6-92c3-428198f38d85)): ძიების ველი, `Topics 0/3` მრიცხველი, ჯგუფებად ჩიპები (ჯგუფის სათაური ემოჯით — ემოჯი არა), Back/Next. Apollo · Define target audience ([screen](https://mobbin.com/screens/b1816033-29d0-4a84-b8bc-3b992a43a375)): თითო ფილტრი = ლეიბლი + არჩეული ჩიპები ერთ ხაზზე + პატარა „+“. Fabric · Choose tags ([screen](https://mobbin.com/screens/f38d897b-e786-428d-a321-a491365691cf)): არჩეული ჩიპები ძიების ქვეშ ზემოთ, ქვემოთ ანბანური სია checkbox-ით. გადმოვიტანოთ: ველი = არჩეული ქალაქები ჩიპებად (× ყოველ ჩიპზე) + „+ ქალაქის დამატება“ → ძიების popover/სია checkbox-ით; მრიცხველი თუ ლიმიტი არსებობს (`3/5`). Reddit-ის ჯგუფ-ჩიპების ბადე ჩვენთვის ზედმეტია (ქალაქი ~10 ჩანაწერია).

design-knowledge: **toast** — არამბლოკავი უკუკავშირი, `role="status" aria-live="polite"`, აშკარა dismiss ღილაკი, ფოკუსი არ გადააქვს, მნიშვნელოვანი მოქმედება თვითონ არ ქრება (recipes-interaction #6). გამოყენება: „შენახულია“ save bar-ის შემდეგ (Delphi toast-ის დადასტურება, MOBBIN §16).

---

## 2. მრავალნაბიჯიანი onboarding (კომპანიის რეგისტრაცია, ვერიფიკაცია, მოლოდინი)

| აპი · flow | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| TikTok · Registering a business (13 ეკრანი) | [flow](https://mobbin.com/flows/02c86e73-5b50-4860-b8d0-21df2534a03e) | 3-ნაბიჯიანი ზედა ზოლი `1 Basic information — 2 Verify business — 3 Verify your access` (დასრულებული ✓ ვარდისფერი); ველის ქვეშ 12px მინიშნება („ზუსტად ისე, როგორც დოკუმენტშია“); Back/Next. **მოლოდინის მდგომარეობა**: ყვითელი ზოლი გვერდის თავში „The registration is under review. We'll notify you via … once the review is complete“ + ქვემოთ ჩაწერილი მონაცემები read-only ლეიბლი/მნიშვნელობით | ვერიფიკაციის მოლოდინი = **ერთი ზოლი გვერდის თავში** (რა ხდება + როგორ შეგატყობინებთ) + გაგზავნილი მონაცემები არარედაქტირებადი სიით; ილუსტრაცია TikTok-ის სასტარტო ეკრანზე ჩვენთვის არა |
| Klook · Onboarding (Merchant), 15 ეკრანი | [flow](https://mobbin.com/flows/86826e44-0c7d-48a8-9d85-f525051108f3) | მარცხნივ ნაბიჯების სვეტი „Basic info → Contract → Get results“, ქვენაბიჯებით და ✓-ით; ქვედა **ფიქსირებული ბარი** `Go back / Save & continue`; კატეგორიის არჩევა = 10 ბარათი ხატულით+1 წინადადებით; ატვირთვა = „Upload“ ღილაკი, ქვეშ ფაილის სახელი სამაგრის ხატულით; ბოლო ნაბიჯი „Get results“ | desktop-ზე ნაბიჯების სვეტი არა (ჩვენი ფორმა ერთსვეტიანია) — ზედა ზოლი TikTok-ის მსგავსად; ფიქსირებული ქვედა ბარი — დიახ; ფაილის სტრიქონი „სახელი · ზომა · წაშლა“; **ბარათები ხატულებით კატეგორიისთვის არა** (DS: ხატულა არა) — ჩიპები/სია |
| Airwallex · Completing business profile (12 ეკრანი) | [flow](https://mobbin.com/flows/2f44eca9-8e57-44c5-8e7a-6a90c93e85f8) | მარცხნივ თხელი სია ჯგუფებით „Get started / Business profile / Business owner“, თითო ნაბიჯზე ✓; ერთი კითხვა ეკრანზე (სათაური-კითხვა + 1 წინადადება); „Add websites“: ველი + სანაგვე ხატულა + „+ Add website“ (**add another**); „Sample description“ ბარათი textarea-ს თავზე | add-another სია (ტელეფონები/საიტები): ველი + წაშლის ხატულა, ქვემოთ ტექსტური „+ დამატება“; ნიმუშის ტექსტი textarea-ზე (აღწერა: „მაგ.: ვამზადებთ…“) — placeholder-ად, ბარათად არა |
| Square · Onboarding (11 ეკრანი) | [flow](https://mobbin.com/flows/907619aa-c7b8-420c-bb9b-59954c4a7a0e) | კატეგორიის არჩევა = ერთსვეტიანი **სია ერთხაზიანი ბარათებით** (მთლიანი რიგი დაწკაპუნებადია, არჩეულს ლურჯი ჩარჩო), ზემოთ მარჯვნივ „Next“; დაფაზე შავი ბლოკი „Get set up to bill clients“ — შემდეგი ნაბიჯი „Required“ ბეჯით და „Start“ | მცირე (≤10) სიიდან ერთის არჩევა = ერთსვეტიანი რადიო-რიგები, არა ბადე; „შემდეგი ნაბიჯი“ ბლოკი — იხ. §7 |

**ჩვენთვის:** onboarding = (1) ძირითადი მონაცემები → (2) კატეგორიები/ქალაქები → (3) დოკუმენტი (არასავალდებულო სანამ მფლობელი არ ითხოვს) → (4) „განხილვაშია“ ზოლი პროფილის თავში. არ ვიღებთ: SMS/ხმოვანი ვერიფიკაციის ნაბიჯს TikTok-იდან (ჩვენ ამას არ ვაკეთებთ), Klook-ის ლურჯ ილუსტრირებულ ფონს.

design-knowledge: **checkout** — ნათელი progress ინდიკატორი; label/შეცდომა/დახმარება ველთან; **ნაბიჯზე უკან დაბრუნებისას შეყვანილი მონაცემი ინახება**; ბოლოს confirmation reference-ით და „შემდეგი ნაბიჯებით“; ნაბიჯების ზოლი არ ითამაშოს interactive tabs-ის როლი; reduced motion — ნაბიჯის მყისიერი ცვლა, ხილული და გამოცხადებული შეცდომები (patterns-pages #3).

---

## 3. RFQ / მოთხოვნის განთავსება

| აპი · flow | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Airtasker · Posting a task (19 ეკრანი) | [flow](https://mobbin.com/flows/fe9d9e82-0b6e-4f98-b09f-4bbaa13ed1dd) | ერთი კითხვა ეკრანზე; მარცხნივ მინიმალური ნაბიჯების სია `Title & Date / Location / Details / Budget` (მხოლოდ მიმდინარე bold); „When“ = 3 pill-არჩევანი (ზუსტი თარიღი / მდე / მოქნილი); „Choose all that apply“ — მრავალარჩევანი ფილები; ბოლო ღილაკი სახელდებულია შედეგით **„Get quotes“**; შემდეგ ეკრანი **„Sit tight while we find your Taskers“** + „We'll notify you when new offers come in“ + 0 views + მოთხოვნის შეჯამების ბარათი (Edit ბმულებით) + ცარიელი „No offers yet — you will also be notified via email“ ქვემოთ | ბოლო ღილაკი „მოთხოვნის გამოქვეყნება“ (შედეგით დასახელებული); **გამოქვეყნების შემდეგ** — „რა ხდება ახლა“ ბლოკი: 1 სათაური + 1 წინადადება („შეთავაზებებს ელფოსტით შეგატყობინებთ“) + მოთხოვნის შეჯამება Edit-ით; ცარიელი „შეთავაზებები ჯერ არ არის“ — ტექსტი + ბმული „შეტყობინებების პარამეტრები“ (ილუსტრაცია არა) |
| Upwork · Creating a job (14 ეკრანი) | [flow](https://mobbin.com/flows/8d087fd6-9d62-452b-83ea-0954f8efe6f1) | მრიცხველი `5/5 · Job post`; textarea-ს ქვეშ `50,000 characters left`; ღილაკი „Attach file“ + ქვეშ `Max file size: 100MB`; **გადახედვა**: სექციები (Category, Skills, Scope, Budget), თითოს მარჯვნივ მრგვალი ✏ ხატულა; დაკეცილი სექციები „Screening questions (optional) — Narrow down your candidates“ (აკორდეონი, ახსნა ერთ ხაზზე); ბოლოს „Back“ + `Next: Finalize job post`; გამოქვეყნების შემდეგ მწვანე ზოლი „Congratulations! Your job post is live“ | გადახედვა გამოქვეყნებამდე: ველების ჯგუფები ლეიბლი+მნიშვნელობა + „შეცვლა“ თითოზე; არასავალდებულო (ფოტოები, დამატებითი ინფო) — აკორდეონში ახსნით ხაზზე; ფაილის ლიმიტი ღილაკის ქვეშ ერთ ხაზზე (ჩვენი MA115 წესი) |
| Jobber · Creating a request (client), 4 ეკრანი | [flow](https://mobbin.com/flows/13bc2f40-c708-4405-89a3-3a6e72376e07) | **ერთი გვერდი, ერთი ფორმა** (არა ნაბიჯები): „Service details“ textarea, „Your availability“ — თარიღი კალენდრის ხატულით, არასავალდებულო მეორე ვარიანტი `(optional)` ლეიბლში, ატვირთვა drag-zone „Select or drag a file“ + ფაილის რიგი ფოტო/სახელი/ზომა/წაშლა; Cancel + Submit; შემდეგ ზედა ზოლი „Request submitted. We'll be in touch soon.“ + ახალი ჩანაწერი სიაში „New“ ბეჯით | მოკლე მოთხოვნაზე (ჩვენი ფორმა ≈ 6 ველი) — ერთგვერდიანი ფორმა უკეთესია, ვიდრე ნაბიჯები; დასრულებისას ზოლი + ახალი მოთხოვნა სიის თავში „ახალი“ ბეჯით |
| Behance · Posting a job (10 ეკრანი) | [flow](https://mobbin.com/flows/700bfeff-cb26-46a0-b0cb-dcd8fb50ddcb) | **ვერტიკალური ნაბიჯები ერთ მოდალში** (1 ვინ აქვეყნებს / 2 დეტალები / 3 საჯარო პოსტი) ერთ scroll-ში + ფიქსირებული „Post Job“; შემდეგ „My Jobs“ → ბარათი ბეჯით **„Pending Approval“** (ნარინჯისფერი) | თუ მოთხოვნა მოდერაციაზე გადის — სტატუსი ბარათზე „განხილვაშია“ პატარა ნარინჯისფერი ბეჯით; ნაბიჯები მოდალში — არა (გვერდი უკეთესია მობილურზე) |

**Upwork post-job-ის წინ** ([Upwork home](https://mobbin.com/flows/8d087fd6-9d62-452b-83ea-0954f8efe6f1) — პირველი ეკრანები): „Last steps before you can hire“ — 3 ბარათი „Required to publish a job — Verify your phone number“, „Required to hire — Add a billing method“, დასრულებული „Email address verified ✓“ (ნაცრისფერი). გადმოვიტანოთ: თუ ელფოსტა დაუდასტურებელია — მოთხოვნის გამოქვეყნებამდე ერთი ზოლი „დაადასტურეთ ელფოსტა“ (ფორმა დაბლოკვის გარეშე ივსება).

---

## 4. შეთავაზებების შედარება / არჩევა

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Fiverr · Offers (5) | [screen](https://mobbin.com/screens/19a08112-0866-45fb-9f04-bbf9d642c941) | მარცხნივ **მოთხოვნის ვიწრო სვეტი**: სათაური, ბიუჯეტი, ვადა, „See full brief“, ქვეშ ვერტიკალური პროგრესი `Brief posted → Sourcing → Offers received → Hired`; მარჯვნივ შეთავაზებების ბარათები: სახელი + ადგილი, intro 2 ხაზი, **ფასი და ვადა ორ ლეიბლ-ციფრად**, ერთი outline „View offer“; ჩანართები `Invite / Offers (5)` | შეთავაზებების გვერდი: მარცხნივ მოთხოვნის მოკლე ბარათი + 4-წერტილიანი პროგრესი; ბარათი = კომპანია · ქალაქი · შეთავაზების 2 ხაზი · „ვადა“ მსხვილად · ერთი მოქმედება; პროგრესი ტექსტური წერტილებით (ხატულა არა) |
| Airtasker · Offers | [screen](https://mobbin.com/screens/260d281c-15e8-457a-ab3e-f7a5c332deb7) | ბარათი ორ სვეტად: მარცხნივ ავტორი, **ფასი მარჯვნივ მსხვილად**, ქვეშ ერთი ფილდ „Accept“; მარჯვნივ — **კითხვა-პასუხის თრედი პირდაპირ შეთავაზების ბარათში** (კომენტარები Reply-ით) | „არჩევა“ ღილაკი ბარათზე + მოკლე კითხვა-პასუხის თრედი შეთავაზების შიგნით (ჩატთან ერთად — MOBBIN §8.8 „ჩატი მოთხოვნის კონტექსტში“ ეთანხმება) |
| Upwork · Review proposals | [screen](https://mobbin.com/screens/e0edac2e-f131-4c4c-bc63-da94896725c1) | ჩანართები `All proposals (2) · Shortlisted · Messaged…`; ბარათზე „NEW“ ბეჯი, მოქმედებები რიგში: 👍 👎 `Message` `Hire`; პირველი გახსნისას modal „How to Hire“ 3 წერტილით (Invite / Interview / Hire) და ერთი „Got it!“ | ჩანართები სტატუსით და რაოდენობით (✅ MOBBIN §6); „ახალი“ პატარა ბეჯი ბარათზე; ერთჯერადი ახსნა — **არა modal**, არამედ ერთი ხაზი სიის თავში |
| Contra · Applicants | [screen](https://mobbin.com/screens/1e5a6bda-34cd-426f-96af-e99a71f1b077) | ჩანართების ზოლი ეტაპებით `Applicants 30 › Shortlisted 0 › Messaged 3 › Hires 0 · Not a fit 0` (მიმდინარე bold); ბარათზე ორი ნიშანი ორ ხაზზე: ციფრები `$5k+ Earned · 6x Hired · ★5.0`, მარჯვნივ „Messaged“ + მუქი „Hire“ | **ეტაპის ზოლი რაოდენობით** = „შეთავაზებები N · შერჩეული N · არჩეული“; ბარათზე ორი ციფრი კომპანიის ნდობისთვის (პროექტების რაოდენობა, წლები) |
| Dribbble · Service modal | [screen](https://mobbin.com/screens/4b6b502c-003c-4029-b6fb-8583388a90ce) | მარჯვენა ბარათი: ფასი 28px, ქვეშ „Concepts · Duration“, ორი ღილაკი **Hire Now (filled) / Request Service (outline)**; ქვემოთ ავტორის ბარათი `Responds within a day · 23 projects completed` | „არჩევის“ ბარათის ფორმა: ერთი მთავარი + ერთი მეორადი (ჩატი); ავტორის ქვეშ „პასუხობს X დღეში“ — მხოლოდ თუ რეალური მონაცემია |

**არჩევის დადასტურება.** Mobbin-ზე ნახულ ნიმუშებში (Upwork „Hire“, Airtasker „Accept“, Contra „Hire“) არჩევა ერთი დაწკაპუნებაა, დადასტურების modal-ის გარეშე; შედეგი — ეტაპის ცვლა ზოლში. ჩვენთვის (არჩევა შეუქცევადად ხურავს სხვა შეთავაზებებს — **ეს ჩვენი ბიზნეს-წესია, რეფერენსით არ დასტურდება**): მცირე დადასტურება ტექსტით „აირჩიეთ [კომპანია]? დანარჩენი შეთავაზებები დაიხურება“ + ორი ღილაკი — იგივე ანატომია, რაც Neon/Square-ის დადასტურების დიალოგებს (§9).

---

## 5. გარიგება / პროექტი — მილესტოუნები და პირობების დადასტურება

| აპი · flow | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Upwork · Contract details (client) | [flow](https://mobbin.com/flows/e362d3c2-551b-4546-9641-b7d9ed31ed19) | მუქი მწვანე თავი: სათაური + ადამიანი + ჩანართები `Overview / Timesheet / Messages / Contract details`; ქვეშ **ერთი ნაცრისფერი ზოლი 5 რიცხვით** (Project price · Funds · Paid · Remaining · Total); **Milestone timeline**: ნომერი, სახელი, თანხა, ბეჯი „Active & funded“, ქვეშ „Last activity“ + წითელი წერტილით **„Action required“** წინადადება ვადით („თუ არაფერი გააკეთეთ Oct 3-მდე — თანხა გათავისუფლდება ავტომატურად“) + მთავარი ღილაკი „Review and pay“; მარჯვნივ „Recent files“; ქვემოთ „Recent activity“ ცხრილი თარიღი/აღწერა | **მოქმედება საჭიროა** = ერთი ბლოკი ეტაპის ქვეშ: რა ელის, ვისგან, **რა მოხდება, თუ არაფერი გაკეთდა და როდის** + ერთი ღილაკი; აქტივობის ჟურნალი თარიღი/წინადადება (ვინ რა გააკეთა) — ჩვენი audit-ის კლიენტური ვერსია; რიცხვების ზოლი — მხოლოდ თუ ჩვენ გვაქვს რიცხვები (მილესტოუნზე ფული ჩვენთან არ არის → ზოლი არა) |
| Upwork · Paying a contract | [flow](https://mobbin.com/flows/76c0f49b-d95e-44b7-8135-a276d9945000) | გვერდითი პანელი (drawer) „Review and pay“: **1. Review submission** (შეტყობინება + ფაილი) → **2. Approve and pay** (თანხა, ბონუსი არასავალდებულო) → `Pay now` + `Request changes` (outline); დასრულება — „Success! … will be paid shortly“ + „Close“ | პირობების დადასტურება = drawer ორი დანომრილი ნაბიჯით (გაეცანით → დაადასტურეთ) და ორი ღილაკი: „დადასტურება“ / „ცვლილების მოთხოვნა“; დასრულებაზე ილუსტრაცია არა |
| Contra · Project detail | [flow](https://mobbin.com/flows/e0147ea2-9e45-4c70-b9ab-9c3d80971c1d) | სია: სტატუსი „IN PROGRESS“ ბეჯი, „Last update“ ერთი წინადადება, ქმედება პატარა outline „Pay invoice“ სტრიქონში; დეტალი: ჩანართები `Activity / Scope / Invoices •` (წერტილი = სიახლე); მარცხნივ „START DATE → EST. END DATE“ ბარათი, ქვეშ label/value ცხრილი (FEE STRUCTURE, RATE…); მარჯვნივ ვიწრო „Project Details“ პანელი + „Download Contract“ | ჩანართები `მიმოხილვა / პირობები / აქტივობა` წერტილით; პირობების ცხრილი = მცირე ზედა-ასოებიანი ლეიბლი (12px) + მნიშვნელობა — ჩვენი ლეიბლი:მნიშვნელობა ფორმატი (COMPETITOR §1 alibaba) |
| Upwork · Contract (freelancer) | [flow](https://mobbin.com/flows/0a203747-b659-41e9-ac60-394043c8f4c2) | ჩანართები ფილტრად `All / Active Milestones (1) / Awaiting (0) / Payment Requests (0)`; „Feedback“ ბარათი ამბობს **რატომ არ არის ხელმისაწვდომი ჯერ** („14 დღის შემდეგ“) და ღილაკი disabled | disabled ქმედებას გვერდით 1 წინადადება „რატომ“ (ასევე read-only კონტაქტის წესია §1) |

---

## 6. ჩატი / inbox და შეტყობინებების ცენტრი

ჩატის რიგი, ორპანელიანი inbox, Angi/Zillow/Dribbble — MOBBIN §5, §8.2. ახალი:

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Intercom · Inbox | [screen](https://mobbin.com/screens/83c79ee4-1b7a-4903-b4d9-0395f68874d7) | 3 სვეტი: ფილტრები · საუბრების სია (`5 Open · Last activity`) · ჩატი · მარჯვნივ „Details“ ჩანართით: assignee, links, attributes (ID, Brand), დაკეცადი სექციები | desktop: სია · ჩატი · **მარჯვენა ვიწრო პანელი „მოთხოვნა“** (სათაური, ვადა, სტატუსი, ბმული) — იგივე, რაც MOBBIN §8.3 Upwork; დაკეცადი სექციები არა (ჩვენ მცირე ველია) |
| Pipedrive · Live Chat | [screen](https://mobbin.com/screens/e25d575f-0d00-4d89-b06a-c1d9b0d1b862) | საუბრების სია ჯგუფებად `My conversations (1) / Unassigned (0) / Closed conversations` დაკეცადი; ჩატში სისტემური ხაზები „You joined the conversation · 12:29 PM“; მარჯვნივ Details | ჩატში სისტემური ხაზები ნეიტრალურად („შეთავაზება გაგზავნილია“, „კომპანია არჩეულია“) — ბუშტის გარეშე, ცენტრში ნაცრისფრად |
| Deel · Notifications | [screen](https://mobbin.com/screens/34b77080-b18f-47f9-863a-959f6d7d7821) | გვერდი, ზემოთ `Activity Feed 20` + ფილტრები Date/Categories + „Mark all as read“ მარჯვნივ; რიგი: ხატულა წერტილით, **სათაური bold + 1 წინადადება მიზეზით/რა გააკეთოთ + თარიღი** | შეტყობინების რიგი = სათაური + 1 წინადადება + დრო; unread = წერტილი (✅ MOBBIN §5) |
| Sketch · Updates | [screen](https://mobbin.com/screens/f16135f5-9086-4271-bb18-0b95b10db12c) | ჩანართები `Unread 2 / Read`, ცალკე `Mark all as read` ღილაკი checkmark-ით; ერთი რიგი = წერტილი · კონტექსტი (პროექტი/დოკუმენტი) პატარად · ტექსტი · ტიპი · დრო | ჩანართები „წაუკითხავი N / წაკითხული“; კონტექსტის პატარა ხაზი რიგის ზემოთ = მოთხოვნის სახელი |
| Todoist · Notifications | [screen](https://mobbin.com/screens/c6a5fe74-6389-4d7e-8e85-980cb1010b9b) | `All / Unread` სეგმენტი; რიგში მხოლოდ ტექსტი + მრგვალი „წაკითხულად მონიშვნა“ მარჯვნივ; თავში მუქი `Mark all as read` გაუქმებულია, თუ არაფერია | თუ წასაკითხი არ არის — „ყველას წაკითხულად მონიშვნა“ disabled (არა დამალული) |
| Homerun · Notifications | [screen](https://mobbin.com/screens/85f6974f-2211-4b28-931a-4bfffafe36e0) | „Jen Doe applied“ ერთი ხაზი + დრო · ვაკანსია; თავში „Clear all“; სია ფერადი ავატარებით | **ჩვენთვის სიგნალი რას არ ვიღებთ:** ფერადი ილუსტრაციული ავატარები და ჩრდილიანი ბარათი თითო რიგზე (DS: რიგს ჩარჩო/ჩრდილი არა) |

---

## 7. დაფა / მიმოხილვა — სტატ-ბარათები, „შემდეგი ნაბიჯი“, ცარიელი მდგომარეობა

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Substack · Home | [screen](https://mobbin.com/screens/4e90246b-6a6e-40b7-b276-a2a161b5325e) | **„Getting started“ ბარათი**: ზემოთ პროგრესის ხაზი, ქვეშ 4 რიგი (მთელი რიგი დაწკაპუნებადია, ისარი მარჯვნივ), დასრულებული რიგები ნაცრისფერი ✓-ით, ბოლოს „Continue setup“; ქვემოთ Overview: 3 მეტრიკა ერთ ზოლში ჩანართებით | **„შემდეგი ნაბიჯი“ = ერთი ბარათი ჩეკლისტით** (პროფილი შევსებულია → კატეგორიები → ქალაქები → დოკუმენტი); დასრულებული ნაცრისფერი; ბოლო ღილაკი ერთი |
| Square · Home (onboarding) | [flow](https://mobbin.com/flows/907619aa-c7b8-420c-bb9b-59954c4a7a0e) | შავი ბლოკი თავში „Get set up to bill clients“: ორი ნაბიჯი ვერტიკალური ხაზით, პირველზე ბეჯი **„Required“**, ღილაკი „Start“; ქვეშ „Key Metrics“ ნულებით `$0.00 / N/A` | მნიშვნელოვანი ბლოკი — ერთი, თავში, „სავალდებულო“ ბეჯით; ნულოვანი მეტრიკები **არა** (იგივე წინააღმდეგობა, რაც MOBBIN §6 Jobber) |
| Buffer · Home | [screen](https://mobbin.com/screens/29f01d44-ab0e-4391-a7e9-6b344506e465) | „First Steps“ — 3 ბარათი ერთ რიგში, ერთი ღილაკი თითოში; **ცარიელი მდგომარეობა ორ სვეტად**: ხატულა + „No posts scheduled yet. You'll see upcoming posts here.“ | ცარიელი = 1 წინადადება „რა გამოჩნდება აქ“ (ხატულა ჩვენთვის არა, DS §8); „უახლოესი“ და „პასუხები“ ორ სვეტად |
| Vercel · Overview | [screen](https://mobbin.com/screens/71889386-ec08-4bcf-851d-3c431af4db45) | პატარა „Production Checklist 4/6“ ბარათი ჩეკბოქსებით; ცარიელი „No Active Branches — Commit using our Git connections.“ (სათაური + მოქმედების მინიშნება) | ცარიელს მოაქვს **შემდეგი მოქმედება**, არა მხოლოდ „არაფერია“ |
| Jira · Summary | [screen](https://mobbin.com/screens/fdeb0210-91df-45f3-9bf6-9d41f2292c25) | 4 მეტრიკა ერთ რიგში („0 completed in the last 7 days“) — ლეიბლი ქვეშ, ხატულა მცირე; „No activity yet“ + 1 წინადადება + ბმული | მეტრიკა = რიცხვი + ლეიბლი + პერიოდი ერთ ბლოკში |
| PandaDoc · Home | [screen](https://mobbin.com/screens/ca6fede4-b6f2-4a6d-bcf4-499542dcc3d2) | 9 დიდი ფერადი ბარათი სტატუსების მიხედვით — **სიგნალი რას არ ვიღებთ**: ფერი სტატუსზე ისე მძიმეა, რომ ნულებიც ყვირის | ჩვენ სტატუსი = ტექსტი + 8px წერტილი (MOBBIN §6) |

design-knowledge **App dashboard** (patterns-pages #7): სექციები = სათაური + მთავარი მოქმედება → მეტრიკები → ფილტრები/პერიოდი → მთავარი ცხრილი → აქტივობა; **loading / empty / error / stale მდგომარეობა — იმავე რეგიონში, რომელსაც ეხება**; მკვრივი ხედი — სტაბილური გასწორება და ფოკუსი; **რას ერიდოს**: მეტრიკის pulse, ხატულა-ანიმაცია, hover ცხრილის რიგზე, სრული მონაცემის ანიმაცია. ცხრილის სორტირებისას ფოკუსი/არჩეული რიგი ინახება.

---

## 8. Auth — როლი, next, ელფოსტის დადასტურება

როლის ბარათები (Instagram), Workable/Felt ველები — MOBBIN §14. ახალი:

| აპი · flow/ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Mistral AI · Onboarding (14 ეკრანი) | [flow](https://mobbin.com/flows/c2b22749-584f-45bc-bf34-617b88cc38f1) | ნაბიჯი 1: ელფოსტა; ნაბიჯი 2 — **ელფოსტა ბრუნდება წაკითხვადი ნაცრისფერი ველით + „Edit“**, ქვეშ პაროლი/სახელი/გვარი; **კოდის ეკრანი**: „An email containing a verification code has been sent“, 6 უჯრა `619·87_`, ქვეშ „Did not receive your code? Resend one.“, ქვემოთ ელფოსტა + „Change account“; შემდეგ „Create your team“ (ერთი ველი + თანხმობა) | დადასტურების ეკრანი: 1 წინადადება + **მისამართი ხილვადია** + „ხელახლა გაგზავნა“ + „მისამართის შეცვლა“; კოდის ნაცვლად ჩვენ ლინკია (თუ ასეა) — მაშინ „გავხსენი ელფოსტა“ ბმული, 6 უჯრა არა |
| Postman · Onboarding (12 ეკრანი) | [flow](https://mobbin.com/flows/ef987d17-8158-47c1-a76f-65b9e4e84fe4) | „Verify your account“: ერთი ველი `Enter 6 digit code`, ორი ღილაკი **Verify Account (filled) / I've Verified My Account (outline)**, ქვეშ „Didn't receive the email? Resend verification code“; შემდეგ „Tell us a bit about yourself“: სახელი + **როლი dropdown-ით** | როლი რეგისტრაციის შემდეგ, პროფილის ნაბიჯად (dropdown) — ალტერნატივაა ახლანდელი „როლი ველებამდე“; ორ ღილაკს აქ ვერიფიკაციის „გავაკეთე“ სტატუსის ხელით შესამოწმებლად — ჩვენ ერთი „უკვე დავადასტურე“ ბმული საკმარისია |
| Jira (Atlassian) · Onboarding | [flow](https://mobbin.com/flows/a9262dda-0fb7-4350-ac55-a9b8b1a5b29c) | ეკრანი **„Email address verified ✓ — Finish setting up your account“**: დადასტურებული ელფოსტა bold-ად, ქვეშ ორი ველი (სახელი, პაროლი) `Password must have at least 8 characters` ველის ქვეშ ერთ ხაზზე | დადასტურების შემდეგ დაბრუნება = ერთი ეკრანი „ელფოსტა დადასტურებულია“ + მომდევნო ნაბიჯი (პროფილის შევსება) |
| Kiwi.com · Onboarding | [flow](https://mobbin.com/flows/fd6b2919-6091-4fe1-9017-9861f2947874) | auth modal **გვერდზე, საიდანაც მოვიდა მომხმარებელი** (ძიების გვერდი ფონზე დარჩა): „Create a new account · Already have an account? Sign in“, ელფოსტა, Continue; ამოსვლის შემდეგ იგივე გვერდი ავატარით | **next-ით დაბრუნება**: შესვლის შემდეგ იმავე გვერდზე დაბრუნება (მოთხოვნა/კომპანია, საიდანაც დაიწყო); modal-ი შესაძლებელია სწრაფი შესვლისთვის, მაგრამ MeetAny-ს ცალკე გვერდია (მობილურზე უკეთესი) — ამიტომ `?next=` + ფორმის თავზე „შესვლა საჭიროა [მოქმედების] გასაგრძელებლად“ ხაზი |

არ ვიღებთ: Google/Apple/Microsoft/Slack ღილაკებს (ყველა ზემოთ აქვს; ჩვენ მხოლოდ ელფოსტა+პაროლი — MOBBIN §14 უკვე ამბობს).

---

## 9. ადმინის მოდერაცია — სია, დეტალი, მოქმედება მიზეზით

ცხრილი/ფილტრი/ჟურნალი — MOBBIN §17 (Klaviyo, Shopify, Supabase, Wix, Cloudflare, Fibery). ახალი: დადასტურების დიალოგები.

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Neon · Delete this User? | [screen](https://mobbin.com/screens/2a018965-c088-42f9-887c-1c9a54cb2a98) | modal: სათაური კითხვა; **წითელი ფონის ბლოკი შედეგის ახსნით** („ამ მომხმარებელს ვეღარ შეძლებს შესვლას“); Cancel (outline) მარცხნივ + Delete (წითელი filled) მარჯვნივ | დაბლოკვა/უარყოფა: შედეგის ახსნა ცალკე ბლოკად; **ქვემოთ „მიზეზი“ textarea (სავალდებულო)** — ეს რეფერენსებში არ არის, ჩვენი მოთხოვნაა; ღილაკი disabled, სანამ მიზეზი ცარიელია |
| Square · Deactivate plan | [screen](https://mobbin.com/screens/f6a677be-0e78-47ae-935a-393c0b78cf4b) | **ღილაკის ტექსტი = მოქმედება** („Deactivate plan“, არა „OK“); ტექსტში მოქმედების ობიექტი bold-ად და რა არ შეიცვლება („არსებულ გამოწერებზე არ მოქმედებს“) | ღილაკი „კომპანიის დაბლოკვა“, ტექსტში კომპანიის სახელი bold-ად + რა დარჩება (მოთხოვნები/ჟურნალი) |
| Whop · Ban users | [screen](https://mobbin.com/screens/b7f5462d-d448-4e06-b82a-2056117a5ea0) | ერთხაზიანი კითხვა კონკრეტულ ობიექტზე („1 user from X“), Cancel / Confirm (წითელი) | მასობრივი მოქმედების რიცხვი ტექსტში („3 მოთხოვნა“) |
| Docusign · Close User | [screen](https://mobbin.com/screens/7fe3eee5-87c3-4cb5-a463-fe375437a6ff) | **checkbox მოდალში** დამატებითი შედეგისთვის („ამოღება ყველა ჯგუფიდან“) | არასავალდებულო შედეგი (მაგ.: „დახურვა ღია მოთხოვნებიც“) checkbox-ად დიალოგში, არა ცალკე დიალოგად |
| Mixpanel · Delete 1 Profiles? | [screen](https://mobbin.com/screens/93935092-56c1-4958-aedc-8dfb58a40ce2) | ცხრილში მონიშნული რიგის ზევით ზოლი „1 selected ×  · Delete“ (bulk action); დიალოგი ორ წინადადებად | bulk მოქმედება — ზოლი ცხრილის თავზე მხოლოდ მონიშვნისას (ჩვენთვის: რიგზე დაწკაპუნება → დეტალის პანელი, MOBBIN §17 Shopify) |

**დეტალის პანელი** (მხარეს გასახსნელი, MOBBIN-ში Contra-ს მარჯვენა „Project Details“, Intercom-ის „Details“): რეფერენსად ვიყენებთ Intercom/Contra-ს მარჯვენა პანელს — ლეიბლი 12px + მნიშვნელობა + მოქმედებები ქვემოთ. ამ ტიპის ცალკე „admin user detail“ ეკრანი Mobbin-ის ძიებამ არ დააბრუნა.

---

## 10. მობილური — sheet, sticky CTA, ფილტრები, ჩიპების ზოლი

Tripadvisor/eBay/Vivino/Beli sheet — MOBBIN §7. ახალი:

| აპი · ეკრანი | Mobbin | რა არის კარგი | MeetAny-ში |
|---|---|---|---|
| Mercury · Filters (iOS) | [screen](https://mobbin.com/screens/f8e44e87-126f-43d2-9989-77e1fd089481) | თავში „Filters“ + ×; **აკორდეონი რიგები** (Date / Methods / Status…) მარჯვნივ არჩეული მნიშვნელობა („This Week“) ჩაკეცილზეც ჩანს; ქვემოთ filled „See Results“ + ტექსტური **„Clear Filters (3)“ — რიცხვი აქტიური ფილტრების** | ჩაკეცილ რიგზე არჩეული მნიშვნელობა; „გასუფთავება (3)“ რაოდენობით |
| Insight Timer · Filter by (iOS) | [screen](https://mobbin.com/screens/f532c0e9-58ed-44c0-9d6e-572b20aeba58) | ჩიპები pill, არჩეული — **შავი filled**, „All“ პირველი ჩიპი; ქვედა ბარი „Clear all“ (ნაცრისფერი ტექსტი) + `Show 169 results` | „ყველა“ ჩიპი პირველად; (არჩეული შავად — **არა**: ჩვენი DS ამბობს `--selected-bg`, MOBBIN §7) |
| Yazio · Filter (iOS) | [screen](https://mobbin.com/screens/9f31cf0b-3123-49e1-8eb4-5df1e0c15a78) | **ფიქსირებული მრგვალი ღილაკი „See 94 Recipes“ შიგთავსის ზემოთ** (ჩიპებს ფარავს ბოლო რიგს) — **სიგნალი რას არ ვიღებთ**: ფარავს შინაარსს; ემოჯიანი ჩიპები | ბარს ქვემოთ padding უნდა ჰქონდეს, რომ ბოლო ჩიპი არ დაიფაროს |
| Depop · Listing (iOS) | [screen](https://mobbin.com/screens/c0e17409-4cc1-4b64-83c6-2550b19551e8) | **sticky ქვედა ბარი**: ფასი მარცხნივ + ორი ღილაკი (**Offer — outline / Buy — filled**); ზევით გამყიდველის ბარათი „Visit shop / Ask a question“ | MeetAny დეტალზე ბარი: მარცხნივ „კიდევ N დღე · N შეთავაზება“ (ფასის ადგილას — MOBBIN §3) + მარჯვნივ ერთი filled „შეთავაზების გაგზავნა“ |
| Vestiaire Collective · Listing | [screen](https://mobbin.com/screens/92d3ecc0-c19a-4360-969e-0cd8e3adb692) | ბარი სამი ელემენტით: **კვადრატული ჩატის ხატულა** · „Make an Offer“ outline · „Add to Bag“ filled; შიგთავსი — დაკეცადი სექციები (Description/Details/Returns) | ჩატის ხატულა ბარის მარცხნივ + ერთი filled; დაკეცადი სექციები გრძელ მოთხოვნაზე |
| Vivino · Wine details | [screen](https://mobbin.com/screens/40a06f0b-46e5-48c9-b9fe-c19d69baf581) | ბარი: ერთი **სრულსიგანიანი** მწვანე „Buy now“ + კვადრატი bookmark ხატულა მარჯვნივ | ერთი მთავარი + „შენახვა“ ხატულა — მარტივი ვარიანტი, თუ ჩატი მეორეულია |
| Grailed · Listing | [screen](https://mobbin.com/screens/f0d9f701-4f21-4eb7-b887-dc9778f9ae3c) | ბარი **ქვედა ტაბ-ბარის ზემოთ** (ორი ფენა) — **სიგნალი რას არ ვიღებთ**: ორი ფიქსირებული ზოლი ჭამს ეკრანს | ჩვენ მობილურზე ქვედა ტაბ-ბარი არ გვაქვს → ერთი ზოლი |

**ჩიპების ზოლი.** Apollo ([screen](https://mobbin.com/screens/b1816033-29d0-4a84-b8bc-3b992a43a375)) აჩვენებს ჩიპების რიგს ლეიბლით; Preply ([screen](https://mobbin.com/screens/a830f90b-5e12-4415-af31-1afb3cf9c338)) — **აქტიური ფილტრები × ჩიპებად** შედეგების თავზე + „Try removing some filters“ ცარიელ მდგომარეობაში (ფილტრების ჯგუფი სახელით). ჰორიზონტალურად გადასაძრავი ზოლის ცალკე Mobbin ნიმუში მოთხოვნაზე ვერ დაბრუნდა — ამ ფაილში მასზე ახალი მტკიცება არ არის (MOBBIN §7: eBay „Selected (N)“ ჩიპები).

design-knowledge **Mobile app UI** (patterns-pages #8): safe-area, მთავარი მოქმედებები მისაწვდომ ზონაში, **სამიზნეები ერთმანეთისგან დაშორებული**, მნიშვნელოვანი კონტენტი კლავიატურისა და სისტემური ჟესტის ზონის გარეთ; **bottom sheet 250–300 ms ხილული დახურვის ღილაკით** (swipe-only დახურვა არა), `button press` 100–150 ms; reduced motion — მყისიერი ნავიგაცია, ღილაკები კვლავ მუშაობს; **თავიდან**: hover-only კონტროლი, სფეროებად ჩადგმული scroll-ის ხაფანგი, spring overshoot გადახდის ნაკადში, sheet რომელიც შიგთავსის scroll-ს იჭერს. **ფილტრებისთვის catalog პატერნი** (patterns-pages #0): მობილურზე ფილტრები drawer-ში; query/sort/scroll ინახება დეტალიდან დაბრუნებისას; შედეგების რაოდენობის ცვლილება ცალკე გამოცხადდეს.

---

## გადაწყვეტილების ცხრილი

| MeetAny ეკრანი | რომელ ნიმუშს ვყვებით | რატომ |
|---|---|---|
| კომპანიის პროფილი (ფორმა) | Laravel Cloud (ჯგუფები + მცურავი unsaved ბარი) + Dub (ჩიპები + „რედაქტირება“, მრიცხველი) | ერთი Save, გრძელი ფორმა იყოფა, კატეგორიები ფორმას არ ახანგრძლივებს; ეთანხმება §15-ის „ერთი პროფილი — ერთი შენახვა“ |
| ქალაქების არჩევა | Apollo (ჩიპები + „+“) + Fabric (ძიება + checkbox სია) | ~10–80 ჩანაწერი: არჩეული ხილულია ველში, არჩევა — ძიებით |
| read-only კონტაქტი | Mistral (ნაცრისფერი ველი) + Upwork (disabled + მიზეზი) | მომხმარებელი ხედავს, რომ ველი არსებობს და რატომ არ იცვლება |
| შეტყობინებების პარამეტრი | Delphi/GetYourGuide (MOBBIN §16) + toast recipe | უკვე არჩეულია; ახალი მხოლოდ toast-ის წესი |
| კომპანიის რეგისტრაცია / ვერიფიკაცია | TikTok (3-ნაბიჯიანი ზოლი, „განხილვაშია“ ზოლი) + Klook (ფიქსირებული ბარი, ფაილის სტრიქონი) | ყველაზე ახლო B2B ვერიფიკაცია მოლოდინით; ორივე ერთსვეტიანია |
| კატეგორიების არჩევა onboarding-ში | Square (ერთსვეტიანი რიგები) ან Dub (ჩიპები) | ხატულიანი ბარათები (Klook) DS-ს არ ერგება |
| ატვირთვის სტრიქონი | Klook + Jobber (სახელი · ზომა · წაშლა) | იგივე ანატომია ორ აპში; ლიმიტი ღილაკის ქვეშ (Upwork) |
| მოთხოვნის შექმნა | Jobber (ერთგვერდიანი ფორმა) + Upwork (გადახედვა `✏`-ით, არასავალდებულო აკორდეონში) | ჩვენი ფორმა მოკლეა; ნაბიჯები (Airtasker 19 ეკრანი) ზედმეტია |
| გამოქვეყნების შემდეგ | Airtasker „Sit tight…“ + Jobber ზოლი „submitted“ | „რა ხდება ახლა“ + შეჯამება Edit-ით + ცარიელი შეთავაზებები ტექსტით |
| შეთავაზებების სია | Fiverr (მოთხოვნის სვეტი + 4-წერტილიანი პროგრესი) + Contra (ეტაპის ზოლი რაოდენობით) | შედარება ორ ლეიბლ-ციფრზე (ვადა + შეთავაზება), ერთი მოქმედება ბარათზე |
| არჩევის დადასტურება | Neon/Square დიალოგის ანატომია | შედეგის ახსნა ბლოკად, ღილაკი = მოქმედების სახელი; დადასტურება ჩვენი ბიზნეს-წესია (დანარჩენი იხურება), არა Mobbin-ის |
| გარიგების/პროექტის ეკრანი | Upwork contract (Action required + ვადა) + Contra (პირობების ცხრილი ზედა-ასოებიანი ლეიბლით) | „რა მოხდება, თუ არ გააკეთეთ“ — ყველაზე ღირებული ელემენტი; ფულის რიცხვების ზოლი არა |
| ჩატი / inbox | Intercom/Pipedrive (მარჯვენა პანელი, სისტემური ხაზები) + MOBBIN §5/§8.2 | მარჯვენა პანელი = მოთხოვნა; ახალი — სისტემური ხაზები |
| შეტყობინებების ცენტრი | Deel (სათაური + 1 წინადადება + დრო) + Sketch (Unread/Read) | სია ჩარჩოს გარეშე; Homerun-ის ბარათები არა |
| დაფა | Substack (ჩეკლისტი-ბარათი) + Buffer (ცარიელი ორ სვეტად) + design-knowledge dashboard | ერთი „შემდეგი ნაბიჯი“ ბლოკი; ნულოვანი მეტრიკები არა; ცარიელი = მოქმედება |
| auth / ელფოსტის დადასტურება | Mistral (ხილული მისამართი + Resend + Change) + Jira („დადასტურებულია“) + Kiwi (`next` დაბრუნება) | ვერიფიკაციის ეკრანი ამბობს ვის გაუგზავნეს და რა გააკეთოს, თუ ვერ მიიღო |
| ადმინის მოქმედება მიზეზით | Neon (შედეგის ბლოკი) + Square (ღილაკი=მოქმედება) + ჩვენი სავალდებულო მიზეზი | მიზეზის ველი რეფერენსში არ არის — ჩვენი დამატებაა და ასე მარკირებულია |
| მობილური ფილტრები | Mercury („Clear (3)“, არჩეული მნიშვნელობა ჩაკეცილზე) + MOBBIN §7 (Tripadvisor „Show N“) | ორივე ნიმუში ერთსა და იმავე ქვედა ბარს იძლევა |
| მობილური sticky CTA | Depop (მარცხნივ ფაქტი, მარჯვნივ ერთი filled) + Vestiaire (ჩატის ხატულა) | ჩვენთვის „ფასის“ ადგილზე — ვადა/შეთავაზებები |

## გამოუყენებელი ნიმუშები (სიგნალი რას არ ვიღებთ)

Homerun (ჩრდილიანი ბარათი თითო შეტყობინებაზე), PandaDoc (მძიმე ფერადი სტატუს-ბარათები), Yazio (ბარი ფარავს ჩიპებს), Grailed (ორი ფიქსირებული ზოლი), Klook (ხატულიანი კატეგორიის ბარათები, ილუსტრირებული ფონი), Upwork (modal „How to Hire“, წარმატების ილუსტრაცია), ყველა social-login ღილაკი, ნულოვანი „Key Metrics“ (Square).
