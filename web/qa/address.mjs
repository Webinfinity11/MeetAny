// T10.8 QA: address field, directions links and request district (local dev only).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const shots = path.join(root, 'qa/shots');
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe = v => secrets.reduce((t,s)=>t.replaceAll(s,'[redacted]'),String(v));
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors = [];
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});return p;}
async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  await p.evaluate(() => document.fonts.ready);
}
async function go(p,route){await p.goto(base+route);await loaded(p);}
async function shot(p,name){
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${name}: horizontal overflow`);
  await p.evaluate(async()=>{await Promise.all(Array.from(document.querySelectorAll('main img')).map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));});
  await p.screenshot({path:path.join(shots,name+'.png'),fullPage:true});console.log('shot',name);
}
async function login(p,key){
  await go(p,'/account/');
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  await loaded(p);
}
const woodId = ledger.accounts.wood.id;
let restore = null, created = null, owner = null;
try {
  // Public catalog + profile.
  const pub = watch(await browser.newPage({viewport:{width:1440,height:1000}}));
  await go(pub,'/companies/');
  const card = pub.locator('.supplier-row').filter({has:pub.locator(`a[href="/companies/view/?id=${woodId}"]`)}).first();
  const dir = card.locator('.listing-directions:visible');
  await dir.waitFor({timeout:30000});
  assert.match(await dir.getAttribute('href'), /^https:\/\/www\.google\.com\/maps\//);
  await card.scrollIntoViewIfNeeded();
  await shot(pub,'address-companies-1440');
  await go(pub,`/companies/view/?id=${woodId}`);
  const pdir = pub.locator('.company-profile-directions');
  await pdir.waitFor({timeout:30000});
  assert.match(await pdir.getAttribute('href'), /^https:\/\/www\.google\.com\/maps\//);
  console.log('profile meta:', await pub.locator('.company-profile-city').innerText());
  await shot(pub,'address-company-1440');
  await pub.setViewportSize({width:390,height:844}); await pub.reload(); await loaded(pub); await pdir.waitFor();
  await shot(pub,'address-company-390');

  // Company edits its address, then it shows on the public profile.
  const co = watch(await browser.newPage({viewport:{width:390,height:844}}));
  await login(co,'wood');
  await go(co,'/account/?tab=profile');
  const field = co.locator('#address'); await field.waitFor();
  restore = await field.inputValue();
  const next = restore.endsWith(' (QA)') ? restore.slice(0,-5) : restore + ' (QA)';
  await field.fill(next);
  await field.scrollIntoViewIfNeeded();
  await shot(co,'address-form-390');
  await co.getByRole('button',{name:'შენახვა',exact:true}).click();
  await co.getByText('ცვლილებები შენახულია.').waitFor({timeout:60000});
  await pub.setViewportSize({width:1440,height:1000});
  await go(pub,`/companies/view/?id=${woodId}`);
  await pub.waitForFunction(t=>document.querySelector('.company-profile-city')?.textContent.includes(t),next,{timeout:30000}).catch(async()=>{await pub.reload();await loaded(pub);});
  assert((await pub.locator('.company-profile-city').innerText()).includes(next),'edited address not shown on profile');
  console.log('address edit visible on profile');
  // Restore the demo value.
  await go(co,'/account/?tab=profile');
  await co.locator('#address').fill(restore);
  await co.getByRole('button',{name:'შენახვა',exact:true}).click();
  await co.getByText('ცვლილებები შენახულია.').waitFor({timeout:60000});
  restore = null;

  // Client creates a request with a district note.
  owner = watch(await browser.newPage({viewport:{width:1440,height:1000}}));
  await login(owner,'cafe');
  const title = `QA ${Date.now()} — მისამართის შემოწმება`;
  await go(owner,'/requests/new/');
  await owner.locator('#title').fill(title);
  await owner.locator('#category').selectOption({index:1});
  await owner.locator('#addressNote').fill('საბურთალო, ვაჟა-ფშაველას გამზ.');
  await owner.locator('#body').fill('ლოკალური QA შემოწმება: რაიონის ველი მოთხოვნის გვერდზე.');
  await owner.locator('button[form="new-request-form"]').click();
  await owner.locator('#new-request').waitFor({state:'hidden',timeout:60000});
  const link = owner.getByRole('link',{name:title,exact:true}); await link.waitFor({timeout:60000});
  created = await link.getAttribute('href');
  await go(owner,created);
  const line = await owner.locator('.request-detail-main .ma-cluster .ma-small').first().innerText();
  console.log('request line:', line);
  assert(line.includes('თბილისი · საბურთალო, ვაჟა-ფშაველას გამზ.'));
  await owner.getByRole('button',{name:'რედაქტირება',exact:true}).click();
  assert.equal(await owner.locator('#addressNote').inputValue(),'საბურთალო, ვაჟა-ფშაველას გამზ.');
  await owner.keyboard.press('Escape');
  await owner.locator('#new-request').waitFor({state:'hidden'});
  await shot(owner,'address-request-1440');
  owner.once('dialog',d=>d.accept()); await owner.getByRole('button',{name:'წაშლა',exact:true}).click();
  await owner.waitForURL('**/account/',{timeout:60000}); created = null;
  console.log('errors:', errors.map(safe));
  console.log('PASS');
} catch (err) {
  console.error('FAIL', safe(err.message), errors.map(safe));
  process.exitCode = 1;
} finally {
  if (created) console.error('leftover QA request:', created);
  if (restore !== null) console.error('wood address not restored');
  await browser.close();
}
