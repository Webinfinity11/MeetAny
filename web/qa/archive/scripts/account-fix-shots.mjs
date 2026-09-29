// P11 T11.9c screenshots + checks: sign-in, account (client, company), request form — acceptance fixes.
// Run: QA_ORIGIN=http://localhost:3001 node qa/account-fix-shots.mjs
// Publishes one request as the demo client and deletes it again (owner "delete" on the request page).
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
const errors = [];
const report = {};
const browser = await chromium.launch({headless:true, executablePath});
const english = /Please |fill out|include an|valid email|Fill in/i;

async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  await p.evaluate(() => document.fonts.ready);
}
async function go(p, route) {await p.goto(base+route, {waitUntil:'networkidle'}); await loaded(p);}
async function measure(p) {
  return p.evaluate(() => {
    const x = s => {const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null;};
    return {overflow: document.documentElement.scrollWidth - innerWidth, h1: x('main h1'), tab: x('main .ma-tabs .ma-tab'), form: x('main form'), avatars: document.querySelectorAll('main .ma-avatar').length, text: document.querySelector('main')?.innerText.slice(0, 4000) || ''};
  });
}
async function capture(p, name, fullPage=true) {
  const m = await measure(p);
  assert(m.overflow <= 0, `${name}: horizontal overflow ${m.overflow}`);
  assert(!english.test(m.text), `${name}: English validation text`);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage});
  delete m.text;
  report[name] = m;
  console.log('shot', name, JSON.stringify(m));
}
async function newPage(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  return p;
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
  // ---- guest: sign-in (#1–#5)
  const guest = await browser.newContext();
  const page = await newPage(guest);
  for (const [w,h] of [[1440,1000],[390,844]]) {
    await page.setViewportSize({width:w,height:h});
    await page.goto(base+'/account/', {waitUntil:'networkidle'});
    await page.locator('#login-email').waitFor({timeout:30000});
    await page.evaluate(() => document.fonts.ready);
    const login = await page.evaluate(() => {
      const r = s => document.querySelector(s)?.getBoundingClientRect();
      const field = document.querySelector('#login-password').closest('.ma-field').getBoundingClientRect();
      const btn = r('form button[type="submit"]');
      return {h1: document.querySelector('main h1').textContent, switchLink: !!document.querySelector('.auth-switch'), placeholder: document.querySelector('#login-email').placeholder, noValidate: document.querySelector('main form').noValidate,
        fieldToButton: Math.round(btn.top - field.bottom), formWidth: Math.round(r('main form').width), forgotSameRow: Math.abs(r('.auth-label-row .auth-link').top - r('label[for="login-password"]').top) < 12, toggle: document.querySelector('.auth-password__toggle')?.textContent};
    });
    console.log('login', w, JSON.stringify(login));
    report[`login-${w}-checks`] = login;
    assert.equal(login.h1, 'შესვლა'); assert(!login.switchLink); assert.equal(login.placeholder, ''); assert(login.noValidate); assert.equal(login.fieldToButton, 24); assert(login.forgotSameRow);
    await capture(page, `login-${w}`);
  }
  await page.setViewportSize({width:1440,height:1000});
  const btnY = () => page.locator('form button[type="submit"]').evaluate(b => Math.round(b.getBoundingClientRect().top));
  const y0 = await btnY();
  await page.locator('#login-email').fill('abc');
  await page.locator('form button[type="submit"]').click();
  const invalid = await page.evaluate(() => ({focus: document.activeElement?.id, errors: [...document.querySelectorAll('.ma-field__error[id]')].map(e => e.textContent), aria: [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.id), described: document.querySelector('#login-email').getAttribute('aria-describedby')}));
  console.log('login invalid', JSON.stringify(invalid));
  report['login-error-checks'] = invalid;
  assert.deepEqual(invalid.errors, ['ჩაწერე სწორი ელფოსტა', 'მიუთითე პაროლი']); assert.equal(invalid.focus, 'login-email');
  await capture(page, 'login-error-1440');
  await page.locator('#login-email').fill('nobody-here@meetany.ge');
  await page.locator('#login-password').fill('wrong-password-1');
  await page.locator('form button[type="submit"]').click();
  await page.locator('.auth-alert:not(:empty)').waitFor({timeout:30000});
  const wrong = {text: await page.locator('.auth-alert').innerText(), buttonShift: (await btnY()) - y0};
  console.log('login wrong', JSON.stringify(wrong));
  report['login-wrong-checks'] = wrong;
  assert.equal(wrong.buttonShift, 0);
  await page.locator('main .ma-tab', {hasText:'რეგისტრაცია'}).click();
  await page.locator('#reg-name').waitFor();
  const regH1 = await page.locator('main h1').innerText();
  await page.locator('form button[type="submit"]').click();
  const reg = await page.evaluate(() => ({focus: document.activeElement?.id, errors: [...document.querySelectorAll('.ma-field__error[id]')].map(e => e.textContent)}));
  console.log('register invalid', regH1, JSON.stringify(reg));
  report['register-error-checks'] = {h1: regH1, ...reg};
  assert.equal(reg.focus, 'reg-name');
  await guest.close();

  // ---- demo client: account (#6–#14) and request form (#15–#18, #3)
  const ctx = await browser.newContext({viewport:{width:1440,height:1000}});
  // Records whether the guest note ever appears while signed in (#15).
  await ctx.addInitScript(() => {
    window.__guestFlash = false;
    new MutationObserver(() => {if (document.querySelector('.request-form__guest')) window.__guestFlash = true;}).observe(document, {subtree:true, childList:true});
  });
  const p = await newPage(ctx);
  await login(p, 'hotel');
  const profileCity = await (async () => {await go(p, '/account/?tab=profile'); return p.locator('#profile-city').inputValue();})();
  await capture(p, 'account-profile-1440');
  const profile = await p.evaluate(() => {
    const top = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
    return {aside: !!document.querySelector('.account-profile'), row1: ['#name','#company','#profile-city'].map(top), phoneReadOnly: document.querySelector('#profile-phone').readOnly, note: document.querySelector('#profile-phone-help').textContent, alerts: !!document.querySelector('#alerts h2'), logout: [...document.querySelectorAll('.account-form-links .account-link')].map(e => e.textContent)};
  });
  console.log('profile', JSON.stringify(profile));
  report['account-profile-checks'] = profile;
  assert(!profile.aside); assert.equal(new Set(profile.row1).size, 1);
  await go(p, '/account/?tab=alerts');
  report['tab-alerts'] = await p.evaluate(() => ({current: document.querySelector('.ma-tab[aria-current="page"]')?.textContent, alertsTop: Math.round(document.querySelector('#alerts').getBoundingClientRect().top)}));
  console.log('tab=alerts', JSON.stringify(report['tab-alerts']));

  for (const [w,h] of [[1440,1000],[390,844]]) {
    await p.setViewportSize({width:w,height:h});
    await go(p, '/account/');
    const acc = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.account-row')];
      const first = rows[0]?.getBoundingClientRect();
      const act = rows.map(r => r.querySelector('.account-row__actions').getBoundingClientRect()).filter(r => r.width).map(r => [Math.round(r.left), Math.round(r.right)]);
      return {tabs: [...document.querySelectorAll('.ma-tab')].map(t => t.textContent), rows: rows.length, firstRowBottom: first ? Math.round(first.bottom) : null,
        primaryButtons: document.querySelectorAll('main .ma-btn--primary').length, addLinks: [...document.querySelectorAll('main .account-link')].filter(a => a.textContent === 'მოთხოვნის დამატება').length,
        metas: rows.slice(0, 3).map(r => r.querySelector('.account-row__meta').textContent), statuses: rows.map(r => r.querySelector('.account-status')?.textContent).filter(Boolean),
        seeOffersText: document.querySelector('main').innerText.includes('შეთავაზებების ნახვა'), actionColumns: [...new Set(act.map(a => a.join('-')))], idline: getComputedStyle(document.querySelector('.account-idline')).display};
    });
    console.log('account', w, JSON.stringify(acc));
    report[`account-${w}-checks`] = acc;
    assert.equal(acc.tabs.length, 4); assert.equal(acc.primaryButtons, 0); assert(!acc.seeOffersText); assert(!acc.statuses.includes('ღიაა'));
    if (w === 390) {assert(acc.firstRowBottom && acc.firstRowBottom <= 844, 'first row not on the first screen'); await capture(p, 'account-390-fold', false);}
    await capture(p, `account-${w}`);
  }

  // Request form: 1440 + 390, then errors, then a real publish.
  for (const [w,h] of [[1440,1000],[390,844]]) {
    await p.setViewportSize({width:w,height:h});
    await go(p, '/requests/new/');
    await p.locator('#new-request[open] #title').waitFor({timeout:30000});
    await p.waitForTimeout(300);
    const form = await p.evaluate(() => {
      const d = document.querySelector('#new-request');
      const labels = [...d.querySelectorAll('.ma-field__label')].map(l => l.textContent);
      return {guestFlash: window.__guestFlash, city: d.querySelector('#city').value, height: Math.round(d.getBoundingClientRect().height), optionalInLabels: labels.filter(l => l.includes('არასავალდებულო')).length,
        groups: [...d.querySelectorAll('.request-form__group-title')].map(e => e.textContent), dateLang: d.querySelector('#neededBy').lang, note: d.querySelector('.request-form__note')?.textContent, overflowX: d.scrollWidth - d.clientWidth};
    });
    console.log('request form', w, JSON.stringify(form));
    report[`request-new-${w}-checks`] = form;
    assert(!form.guestFlash, 'guest note flashed for a signed-in author'); assert.equal(form.city, profileCity); assert.equal(form.optionalInLabels, 0);
    await capture(p, `request-new-${w}`, false);
  }
  await p.setViewportSize({width:1440,height:1000});
  await go(p, '/requests/new/');
  await p.locator('#new-request[open] #title').waitFor({timeout:30000});
  await p.locator('#new-request button[type="submit"]').click();
  const formErr = await p.evaluate(() => ({focus: document.activeElement?.id, errors: [...document.querySelectorAll('#new-request .ma-field__error[id]')].map(e => e.textContent)}));
  console.log('request form errors', JSON.stringify(formErr));
  report['request-new-errors-checks'] = formErr;
  assert.equal(formErr.focus, 'title'); assert.equal(formErr.errors.length, 3);
  await capture(p, 'request-new-errors-1440', false);

  const title = 'სამზარეულოს ტექნიკის სერვისი — 2 მაცივრის შეკეთება';
  await p.locator('#title').fill(title);
  await p.locator('#category').selectOption({index:1});
  await p.locator('#body').fill('სასტუმროს სამზარეულოში ორი სამრეწველო მაცივარი არ აციებს. საჭიროა დიაგნოსტიკა და შეკეთება ადგილზე, ამ კვირაში.');
  await p.locator('#new-request button[type="submit"]').click();
  await p.locator('#new-request[open]').waitFor({state:'detached', timeout:60000}).catch(()=>p.waitForFunction(()=>!document.querySelector('#new-request')?.open,null,{timeout:60000}));
  await go(p, '/account/');
  const href = await p.locator('.account-row__link', {hasText:title}).first().getAttribute('href');
  assert(href, 'published request not in the account list');
  report['publish'] = {listed: true};
  await go(p, href);
  p.once('dialog', d => d.accept());
  await p.locator('button', {hasText:'წაშლა'}).click();
  await p.waitForURL(/\/account\/$/, {timeout:60000});
  await loaded(p);
  report['publish'].deleted = !(await p.locator('.account-row__link', {hasText:title}).count());
  console.log('publish + delete', JSON.stringify(report['publish']));
  assert(report['publish'].deleted);
  await ctx.close();

  // ---- demo company: first tab = offers
  const company = await browser.newContext({viewport:{width:1440,height:1000}});
  const cp = await newPage(company);
  await login(cp, 'supply');
  await go(cp, '/account/');
  report['account-company-checks'] = await cp.evaluate(() => ({tabs: [...document.querySelectorAll('.ma-tab')].map(t => t.textContent), sections: [...document.querySelectorAll('.account-main .account-section__title')].map(t => t.textContent)}));
  console.log('company', JSON.stringify(report['account-company-checks']));
  await capture(cp, 'account-company-1440');
  await company.close();

  fs.writeFileSync(path.join(out,'account-fix-qa.json'), JSON.stringify({report, pageerrors: errors.map(safe)}, null, 1));
  assert.equal(errors.length, 0, 'pageerror: '+errors.map(safe).join(' | '));
  console.log('PASS');
} catch (err) {
  console.error('pageerrors:', errors.map(safe));
  throw new Error(safe(err.stack || err.message));
} finally {
  await browser.close();
}
