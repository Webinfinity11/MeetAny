// P11 T11.5c screenshots: account inbox (client + company) and six avatar tones on /companies/.
// Run: QA_ORIGIN=http://localhost:3001 node qa/inbox-shots.mjs
// Sends at most one business message (company → client, in the request conversation); skipped if already there.
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
const REPLY = 'ბათუმში მონტაჟს ჩვენი ბრიგადა აკეთებს. ქსოვილის ნიმუშების ფოტოებს ხვალ აქვე გამოგიგზავნით.';
const errors = [];
const report = {};
const browser = await chromium.launch({headless:true, executablePath});

async function settle(p) {
  console.log('settle', p.url().replace(base, ''));
  await p.waitForFunction(() => !document.querySelector('main [role="status"]') && !document.querySelector('main [aria-busy="true"]'), null, {timeout:60000});
  await p.evaluate(() => document.fonts.ready);
}
async function inbox(p, query='') {
  await p.goto(base+'/account/?tab=messages'+query, {waitUntil:'networkidle'});
  await p.locator('.inbox-row, .inbox-note').first().waitFor({timeout:60000});
  await settle(p);
}
async function measure(p) {
  return p.evaluate(() => {
    const x = s => {const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null;};
    const shown = s => {const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;};
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      h1: x('main h1'), tab: x('main .ma-tabs .ma-tab'), rowAvatar: x('.inbox-row .ma-avatar'),
      list: shown('.inbox-list'), thread: shown('.inbox-thread'),
      dots: document.querySelectorAll('.inbox-dot').length,
      tel: document.querySelector('.inbox-call')?.getAttribute('href') || null,
      tabLabel: document.querySelector('.ma-tab[aria-current="page"]')?.textContent || null,
      tones: [...new Set([...document.querySelectorAll('main .ma-avatar[data-tone]')].map(e => e.dataset.tone))].sort(),
    };
  });
}
async function capture(p, name, fullPage=true) {
  const m = await measure(p);
  assert(m.overflow <= 0, `${name}: horizontal overflow ${m.overflow}`);
  await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,`${name}.png`), fullPage});
  report[name] = m;
  console.log('shot', name, JSON.stringify(m));
  return m;
}
async function session(key, viewport) {
  const ctx = await browser.newContext({viewport});
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base+'/account/', {waitUntil:'networkidle'});
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(()=>!document.querySelector('#login-email'),null,{timeout:60000});
  return {ctx, p};
}
const convIds = p => p.evaluate(() => [...document.querySelectorAll('.inbox-list li')].map(li => ({id: li.dataset.id, context: li.dataset.context, text: li.innerText})));

try {
  // Company side: the reply goes into the request conversation through the inbox composer.
  const wood = await session('wood', {width:1440, height:1000});
  await inbox(wood.p);
  const woodRows = await convIds(wood.p);
  const request = woodRows.find(r => r.context === 'request');
  const general = woodRows.find(r => r.context === 'general');
  assert(request && general, 'wood needs the request and the general conversation with hotel');
  await inbox(wood.p, `&c=${request.id}`);
  await wood.p.locator('.inbox-log .inbox-msg, .inbox-log__note').first().waitFor({timeout:30000});
  if (!await wood.p.locator('.inbox-msg[data-mine]', {hasText: REPLY}).count()) {
    await wood.p.locator('#inbox-body').fill(REPLY);
    await wood.p.locator('.inbox-compose button[type="submit"]').click();
    await wood.p.locator('.inbox-msg[data-mine]', {hasText: REPLY}).waitFor({timeout:30000});
    console.log('sent: company → client (request conversation)');
  } else console.log('reply already present; nothing sent');
  report.sendWorked = true;
  await wood.ctx.close();

  // Client side, desktop: open the general conversation so the request one stays unread.
  const hotel = await session('hotel', {width:1440, height:1000});
  await inbox(hotel.p, `&c=${general.id}`);
  await hotel.p.locator('.inbox-msg').first().waitFor({timeout:30000});
  const d = await capture(hotel.p, 'inbox-1440');
  assert(d.list && d.thread, 'two panes');
  assert(d.dots >= 1, 'unread dot');
  assert(d.tel?.startsWith('tel:'), 'tel in the context bar');
  assert.equal(d.h1, 120); assert.equal(d.tab, 120); assert.equal(d.rowAvatar, 120);
  assert.match(d.tabLabel || '', /მიმოწერები \(\d+\)/);
  // The popup still opens from the company profile and loads the same conversation.
  await hotel.p.goto(base+`/companies/view/?id=${encodeURIComponent(ledger.accounts.wood.id)}`, {waitUntil:'networkidle'});
  await hotel.p.getByRole('button', {name:'მიწერა'}).first().click();
  await hotel.p.locator('.ma-chat[open] .ma-chat__message').first().waitFor({timeout:30000});
  report.popupStillWorks = true;
  await hotel.ctx.close();

  // Client side, mobile: list first, then one thread full width.
  const phone = await session('hotel', {width:390, height:844});
  await inbox(phone.p);
  const l = await capture(phone.p, 'inbox-390-list');
  assert(l.list && !l.thread && l.dots >= 1, 'mobile list with unread dot');
  await phone.p.locator(`.inbox-list li[data-id="${general.id}"] .inbox-row`).click();
  await phone.p.locator('.inbox-msg').first().waitFor({timeout:30000});
  await settle(phone.p);
  await phone.p.waitForTimeout(300);
  const t = await capture(phone.p, 'inbox-390-thread', false);
  assert(!t.list && t.thread, 'mobile thread replaces the list');
  const compose = await phone.p.locator('.inbox-compose').boundingBox();
  assert(compose && compose.y + compose.height <= 844 + 1, 'composer visible at the bottom');
  await phone.ctx.close();

  // An account with no conversations.
  const cafe = await session('cafe', {width:1440, height:1000});
  await inbox(cafe.p);
  await capture(cafe.p, 'inbox-empty-1440');
  await cafe.ctx.close();

  // Six tones in the catalogue.
  const guest = await browser.newContext({viewport:{width:1440, height:1000}});
  const g = await guest.newPage();
  g.on('pageerror', e => errors.push(e.message));
  await g.goto(base+'/companies/', {waitUntil:'networkidle'});
  await g.locator('main .ma-avatar').first().waitFor({timeout:60000});
  await g.evaluate(() => document.fonts.ready);
  const c = await capture(g, 'companies-1440-avatars');
  console.log('tones on /companies/:', c.tones.join(','));
  await guest.close();

  fs.writeFileSync(path.join(out,'inbox-qa.json'), JSON.stringify({report, pageerrors: errors.map(safe)}, null, 1));
  assert.equal(errors.length, 0, 'pageerror: '+errors.map(safe).join(' | '));
  console.log('PASS');
} catch (err) {
  console.error('pageerrors:', errors.map(safe));
  throw new Error(safe(err.message));
} finally {
  await browser.close();
}
