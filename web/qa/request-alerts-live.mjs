// Local app + auth-probe only. All fixture requests and preference changes are restored.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import assert from 'node:assert/strict';
const env=parseEnv(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8'));
assert(/^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(env.DATABASE_URL).hostname),'Only auth-probe');
const base='http://localhost:3001';
const pool=new Pool({connectionString:env.DATABASE_URL,max:1});
const ledger=JSON.parse(fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md',import.meta.url),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})});
let recipient,original,fixture;
try {
 recipient=(await pool.query("select id from public.profiles where email='demo-wood@meetany.ge'")).rows[0].id;
 original=(await pool.query('select * from meetany_private.request_alert_preferences where user_id=$1',[recipient])).rows[0]||null;
 // Avoid cancelling any existing queued delivery on a user's configured account.
 assert.equal((await pool.query("select count(*)::int n from meetany_private.request_alert_emails where user_id=$1 and status in ('pending','processing')",[recipient])).rows[0].n,0);
 const p=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/account/?tab=notifications');await p.locator('#login-email').fill('demo-wood@meetany.ge');await p.locator('#login-password').fill(ledger.accounts.wood.password);await p.locator('form button[type=submit]').click();
 const form=p.getByRole('form',{name:'ახალი მოთხოვნების შეტყობინებები'});await form.waitFor({timeout:60000});
 await form.getByRole('checkbox',{name:'ახალ მოთხოვნებზე შემატყობინე',exact:true}).check();
 for(const checkbox of await form.locator('fieldset').first().getByRole('checkbox').all()) if(await checkbox.isChecked()) await checkbox.uncheck();
 await form.getByRole('checkbox',{name:'ავეჯი და ინვენტარი',exact:true}).check();
 await form.getByRole('checkbox',{name:'მთელი საქართველო',exact:true}).check();
 await form.getByRole('checkbox',{name:'თბილისი',exact:true}).check();
 assert(!await form.getByRole('checkbox',{name:'მთელი საქართველო',exact:true}).isChecked());
 await p.route('**/api/db/rpc/set_request_alert_preferences',route=>route.fulfill({status:503,json:{message:'QA unavailable'}}),{times:1});
 await form.getByRole('button',{name:'პარამეტრების შენახვა'}).click();await form.getByRole('alert').waitFor();assert(await form.getByRole('checkbox',{name:'თბილისი',exact:true}).isChecked());
 await form.getByRole('button',{name:'პარამეტრების შენახვა'}).click();await form.getByRole('status').waitFor();
 await p.reload();await form.waitFor();await form.getByRole('button',{name:'პარამეტრების შეცვლა'}).waitFor();await p.screenshot({path:'/tmp/request-alert-settings-compact-1280.png',fullPage:true});await form.getByRole('button',{name:'პარამეტრების შეცვლა'}).click();assert(await form.getByRole('checkbox',{name:'თბილისი',exact:true}).isChecked());assert(await form.getByRole('combobox').isDisabled());
 for(const width of [1280,390,320]){
  await p.setViewportSize({width,height:900});await p.addStyleTag({content:'nextjs-portal {display:none}'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  await p.screenshot({path:`/tmp/request-alert-settings-${width}.png`,fullPage:true});
 }
 await p.goto(base+'/requests/');const manage=p.getByRole('link',{name:'შეტყობინებების მართვა',exact:true});await manage.waitFor();
 for(const width of [1280,390,320]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await manage.click();await form.waitFor();
 fixture=(await pool.query("insert into public.requests(owner_id,title,body,category,city,needed_by) select id,'QA ახალი მოთხოვნის შეტყობინება','სატესტო მოთხოვნა შეტყობინების შესამოწმებლად','furniture','tbilisi',current_date+7 from public.profiles where email='demo-hotel@meetany.ge' returning id")).rows[0].id;
 await p.reload();await p.getByText('QA ახალი მოთხოვნის შეტყობინება',{exact:true}).waitFor();
 const row=p.locator('article').filter({hasText:'QA ახალი მოთხოვნის შეტყობინება'});assert.equal(await row.getAttribute('data-unread'),'true');
 await p.getByRole('button',{name:/^შეტყობინებები, /}).click();await p.locator('#notification-list').getByText('QA ახალი მოთხოვნის შეტყობინება',{exact:true}).waitFor();
 await p.screenshot({path:'/tmp/request-alert-bell-320.png'});await p.keyboard.press('Escape');
 await row.getByRole('link',{name:/ახალი მოთხოვნა შენს კატეგორიაში/}).click();await p.waitForURL('**/requests/view/**');
 assert(new URL(p.url()).searchParams.get('id')===fixture);
 await p.goto(base+'/account/?tab=notifications');await p.getByText('QA ახალი მოთხოვნის შეტყობინება',{exact:true}).waitFor();assert.equal(await p.locator('article').filter({hasText:'QA ახალი მოთხოვნის შეტყობინება'}).getAttribute('data-unread'),'false');
 await pool.query("update public.requests set status='closed' where id=$1",[fixture]);await p.reload();await form.waitFor();await p.getByText('შეტყობინებები ჯერ არ გაქვს.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS live preference failure/retry/save/reload, request-page settings link, category/city selection, 1280/390/320 layout, real insert notification, bell, link/read, closed request removal. No email sent.');
} finally {
 if(fixture) await pool.query('delete from public.requests where id=$1',[fixture]);
 if(recipient && original!==undefined){
  if(original)await pool.query('update meetany_private.request_alert_preferences set enabled=$2,categories=$3,cities=$4,email_mode=$5,generation=$6 where user_id=$1',[recipient,original.enabled,original.categories,original.cities,original.email_mode,original.generation]);
  else await pool.query('delete from meetany_private.request_alert_preferences where user_id=$1',[recipient]);
 }
 await browser.close();await pool.end();
}
