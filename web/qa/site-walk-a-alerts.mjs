// Authorized owner_company toggle cycle; restore enabled preferences even after a failure.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { reuseAnonymousToken } from './site-walk-a-auth.mjs';
process.env.QA_ORIGIN ||= 'http://localhost:3002';
const { origin, root, rpc, assert, safe } = await import('./e2e/lib.mjs');
assert.equal(new URL(origin).port, '3002');
const dir = path.join(root, 'qa/shots/final-2026-09-29/public/default-on');
fs.mkdirSync(dir, {recursive:true});
const expected = {enabled:true, categories:['freight'], cities:['tbilisi','rustavi'], emailMode:'off'};
const normalized = prefs => ({enabled:prefs.enabled, categories:[...prefs.categories].sort(), cities:[...prefs.cities].sort(), emailMode:prefs.emailMode});
const report = {checks:[], errors:[]};
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({storageState:'/tmp/meetany-flows-owner_company.json'});
await reuseAnonymousToken(context);
const p = await context.newPage();
p.setDefaultTimeout(25000);
p.on('pageerror', e => report.errors.push(safe(e.message)));
p.on('console', e => {if(e.type()==='error') report.errors.push(safe(e.text()));});
const settings = p.getByRole('form', {name:'ახალი მოთხოვნების შეტყობინებები'});
const toggle = settings.getByLabel('ახალ მოთხოვნებზე შემატყობინე', {exact:true});
async function check(name, fn) {await fn();report.checks.push({name,status:'PASS'});console.log(name+': PASS');}
async function load() {await p.goto(origin+'/account/?tab=notifications');await settings.waitFor();await p.evaluate(()=>document.fonts.ready);}
async function save(enabled) {
  await toggle.setChecked(enabled);
  const response=p.waitForResponse(r=>r.url().endsWith('/rpc/set_request_alert_preferences'));
  await settings.getByRole('button',{name:'პარამეტრების შენახვა',exact:true}).click();
  assert((await response).ok());
  await settings.getByText(enabled?'შენახულია — ახალ შესაბამის მოთხოვნებზე შეგატყობინებთ.':'ახალი მოთხოვნების შეტყობინებები გამორთულია.',{exact:true}).waitFor();
}
try {
  for(const width of [1440,390]) {
    await p.setViewportSize({width,height:width===390?844:1000});await load();
    await check(`${width} საწყისი ჩართული პარამეტრები`,async()=>{
      assert(await toggle.isChecked());assert.deepEqual(normalized(await rpc(p,'request_alert_preferences')),normalized(expected));
      assert.match(await settings.innerText(),/შეტყობინებები ნაგულისხმევად ჩართულია\. გამორთვა აქვე შეგიძლია\./);
      for(const text of ['ტვირთის გადაზიდვა','თბილისი','რუსთავი'])assert((await settings.innerText()).includes(text));
    });
    await settings.screenshot({path:path.join(dir,`${width}-enabled.png`)});
    await check(`${width} გამორთვა და შენახვა`,async()=>{await save(false);assert.equal((await rpc(p,'request_alert_preferences')).enabled,false);});
    await check(`${width} განახლების შემდეგ გამორთულია`,async()=>{await load();assert.equal(await toggle.isChecked(),false);});
    await settings.screenshot({path:path.join(dir,`${width}-disabled.png`)});
    await check(`${width} ხელახალი ჩართვა და შენახვა`,async()=>{await save(true);assert.deepEqual(normalized(await rpc(p,'request_alert_preferences')),normalized(expected));});
    await check(`${width} განახლების შემდეგ ჩართულია`,async()=>{await load();assert(await toggle.isChecked());assert.deepEqual(normalized(await rpc(p,'request_alert_preferences')),normalized(expected));});
    await check(`${width} ზომები და სურათები`,async()=>{
      const metrics=await p.evaluate(()=>({overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,broken:[...document.images].filter(x=>x.complete&&!x.naturalWidth).length}));
      assert.deepEqual(metrics,{overflow:0,broken:0});
    });
    await settings.screenshot({path:path.join(dir,`${width}-restored.png`)});
  }
  assert.equal(report.errors.length,0);
} catch(e) {report.failure=safe(e.message);process.exitCode=1;}
finally {
  try {
    let prefs=await rpc(p,'request_alert_preferences');
    if(JSON.stringify(normalized(prefs))!==JSON.stringify(normalized(expected))) prefs=await rpc(p,'set_request_alert_preferences',{p_enabled:true,p_categories:expected.categories,p_cities:expected.cities,p_email_mode:'off'});
    report.finalPreferences=prefs;assert.deepEqual(normalized(prefs),normalized(expected));
  } catch(e) {report.restoreFailure=safe(e.message);process.exitCode=1;}
  fs.writeFileSync(path.join(dir,'ui.json'),safe(JSON.stringify(report,null,2)));
  await browser.close();
}
