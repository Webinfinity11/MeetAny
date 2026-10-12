// ეტაპი 3, ფართობი „გარიგება“: after-კადრები. ქმნის ერთ სატესტო მოთხოვნას (owner_user), wood-ის შეთავაზებას და
// ატარებს მის გარიგებას ყველა ეტაპზე. არსებულ გარიგებებს არ ეხება. მხოლოდ ლოკალური ბაზა (MEETANY_LOCAL_DATABASE_URL).
// გაშვება web/-დან: QA_BASE=http://localhost:3307 STEP=all node qa/PERFECTION-2026-10-12/scripts/deal-after.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../../..');
const base = process.env.QA_BASE || 'http://localhost:3307';
const out = path.join(root, 'qa/PERFECTION-2026-10-12/after/deal');
fs.mkdirSync(out, { recursive: true });
const ledger = JSON.parse(fs.readFileSync('/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const accounts = { buyer: { email: 'user@gmail.com', password: ledger.accounts.owner_user.password }, supplier: { email: 'demo-wood@meetany.ge', password: ledger.accounts.wood.password } };
const statePath = '/tmp/deal-thread/qa-state.json';
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const STEPS = (process.env.STEP || 'all').split(',');
const run = name => STEPS.includes('all') || STEPS.includes(name);
const report = { base, at: new Date().toISOString(), pages: [] };
const reportPath = path.join(out, `report-${STEPS.join('-')}.json`);

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const settle = async p => {
  await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await p.waitForFunction(() => { const m = document.querySelector('main'); return m && m.innerText.length > 20 && !m.innerText.includes('იტვირთება…'); }, null, { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
};
const audit = p => p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const over = [];
  for (const el of document.querySelectorAll('main *, dialog[open] *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).position === 'fixed') continue;
    let clipped = false;
    for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1) clipped = true; break; } }
    if (!clipped && (r.right > vw + 1 || r.left < -1)) over.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return { docOverflow: document.documentElement.scrollWidth - vw, over: over.slice(0, 8), h1: document.querySelector('main h1')?.innerText || '' };
});
async function shot(p, name, opts = {}) {
  assert.equal(await p.locator('#login-password').count(), 0, 'Never capture the password form');
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  const a = await audit(p);
  await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: !opts.viewport });
  report.pages.push({ name, url: p.url().replace(base, ''), ...a, errors: p.qaErrors.splice(0) });
}
async function context(who) {
  const file = `/tmp/deal-thread/auth-${who}.json`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: fs.existsSync(file) ? file : undefined, locale: 'ka-GE', timezoneId: 'Asia/Tbilisi' });
  const p = await ctx.newPage();
  p.qaErrors = [];
  p.on('pageerror', e => p.qaErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  p.on('console', m => { if (m.type() === 'error') p.qaErrors.push(`console: ${m.text().slice(0, 200)}`); });
  await p.goto(base + '/account/', { waitUntil: 'networkidle' });
  if (await p.locator('#login-email').count()) {
    await p.locator('#login-email').fill(accounts[who].email);
    await p.locator('#login-password').fill(accounts[who].password);
    await p.locator('form button[type="submit"]').click();
    await p.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
    await ctx.storageState({ path: file });
  }
  p.qaErrors.splice(0);
  return p;
}
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
// CustomSelect: open the listbox and click the first enabled option matching the name (or the first enabled one).
async function pick(p, selector, name) {
  await p.locator(selector).first().click();
  const options = p.locator('[role=option]:not([aria-disabled=true])');
  const target = name ? options.filter({ hasText: name }).first() : options.first();
  await (await target.count() ? target : options.first()).click();
}
async function both(p, name, url, before) {
  for (const w of widths) {
    await p.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 });
    if (url) await p.goto(base + url, { waitUntil: 'domcontentloaded' });
    await settle(p);
    if (before) await before(p, w);
    await shot(p, `${name}-${w}`);
  }
}
async function dialog(p, name, opener, w) {
  await p.getByRole('button', { name: opener }).first().click();
  const d = p.locator('dialog[open]').last();
  await d.waitFor({ state: 'visible', timeout: 8000 });
  await p.waitForTimeout(450);
  await shot(p, `${name}-${w}`, { viewport: true });
  return d;
}
const closeDialog = async p => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
const dealUrl = () => `/deals/view/?id=${state.dealId}`;

