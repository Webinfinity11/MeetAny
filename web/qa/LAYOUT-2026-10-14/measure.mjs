// Layout / density inventory (P8). Local fixture only: loopback BASE + AUTH, never submits anything.
//   BASE=http://127.0.0.1:3440 AUTH=http://127.0.0.1:4440 ROLE=guest|client|company \
//   PAGES='regex over slug or path' OUT=qa/LAYOUT-2026-10-14/before WIDTHS=1440,390 node qa/LAYOUT-2026-10-14/measure.mjs
// Writes OUT/measure-<role>.json and OUT/<role>-<slug>-<width>.png (full page).
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3440';
const AUTH = process.env.AUTH || 'http://127.0.0.1:4440';
if (![BASE, AUTH].every(url => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))) throw new Error('Only loopback fixtures are supported');
const ROLE = process.env.ROLE || 'guest';
const OUT = process.env.OUT || 'qa/LAYOUT-2026-10-14/before';
const WIDTHS = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const PAGES = process.env.PAGES ? new RegExp(process.env.PAGES) : null;
const DEPTH = Number(process.env.DEPTH || 4);
const NO_SHOTS = process.env.NO_SHOTS === '1';
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e' };
const REQUEST = process.env.REQUEST_ID || '0101aaac-f4e6-4ed4-b1bd-5a52e0942db9';
const OWN_REQUEST = process.env.OWN_REQUEST_ID || '012ca27c-5913-46e2-899f-254785bd3d23';
const OPEN_REQUEST = process.env.OPEN_REQUEST_ID || '77e2a061-95ed-4fdb-8f66-af0d9f994930';
const COMPANY = process.env.COMPANY_ID || ids.company;
const DEAL = process.env.DEAL_ID || '8e6766e1-b67e-408a-a8c0-e9e6944e115b';
if (!ids[ROLE] && ROLE !== 'guest') throw new Error('ROLE must be guest|client|company');

// Step 1 → 2 → 3 of /requests/new/: fill required fields, go forward, never publish.
async function fillStep1(page) {
  await page.locator('#title').fill('ხის მაგიდების შესყიდვა — განლაგების ინვენტარი');
  await page.locator('#body').fill('სასტუმროსთვის სჭირდება 20 ხის მაგიდა, ზომა 120×80, მიწოდებით თბილისში.');
  await page.locator('#quantity').fill('20');
  await page.locator('#category').click();
  await page.getByRole('option', { name: 'ავეჯი', exact: true }).click();
}
async function nextStep(page) {
  await page.locator('button.post-actions__next[type=submit]').click();
  await page.waitForTimeout(400);
}
async function newRequest2(page) {
  await fillStep1(page); await nextStep(page);
  await page.locator('input[type=date]').first().waitFor({ timeout: 10000 });
}
async function newRequest3(page) {
  await newRequest2(page);
  const d = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await page.locator('input[type=date]').first().fill(d);
  await nextStep(page);
  await page.getByText('მოთხოვნის დეტალები').first().waitFor({ timeout: 10000 });
}

const acc = tab => `/account/?tab=${tab}`;
const prof = section => `/account/?tab=profile&section=${section}`;
const routes = {
  guest: [
    ['home', '/'], ['requests', '/requests/'], ['companies', '/companies/'],
    ['request-view', `/requests/view/?id=${REQUEST}`], ['company-view', `/companies/view/?id=${COMPANY}`],
    ['how-it-works', '/how-it-works/'], ['terms', '/terms/'], ['account-login', '/account/'], ['account-register', '/account/?tab=register'],
  ],
  client: [
    ...['overview', 'requests', 'deals', 'saved', 'messages', 'notifications', 'profile'].map(t => [`account-${t}`, acc(t)]),
    ['requests-new-1', '/requests/new/?step=1'], ['requests-new-2', '/requests/new/?step=1', newRequest2], ['requests-new-3', '/requests/new/?step=1', newRequest3],
    ['deal-view', `/deals/view/?id=${DEAL}`], ['request-view-own', `/requests/view/?id=${OWN_REQUEST}`],
  ],
  company: [
    ...['overview', 'opportunities', 'offers', 'deals'].map(t => [`account-${t}`, acc(t)]),
    ...['details', 'legal', 'documents', 'products', 'distribution', 'security'].map(s => [`account-profile-${s}`, prof(s)]),
    ['matching', '/matching/'], ['offers-new', `/offers/new/?requestId=${OPEN_REQUEST}`], ['onboarding', '/onboarding/'],
  ],
}[ROLE];

