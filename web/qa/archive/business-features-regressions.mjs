// Browser interactions use fixtures for all new business writes; SQL tests cover real authorization.
import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const origin=process.env.QA_ORIGIN||'http://localhost:3001';
const ledger=JSON.parse(fs.readFileSync('../DEMO-ACCOUNTS.local.md','utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],writes=[];let companyId='',distributor=false,application=null,membership=null,review=null,failPlan=false;
fs.mkdirSync('qa/shots/business',{recursive:true});
const stamp='2026-09-30T10:00:00Z',requestId='11111111-1111-4111-8111-111111111111';
async function context(){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route('**/api/db/rpc/*',async route=>{
 const name=new URL(route.request().url()).pathname.split('/').at(-1),args=route.request().postDataJSON()||{};let json;
 switch(name){
 case 'company_business_features':json=companyId?[{id:companyId,distributor,plan:membership?.plan||null,rating:review?.status==='published'?review.rating:null,reviewCount:review?.status==='published'?1:0}]:[];break;
 case 'my_business_settings':json={distributor,application,membership};break;
 case 'set_company_distributor':distributor=args.p_distributor;json={distributor,application,membership};writes.push(name);break;
 case 'request_company_plan':if(failPlan){await route.fulfill({status:400,json:{message:'MA604'}});return;}application={id:'application-1',company_id:companyId,company:'სატესტო კომპანია',plan:args.p_plan,status:'pending',note:''};json={distributor,application,membership};writes.push(name);break;
 case 'cancel_company_plan_request':application.status='cancelled';json={distributor,application,membership};writes.push(name);break;
 case 'company_reviews':json={total:review?.status==='published'?1:0,rating:review?.status==='published'?review.rating:null,items:review?.status==='published'?[review]:[]};break;
 case 'my_company_review_targets':json=[{id:requestId,title:'სატესტო არჩეული მოთხოვნა',rating:review?.rating||null,body:review?.body||null,status:review?.status||null,reason:review?.reason||''}];break;
 case 'save_company_review':review={id:'review-1',company_id:companyId,company:'სატესტო კომპანია',rating:args.p_rating,body:args.p_body,status:'pending',author:'სატესტო კლიენტი',updated_at:stamp};json=review;writes.push(name);break;
 case 'admin_business_queue':json={total:args.p_kind==='reviews'?(review?1:0):(application?1:0),items:args.p_kind==='reviews'?(review?[review]:[]):(application?[application]:[])};break;
 case 'admin_moderate_review':review.status=args.p_status;review.reason=args.p_reason;json=null;writes.push(name);break;
 case 'admin_resolve_plan':application.status=args.p_approve?'approved':'declined';application.note=args.p_note;if(args.p_approve)membership={plan:application.plan,expires_at:'2026-10-30T10:00:00Z'};json=null;writes.push(name);break;
 // Avoid marking actual messages read during unrelated UI tests.
 case 'mark_read':case 'send_message':case 'start_conversation':throw new Error('Unexpected real chat write');
 default:await route.continue();return;
 }
 await route.fulfill({json});
 });return c;}
async function pageFor(c){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
async function login(p,key){await p.goto(origin+'/account/',{waitUntil:'domcontentloaded'});await p.locator('#login-email').fill(ledger.accounts[key].email);await p.locator('#login-password').fill(ledger.accounts[key].password);await p.locator('form button[type=submit]').click();await p.locator('#login-email').waitFor({state:'hidden',timeout:45000});}
async function shot(p,name,width=1440){await p.setViewportSize({width,height:1000});await p.evaluate(()=>window.scrollTo(0,0));assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0,`overflow ${name}`);await p.screenshot({path:`qa/shots/business/${name}-${width}.png`,fullPage:true});}
try{
 const guest=await context(),p=await pageFor(guest);
 await p.goto(origin+'/companies/',{waitUntil:'domcontentloaded'});await p.locator('.company-card__name a').first().waitFor({timeout:45000});companyId=new URL(await p.locator('.company-card__name a').first().getAttribute('href'),origin).searchParams.get('id');assert(companyId);
 await p.locator('#desktop-type').click();await p.getByRole('option',{name:'დისტრიბუტორები',exact:true}).click();await p.waitForURL(/type=distributors/);await p.getByText('ამ პირობით კომპანია ჯერ არ გვყავს',{exact:true}).waitFor();
 await p.goto(origin+'/ideas/',{waitUntil:'domcontentloaded'});assert.equal(await p.locator('.idea-card').count(),6);await p.getByRole('button',{name:'ლოგისტიკა',exact:true}).click();assert.equal(await p.locator('.idea-card').count(),1);await p.getByRole('button',{name:'ყველა',exact:true}).click();await shot(p,'ideas');await shot(p,'ideas',390);
 await p.locator('.idea-card h2 a').first().click();await p.locator('.idea-resources').waitFor();await shot(p,'idea-detail',390);assert((await p.locator('.idea-resources .ma-btn').getAttribute('href')).includes('category=office_household'));
 const co=await context(),company=await pageFor(co);await login(company,'owner_company');await company.goto(origin+'/account/?tab=business',{waitUntil:'domcontentloaded'});await company.getByRole('heading',{name:'შენი ბიზნესის განვითარებისთვის'}).waitFor();
 const toggle=company.getByRole('switch',{name:'ვარ დისტრიბუტორი'});await toggle.click();await company.waitForFunction(()=>document.querySelector('input[role=switch]')?.checked);assert(distributor);
 failPlan=true;await company.locator('.business-plan').first().getByRole('button').click();await company.locator('.business-panel>.ma-field__error').waitFor();failPlan=false;
 await company.locator('.business-plan').first().getByRole('button').click();await company.getByText('Premium · განაცხადი განხილვაშია',{exact:true}).waitFor();assert.equal(membership,null);assert.equal(await company.locator('.business-plan button:disabled').count(),2);
 await company.getByRole('button',{name:'განაცხადის გაუქმება'}).click();await company.getByText('Premium · განაცხადი გაუქმებულია',{exact:true}).waitFor();await company.locator('.business-plan').nth(1).getByRole('button').click();await company.getByText('VIP · განაცხადი განხილვაშია',{exact:true}).waitFor();await shot(company,'company-plans');await shot(company,'company-plans',390);
 const cl=await context(),client=await pageFor(cl);await login(client,'owner_user');await client.goto(origin+`/companies/view/?id=${companyId}`,{waitUntil:'domcontentloaded'});await client.locator('#company-reviews').waitFor();await client.locator('.business-review-form summary').click();await client.getByRole('radio',{name:'5 ქულა',exact:true}).check();await client.locator('.business-review-form textarea').fill('პირობები დროულად და გასაგებად შეგვითანხმეს. მომსახურებით კმაყოფილი ვართ.');await client.getByRole('button',{name:'შეფასების გაგზავნა'}).click();await client.locator('.business-review-form summary').getByText('შენი შეფასების ნახვა / შეცვლა').waitFor();assert.equal(review.status,'pending');assert.equal(await client.locator('.business-review').count(),0);
 const ad=await context(),admin=await pageFor(ad);await login(admin,'owner_admin');await admin.goto(origin+'/admin/?tab=reviews',{waitUntil:'domcontentloaded'});await admin.locator('.business-admin-row').waitFor();assert.equal(await admin.locator('.business-admin-row').count(),1);await admin.getByRole('button',{name:'გამოქვეყნება',exact:true}).click();await admin.locator('.business-admin-row').getByText('გამოქვეყნებული',{exact:true}).waitFor();assert.equal(review.status,'published');await shot(admin,'admin-reviews',390);
 await admin.goto(origin+'/admin/?tab=plans',{waitUntil:'domcontentloaded'});await admin.locator('.business-admin-row').waitFor();await admin.locator('.business-admin-row textarea').fill('შეთანხმებული საცდელი პირობები');await admin.getByRole('button',{name:'პაკეტის გააქტიურება',exact:true}).click();await admin.locator('.business-admin-row').getByText('დადასტურებული',{exact:true}).waitFor();assert.equal(membership.plan,'vip');await shot(admin,'admin-plans');
 await p.goto(origin+`/companies/view/?id=${companyId}`,{waitUntil:'domcontentloaded'});await p.locator('.business-review').waitFor();await shot(p,'public-reviews',390);
 await p.goto(origin+'/companies/?type=distributors',{waitUntil:'domcontentloaded'});await p.locator('.company-card').waitFor();assert.equal(await p.locator('.company-card').count(),1);await p.locator('.business-tier').waitFor();await shot(p,'distributors');
 assert(writes.includes('save_company_review')&&writes.includes('admin_resolve_plan'));assert.deepEqual(errors,[]);
 console.log('PASS ideas/filter/detail, company distributor, plan retry/request/cancel/approval, client review/pending/publication, admin queues, public badges/catalog, desktop/mobile overflow, zero runtime errors; business writes mocked');
}finally{await browser.close();}
