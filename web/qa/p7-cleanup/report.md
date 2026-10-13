# T7.11 — რეპოს დალაგება

## ცვლილებები

- Root `.gitignore`: QA PNG/JPG/JPEG/WebP და `shots/` ლოკალურად რჩება; `ref-mobbin/**` გამონაკლისია. ისტორია და tracked ფაილები არ ამოღებულა.
- 9 TSX ფაილში 11 `<img>` ჩანაცვლდა `next/image`-ით ან საერთო `ui/Avatar`-ით. არსებული CSS ზომები/მორგება შენარჩუნებულია; ყველა Image-ს აქვს width/height და alt. დასაშვებ წყაროებზე გამოიყენება `optimizable`, ლოკალურ blob preview-ზე — `unoptimized`.
- `RequestViewPageContent.tsx`: მხოლოდ ავატარის სტრიქონი და შესაბამისი import შეიცვალა. ფოტოს არმქონე ავტორზე საერთო Avatar-ის ნეიტრალური პროფილის ხატულა ჩანს.
- შეცვლილი კომპონენტები: `BusinessIdeas`, `PhotoField`, `AdminContentEditor`, `AdminEditPanel`, `CompanyProducts`, `AdminPhotos`, `ImageUpload`, `RequestViewPageContent`; გვერდი: `app/(ideas)/ideas/[slug]/page.tsx`.

## მკვდარი კომპონენტები

`ROLES-AUDIT-2026-09-29.md` §4.4-ის სრული სია: `CompanyRow`, `DirectionPhotoCard`, `MobileActionBar`, `PartnershipCTA`, `SectionHead`.

ხუთივე უკვე წაშლილი იყო საწყის checkout-ში; მათზე `ctx grep <სახელი> tsx,ts,js,mjs` თითოეულმა 0 შედეგი დააბრუნა. შესაბამისი კომპონენტები/სახელობითი CSS ფაილები არ არსებობს. ამ ცვლილებით წაშლილი: 0; გამოყენების გამო დატოვებული: 0; უკვე შესრულებულად აღრიცხული: 5.

## შემოწმებები

- `git check-ignore -v web/qa/x/new.png`: იგნორირებულია root `.gitignore`-ით.
- `git ls-files web/qa | grep -c png`: **1931 → 1931** (ორკესტრატორის მიერ დაზუსტებული საწყისი რაოდენობა).
- `ref-mobbin/new.png` გამონაკლისი შენარჩუნებულია; `p7-cleanup/shots/new.png` იგნორირებულია.
- `npx eslint app`: **0 error / 0 warning**.
- `npx tsc --noEmit`: **0 შეცდომა**.
- `npm run lint:design`: წარმატებულია.
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: **118 pass / 0 fail**, Node v22.23.2.
- `git diff --check`: სუფთა.

პირველ გაშვებაში npm-მა Node v26.5.0 გამოიყენა: `auth-bootstrap`, `auth-session-cache`, `pending-company-profile` ფაილები არ სრულდებოდა; 125 წამზე გაჩერების შემდეგ სხვა 103 ტესტი წარმატებული იყო. დამატებითი მცდელობაც გაიჭედა. Node 22-ზე იგივე უცვლელმა ნაკრებმა 7.3 წამში სრულად გაიარა. ამ ნაკადში auth კოდი და ტესტები არ შეცვლილა.

## ვიზუალური QA

ლოკალური ბაზა: `meetany_preview_p7_cleanup`; dev: 3706; auth fixture: 3716. ცოცხალი Auth/production ბაზა არ გამოყენებულა. ფოტოები აირჩა preview-ისთვის; ფორმების ცვლილებები არ შენახულა.

ბაზიდან შერჩეული კომპანია: `3d12ff1f-0d72-4a53-a92f-1830cfd5b290`; ფოტოს მქონე მოთხოვნა: `ea9e0391-2fba-44f1-8be3-84ea8896dab9`. პროდუქტები რეალურად `meetany_private.company_products`-შია (`items` JSON), არა `public.company_products`-ში.

გამეორება `web/`-დან: `node qa/p7-cleanup/spot-check.mjs`. Playwright Chromium იყენებს დაყენებულ Google Chrome-ს. `results.json` ინახავს თითოეული ხილული სურათის ჩატვირთვის სტატუსს/ზომას, overflow-სა და pageerror-ს; JWT მასში არ იწერება.

**შედეგი: 39 სცენარი, 478 სურათის ჩატვირთვის შემოწმება, 0 გატეხილი სურათი, 0 pageerror, 0 ჰორიზონტალური overflow.** სამივე ზომის სკრინშოტები ვიზუალურად გახსნილია.

სკრინშოტები: `web/qa/p7-cleanup/shots/*-{1440,390,360}.png` (იგნორირებულია, commit-ში არ შედის). დაფარვა: იდეების სია/დეტალი, კომპანიის პროფილი პროდუქტებით, მოთხოვნის დეტალი ფოტოთი/ავტორის ავატარით, ადმინის ფოტოები/რედაქტირება/კონტენტის რედაქტორი, ანგარიშის გალერეა და blob preview, მოთხოვნის PhotoField და blob preview, პროდუქტების რედაქტორი.

ThreadRig-ის `browser open http://localhost:3706/ideas/` ორჯერ დასრულდა timeout/exit 28-ით. ვიზუალური დათვალიერება შესრულდა Playwright-ის რეალური სკრინშოტების გახსნით.

მიგრაციები: 0. push/deploy არ შესრულებულა; დამატებითი worktree/clone არ შექმნილა. ინტეგრაციას ასრულებს ორკესტრატორი.
