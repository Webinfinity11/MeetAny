import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({headless:true,...(process.env.QA_BROWSER_PATH ? {executablePath:process.env.QA_BROWSER_PATH} : {})});
const errors = [];
const privateValues = [];
const safe = value => privateValues.reduce((text, secret) => text.replaceAll(secret, "[redacted]"), String(value));
const report = [];
const page = await browser.newPage({viewport:{width:1280,height:900}});
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if(m.type()==='error') errors.push(m.text().slice(0,250));});
const shots = path.join(root, 'qa/shots');
fs.mkdirSync(shots,{recursive:true});
async function loaded(p=page) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  assert(!await p.locator('main').innerText().then(t=>t.includes('სერვისი დროებით მიუწვდომელია')), 'API unavailable');
  await p.evaluate(() => document.fonts.ready);
}
async function go(route,p=page) {await p.goto(base+route); await loaded(p);}
async function capture(name,width) {
  if (['companies','company','request'].includes(name)) await page.locator('.ma-call').first().waitFor({timeout:30000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${name}: horizontal overflow`);
  const filterOverflow = await page.locator(".ma-proto-filters").evaluateAll(groups => groups.flatMap(group => {
    const bounds = group.getBoundingClientRect();
    if (!bounds.width) return [];
    return Array.from(group.querySelectorAll("button, select")).filter(control => {
      const rect = control.getBoundingClientRect();
      return rect.width && (rect.right > bounds.right + 0.5 || rect.left < bounds.left - 0.5 || control.scrollWidth > control.clientWidth + 1);
    }).map(control => control.textContent);
  }));
  assert.deepEqual(filterOverflow, [], `${name}: filter controls overflow their container`);
  await page.evaluate(async () => {await Promise.all(Array.from(document.querySelectorAll('main img')).map(img => {img.loading='eager'; return img.decode().catch(()=>{});}));});
  await page.screenshot({path:path.join(shots,`${name}-${width}.png`),fullPage:true});
  console.log('checked',name,width);
  report.push({page:name,width,passed:true});
}
try {
  if(process.env.QA_DEMO_ONLY !== '1') {
  await go('/requests/');
  const request=await page.locator('a[href^="/requests/view/?id="]').first().getAttribute('href');
  await go('/companies/');
  const company=await page.locator('a[href^="/companies/view/?id="]').first().getAttribute('href');
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:900});
    for(const [name,route] of Object.entries({home:'/',requests:'/requests/',new:'/requests/new/',request,companies:'/companies/',company,account:'/account/',admin:'/admin/',terms:'/terms/'})) {
      await go(route); await capture(name,width);
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await go('/requests/');
  assert.equal(await page.locator('#city-desktop').first().inputValue(),'');
  await page.locator('#city-desktop').first().selectOption('batumi');
  assert(new URL(page.url()).searchParams.get('city')==='batumi');
  await page.reload(); await loaded(); assert.equal(await page.locator('#city-desktop').first().inputValue(),'batumi');
  await page.locator('#city-desktop').first().selectOption('kutaisi'); await page.goBack();
  assert.equal(await page.locator('#city-desktop').first().inputValue(),'batumi');
  await go('/companies/');
  await page.locator('.ma-call').first().waitFor();
  assert((await page.locator('.ma-call').first().boundingBox()).height>=44);
  assert(await page.locator('.listing-media img').first().evaluate(e=>e.complete && e.naturalWidth>0));
  await page.setViewportSize({width:390,height:900});
  await page.getByRole('button',{name:'მენიუ',exact:true}).click();
  await page.keyboard.press('Escape');
  assert(await page.getByRole('button',{name:'მენიუ',exact:true}).evaluate(e=>e===document.activeElement));
  await page.getByRole('button',{name:/ფილტრი \(/}).click(); await page.keyboard.press('Escape');
  assert(await page.getByRole('button',{name:/ფილტრი \(/}).evaluate(e=>e===document.activeElement));
  report.push({filters:true,history:true,phone:true,photos:true,dialogs:true});
  }
  if(process.env.QA_DEMO==='1') {
    const env=fs.readFileSync(path.join(root,'.env.local'),'utf8');
    const database=env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.replace(/^["']|["']$/g,'');
    assert(database && /^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(database).hostname),'QA mutations require auth-probe branch');
    const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
    privateValues.push(...Object.values(ledger.accounts).map(a=>a.password).filter(Boolean));
    const login = async (key,p=page) => {
      await go('/account/',p);
      await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
      await p.locator('#login-password').fill(ledger.accounts[key].password);
      await p.locator('form button[type="submit"]').click();
      await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
      await loaded(p);
    };
    await page.setViewportSize({width:1280,height:900});
    await login('wood');
    const leftovers=await page.getByRole('link',{name:/^QA \d+ — ავეჯის მოთხოვნა$/}).evaluateAll(links=>links.map(l=>l.getAttribute('href')));
    for(const href of leftovers) {await go(href); page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'წაშლა',exact:true}).click();await page.waitForURL('**/account/',{timeout:60000});await loaded();}
    await capture('account-company',1280);
    // Only new QA data is changed. Existing demo requests and offers remain untouched.
    const title=`QA ${Date.now()} — ავეჯის მოთხოვნა`;
    await go('/requests/new/');
    await page.locator('#title').fill(title);
    await page.locator('#category').selectOption('furniture');
    await page.locator('#body').fill('ლოკალური QA შემოწმება: გვჭირდება ხის მაგიდა და მიტანა თბილისში.');
    await page.locator('#quantity').fill('2');
    await page.locator('input[type="file"]').setInputFiles(path.join(root,'public/assets/photos/workshop-banner.jpg'));
    await page.locator('button[form="new-request-form"]').click();
    await page.locator('#new-request').waitFor({state:'hidden',timeout:60000});
    const link=page.getByRole('link',{name:title,exact:true});await link.waitFor();
    const created=await link.getAttribute('href'); await go(created);
    await page.getByRole('button',{name:'რედაქტირება',exact:true}).click();
    await page.locator('#quantity').fill('3');await page.getByRole('button',{name:'შენახვა',exact:true}).click();
    await page.locator('#new-request').waitFor({state:'hidden',timeout:60000});
    await page.locator('main').getByRole('button',{name:'დახურვა',exact:true}).click();
    await page.getByRole('button',{name:/ხელახლა გახსნა/}).waitFor({timeout:60000});
    await page.getByRole('button',{name:/ხელახლა გახსნა/}).click();
    await page.locator('main').getByRole('button',{name:'დახურვა',exact:true}).waitFor({timeout:60000});
    const companyContext=await browser.newContext();const supplier=await companyContext.newPage();
    supplier.on('pageerror',e=>errors.push(e.message));
    await login('linen',supplier);await go(created,supplier);
    await supplier.locator('#of-body').fill('QA შეთავაზება: დავამზადებთ მაგიდას და მოგაწვდით შეთანხმებულ მისამართზე.');
    await supplier.locator('#of-days').fill('5');
    await supplier.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();
    await supplier.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).waitFor({timeout:60000});
    await supplier.getByRole('button',{name:'შეთავაზების რედაქტირება',exact:true}).click();
    await supplier.locator('#of-days').fill('4');await supplier.getByRole('button',{name:'შეთავაზების განახლება'}).click();
    await supplier.locator('#of-body').waitFor({state:'hidden',timeout:60000});
    await supplier.getByRole('button',{name:'შეთავაზების გაუქმება'}).click();
    await supplier.locator('#of-body').waitFor({timeout:60000});
    await supplier.locator('#of-body').fill('QA განახლებული შეთავაზება: დავამზადებთ მაგიდას ოთხ სამუშაო დღეში.');
    await supplier.getByRole('button',{name:'შეთავაზების გაგზავნა',exact:true}).click();
    await supplier.getByRole('button',{name:'შეთავაზების რედაქტირება'}).waitFor({timeout:60000});
    await page.reload(); await loaded();
    const engagementEnabled=(await (await page.request.get(base+'/api/db/capabilities')).json()).engagement;
    if(engagementEnabled) await page.getByRole('button',{name:/^შეტყობინებები, \d+/}).waitFor({timeout:30000});
    assert.equal(await page.getByRole('button',{name:'რედაქტირება',exact:true}).count(),0);
    await page.getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();
    await page.locator('#choose').getByRole('button',{name:'შეთავაზების არჩევა',exact:true}).click();
    await page.locator('#choose').waitFor({state:'hidden',timeout:60000});
    await capture('chosen',1280);
    if(engagementEnabled){await supplier.reload();await loaded(supplier);await supplier.getByRole('button',{name:/^შეტყობინებები, \d+/}).waitFor({timeout:30000});}
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'წაშლა',exact:true}).click();
    await page.waitForURL('**/account/',{timeout:60000});
    await companyContext.close();
    const adminContext=await browser.newContext();const admin=await adminContext.newPage();await login('admin',admin);await go('/admin/',admin);
    assert(await admin.locator('.ma-stat').count()===6);
    await go('/admin/?tab=users',admin);assert(await admin.locator('tbody tr').count()>0);
    await admin.screenshot({path:path.join(shots,'admin-users-1280.png'),fullPage:true});
    await adminContext.close();report.push({demoLogin:true,createPhoto:true,edit:true,closeReopen:true,offerEditWithdraw:true,choose:true,delete:true,admin:true});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,process.env.QA_DEMO_ONLY === '1' ? 'qa/demo-report.json' : 'qa/report.json'),JSON.stringify({report,errors},null,2));
  console.log('PASS',report.length,'checks; 0 console errors');
} catch(err) { console.error('Visible alerts:', await page.locator('main [role=alert], dialog [role=alert]').allTextContents()); console.error('Console errors:', errors.map(safe)); throw new Error(safe(err.message)); } finally {await browser.close();}
