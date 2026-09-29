// BASE=http://localhost:3003 node qa/flows-walk.mjs [before|after|idle] [--sample]
// Only auth-probe; credentials/session files are never printed or committed.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { categories } from '../app/lib/categories-data.js';
process.env.QA_ORIGIN = process.env.BASE || 'http://localhost:3003';
const { assert, guard, root, origin, safe, credentials, rpc, db, go, query, requestPath } = await import('./e2e/lib.mjs');
guard(); assert.equal(new URL(origin).port, '3003');
const phase = process.argv[2] || 'before';
assert(['before', 'after', 'idle'].includes(phase));
const keepSample = process.argv.includes('--sample');
const mobileOnly = process.argv.includes('--mobile-only');
const dir = path.join(root, 'qa/shots/flows-2026-09-29');
fs.mkdirSync(dir, { recursive: true });
const report = { phase, started: new Date().toISOString(), checks: [], timings: [], screenshots: [], requests: [], conversations: [] };
const journal = path.join(dir, `${phase}${mobileOnly ? "-mobile" : ""}.json`);
const save = () => fs.writeFileSync(journal, safe(JSON.stringify(report, null, 2)) + '\n');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const pages = {};
let prefs, user, company, retained, profilesBefore, profileIds, categoryId='freight';
const contactIds = new Set(), pendingContacts = new Set();
async function check(name, fn) {
  try { const evidence = await fn(); report.checks.push({ name, status: 'PASS', evidence }); }
  catch(e) { report.checks.push({ name, status: 'FAIL', reason: safe(e.message) }); }
  save(); console.log(`${name}: ${report.checks.at(-1).status}`);
}
async function page(key) {
  const session = `/tmp/meetany-flows-${key}.json`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...(key !== 'guest' && fs.existsSync(session) ? {storageState:session} : {}) });
  const p = await context.newPage(); p.setDefaultTimeout(18000);
  p.qaNotices=[];
  p.on('response', r => {
    if(r.url().endsWith('/rpc/engagement_state') && r.ok()) void r.json().then(state=>{p.qaNotices=state.notifications?.items||[];}).catch(()=>{});
    if (!r.url().endsWith('/rpc/log_contact_event') || !r.ok()) return;
    const work = r.json().then(x => { if(x.id) contactIds.add(x.id); }).catch(() => {});
    pendingContacts.add(work);work.finally(() => pendingContacts.delete(work));
  });
  if (key !== 'guest') {
    await go(p, '/account/');
    if (await p.locator('#login-email').isVisible()) {
      const c = credentials(key);
      await p.locator('#login-email').fill(c.email); await p.locator('#login-password').fill(c.password);
      await p.locator('main form button[type="submit"]').click();
      await p.locator('#login-email').waitFor({state:'hidden',timeout:30000});
    }
    assert((await rpc(p,'my_profile'))[0], 'სესია არ შეიქმნა');
    await context.storageState({path:session}); fs.chmodSync(session,0o600);
  }
  return pages[key] = p;
}
async function shot(p, name) {
  await p.evaluate(() => document.fonts.ready);
  assert(await p.locator('input[type="password"]').evaluateAll(inputs=>inputs.every(input=>!input.value)), 'კადრში პაროლის მნიშვნელობა არ უნდა მოხვდეს');
  const filename = `${phase}-${name}.png`;
  const modal=await p.locator('dialog[open]').count();
  if(!modal) await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({path:path.join(dir,filename),fullPage:!modal});
  report.screenshots.push(filename);save();
  assert.equal(await p.evaluate(() => Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth),0,'ჰორიზონტალური გადაცდენა');
}
async function elapsed(name, since, predicate, seconds=42) {
  const deadline = since + seconds*1000;
  let found = false;
  do {
    if(await predicate().catch(() => false)) { found=true; break; }
    await new Promise(r=>setTimeout(r,250));
  } while(Date.now()<deadline);
  const value={name,seconds:found?Number(((Date.now()-since)/1000).toFixed(2)):null,limit:seconds};
  report.timings.push(value);save();return found;
}
async function create(p,width,category=categoryId,city='tbilisi',suffix='') {
  const title = suffix==='-sample' ? 'საწყობიდან 24 ყუთის ტრანსპორტირება თბილისში' : `საწყობიდან 24 ყუთის ტრანსპორტირება ${width}${suffix} ${Date.now()}`;
  await p.goto(origin+'/requests/new/',{waitUntil:'domcontentloaded'});
  await p.locator('#title').fill(title); await p.locator('#category').selectOption(category); await p.locator('#city').selectOption(city);
  await p.locator('#body').fill('გვჭირდება 24 შეფუთული ყუთის გადაზიდვა დიდ დიღომში მდებარე საწყობიდან ვაკის ოფისამდე. საერთო წონა 180 კგ. საჭიროა დახურული ფურგონი და დატვირთვა-გადმოტვირთვა. გთხოვთ მიუთითოთ სრული ღირებულება და შესრულების დრო.');
  await p.locator('#quantity').fill('24');
  const response=p.waitForResponse(r=>r.url().endsWith('/rpc/create_request') && r.ok());
  await p.locator('button[form="new-request-form"]').click();
  const res=await response; const data=await res.json(); const row=Array.isArray(data)?data[0]:data;
  const created=Date.now();report.requests.push(row.id);save();
  const publicPage=await p.request.get(origin+'/requests/');
  report.timings.push({name:`${width}${suffix}: ახალი SSR პასუხი`,seconds:(Date.now()-created)/1000,containsRequest:(await publicPage.text()).includes(row.id)});save();
  await p.locator('#new-request').waitFor({state:'hidden'});
  return {...row,created};
}
async function offer(p,r,days,body) {
  await go(p,requestPath(r.id));
  await p.locator('#of-body').fill(body); await p.locator('#of-days').fill(String(days));
  const response=p.waitForResponse(r=>r.url().endsWith('/rpc/send_offer') && r.ok());
  await p.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();
  await response;const sent=Date.now();
  await p.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).waitFor();
  return sent;
}
const section = p=>p.locator('.account-section').filter({has:p.getByRole('heading',{name:/შენი მიმართულების მოთხოვნები/})});
const row = (p,id)=>p.locator('.account-row').filter({has:p.locator(`a[href="${requestPath(id)}"]`)});
const bell = p=>p.getByRole('button',{name:/^შეტყობინებები(?:,|$)/});
try {
  user=await page('owner_user');company=await page('owner_company'); const other=phase==='idle'?null:await page('port');const guest=await page('guest');
  if(phase==='idle') {
    await go(user,'/account/');await go(company,'/account/');await go(guest,'/requests/');
    await new Promise(resolve=>setTimeout(resolve,5000));
    const visibility=Object.fromEntries(await Promise.all(Object.entries(pages).map(async([key,p])=>[key,await p.evaluate(()=>document.visibilityState)])));
    assert(Object.values(visibility).every(state=>state==='visible'));
    const counts={};
    for(const [key,p] of Object.entries(pages)) {
      counts[key]={};
      p.on('request',r=>{const url=new URL(r.url());const name=url.hostname.includes('.neonauth.')?`auth:${url.pathname}`:url.pathname;if(name.startsWith('/api/db/')||name.startsWith('auth:')) counts[key][name]=(counts[key][name]||0)+1;});
    }
    console.log('უმოქმედო ჩანართების 60-წამიანი გაზომვა დაიწყო');
    await new Promise(resolve=>setTimeout(resolve,60000));
    report.idle={durationSeconds:60,visibility,counts:structuredClone(counts),totals:Object.fromEntries(Object.entries(counts).map(([key,value])=>[key,Object.values(value).reduce((sum,n)=>sum+n,0)]))};
    save();
  } else {
  profileIds=await Promise.all([user,company,other].map(async p=>(await rpc(p,'my_profile'))[0].id));
  profilesBefore=await query('select * from public.profiles where id=any($1::uuid[]) order by id',[profileIds]);
  const profile=(await rpc(company,'my_profile'))[0];categoryId=profile.industry;assert(categories[categoryId],'პროფილის კატეგორია აპში არ არსებობს');assert.equal(profile.city,'tbilisi');
  prefs=await rpc(company,'request_alert_preferences');report.originalAlertPreferences=prefs;
  // Exercise existing opt-in in the UI; restore in finally. No profile changes.
  await go(company,'/account/?tab=notifications');
  const settings=company.getByRole('form',{name:'ახალი მოთხოვნების შეტყობინებები'});
  if(!prefs.enabled) {
    await settings.getByLabel('ახალ მოთხოვნებზე შემატყობინე',{exact:true}).check();
    if(phase==='after') {
      assert(await settings.getByLabel(categories[categoryId],{exact:true}).isChecked(),'პროფილის მიმართულება წინასწარ არ შეივსო');
      assert(await settings.getByLabel('თბილისი',{exact:true}).isChecked(),'პროფილის ქალაქი წინასწარ არ შეივსო');
    }
    await settings.getByLabel(categories[categoryId],{exact:true}).check();
    await settings.getByLabel('თბილისი',{exact:true}).check();
    await settings.getByRole('button',{name:'პარამეტრების შენახვა',exact:true}).click();
    await settings.getByText('შენახულია — ახალ შესაბამის მოთხოვნებზე შეგატყობინებთ.',{exact:true}).waitFor();
  }
  report.activeAlertPreferences=await rpc(company,'request_alert_preferences');
  for(const width of mobileOnly ? [390] : [1440,390]) {
    console.log(`გავლა ${width}`);
    for(const p of Object.values(pages)) await p.setViewportSize({width,height:width===390?844:1000});
    await go(company,'/account/');await go(guest,'/requests/');
    const r=await create(user,width);
    await check(`${width} ახალი მოთხოვნის ავტომატური გამოჩენა`,async()=>{
      const results=await Promise.all([
        elapsed(`${width}: კომპანიის სია`,r.created,()=>section(company).locator(`a[href="${requestPath(r.id)}"]`).isVisible()),
        elapsed(`${width}: საჯარო გახსნილი სია`,r.created,()=>guest.locator(`main a[href="${requestPath(r.id)}"]`).first().isVisible()),
        elapsed(`${width}: კომპანიის ბეიჯი`,r.created,async()=>company.qaNotices.some(n=>n.request_id===r.id && n.kind==='request_match') && /წაუკითხავი/.test(await bell(company).getAttribute('aria-label'))),
      ]);
      assert(results.every(Boolean),JSON.stringify(results));
    });
    await check(`${width} საჯარო სია ხელახლა ჩატვირთვისას`,async()=>{
      const t=Date.now();await guest.reload();await guest.locator(`main a[href="${requestPath(r.id)}"]`).first().waitFor();
      report.timings.push({name:`${width}: საჯარო reload`,seconds:(Date.now()-t)/1000});
    });
    await go(company,'/account/?tab=notifications');
    await check(`${width} მოთხოვნის შეტყობინება`,async()=>{await company.locator(`main a[href="${requestPath(r.id)}"]`).first().waitFor();await shot(company,`${width}-request-notification`);});
    await go(company,'/account/');await company.reload();
    await check(`${width} შესაბამისი მოთხოვნა ანგარიშში`,async()=>{await section(company).locator(`a[href="${requestPath(r.id)}"]`).waitFor();await shot(company,`${width}-matching`);});
    const negative=await create(user,width,'furniture','tbilisi','-სხვა-მიმართულება');
    await company.reload();await section(company).waitFor();
    await check(`${width} სხვა მიმართულება არ ხვდება სიაში`,async()=>assert.equal(await section(company).locator(`a[href="${requestPath(negative.id)}"]`).count(),0));
    await rpc(user,'delete_request',{p_request_id:negative.id});
    const elsewhere=await create(user,width,categoryId,'batumi','-სხვა-ქალაქი');
    await company.reload();await section(company).waitFor();
    await check(`${width} სხვა ქალაქის ხილვადობა და ქალაქების რიგი`,async()=>{
      assert.equal(await section(company).locator(`a[href="${requestPath(elsewhere.id)}"]`).count(),1);
      if(phase==='after') {
        const links=await section(company).locator('.account-row__link').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
        assert(links.indexOf(requestPath(r.id))<links.indexOf(requestPath(elsewhere.id)),'საკუთარი ქალაქი წინ არ დგას');
        await section(company).getByText(/ყველა ქალაქი — ჯერ შენი ქალაქის მოთხოვნები/).waitFor();
      }
      return 'სია ყველა ქალაქს აჩვენებს; შეტყობინება არჩეულ ქალაქს მიჰყვება';
    });
    await check(`${width} სხვა ქალაქზე შეტყობინება არ მოდის`,async()=>assert(!(await rpc(company,'list_notifications')).items.some(n=>n.request_id===elsewhere.id)));
    await rpc(user,'delete_request',{p_request_id:elsewhere.id});
    await go(user,'/account/?tab=requests');await user.reload();await row(user,r.id).waitFor();
    const initialLabel=await bell(user).getAttribute('aria-label');
    const sent=await offer(company,r,1,'24 ყუთს გადავიტანთ დახურული ფურგონით ხვალ დილით. დატვირთვა და გადმოტვირთვა შედის 240 ლარში. სამუშაო სრულდება ერთ დღეში.');
    await check(`${width} შეთავაზების ავტომატური გამოჩენა`,async()=>{
      const result=await Promise.all([
        elapsed(`${width}: კლიენტის ბეიჯი`,sent,async()=>user.qaNotices.some(n=>n.request_id===r.id && n.kind==='offer_received') && await bell(user).getAttribute('aria-label')!==initialLabel),
        elapsed(`${width}: ანგარიშის რაოდენობა`,sent,async()=>/1 შეთავაზება/.test(await row(user,r.id).innerText())),
      ]);assert(result.every(Boolean),JSON.stringify(result));
    });
    await user.reload();await row(user,r.id).getByText('1 ახალი',{exact:true}).waitFor();await shot(user,`${width}-received-account`);
    if(phase==='after') await check(`${width} შეტყობინებიდან შეთავაზებაზე გადასვლა`,async()=>{
      await bell(user).click();
      const marked=user.waitForResponse(response=>response.url().endsWith('/rpc/mark_notification_read'));
      await user.locator('#notification-list').locator(`a[href="${requestPath(r.id)}"]`).click();
      assert((await marked).ok(),'შეტყობინება წაკითხულად ვერ მოინიშნა');
      await user.locator('.ma-ocard').waitFor();
    });
    else await go(user,requestPath(r.id));
    await user.locator('.ma-ocard').waitFor();
    const sent2=await offer(other,r,2,'გთავაზობთ ტრანსპორტირებას 200 ლარად ორი დღის განმავლობაში. ფასში შედის ორი დამტვირთველი, ყუთების დაცვა და ორივე მისამართზე მიტანა.');
    await check(`${width} მეორე OfferCard ავტომატურად`,async()=>assert(await elapsed(`${width}: OfferCard`,sent2,async()=>await user.locator('.ma-ocard').count()===2)));
    await user.reload();await user.getByRole('heading',{name:/შეთავაზებები \(2\)/}).waitFor();
    await check(`${width} შედარება`,async()=>{await user.getByRole('button',{name:'პირობების შედარება',exact:true}).click();await user.getByRole('table').waitFor();assert.equal(await user.locator('tbody tr').count(),2);await shot(user,`${width}-compare`);});
    await check(`${width} არჩევა`,async()=>{
      await user.locator('.ma-ocard').filter({hasText:profile.company}).getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();
      await shot(user,`${width}-choose`);await user.locator('#choose').getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();
      await user.locator('#choose').waitFor({state:'hidden'});await user.getByText('მომწოდებელი არჩეულია',{exact:true}).first().waitFor();
      await shot(user,`${width}-chosen`);
      if(phase==='after') {
        await user.locator('.request-responses').getByRole('button',{name:'მიწერა',exact:true}).click();
        await user.locator('.ma-chat').waitFor();
        await user.getByRole('button',{name:'მიმოწერის დახურვა',exact:true}).click();
      }
    });
    await check(`${width} ორივე კომპანიის სტატუსი`,async()=>{
      if(phase==='after') {
        const t=Date.now();
        assert(await elapsed(`${width}: კომპანიის არჩეული სტატუსი`,t,()=>company.locator('.ma-ocard').getByText('არჩეულია',{exact:true}).isVisible()));
      } else await company.reload();
      await company.locator('.ma-ocard').getByText('არჩეულია',{exact:true}).waitFor();
      if(phase==='after') {
        const t=Date.now();
        assert(await elapsed(`${width}: კომპანიის არარჩეული სტატუსი`,t,()=>other.locator('.ma-ocard').getByText('არ აირჩიეს',{exact:true}).isVisible()));
      } else await other.reload();
      await other.locator('.ma-ocard').getByText('არ აირჩიეს',{exact:true}).waitFor();
      await shot(company,`${width}-company-chosen`);await shot(other,`${width}-company-declined`);
    });
    await check(`${width} ჩატი და 25 წამში ბეიჯი`,async()=>{
      // Company initiates from the request's existing MessageButton; customer replies in Inbox.
      await company.getByRole('button',{name:'მიწერა',exact:true}).click();
      const input=company.locator('.ma-chat textarea');await input.fill('ხვალ 10 საათზე მოვალთ. გთხოვთ დაადასტუროთ.');
      await company.locator('.ma-chat').getByRole('button',{name:'გაგზავნა',exact:true}).click();
      const t=Date.now();assert(await elapsed(`${width}: ჩატის ბეიჯი`,t,()=>user.locator('.ma-chat-badge').first().isVisible(),25));
      const conversation=(await rpc(user,'list_my_conversations')).find(c=>c.request_id===r.id);
      assert(conversation,'მოთხოვნის საუბარი');report.conversations.push(conversation.id);save();
      await go(user,`/account/?tab=messages&c=${conversation.id}`);
      await user.locator('#inbox-body').fill('დადასტურებულია, გელოდებით 10 საათზე.');
      await user.getByRole('button',{name:'გაგზავნა',exact:true}).click();
      await company.getByRole('log').getByText('დადასტურებულია, გელოდებით 10 საათზე.',{exact:true}).waitFor();
      await shot(user,`${width}-chat`);
      await company.getByRole('button',{name:'მიმოწერის დახურვა',exact:true}).click();
    });
    await rpc(user,'delete_request',{p_request_id:r.id});
  }
  if(keepSample && !report.checks.some(check=>check.status==='FAIL')) {
    const r=await create(user,1440,categoryId,'tbilisi','-sample');
    await offer(company,r,1,'24 ყუთის ტრანსპორტირება დახურული ფურგონით, დატვირთვითა და გადმოტვირთვით — 240 ლარი. შესრულება ხვალ, ერთ დღეში.');
    await offer(pages.port,r,2,'გადაზიდვა ორი დღის განმავლობაში — 200 ლარი. ფასში შედის ორი დამტვირთველი და შეფუთული ყუთების დაცვა.');
    retained=r.id;report.sampleId=r.id;
    for(const width of [1440,390]) {
      await user.setViewportSize({width,height:width===390?844:1000});await go(user,requestPath(r.id));await user.reload();
      await user.getByRole('heading',{name:/შეთავაზებები \(2\)/}).waitFor();await shot(user,`${width}-sample`);
    }
  }
  }
} catch(e) {report.fatal=safe(e.message);console.log('შეჩერდა: '+safe(e.message));}
finally {
  await check('სატესტო მონაცემების გაწმენდა',async()=>{
    if(user) for(const id of report.requests.filter(id=>id!==retained)) {
      if((await db(user,`requests?select=id&id=eq.${id}`)).length) await rpc(user,'delete_request',{p_request_id:id});
    }
    if(prefs && company) await rpc(company,'set_request_alert_preferences',{p_enabled:prefs.enabled,p_categories:prefs.categories,p_cities:prefs.cities,p_email_mode:prefs.emailMode});
    await Promise.all([...pendingContacts]);
    if(contactIds.size) await query('delete from meetany_private.contact_events where id=any($1::uuid[])',[[...contactIds]]);
    const deleted=report.requests.filter(id=>id!==retained);
    const left=(await query(`select
      (select count(*)::int from public.requests where id=any($1::uuid[])) requests,
      (select count(*)::int from public.offers where request_id=any($1::uuid[])) offers,
      (select count(*)::int from meetany_private.conversations where id=any($2::uuid[])) conversations,
      (select count(*)::int from meetany_private.messages where conversation_id=any($2::uuid[])) messages`,[deleted,report.conversations]))[0];
    assert(Object.values(left).every(n=>n===0),JSON.stringify(left));report.cleanup=left;
    if(profilesBefore) {assert.deepEqual(await query('select * from public.profiles where id=any($1::uuid[]) order by id',[profileIds]),profilesBefore,'პროფილები შეიცვალა');report.profilesUnchanged=true;}
    return {removed:deleted.length,retained:retained||null,preferencesRestored:!!prefs};
  });
  await browser.close();save();
}
process.exitCode = report.fatal || report.checks.some(x=>x.status==='FAIL') ? 1 : 0;
