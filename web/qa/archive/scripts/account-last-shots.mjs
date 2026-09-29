// P11 T11.9e screenshots + checks: register grid, profile notifications, no placeholder toggle, typed date field.
// Run: QA_ORIGIN=http://localhost:3001 node qa/account-last-shots.mjs  (read-only: nothing is published)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root,'../DEMO-ACCOUNTS.local.md'),'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a=>a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/ideal-0924');
const report = {};
const errors = [];
const browser = await chromium.launch({headless:true, executablePath});

async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  await p.evaluate(() => document.fonts.ready);
}
async function go(p, route) {await p.goto(base+route, {waitUntil:'networkidle'}); await loaded(p);}
async function shot(p, name, fullPage=true) {
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, `${name}: horizontal overflow ${overflow}`);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage});
  console.log('shot', name);
}
async function login(p, key) {
  await go(p, '/account/');
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  await loaded(p);
}

try {
  // #1 register grid (guest, 1440)
  const guest = await browser.newContext({viewport:{width:1440,height:1000}});
  const g = await guest.newPage();
  g.on('pageerror', e => errors.push(e.message));
  await go(g, '/account/?tab=register');
  const grid = await g.evaluate(() => {
    const box = id => {const r = document.getElementById(id).getBoundingClientRect(); return {x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)};};
    const label = id => {const r = document.querySelector(`label[for="${id}"]`).getBoundingClientRect(); return {x:Math.round(r.left), h:Math.round(r.height)};};
    const opt = document.querySelector('label[for="reg-company"] .ma-field__opt')?.getBoundingClientRect();
    const companyLabel = document.querySelector('label[for="reg-company"]').getBoundingClientRect();
    return {name:box('reg-name'), company:box('reg-company'), phone:box('reg-phone'), email:box('reg-email'), labels:['reg-name','reg-company','reg-phone','reg-email'].map(label), optSameLine: opt ? Math.abs(opt.bottom - companyLabel.bottom) < 4 : null};
  });
  report.register = grid;
  console.log('register', JSON.stringify(grid));
  for (const k of ['name','company','phone','email']) assert.equal(grid[k].h, 44, `${k} height`);
  assert.equal(grid.name.y, grid.company.y); assert.equal(grid.phone.y, grid.email.y);
  assert.equal(grid.name.w, grid.company.w, 'equal columns');
  assert(grid.labels.every(l => l.h === grid.labels[0].h), 'label heights');
  assert.equal(grid.labels[1].x, grid.company.x); assert(grid.optSameLine);
  await shot(g, 'register-1440');
  await guest.close();

  // #2 #3 profile notifications (demo company: offers + alerts), 1440 and 390
  const ctx = await browser.newContext({viewport:{width:1440,height:1000}});
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await login(p, 'hotel');
  for (const [w,h] of [[1440,1000],[390,844]]) {
    await p.setViewportSize({width:w,height:h});
    await go(p, '/account/?tab=profile');
    await p.waitForFunction(() => !document.querySelector('#alerts [role="status"][aria-label]'), null, {timeout:30000}).catch(()=>{});
    const alerts = await p.evaluate(() => {
      const box = document.getElementById('alerts');
      const rows = [...box.querySelectorAll('article')];
      const hrefs = rows.map(r => r.querySelector('a')?.getAttribute('href'));
      const main = document.querySelector('main').getBoundingClientRect();
      return {rows: rows.length, uniqueRows: new Set(rows.map(r => r.querySelector('a')?.textContent)).size, sameRequestTwice: hrefs.length !== new Set(hrefs).size && rows.every(r => /შეთავაზება/.test(r.querySelector('a')?.textContent || '')),
        times: rows.map(r => r.querySelector('time')?.textContent), first: rows[0]?.querySelector('a')?.textContent,
        allLink: [...box.querySelectorAll('a')].find(a => a.textContent.startsWith('ყველა შეტყობინება'))?.textContent || null,
        allLinkLast: box.querySelector('a:last-of-type') ? [...box.querySelectorAll('a')].at(-1).textContent.startsWith('ყველა') : false,
        toggle: /მალე დაემატება/.test(box.innerText), sectionHeight: Math.round(box.getBoundingClientRect().height), atEnd: Math.round(main.bottom - box.getBoundingClientRect().bottom)};
    });
    report[`profile-${w}`] = alerts;
    console.log('profile', w, JSON.stringify(alerts));
    assert(alerts.rows <= 5, 'at most 5 rows'); assert(!alerts.toggle, 'placeholder toggle');
    assert(alerts.times.every(t => /^(დღეს|გუშინ) \d\d:\d\d$|დღის წინ$|^\d\d\.\d\d\.\d{4}$/.test(t)), 'relative time');
    await shot(p, `account-profile-${w}`);
  }
  await ctx.close();

  // #4 typed date field (demo client), 1440
  const cctx = await browser.newContext({viewport:{width:1440,height:1000}});
  const c = await cctx.newPage();
  c.on('pageerror', e => errors.push(e.message));
  await login(c, 'hotel');
  await go(c, '/requests/new/');
  await c.locator('#neededBy').waitFor({timeout:30000});
  const date = {};
  date.type = await c.locator('#neededBy').getAttribute('type');
  date.placeholder = await c.locator('#neededBy').getAttribute('placeholder');
  const button = await c.locator('.request-date__button').boundingBox();
  date.button = {w:Math.round(button.width), h:Math.round(button.height)};
  // invalid text → Georgian error on submit (title etc. empty too; we only read the date message)
  await c.locator('#neededBy').fill('31.02.2026');
  await c.locator('button[type="submit"][form="new-request-form"]').click();
  date.invalid = await c.locator('#neededBy-error').textContent();
  // native picker value → typed text back
  await c.locator('.request-date__native').evaluate(el => {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2026-10-15'); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));});
  date.fromPicker = await c.locator('#neededBy').inputValue();
  date.errorCleared = !(await c.locator('#neededBy-error').count());
  await c.locator('#neededBy').fill('24092026');
  await c.locator('#addressNote').focus();
  date.normalized = await c.locator('#neededBy').inputValue();
  await c.locator('#neededBy').fill('24.09.2026');
  await c.locator('button[type="submit"][form="new-request-form"]').click();
  date.today = await c.locator('#neededBy-error').textContent();
  report.date = date;
  console.log('date', JSON.stringify(date));
  assert.equal(date.type, null); assert.equal(date.placeholder, 'დღ.თთ.წწწწ');
  assert.deepEqual(date.button, {w:44, h:44});
  assert.equal(date.invalid, 'მიუთითე თარიღი დღ.თთ.წწწწ ფორმატით');
  assert.equal(date.fromPicker, '15.10.2026'); assert.equal(date.normalized, '24.09.2026');
  assert.equal(date.today, 'თარიღი ხვალიდან უნდა იყოს');
  await c.locator('#neededBy').fill('15.10.2026');
  await c.locator('#neededBy').scrollIntoViewIfNeeded();
  await shot(c, 'request-new-date-1440', false);
  await cctx.close();
  assert.deepEqual(errors, [], 'page errors');
} catch (e) {
  console.error(safe(e.stack || e));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'account-last-qa.json'), safe(JSON.stringify({report, errors}, null, 2)));
  await browser.close();
}