fs.mkdirSync(OUT, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});

async function settle(page) {
  await page.waitForFunction(() => Boolean(document.querySelector('main')?.innerText.trim()), null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"], main [class*="skeleton" i], main [class*="Skeleton"]'), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  // lazy images / reveal-on-scroll: walk the page once, come back, then wait for a stable height
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
    scrollTo(0, 0);
  });
  let last = -1, same = 0;
  for (let i = 0; i < 20 && same < 3; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    same = h === last ? same + 1 : 0; last = h;
    await page.waitForTimeout(150);
  }
}

// Runs in the page. Returns plain JSON.
function measureInPage({ depthMax }) {
  const vw = innerWidth, vh = innerHeight, sy = scrollY;
  const doc = document.documentElement;
  const main = document.querySelector('main');
  const out = { vw, vh, scrollHeight: doc.scrollHeight, scrollWidth: doc.scrollWidth };
  out.viewports = +(out.scrollHeight / vh).toFixed(2);
  out.hOverflow = Math.max(0, doc.scrollWidth - vw);
  if (!main) return { ...out, error: 'no <main>' };
  const mcs = getComputedStyle(main), mr = main.getBoundingClientRect();
  out.main = { paddingTop: parseFloat(mcs.paddingTop), paddingBottom: parseFloat(mcs.paddingBottom), paddingLeft: parseFloat(mcs.paddingLeft), top: Math.round(mr.top + sy), height: Math.round(mr.height) };
  const hdr = document.querySelector('header'); out.headerHeight = hdr ? Math.round(hdr.getBoundingClientRect().height) : 0;
  const ftr = document.querySelector('body > footer, footer'); out.footerHeight = ftr ? Math.round(ftr.getBoundingClientRect().height) : 0;

  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'contents' || +cs.opacity === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let p = el; p && p !== main; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return null;
    return r;
  };
  const sel = el => {
    const cls = [...el.classList].slice(0, 2).map(c => c.length > 38 ? c.slice(0, 38) : c).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (el.id ? '#' + el.id : '');
  };
  // padding that main itself does not carry usually lives on the first wrapper that does (page container)
  for (let el = main, i = 0; i < 4 && el; i++) {
    const c = [...el.children].find(k => visible(k) && k.getBoundingClientRect().height > 100);
    if (!c) break;
    const cs = getComputedStyle(c), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    if (pt || pb) { out.pageWrap = { sel: sel(c), paddingTop: pt, paddingBottom: pb }; break; }
    el = c;
  }
  const abs = r => ({ top: r.top + sy, bottom: r.bottom + sy, left: r.left, right: r.right, width: r.width, height: r.height });

  // ---- block candidates (depth <= depthMax below main)
  const blocks = [];
  const walk = (el, depth) => {
    for (const child of el.children) {
      const r = visible(child);
      if (!r) continue;
      const d = depth + 1;
      if (r.height >= 8 && r.width >= 40 && !['SCRIPT', 'STYLE', 'BR', 'SPAN', 'A', 'BUTTON', 'LABEL', 'SVG', 'IMG', 'P', 'LI', 'SMALL', 'STRONG'].includes(child.tagName.toUpperCase())) blocks.push({ el: child, depth: d, ...abs(r) });
      if (d < depthMax) walk(child, d);
    }
  };
  walk(main, 0);

  // ---- vertical gaps between sibling-ish blocks
  const gaps = new Map();
  for (const b of blocks) {
    let best = null;
    for (const a of blocks) {
      if (a === b || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.bottom > b.top + 1) continue;
      const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlap < 0.5 * Math.min(a.width, b.width)) continue;
      if (!best || a.bottom > best.bottom) best = a;
    }
    if (!best) continue;
    const gap = Math.round(b.top - best.bottom);
    if (gap < 8) continue;
    const key = Math.round(b.top);
    if (!gaps.has(key) || gaps.get(key).depth > b.depth) gaps.set(key, { gap, y: Math.round(best.bottom), above: sel(best.el), below: sel(b.el), depth: b.depth });
  }
  const lastBottom = blocks.reduce((m, b) => Math.max(m, b.bottom), 0);
  const tail = Math.round(mr.bottom + sy - lastBottom);
  if (tail >= 8) gaps.set('end', { gap: tail, y: Math.round(lastBottom), above: blocks.length ? sel(blocks.reduce((m, b) => (b.bottom > m.bottom ? b : m)).el) : 'main', below: 'main-end', depth: 0 });
  const lead = blocks.length ? Math.round(Math.min(...blocks.map(b => b.top)) - (mr.top + sy)) : 0;
  if (lead >= 8) gaps.set('start', { gap: lead, y: Math.round(mr.top + sy), above: 'main-start', below: sel(blocks.reduce((m, b) => (b.top < m.top ? b : m)).el), depth: 0 });
  out.topGaps = [...gaps.values()].sort((x, y) => y.gap - x.gap).slice(0, 5);

  // ---- content leaves (text ranges, media, controls) for horizontal extent and truly-empty vertical px
  const leaves = [];
  const media = 'img,svg,video,canvas,iframe,input,select,textarea,button,picture';
  const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width >= 1 && r.height >= 1) leaves.push({ ...abs(r), el: n.parentElement });
  }
  for (const el of main.querySelectorAll(media)) { const r = visible(el); if (r) leaves.push({ ...abs(r), el }); }
  const inside = leaves.filter(l => l.left < vw && l.right > 0);
  if (inside.length) {
    const right = Math.min(vw, Math.max(...inside.map(l => l.right))), left = Math.max(0, Math.min(...inside.map(l => l.left)));
    out.content = { left: Math.round(left), right: Math.round(right), width: Math.round(right - left), rightMargin: Math.round(vw - right), leftMargin: Math.round(left) };
  }
  // widest element (depth <= depthMax), usually the page container; full-bleed backgrounds reported separately
  let widest = null, bleed = null;
  for (const b of blocks) {
    if (b.width >= vw - 1) { if (!bleed || b.height > bleed.height) bleed = b; continue; }
    if (!widest || b.width > widest.width) widest = b;
  }
  if (widest) out.widest = { sel: sel(widest.el), width: Math.round(widest.width), left: Math.round(widest.left), right: Math.round(widest.right), rightMargin: Math.round(vw - widest.right) };
  if (bleed) out.fullBleed = { sel: sel(bleed.el), height: Math.round(bleed.height) };

  // ---- form column
  const forms = [...main.querySelectorAll('form, .ma-form')].map(el => ({ el, r: visible(el) })).filter(f => f.r && f.el.querySelectorAll('input,select,textarea,button[role=combobox]').length >= 2);
  if (forms.length) { const f = forms.sort((a, b) => b.r.height - a.r.height)[0]; out.form = { sel: sel(f.el), width: Math.round(f.r.width), left: Math.round(f.r.left), height: Math.round(f.r.height) }; }
  const fields = [...main.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')].map(visible).filter(Boolean);
  if (fields.length) out.fieldMaxWidth = Math.round(Math.max(...fields.map(r => r.width)));
  // side column next to the form (aside / sticky) at >=1024
  const asides = [...main.querySelectorAll('aside')].map(el => ({ el, r: visible(el) })).filter(a => a.r);
  if (asides.length) out.asides = asides.slice(0, 3).map(a => ({ sel: sel(a.el), width: Math.round(a.r.width), left: Math.round(a.r.left), sticky: getComputedStyle(a.el).position === 'sticky' }));

  // ---- truly empty vertical px: main band not covered by any text/media/control rect
  const y0 = mr.top + sy, y1 = mr.bottom + sy;
  const iv = leaves.map(l => [Math.max(y0, l.top), Math.min(y1, l.bottom), l]).filter(i => i[1] > i[0]).sort((a, b) => a[0] - b[0]);
  const bands = []; let cur = y0, prev = null;
  for (const [s, e, l] of iv) {
    if (s - cur >= 1) bands.push({ px: Math.round(s - cur), y: Math.round(cur), above: prev ? sel(prev) : 'main-start', below: sel(l.el) });
    if (e > cur) { cur = e; prev = l.el; }
  }
  if (y1 - cur >= 1) bands.push({ px: Math.round(y1 - cur), y: Math.round(cur), above: prev ? sel(prev) : 'main-start', below: 'main-end' });
  const emptyPx = bands.reduce((s, b) => s + b.px, 0);
  out.empty = { px: emptyPx, pctOfScroll: +(100 * emptyPx / out.scrollHeight).toFixed(1), pctOfMain: +(100 * emptyPx / (y1 - y0)).toFixed(1), top5: bands.sort((a, b) => b.px - a.px).slice(0, 5) };

  // ---- list rows (catalog / home): heights of repeated row-like elements
  const rowSel = '[class*="request-row" i],[class*="RequestRow"],[class*="company-row" i],[class*="listing-card" i],[class*="CompanyListing"],[data-row],.ma-row,.ma-card,article';
  const rows = [...main.querySelectorAll(rowSel)].map(el => ({ el, r: visible(el) })).filter(x => x.r && x.r.height >= 40 && x.r.width >= vw * 0.5);
  const top = rows.filter(x => !rows.some(o => o !== x && o.el.contains(x.el)));
  if (top.length) {
    out.rows = { count: top.length, sel: sel(top[0].el), heights: top.slice(0, 8).map(x => Math.round(x.r.height)), fitInFirstScreen: top.filter(x => x.r.bottom + sy <= vh).length, firstTop: Math.round(top[0].r.top + sy) };
  }
  // ---- first screen: what the first 844 / 1000 px contain
  out.h1 = (() => { const h = main.querySelector('h1'); const r = h && visible(h); return r ? { text: h.textContent.trim().slice(0, 50), top: Math.round(r.top + sy), bottom: Math.round(r.bottom + sy) } : null; })();
  return out;
}

