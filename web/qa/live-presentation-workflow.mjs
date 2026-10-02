import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
import { chromium } from 'playwright';

// Run only AFTER production deployment + migrations have been confirmed:
// node qa/live-presentation-workflow.mjs --run-after-deploy [--activate-vip-if-unassigned]
// Real UI writes, fixed existing fixture accounts, no cleanup or SQL mutations.
async function main() {
  const args = process.argv.slice(2);
  assert(args.includes('--run-after-deploy') && args.every(v => ['--run-after-deploy','--activate-vip-if-unassigned'].includes(v)), 'Requires explicit --run-after-deploy; script was not run.');
  const origin = 'https://meet-any.vercel.app';
  const auth = 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
  const root = path.resolve(import.meta.dirname, '..');
  const env = Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).flatMap(line => {
    const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];
  }));
  assert(['ep-withered-glade-b54ts1g5-pooler.c-7.us-east-2.aws.neon.tech','ep-withered-glade-b54ts1g5.c-7.us-east-2.aws.neon.tech'].includes(new URL(env.DATABASE_URL).hostname), 'Unexpected database');
  assert(env.NEON_AUTH_BASE_URL?.replace(/\/$/,'') === auth, 'Unexpected Auth');
  const ledgerPath=[path.join(root,'DEMO-ACCOUNTS.local.md'),path.join(root,'../DEMO-ACCOUNTS.local.md')].find(p=>fs.existsSync(p));
  assert(ledgerPath,'Fixture ledger required');
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
  const targets={hotel:{id:'bacf1572-7493-4ac9-bfc7-95719e911c4c',role:'client'},wood:{id:'74cc28fc-47de-45cb-9563-93735b86855e',role:'company'},owner_admin:{id:'d2517b00-554d-4e6b-929a-ef3da51f3b47',role:'admin'}};
  for(const [key,target] of Object.entries(targets))assert(ledger.accounts[key]?.id===target.id,`Allowlist mismatch: ${key}`);
  const title='6 ხის მაგიდა სასტუმროს ლაუნჯისთვის';
  const description='სასტუმროს ლაუნჯისთვის გვჭირდება 6 ხის მაგიდა, თითო 80×80 სმ, ბუნებრივი მუხის მასალითა და ადვილად გასაწმენდი დამცავი საფარით. მიღების ადგილი ჩვენი თბილისის საწყობია; ბათუმამდე შემდგომ გადაზიდვას თავად მოვაწყობთ. შეთავაზებაში მიუთითეთ ჯამური ფასი, დღგ, თბილისში მიტანა და დამზადების ვადა. შეკვეთამდე გვსურს მასალისა და საფარის ნიმუშის შეთანხმება.';
  const offerBody='გთავაზობთ 6 მუხის მაგიდას ზომით 80×80 სმ, ბუნებრივი ფერითა და ადვილად გასაწმენდი დამცავი საფარით. ჯამური ღირებულება 2 340 ლარია, დღგ-ის ჩათვლით; ფასში შედის თბილისის საწყობში მიტანა და აწყობა. დამზადება და მიწოდება შეთანხმებიდან 10 დღეში შესრულდება. მუშაობის დაწყებამდე ვათანხმებთ ესკიზს, მასალის ნიმუშსა და საფარს. გადახდა: 30% წინასწარ და დარჩენილი თანხა მიღებისას.';
  const question='გამარჯობა, ექვსივე მაგიდის 80×80 სმ ზომა და ბუნებრივი მუხის ფერი გვაწყობს. შეგიძლიათ დამცავი საფარის ნიმუში გამოგვიგზავნოთ? გთხოვთ დაგვიდასტუროთ, რომ 2 340 ლარში დღგ, თბილისის საწყობში მიტანა და აწყობა შედის. ბათუმამდე გადაზიდვას თავად მოვაწყობთ.';
  const answer='გამარჯობა! დიახ, 2 340 ლარი ექვსივე მაგიდის ჯამური ფასია და მოიცავს დღგ-ს, თბილისის საწყობში მიტანასა და აწყობას. საფარის ნიმუშსა და ესკიზს მუშაობის დაწყებამდე შეგითანხმებთ. დამზადებისა და მიტანის ვადა საბოლოო ზომებისა და ნიმუშის შეთანხმებიდან 10 დღეა.';
  const reviewBody='შეთავაზებაში ზომები, მუხის მასალა, ჯამური ფასი და თბილისში მიტანის პირობები მკაფიოდ არის აღწერილი. მიმოწერაში დავაზუსტეთ დღგ, აწყობა და ნიმუშის შეთანხმების პროცესი. შეფასება ეხება კომუნიკაციასა და შეთავაზების სიცხადეს.';
  const output=path.join(root,'qa/shots/live-presentation-workflow');
  const reportDir=path.join(output,'report');fs.mkdirSync(reportDir,{recursive:true,mode:0o700});
  const journal=path.join(reportDir,'state.json');
  const state=fs.existsSync(journal)?JSON.parse(fs.readFileSync(journal,'utf8')):{origin,title,steps:[],writes:[],messageIds:[]};
  assert(state.origin===origin && state.title===title,'Journal target mismatch');delete state.error;delete state.errorLocation;delete state.browserErrors;state.pass=null;state.scope={accounts:Object.keys(targets),newRequestsMaximum:1,newOffersMaximum:1,newMessagesMaximum:2,newReviewsMaximum:1,comparison:'Single supplier: terms and profile inspected; multi-offer comparison requires a second supplier and is outside this three-account workflow.'};
  const save=()=>{fs.writeFileSync(journal+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});fs.renameSync(journal+'.tmp',journal);};
  const step=name=>{if(!state.steps.includes(name))state.steps.push(name);save();console.log(name);};
  const sql=neon(env.DATABASE_URL);
  const read=(text,values=[])=>{assert(/^select\b/i.test(text),'SQL writes forbidden');return sql.query(text,values,{fetchOptions:{signal:AbortSignal.timeout(15000)}});};
  const prerequisites=(await read("select to_regprocedure('public.admin_company_settings(uuid)') is not null as management, to_regprocedure('public.admin_business_audit(integer,integer)') is not null as audit"))[0];
  // Inspect actual review function body, rather than trusting only its existence.
  const functionRows=await read("select pg_get_functiondef('public.save_company_review(uuid,integer,text)'::regprocedure) as definition");
  assert(prerequisites.management && prerequisites.audit && functionRows[0].definition.includes("'published'"),'Production management/review migrations not present');
  const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',slowMo:120});
  const pages=[];const errors=[];
  const mutated=/^(create_|update_|delete_|send_|start_|mark_|set_|save_|choose_|close_|extend_|withdraw_|request_company_plan|cancel_company_plan|admin_(edit|manage|moderate|resolve|set|delete|save|reject|hide))/;
  async function rpc(page,name,data={}){
    const tokenResponse=await page.request.get(auth+'/token');assert(tokenResponse.ok(),'JWT unavailable');const jwt=(await tokenResponse.json()).token;assert(jwt,'JWT missing');
    const response=await page.request.post(origin+'/api/db/rpc/'+name,{headers:{Authorization:'Bearer '+jwt},data,timeout:30000});assert(response.ok(),`Read RPC ${name}: HTTP ${response.status()}`);return response.json();
  }
  async function identity(page,key){const me=(await rpc(page,'my_profile'))[0];assert(me?.id===targets[key].id && me.role===targets[key].role && !me.blocked,`Identity guard: ${key}`);return me;}
  async function pageFor(key){
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();pages.push(page);page.setDefaultTimeout(40000);page.on('pageerror',e=>errors.push(e.message));
    state.phase=`Sign-in ${key}`;save();const login=await page.request.post(auth+'/sign-in/email',{data:{email:ledger.accounts[key].email||`demo-${key}@meetany.ge`,password:ledger.accounts[key].password},timeout:30000});assert(login.ok(),`Sign-in ${key}: HTTP ${login.status()}`);
    state.phase=`Verify identity ${key}`;save();await identity(page,key);
    await context.route('**/api/db/rpc/*',async route=>{
      const url=new URL(route.request().url());assert(url.origin===origin,'Wrong application origin');const name=url.pathname.split('/').at(-1);
      if(!mutated.test(name))return route.continue();
      const data=route.request().postDataJSON();await identity(page,key);
      let permitted=false;
      if(name==='create_request')permitted=key==='hotel'&&!state.requestId&&data.p_title===title&&data.p_body===description&&data.p_category==='furniture'&&data.p_city==='tbilisi'&&Number(data.p_quantity)===6;
      if(name==='send_offer')permitted=key==='wood'&&data.p_request_id===state.requestId&&data.p_body===offerBody&&Number(data.p_price)===2340&&data.p_price_type==='total'&&data.p_vat_included===true&&data.p_delivery_included===true&&Number(data.p_delivery_days)===10;
      if(name==='choose_offer')permitted=key==='hotel'&&data.p_offer_id===state.offerId;
      if(name==='start_conversation')permitted=key==='hotel'&&data.p_company_id===targets.wood.id&&data.p_request_id===state.requestId;
      if(name==='mark_read')permitted=key!=='owner_admin'&&data.p_conversation_id===state.conversationId;
      if(name==='send_message')permitted=data.p_conversation_id===state.conversationId&&((key==='hotel'&&data.p_body===question)||(key==='wood'&&data.p_body===answer));
      if(name==='save_company_review')permitted=key==='hotel'&&data.p_request_id===state.requestId&&data.p_body===reviewBody&&Number(data.p_rating)===5;
      if(name==='admin_manage_plan'){permitted=key==='owner_admin'&&args.includes('--activate-vip-if-unassigned')&&data.p_id===targets.wood.id&&data.p_plan==='vip'&&data.p_expires_at===state.vipExpiry;if(permitted)assert(!(await rpc(page,'admin_company_settings',{p_id:targets.wood.id})).membership,'Membership assigned concurrently; preserve it');}
      assert(permitted,`Unexpected mutation refused: ${key}/${name}`);
      const response=await route.fetch();
      if(response.ok()){
        const raw=await response.json();const result=Array.isArray(raw)?raw[0]:raw;
        if(name==='create_request')state.requestId=result.id;
        if(name==='send_offer')state.offerId=result.id;
        if(name==='start_conversation')state.conversationId=result.id;
        if(name==='save_company_review')state.reviewId=result.id;
        if(name==='send_message'&&!state.messageIds.includes(result.id))state.messageIds.push(result.id);
        state.writes.push({key,name,id:result?.id||null,at:new Date().toISOString()});save();
      }
      await route.fulfill({response});
    });return page;
  }
  async function go(page,route){await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('main')?.innerText.trim()&&!document.querySelector('main [aria-busy="true"]'),null,{timeout:60000});}
  async function shot(page,name,widths=[1440,390,320]){for(const width of widths){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: ${width} overflow`);await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});}await page.setViewportSize({width:1440,height:1000});}
  async function custom(page,selector,label){await page.locator(selector).click();await page.getByRole('option',{name:label,exact:true}).filter({visible:true}).click();}
  async function waitRead(check){for(let n=0;n<40;n++){const result=await check();if(result)return result;await new Promise(r=>setTimeout(r,300));}assert.fail('Expected saved record did not appear');}
  async function requestRow(){const rows=await read('select * from public.requests where owner_id=$1::uuid and title=$2',[targets.hotel.id,title]);assert(rows.length<=1,'Duplicate matching requests; refusing');if(rows[0]){assert(rows[0].category==='furniture'&&rows[0].city==='tbilisi'&&!rows[0].hidden,'Existing matching request changed');assert(!state.requestId||state.requestId===rows[0].id,'Journal request mismatch');state.requestId=rows[0].id;save();}return rows[0];}
  try{
    const hotel=await pageFor('hotel'),wood=await pageFor('wood'),admin=await pageFor('owner_admin');
    const customer=await identity(hotel,'hotel');const company=await identity(wood,'wood');assert(company.verified,'Wood must already be approved; no verification changes');
    if(!(await requestRow())){
      await go(hotel,'/requests/new/');await hotel.locator('#new-request[open]').waitFor();await hotel.locator('#title').fill(title);await custom(hotel,'#category','ავეჯი');await custom(hotel,'#city','თბილისი');await hotel.locator('#body').fill(description);await hotel.locator('#quantity').fill('6');
      await hotel.getByRole('combobox',{name:'რაოდენობის ერთეული',exact:true}).click();await hotel.getByRole('option',{name:'ცალი',exact:true}).filter({visible:true}).click();await shot(hotel,'request-form');
      await hotel.locator('#new-request').getByRole('button',{name:'გამოქვეყნება',exact:true}).click();await waitRead(requestRow);
    }
    step('One meaningful request exists under the hotel fixture only');
    let offers=await read('select * from public.offers where request_id=$1::uuid and company_id=$2::uuid',[state.requestId,targets.wood.id]);assert(offers.length<=1,'Duplicate wood offers');
    if(!offers.length){
      await go(wood,`/requests/view/?id=${state.requestId}`);await wood.locator('#of-body').waitFor();await custom(wood,'#of-price-type','ჯამური ფასი');await wood.locator('#of-price').fill('2340');await wood.getByLabel('დღგ ფასში შედის',{exact:true}).check();await wood.getByLabel('მიწოდების ხარჯი შეთავაზებაში შედის',{exact:true}).check();await wood.locator('#of-days').fill('10');await wood.locator('#of-body').fill(offerBody);await shot(wood,'offer-form');await wood.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();
      offers=await waitRead(async()=>{const rows=await read('select * from public.offers where request_id=$1::uuid and company_id=$2::uuid',[state.requestId,targets.wood.id]);return rows.length===1&&rows;});
    }
    const offer=offers[0];assert(offer.body===offerBody&&Number(offer.price)===2340&&offer.price_type==='total'&&offer.delivery_days===10&&offer.vat_included&&offer.delivery_included,'Existing offer differs; preserve it and review manually');state.offerId=offer.id;save();
    await go(wood,'/account/?tab=offers');await wood.locator(`a.account-row__link[href="/requests/view/?id=${state.requestId}"]`).waitFor();await shot(wood,'sent-offers');step('Wood account links to the correct sent offer');
    await go(hotel,`/requests/view/?id=${state.requestId}`);const card=hotel.locator('.ma-ocard').filter({hasText:offerBody});await card.waitFor();assert((await card.innerText()).includes('10 დღე'),'Delivery days not visible');await shot(hotel,'received-offer-terms');
    await card.getByRole('link',{name:'კომპანიის ნახვა',exact:true}).click();await hotel.waitForURL(url=>url.searchParams.get('id')===targets.wood.id);await hotel.getByRole('heading',{name:company.company,exact:true}).waitFor();await shot(hotel,'supplier-profile');step('Hotel sees price, VAT, shipping, lead time and correct supplier profile before choosing');
    const row=await requestRow();
    if(!row.chosen_offer_id){await go(hotel,`/requests/view/?id=${state.requestId}`);await hotel.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();await hotel.locator('#choose').getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();await hotel.locator('#choose').waitFor({state:'hidden'});}
    assert((await requestRow()).chosen_offer_id===state.offerId,'Wrong chosen offer');state.chosen=true;save();step('Hotel chose wood through the confirmation UI');
    await go(hotel,`/requests/view/?id=${state.requestId}`);await hotel.getByRole('button',{name:'მიწერა',exact:true}).filter({visible:true}).first().click();await hotel.locator('.ma-chat[open] .ma-chat__messages[aria-busy="false"]').waitFor();
    const conversations=await read('select id from meetany_private.conversations where client_id=$1::uuid and company_id=$2::uuid and context_key=$3',[targets.hotel.id,targets.wood.id,state.requestId]);assert(conversations.length===1,'Request thread missing or duplicated');state.conversationId=conversations[0].id;save();
    const messages=()=>read('select id,sender_id,body,read_at from meetany_private.messages where conversation_id=$1::uuid order by created_at',[state.conversationId]);
    if(!(await messages()).some(m=>m.sender_id===targets.hotel.id&&m.body===question)){await hotel.locator('#ma-chat-body').fill(question);await hotel.locator('#ma-chat-body').press('Enter');await waitRead(async()=>(await messages()).some(m=>m.sender_id===targets.hotel.id&&m.body===question));}
    await go(wood,`/account/?tab=messages&c=${state.conversationId}`);await wood.locator('.inbox-msg p').getByText(question,{exact:true}).last().waitFor();
    if(!(await messages()).some(m=>m.sender_id===targets.wood.id&&m.body===answer)){await wood.waitForTimeout(2100);await wood.locator('#inbox-body').fill(answer);await wood.locator('#inbox-body').press('Enter');await waitRead(async()=>(await messages()).some(m=>m.sender_id===targets.wood.id&&m.body===answer));}
    await hotel.locator('.ma-chat__message p').getByText(answer,{exact:true}).last().waitFor();await shot(hotel,'request-chat');await shot(wood,'supplier-inbox');step('Two-way request chat confirms actual quoted conditions');
    const existing=(await read('select id,rating,body,status from meetany_private.company_reviews where request_id=$1::uuid and author_id=$2::uuid',[state.requestId,targets.hotel.id]))[0];
    if(!existing){await go(hotel,`/companies/view/?id=${targets.wood.id}#company-reviews`);await hotel.locator('.business-review-form summary').click();await hotel.locator('.business-review-form select').selectOption(state.requestId);await hotel.locator('.business-review-form textarea').fill(reviewBody);await hotel.locator('.business-review-form input[type="radio"][value="5"]').check();await hotel.getByRole('button',{name:'შეფასების გაგზავნა',exact:true}).click();}
    const review=await waitRead(async()=>(await read('select id,rating,body,status from meetany_private.company_reviews where request_id=$1::uuid and author_id=$2::uuid',[state.requestId,targets.hotel.id]))[0]);assert(review.body===reviewBody&&review.status==='published','Review differs or did not publish; preserve and review manually');state.reviewId=review.id;save();await go(hotel,`/companies/view/?id=${targets.wood.id}#company-reviews`);await hotel.locator('.business-review p').getByText(reviewBody,{exact:true}).waitFor();await shot(hotel,'published-communication-review');step('Communication review published immediately without claiming delivery');
    await go(admin,`/admin/?tab=companies&q=${targets.wood.id}`);await admin.locator('tbody').getByRole('button',{name:company.company,exact:true}).click();await admin.getByRole('dialog').filter({visible:true}).waitFor();await shot(admin,'admin-company-detail');
    const settings=await rpc(admin,'admin_company_settings',{p_id:targets.wood.id});
    if(args.includes('--activate-vip-if-unassigned')&&!settings.membership){state.vipExpiry=new Date(Date.now()+30*86400000).toISOString().slice(0,10)+'T19:59:59Z';save();const drawer=admin.getByRole('dialog').filter({visible:true});await drawer.getByLabel('პაკეტი',{exact:true}).selectOption('vip');await drawer.locator('input[type="date"]').fill(state.vipExpiry.slice(0,10));await drawer.getByRole('button',{name:'პაკეტის შენახვა',exact:true}).click();await waitRead(async()=>(await rpc(admin,'admin_company_settings',{p_id:targets.wood.id})).membership?.plan==='vip');step('Unassigned wood visibility upgraded to VIP for 30 days via admin UI');}else step('Existing wood visibility membership preserved');
    await go(admin,`/admin/?tab=requests&q=${encodeURIComponent(title)}`);await admin.locator('tbody').getByRole('button',{name:title,exact:true}).click();await shot(admin,'admin-request-detail');step('Admin inspected the exact company and request details');
    await go(admin,'/admin/?tab=audit');await admin.getByText('პაკეტები და შიგთავსი',{exact:true}).click();await admin.getByText('შეფასების შენახვა',{exact:true}).first().waitFor();await shot(admin,'admin-audit');
    const audit=await rpc(admin,'admin_business_audit',{p_offset:0,p_limit:20});assert(audit.items.some(item=>item.action==='review_saved'&&item.company_id===targets.wood.id&&item.actor===customer.company&&item.changes?.rating===5),'Specific hotel→wood review missing from business audit');const matching=await read("select id from meetany_private.business_audit where action='review_saved' and actor_id=$1::uuid and target_id=$2::uuid",[targets.hotel.id,state.reviewId]);assert(matching.length>0,'Exact review audit target missing');step('Admin audit shows the published review action');
    assert(errors.length===0,'Browser page errors detected; inspect private report');delete state.error;delete state.errorLocation;delete state.browserErrors;state.phase='Completed';state.pass=true;state.finishedAt=new Date().toISOString();save();console.log(`PASS: ${state.steps.length} live presentation checks; existing unrelated data preserved.`);
  }catch(error){state.pass=false;state.errorLocation=String(error.stack||'').split('\n').filter(line=>line.includes('live-presentation-workflow.mjs'));state.error=error?.code==='ERR_ASSERTION'?error.message:`${error?.name||'Error'}: inspect private browser evidence`;state.browserErrors=errors;save();for(let n=0;n<pages.length;n++)await pages[n].screenshot({path:path.join(output,`failure-${n}.png`),fullPage:true}).catch(()=>{});console.error(state.error);process.exitCode=1;}
  finally{await browser.close();}
}
main().catch(error=>{console.error(error?.code==='ERR_ASSERTION'?error.message:'Setup failed; no credentials logged.');process.exitCode=1;});
