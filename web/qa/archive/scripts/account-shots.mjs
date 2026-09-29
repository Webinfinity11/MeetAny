// P11 T11.5b screenshots: account (client, company), sign-in, request form.
// Run: QA_ORIGIN=http://localhost:3001 node qa/account-shots.mjs
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
const widths = [[1440,1000],[390,844]];
const errors = [];
const report = {};
const browser = await chromium.launch({headless:true, executablePath});

async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'),null,{timeout:60000});
  assert(!await p.locator('main').innerText().then(t=>t.includes('სერვისი დროებით მიუწვდომელია')), 'API unavailable');
  await p.evaluate(() => document.fonts.ready);
}
async function go(p, route) {await p.goto(base+route, {waitUntil:'networkidle'}); await loaded(p);}
async function measure(p) {
  return p.evaluate(() => {
    const x = s => {const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null;};
    const cards = [...document.querySelectorAll('main .ma-panel, main .ma-card')].filter(e => getComputedStyle(e).borderTopWidth !== '0px').length;
    return {overflow: document.documentElement.scrollWidth - innerWidth, h1: x('main h1'), tab: x('main .ma-tabs .ma-tab'), avatars: document.querySelectorAll('main .ma-avatar').length, borderedCards: cards};
  });
}
async function capture(p, name, fullPage=true) {
  const m = await measure(p);
  assert(m.overflow <= 0, `${name}: horizontal overflow ${m.overflow}`);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(400);
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage});
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
  const guest = await browser.newContext();
  const page = await newPage(guest);
  for (const [w,h] of widths) {
    await page.setViewportSize({width:w,height:h});
    await page.goto(base+'/account/', {waitUntil:'networkidle'});
    await page.locator('#login-email').waitFor({timeout:30000});
    await page.evaluate(() => document.fonts.ready);
    await capture(page, `login-${w}`);
  }
  await guest.close();

  const ctx = await browser.newContext();
  const p = await newPage(ctx);
  await login(p, 'hotel');
  for (const [w,h] of widths) {
    await p.setViewportSize({width:w,height:h});
    await go(p, '/account/');
    await capture(p, `account-${w}`);
    await go(p, '/requests/new/');
    await p.locator('#new-request[open]').waitFor({timeout:30000});
    await p.waitForTimeout(300);
    const dialog = await p.evaluate(() => {
      const d = document.querySelector('#new-request');
      const hs = [...d.querySelectorAll('.ma-input,.ma-select,.request-form__qty')].filter(e => !e.closest('.request-form__qty') || e.classList.contains('request-form__qty')).map(e => Math.round(e.getBoundingClientRect().height));
      return {controlHeights: [...new Set(hs)], overflowX: d.scrollWidth - d.clientWidth};
    });
    console.log('request form', w, JSON.stringify(dialog));
    report[`request-new-${w}-controls`] = dialog;
    await capture(p, `request-new-${w}`, false);
  }
  // Owner view of a request with offers: the offers heading.
  await p.setViewportSize({width:1440,height:1000});
  await go(p, '/account/');
  const withOffers = await p.evaluate(() => [...document.querySelectorAll('.account-row')].find(r => !/^0 /.test(r.querySelector('.account-row__count strong')?.textContent || '0 '))?.querySelector('.account-row__title a')?.getAttribute('href'));
  if (withOffers) {
    await go(p, withOffers);
    await p.locator('.request-offers__title').waitFor({timeout:30000});
    await p.locator('.request-offers__title').scrollIntoViewIfNeeded();
    await p.screenshot({path:path.join(out,'request-owner-offers-1440.png')});
    console.log('owner offers heading:', await p.locator('.request-offers__title').innerText());
  }
  await ctx.close();

  const company = await browser.newContext({viewport:{width:1440,height:1000}});
  const cp = await newPage(company);
  await login(cp, 'supply');
  await go(cp, '/account/');
  await capture(cp, 'account-company-1440');
  await go(cp, '/account/?tab=saved');
  await capture(cp, 'account-company-saved-1440');
  await company.close();

  fs.writeFileSync(path.join(out,'account-qa.json'), JSON.stringify({report, pageerrors: errors.map(safe)}, null, 1));
  assert.equal(errors.length, 0, 'pageerror: '+errors.map(safe).join(' | '));
  console.log('PASS');
} catch (err) {
  console.error('pageerrors:', errors.map(safe));
  throw new Error(safe(err.message));
} finally {
  await browser.close();
}