const result = { at: new Date().toISOString(), base: BASE, role: ROLE, depth: DEPTH, pages: [], errors: [] };
const jwt = ROLE === 'guest' ? null : (await (await fetch(`${AUTH}/__mint?sub=${ids[ROLE]}`)).json()).token;
const list = routes.filter(([slug, path]) => !PAGES || PAGES.test(slug) || PAGES.test(path));
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route(`${AUTH}/**`, route => {
    const url = route.request().url();
    if (url.includes('/.well-known/')) return route.continue();
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? { 'set-auth-jwt': jwt } : {}) }, json: url.includes('/get-session') ? (jwt ? { user: { id: ids[ROLE], email: 'qa@local.test', name: 'QA' } } : null) : { token: jwt } });
  });
  await context.route(/https:\/\/.*\/auth\//, route => route.abort());
  await context.addInitScript(({ signedIn }) => { if (signedIn) localStorage.setItem('meetany.session', '1'); }, { signedIn: !!jwt });
  const page = await context.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const [slug, path, prep] of list) {
    errors = [];
    const entry = { role: ROLE, slug, path, width };
    try {
      await context.clearCookies();
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
      if (ROLE !== 'guest') await page.locator('button[aria-controls="ma-account-menu"]').waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
      await settle(page);
      if (prep) { await prep(page); await settle(page); }
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      await page.waitForTimeout(200);
      entry.finalUrl = page.url().replace(BASE, '');
      entry.redirected = !entry.finalUrl.startsWith(path.split('?')[0]) || (path.includes('?') && prep == null && entry.finalUrl !== path && !entry.finalUrl.includes(path.split('?')[1] || '#'));
      Object.assign(entry, await page.evaluate(measureInPage, { depthMax: DEPTH }));
      if (!NO_SHOTS) await page.screenshot({ path: `${OUT}/${ROLE}-${slug}-${width}.png`, fullPage: true, animations: 'disabled' });
    } catch (error) { entry.error = error.message.split('\n')[0]; result.errors.push({ slug, width, error: entry.error }); }
    entry.pageErrors = [...errors];
    result.pages.push(entry);
    console.log(`${ROLE} ${width} ${slug}: ${entry.error ? 'ERROR ' + entry.error : `${entry.scrollHeight}px (${entry.viewports} scr) empty ${entry.empty?.pctOfScroll}% overflow ${entry.hOverflow} pageerrors ${errors.length}${entry.redirected ? ' REDIRECT→' + entry.finalUrl : ''}`}`);
    fs.writeFileSync(`${OUT}/measure-${ROLE}.json`, JSON.stringify(result, null, 2) + '\n');
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/measure-${ROLE}.json`, JSON.stringify(result, null, 2) + '\n');
console.log(`done: ${result.pages.length} measurements, ${result.errors.length} errors, ${result.pages.reduce((s, p) => s + p.pageErrors.length, 0)} pageerrors`);
