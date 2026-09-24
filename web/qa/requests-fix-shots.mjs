// P11 T11.9a: /requests/ + /requests/view/ after the 17 acceptance fixes (2026-09-24).
// Run: QA_ORIGIN=http://localhost:3001 node qa/requests-fix-shots.mjs  — passwords never reach stdout.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const out = path.join(root, 'qa/shots/ideal-0924');
const b = await chromium.launch({ headless: true, executablePath });
const errors = [];
async function ready(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება'), null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(async () => { await Promise.all([...document.querySelectorAll('main img')].map(i => { i.loading = 'eager'; return i.decode().catch(() => {}); })); });
  await p.waitForTimeout(700);
}
const box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)]; };
async function page(w, h, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${w}: ${e.message}`));
  return p;
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const info = {};

for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const p = await page(w, h);
  await p.goto(base + '/requests/'); await ready(p);
  await p.screenshot({ path: `${out}/requests-${w}.png`, fullPage: true });
  if (w === 390) await p.screenshot({ path: `${out}/requests-390-fold.png` });
  info[`list${w}`] = await p.evaluate(({ h }) => {
    const b = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)]; };
    const rows = [...document.querySelectorAll('main article.request-card')];
    const count = document.querySelector('.catalog-heading p'), h1 = document.querySelector('.catalog-heading h1');
    return {
      count: count && { box: b(count), font: getComputedStyle(count).fontSize, baselineDelta: Math.round((count.getBoundingClientRect().bottom) - (h1.getBoundingClientRect().bottom)) },
      fullRowsInFold: rows.filter(r => r.getBoundingClientRect().bottom <= h).length,
      selects: [...document.querySelectorAll('.request-board-choice, .catalog-sort')].map(f => ({ text: f.innerText.replace(/\n.*/s, '') + ' ' + f.querySelector('select').selectedOptions[0]?.text, box: b(f.querySelector('select')), h: getComputedStyle(f.querySelector('select')).height, border: getComputedStyle(f.querySelector('select')).borderTopWidth })),
      rows: rows.map(r => {
        const t = r.querySelector('h2'), v = r.querySelector('.request-card-visual'), s = r.querySelector('.request-card-status'), m = r.querySelector('.request-card-meta');
        return {
          cls: r.className.replace(/ma-rcard |ma-rcard--row |request-card /g, ''), row: b(r), bg: getComputedStyle(r).backgroundColor, before: getComputedStyle(r, '::before').content,
          title: b(t), photo: v && b(v), status: s && getComputedStyle(s).display !== 'none' ? b(s) : null, statusText: s?.innerText.replace(/\n/g, ' '),
          meta: m.innerText, metaLines: Math.round(m.getBoundingClientRect().height / parseFloat(getComputedStyle(m).lineHeight)), metaColor: getComputedStyle(m).color,
          tier: r.querySelector('.request-tier-badge, .request-tier-label')?.className,
        };
      }),
    };
  }, { h });
  info[`list${w}`].overflow = await overflow(p);
  const href = await p.locator('main a[href*="/requests/view"]').first().getAttribute('href');
  await p.goto(base + href); await ready(p);
  await p.screenshot({ path: `${out}/request-view-${w}.png`, fullPage: true });
  info[`view${w}`] = await p.evaluate(() => {
    const b = e => e && (r => [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)])(e.getBoundingClientRect());
    const aside = document.querySelector('.request-detail-aside'), meta = document.querySelector('.detail-meta');
    return {
      back: b(document.querySelector('.ma-back')), h1: b(document.querySelector('.request-detail h1')), meta: meta?.innerText, metaBox: b(meta),
      photo: b(document.querySelector('.detail-photo img')), main: b(document.querySelector('.request-detail-main')),
      aside: b(aside), asideSticky: getComputedStyle(aside).position, asideText: aside.innerText,
      primary: [...document.querySelectorAll('main .ma-btn--primary')].map(a => [a.innerText, a.getAttribute('href')]),
      shareInMain: !!document.querySelector('.request-detail-main .detail-share'), facebook: !!document.querySelector('a[href*="facebook"]'),
      overflowParents: (() => { const o = []; for (let e = aside.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflow !== 'visible' && e !== document.documentElement && e !== document.body) o.push(e.className + ':' + s.overflow); } return o; })(),
    };
  });
  info[`view${w}`].overflow = await overflow(p);
  if (w === 1440) {
    await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(200);
    info.view1440.asideTopAfterScroll = await p.evaluate(() => Math.round(document.querySelector('.request-detail-aside').getBoundingClientRect().top));
    // Guest primary → sign-in with ?next → company login returns to this request.
    const viewUrl = p.url();
    await p.locator('main .ma-btn--primary', { hasText: 'შეთავაზების გაგზავნა' }).click();
    await p.waitForURL(/\/account\/\?next=/); info.nextUrl = new URL(p.url()).search;
    await p.locator('#login-email').fill('demo-supply@meetany.ge'); await p.locator('#login-password').fill(ledger.accounts.supply.password);
    await p.locator('form button[type=submit]').click();
    await p.waitForURL(u => u.pathname.startsWith('/requests/view'), { timeout: 30000 }); await ready(p);
    info.returnedTo = p.url() === viewUrl ? 'same request' : p.url();
    await p.screenshot({ path: `${out}/request-view-company-1440.png`, fullPage: true });
    // Open redirect is refused: a //host "next" stays on the account page.
    await p.context().clearCookies();
  }
  await p.context().close();
}
{
  const p = await page(1440, 1000);
  await p.goto(base + '/account/?next=' + encodeURIComponent('//example.com/x')); await ready(p);
  await p.locator('#login-email').fill('demo-supply@meetany.ge'); await p.locator('#login-password').fill(ledger.accounts.supply.password);
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(4000);
  info.openRedirect = new URL(p.url()).host;
  await p.context().close();
}
{
  const p = await page(1440, 1000);
  await p.goto(base + '/requests/'); await ready(p);
  await p.locator('#query').fill('ქსქსქს'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/requests-empty-1440.png`, fullPage: true });
  info.empty = await p.evaluate(() => ({ panelHidden: document.querySelector('.search-suggestions').hidden, text: document.querySelector('main section').innerText, section: (e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })(document.querySelector('main section')), docH: document.documentElement.scrollHeight }));
  // Long category value: text must not reach the chevron.
  await p.locator('#request-category-desktop').selectOption('construction').catch(() => p.locator('#request-category-desktop').selectOption({ index: 2 }));
  await p.waitForTimeout(600);
  info.longSelect = await p.evaluate(() => { const s = document.querySelector('#request-category-desktop'); const r = s.getBoundingClientRect(); return { text: s.selectedOptions[0].text, w: Math.round(r.width), scrollW: s.scrollWidth, pr: getComputedStyle(s).paddingRight }; });
  await p.context().close();
}
info.pageerrors = errors;
fs.writeFileSync(`${out}/requests-fix-qa.json`, JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
await b.close();
