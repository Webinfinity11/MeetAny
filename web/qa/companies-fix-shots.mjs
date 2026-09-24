// P11 T11.9b: /companies/ + /companies/view/ after the 13 acceptance fixes (2026-09-24). Guest only.
// Run: QA_ORIGIN=http://localhost:3001 node qa/companies-fix-shots.mjs — phone numbers are masked in the DOM
// before every screenshot and never reach stdout or the JSON.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(root, 'qa/shots/ideal-0924');
const b = await chromium.launch({ headless: true, executablePath });
const errors = [];
async function ready(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება'), null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
}
const mask = p => p.evaluate(() => document.querySelectorAll('.ma-call__number').forEach(n => { n.textContent = n.textContent.replace(/\d/g, '•'); }));
const shot = async (p, name, full = true) => { await mask(p); await p.screenshot({ path: `${out}/${name}.png`, fullPage: full }); };
async function page(w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${w}: ${e.message}`));
  return p;
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const listInfo = p => p.evaluate(() => {
  const b = e => e && (r => [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)])(e.getBoundingClientRect());
  const rows = [...document.querySelectorAll('main article.supplier-row')];
  const rail = document.querySelector('.filter-rail'), list = document.querySelector('.company-directory-list');
  return {
    header: b(document.querySelector('.catalog-header .ma-input')), bar: b(document.querySelector('.r2-results-bar')), list: b(list), rail: rail && getComputedStyle(rail).display !== 'none' ? b(rail) : null,
    facets: [...document.querySelectorAll('.filter-rail .ma-proto-filter')].map(f => `${f.innerText.replace(/\n/g, ' ')}|${Math.round(f.getBoundingClientRect().height)}|${getComputedStyle(f).fontSize}`),
    groupTitle: !!document.querySelector('.filter-rail .facet-group-title'), railReset: !!document.querySelector('.filter-rail .filter-reset'),
    rows: rows.map(r => {
      const q = s => r.querySelector(s), m = q('.listing-location'), pr = q('.listing-products');
      const call = q('.ma-call'), dir = q('.listing-directions'), save = q('.listing-utilities button');
      return {
        name: q('h3').innerText, avatar: q('.ma-avatar').innerText, avatarFF: getComputedStyle(q('.ma-avatar')).fontFeatureSettings,
        row: b(r), h: Math.round(r.getBoundingClientRect().height),
        metaLines: Math.round(m.getBoundingClientRect().height / parseFloat(getComputedStyle(m).lineHeight)), meta: m.innerText,
        productLines: pr ? Math.round(pr.getBoundingClientRect().height / parseFloat(getComputedStyle(pr).lineHeight)) : 0,
        call: b(call), dir: b(dir), dirText: dir?.innerText, save: b(save), metaHasDirections: !!m.querySelector('a'),
      };
    }),
  };
});

// Warm the dev compiler so the 500ms profile shot measures the page, not the first compile.
{ const p = await page(1440, 1000); await p.goto(base + '/companies/'); await ready(p); const href = await p.locator('main a.card-main-link').first().getAttribute('href'); await p.goto(base + href); await ready(p); await p.context().close(); }

const info = {};
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const p = await page(w, h);
  await p.goto(base + '/companies/'); await ready(p);
  await shot(p, `companies-${w}`);
  if (w === 390) await shot(p, 'companies-390-fold', false);
  info[`list${w}`] = await listInfo(p);
  info[`list${w}`].overflow = await overflow(p);
  if (w === 1440) {
    // #12: reveal the first number; the button keeps its width and the save icon keeps its x.
    const before = info.list1440.rows[0];
    await p.locator('main article.supplier-row').first().locator('.ma-call').click(); await p.waitForTimeout(300);
    await shot(p, 'companies-1440-phone-open');
    const after = (await listInfo(p)).rows[0];
    info.phoneOpen = { callBefore: before.call, callAfter: after.call, saveBefore: before.save, saveAfter: after.save, rowBefore: before.h, rowAfter: after.h, dirBefore: before.dir, dirAfter: after.dir };
    // #11: a filter chip appears without moving the list.
    const listTop = info.list1440.list[1];
    await p.goto(base + '/companies/'); await ready(p);
    await p.locator('.filter-rail .ma-proto-filter').nth(1).click(); await p.waitForTimeout(800);
    const f = await listInfo(p);
    info.filterOn = { url: new URL(p.url()).search, listTopBefore: listTop, listTopAfter: f.list[1], bar: f.bar, chips: await p.locator('.r2-results-summary').innerText(), railReset: f.railReset };
  } else {
    // #13: the filter sheet.
    await p.locator('.catalog-filter-toggle').click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/companies-sheet-390.png` });
    info.sheet390 = await p.evaluate(() => {
      const d = document.querySelector('#filters'), f = d.querySelector('.ma-sheet__footer');
      const b = e => (r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)])(e.getBoundingClientRect());
      const hs = getComputedStyle(d, '::before');
      return { footer: [...f.children].map(c => `${c.innerText}|${b(c)}|${getComputedStyle(c).color}`), handle: `${hs.display} ${hs.width}×${hs.height} ${hs.backgroundColor}`, sheet: b(d), sectionBorders: [...d.querySelectorAll('.filter-section, .ma-proto-filters>.ma-field')].map(e => getComputedStyle(e).borderTopColor), bodyReset: !!d.querySelector('.ma-sheet__body .filter-reset') };
    });
  }
  await p.context().close();
}