try {
  if (run('post')) {
    const p = await context('buyer');
    for (const w of widths) {
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 });
      await p.goto(base + '/requests/new/', { waitUntil: 'domcontentloaded' }); await settle(p);
      await p.evaluate(() => sessionStorage.clear());
      await p.goto(base + '/requests/new/?step=1', { waitUntil: 'domcontentloaded' }); await settle(p);
      await p.getByRole('button', { name: /შემდეგი/ }).click(); await p.waitForTimeout(300);
      await shot(p, `post-step1-errors-${w}`);
      await p.locator('#title').fill('QA გარიგება — მუხის მაგიდები');
      await pick(p, '#category', /ავეჯი|ხე/);
      await p.locator('#body').fill('სატესტო მოთხოვნა გარიგების ეტაპების შესამოწმებლად: მუხის 6 მაგიდა, მიწოდებით.');
      await p.locator('#quantity').fill('6');
      await p.waitForTimeout(3600);
      await shot(p, `post-step1-${w}`);
      await p.getByRole('button', { name: /შემდეგი/ }).click(); await settle(p);
      const d = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
      await p.locator('#neededBy').fill(d);
      await shot(p, `post-step2-${w}`);
      await p.getByRole('button', { name: /შემდეგი/ }).click(); await settle(p);
      await shot(p, `post-step3-${w}`);
      if (w === 1440 && !state.requestId) {
        // One request only: the 390 success shot is the same screen after a resize, so no second request is published.
        await p.getByRole('button', { name: /გამოქვეყნება/ }).click();
        await p.getByRole('heading', { name: 'მოთხოვნა გამოქვეყნდა' }).waitFor({ timeout: 30000 });
        await settle(p);
        await shot(p, 'post-published-1440');
        await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
        await shot(p, 'post-published-390');
        const href = await p.getByRole('link', { name: 'მოთხოვნის ნახვა' }).getAttribute('href');
        state.requestId = new URL(base + href).searchParams.get('id'); save();
      }
    }
  }
  if (run('offer')) {
    const p = await context('supplier');
    await both(p, 'offer-new', `/offers/new/?requestId=${state.requestId}`);
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.getByRole('button', { name: 'შეთავაზების გაგზავნა' }).click(); await p.waitForTimeout(400);
    await shot(p, 'offer-new-validation-1440');
    await p.getByRole('button', { name: 'ჯამური', exact: true }).click();
    await p.locator('#of-price').fill('1920');
    await pick(p, '#of-deliveryDays', /^7 /);
    await p.getByRole('button', { name: 'მიწოდებისას', exact: true }).click();
    await p.getByRole('button', { name: 'გარანტია', exact: true }).click();
    await p.locator('#of-body').fill('მუხის მასივი, ლაქით დამუშავებული. მიწოდება და აწყობა თბილისში.');
    await p.getByRole('button', { name: 'შეთავაზების გაგზავნა' }).click();
    await p.locator('dialog[open]').waitFor({ timeout: 30000 }); await p.waitForTimeout(500);
    await shot(p, 'modal-offer-sent-1440', { viewport: true });
  }
  if (run('choose')) {
    const p = await context('buyer');
    await both(p, 'compare', `/requests/compare/?id=${state.requestId}`);
    for (const w of widths) { await p.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 }); await dialog(p, 'modal-select-offer', 'შეთავაზების არჩევა', w); await closeDialog(p); }
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.getByRole('button', { name: 'შეთავაზების არჩევა' }).first().click();
    await p.locator('dialog[open]').getByRole('button', { name: 'შეთავაზების არჩევა' }).click();
    await p.waitForURL(/\/deals\/view\//, { timeout: 30000 });
    state.dealId = new URL(p.url()).searchParams.get('id'); save();
    await both(p, 'deal-selected-buyer', dealUrl());
    await both(p, 'compare-chosen', `/requests/compare/?id=${state.requestId}`);
  }
  if (run('discuss')) {
    const p = await context('buyer');
    await p.goto(base + dealUrl(), { waitUntil: 'domcontentloaded' }); await settle(p);
    if (await p.getByRole('button', { name: 'ჩატის გახსნა' }).count()) { await p.getByRole('button', { name: 'ჩატის გახსნა' }).click(); await p.waitForTimeout(1500); }
    await both(p, 'deal-discuss-buyer', dealUrl());
    for (const w of widths) {
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 });
      await dialog(p, 'modal-new-terms', 'ახალი პირობები', w); await closeDialog(p);
      await dialog(p, 'modal-agree', 'პირობები შეთანხმებულია', w); await closeDialog(p);
      await dialog(p, 'modal-cancel-deal', 'გარიგების გაუქმება', w); await closeDialog(p);
    }
    const s = await context('supplier');
    await both(s, 'deal-discuss-supplier', dealUrl());
  }
  if (run('terms')) {
    const p = await context('buyer');
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(base + dealUrl(), { waitUntil: 'domcontentloaded' }); await settle(p);
    await p.getByRole('button', { name: 'პირობები შეთანხმებულია' }).click();
    const d = p.locator('dialog[open]');
    const confirm = d.getByRole('button', { name: /პირობების (დადასტურება|შევსება)/ });
    const label = await confirm.innerText();
    await confirm.click();
    if (/შევსება/.test(label)) {
      // Fill what the offer left open, then send it as the proposal.
      const form = p.locator('dialog[open] form');
      await form.waitFor();
      if (!(await form.locator('[name=place]').inputValue())) await form.locator('[name=place]').fill('თბილისი, ვაკე');
      await form.getByRole('button', { name: 'ცვლილების შეთავაზება' }).click();
      await p.waitForTimeout(2000);
    }
    await p.waitForFunction(() => document.querySelector('main h1')?.textContent?.includes('პირობების დადასტურება'), null, { timeout: 30000 });
    await both(p, 'deal-terms-buyer', dealUrl());
    const s = await context('supplier');
    await both(s, 'deal-terms-supplier', dealUrl());
    await dialog(s, 'modal-terms-change', 'ცვლილების შეთავაზება', 390); await closeDialog(s);
  }
  if (run('progress')) {
    const s = await context('supplier');
    await s.setViewportSize({ width: 1440, height: 1000 });
    await s.goto(base + dealUrl(), { waitUntil: 'domcontentloaded' }); await settle(s);
    if (await s.getByRole('button', { name: 'პირობების დადასტურება' }).count()) { await s.getByRole('button', { name: 'პირობების დადასტურება' }).click(); await s.waitForTimeout(2000); }
    await s.getByRole('button', { name: 'შესრულების დაწყება' }).click();
    await s.waitForFunction(() => document.querySelector('main h1')?.textContent?.includes('შესრულება'), null, { timeout: 30000 });
    await settle(s);
    for (const [status, text] of [['started', 'მასალა შეძენილია, წარმოება დაიწყო.'], ['producing', 'ოთხი მაგიდა მზადაა, ორი ლაქდება.']]) {
      const select = s.locator('select[id$="-status"]');
      await pick(s, 'select[id$="-status"], [id$="-status"]', { started: /წარმოება დაიწყო/, producing: /მზადდება/ }[status]);
      await s.locator('textarea[id$="-body"]').fill(text);
      await s.getByRole('button', { name: 'განახლების დამატება' }).click();
      await s.waitForTimeout(2000);
    }
    await both(s, 'deal-progress-supplier', dealUrl());
    const p = await context('buyer');
    await both(p, 'deal-progress-buyer', dealUrl());
    await dialog(p, 'modal-issue', 'პრობლემის შეტყობინება', 390); await closeDialog(p);
    await dialog(p, 'modal-complete', 'მიღებულია, დასრულება', 390); await closeDialog(p);
  }
  if (run('complete')) {
    const p = await context('buyer');
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(base + dealUrl(), { waitUntil: 'domcontentloaded' }); await settle(p);
    await p.getByRole('button', { name: 'მიღებულია, დასრულება' }).click();
    await p.locator('dialog[open]').getByRole('button', { name: 'დასრულების დადასტურება' }).click();
    await p.waitForFunction(() => document.querySelector('main h1')?.textContent?.includes('დასრულებული'), null, { timeout: 30000 });
    await both(p, 'deal-complete-buyer', dealUrl());
    for (const w of widths) { await p.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 }); await dialog(p, 'modal-review', 'თანამშრომლობის შეფასება', w); await closeDialog(p); }
    const s = await context('supplier');
    await both(s, 'deal-complete-supplier', dealUrl());
  }
  if (STEPS.includes('reshoot')) {
    // Re-capture the finished deal after a fix, without moving it.
    const p = await context('buyer');
    await both(p, 'deal-complete-buyer', dealUrl());
    const s = await context('supplier');
    await both(s, 'deal-complete-supplier', dealUrl());
  }
  if (run('existing')) {
    // Read only: a deal owner_user does not take part in shows the access state.
    const p = await context('buyer');
    await both(p, 'deal-denied', '/deals/view/?id=63d76320-70a5-4cf2-bd5a-dc4aa424a3bc');
  }
} finally {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  await browser.close();
  const bad = report.pages.filter(x => x.docOverflow > 0 || x.over.length || x.errors.length);
  console.log(`pages ${report.pages.length}, with issues ${bad.length}`);
  for (const b of bad) console.log(b.name, b.docOverflow, b.over.slice(0, 3).join(' | '), b.errors.slice(0, 3).join(' | '));
}
