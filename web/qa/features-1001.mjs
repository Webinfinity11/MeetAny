import fs from 'node:fs';
import { chromium } from 'playwright';
import { Scenario, assert, rpc, api, go, query, safe } from './e2e/lib.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const t=new Scenario(browser,'features',`${Date.now()}-features`);t.persist();
fs.mkdirSync('qa/shots/finish-1001',{recursive:true});
let request;
try {
 const owner=await t.page('hotel'),reporter=await t.page('linen'),admin=await t.page('owner_admin'),guest=await t.page();
 request=await t.fixture(owner,'საჩივრის შემოწმება');
 await go(guest,`/requests/view/?id=${request.id}`);
 await guest.getByRole('button',{name:'შეატყობინე',exact:true}).click();
 await guest.waitForURL(/account\/\?next=/);assert(new URL(guest.url()).searchParams.get('next').includes(request.id));
 await go(reporter,`/requests/view/?id=${request.id}`);
 await reporter.getByRole('button',{name:'შეატყობინე',exact:true}).click();
 await reporter.getByRole('radio',{name:'სხვა მიზეზი'}).check();
 await reporter.getByRole('button',{name:'გაგზავნა',exact:true}).click();
 await reporter.getByRole('alert').filter({hasText:'მოკლედ აღწერე'}).waitFor();
 await reporter.locator('.report-sheet textarea').fill(`${t.marker} სატესტო საჩივარი`);
 await reporter.getByRole('button',{name:'გაგზავნა',exact:true}).click();
 await reporter.locator('.report-sheet').waitFor({state:'hidden'});
 const queue=await rpc(admin,'admin_list_reports',{p_status:'new',p_offset:0});
 const metrics=await rpc(admin,'admin_market_metrics');
 const [expected]=await query(`with r as (select r.*,meetany_private.request_state(r) state from public.requests r join public.profiles p on p.id=r.owner_id where not r.hidden and not p.blocked),f as(select request_id,min(created_at) at from public.offers where status<>'withdrawn' group by request_id) select (select count(*)::int from r where state='open' and not exists(select 1 from f where f.request_id=r.id)) unanswered,(select round(avg(greatest(0,extract(epoch from f.at-r.created_at)/3600))::numeric,1) from r join f on f.request_id=r.id) hours,(select round(100.0*count(*) filter(where chosen_offer_id is not null)/nullif(count(*) filter(where state<>'open'),0),1) from r) share`);
 assert.equal(metrics.withoutOffers,expected.unanswered);assert.equal(Number(metrics.averageFirstOfferHours),Number(expected.hours));assert.equal(Number(metrics.chosenShare),Number(expected.share));
 const report=queue.items.find(x=>x.target_id===request.id);assert(report);
 assert.equal((await api(reporter,'rpc/admin_list_reports',{})).status,400);
 await go(admin,'/admin/?tab=reports');
 let row=admin.locator('tbody tr').filter({hasText:request.title});await row.waitFor();
 await row.getByRole('button',{name:'უარყოფა',exact:true}).click();
 await admin.locator('#moderation-reason').fill('სატესტო ჩანაწერია, დარღვევა არ არის');
 await admin.locator('#moderation').getByRole('button',{name:'დადასტურება',exact:true}).click();
 await admin.locator('#moderation').waitFor({state:'hidden'});
 assert((await rpc(admin,'admin_list_reports',{p_status:'handled',p_offset:0})).items.some(x=>x.id===report.id&&x.resolution==='rejected'));
 for(const width of [1440,390]){
  await admin.setViewportSize({width,height:1000});await go(admin,'/admin/');
  await admin.getByRole('heading',{name:'მიწოდება და მოთხოვნა',exact:true}).waitFor();
  await admin.locator('#market-metrics-heading').locator('..').locator('..').getByText('პირველი შეთავაზების საშუალო დრო').waitFor();
  assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'admin overflow');
  await admin.screenshot({path:`qa/shots/finish-1001/admin-${width}.png`,fullPage:true});
 }
 await go(reporter,'/account/?tab=business');
 // Render distribution settings without mutating any existing company profile.
 await reporter.route('**/api/db/rpc/my_business_settings',route=>route.fulfill({json:{distributor:true,distribution:{regions:['tbilisi'],categories:[],channels:['horeca'],brands:['QA Brand'],warehouse:'own',transport:'own',coldChain:true,minOrder:'',exclusive:false},membership:null,application:null}}));
 await reporter.reload({waitUntil:'domcontentloaded'});
 await reporter.getByRole('heading',{name:'დისტრიბუციის პროფილი',exact:true}).waitFor();
 await reporter.setViewportSize({width:390,height:1000});
 assert(await reporter.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'distribution overflow');
 await reporter.screenshot({path:'qa/shots/finish-1001/distribution-390.png',fullPage:true});
 await go(guest,'/companies/?type=distributors&channels=horeca&cold=1');
 await guest.locator('.catalog-skeleton').waitFor({state:'hidden'});
 assert(!(await guest.locator('main').innerText()).includes('ინფორმაცია ვერ ჩაიტვირთა'));
 console.log('PASS: guest redirect, report validation/submission/resolution, admin permissions, metrics desktop/mobile, distribution form/catalog');
} catch(e){console.error(safe(e.stack));process.exitCode=1;await t.current?.screenshot({path:'qa/shots/finish-1001/failure.png',fullPage:true});}
finally {
 if(request)await query('delete from meetany_private.reports where target_id=$1 and body like $2',[request.id,t.marker+'%']);
 await t.cleanup();await browser.close();
 console.log('Cleanup:',safe(JSON.stringify(t.cleanupLog)));
}