// #6: empty search.
{
  const p = await page(1440, 1000);
  await p.goto(base + '/companies/?q=' + encodeURIComponent('ქსქსქს')); await ready(p);
  await shot(p, 'companies-empty-1440');
  info.empty = await p.evaluate(() => ({ text: document.querySelector('.company-directory-list').innerText, resets: [...document.querySelectorAll('main button')].filter(x => /გასუფთავება/.test(x.innerText)).map(x => x.innerText), groupTitle: !!document.querySelector('.facet-group-title'), docH: document.documentElement.scrollHeight }));
  info.empty.list = await listInfo(p).then(i => ({ rail: i.rail, facets: i.facets }));
  await p.context().close();
}

// Profile: the phone button is on screen 500ms after navigation starts.
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const p = await page(w, h);
  await p.goto(base + '/companies/'); await ready(p);
  const href = await p.locator('main a.card-main-link').first().getAttribute('href');
  const t0 = Date.now();
  await p.goto(base + href, { waitUntil: 'commit' });
  await p.waitForTimeout(Math.max(0, 500 - (Date.now() - t0)));
  const at500 = await p.evaluate(() => { const c = document.querySelector('.r2-band .ma-call'); return c ? { text: c.innerText, visible: c.getBoundingClientRect().width > 0 } : null; });
  await shot(p, `company-view-${w}-500ms`, false);
  await ready(p);
  await shot(p, `company-view-${w}`);
  info[`view${w}`] = await p.evaluate(() => {
    const b = e => e && (r => [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.right), Math.round(r.bottom + scrollY)])(e.getBoundingClientRect());
    const acts = document.querySelector('.r2-band .ma-page-head__actions');
    return {
      avatar: document.querySelector('.r2-band .ma-avatar').innerText, h1: b(document.querySelector('h1')),
      actions: [...acts.children].map(c => `${c.innerText || c.getAttribute('aria-label')}|${c.className.replace(/\s+/g, ' ')}|${b(c)}|${getComputedStyle(c).backgroundColor}`),
      meta: document.querySelector('.detail-meta').innerText, main: b(document.querySelector('.company-profile-main')), aside: !!document.querySelector('.company-profile-partnership'),
      sections: [...document.querySelectorAll('.company-profile-main h2')].map(x => x.innerText), seeks: document.querySelector('.company-profile-seeks')?.innerText,
      seeksFont: (e => e && `${getComputedStyle(e).fontSize}/${getComputedStyle(e).lineHeight}`)(document.querySelector('.company-profile-seeks')),
      activity: document.querySelector('.company-profile-activity')?.innerText, activityStyle: (e => e && `${getComputedStyle(e).fontSize}/${getComputedStyle(e).lineHeight} ${getComputedStyle(e).color}`)(document.querySelector('.company-profile-activity')),
      addRequestLink: [...document.querySelectorAll('main a')].some(a => /მოთხოვნის დამატება/.test(a.innerText)),
    };
  });
  info[`view${w}`].at500ms = at500;
  info[`view${w}`].overflow = await overflow(p);
  await p.context().close();
}
info.pageerrors = errors;
fs.writeFileSync(`${out}/companies-fix-qa.json`, JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
await b.close();
