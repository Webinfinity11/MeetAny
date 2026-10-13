// Site-wide typography audit (owner's comfort rules, 2026-10-13). Read-only: it signs in and looks, never submits.
// Run from web/:  BASE=http://localhost:3001 node qa/type-audit.mjs [--only name,name] [--out file.json] [--shots dir] [--verbose]
// Every visible text element on each page at 1440 and 390: size (text ≥16 desktop / ≥15 mobile, meta ≥13, field
// label ≥14, input ≥16), line-height (text 1.55–1.7, headings 1.2–1.35, wrapped labels 1.3–1.7), AA contrast against
// the painted background, Mtavruli/uppercase outside headings and buttons, paragraph measure (≤ ~75ch), tap targets
// ≥44px; plus horizontal overflow and console errors. Accounts come from ../DEMO-ACCOUNTS.local.md
// (owner_user, owner_company, owner_admin); passwords are never printed.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const base = (process.env.BASE || arg('origin') || 'http://localhost:3001').replace(/\/+$/, '');
const out = arg('out'), shots = arg('shots'), only = arg('only')?.split(','), verbose = process.argv.includes('--verbose');
const root = path.resolve(import.meta.dirname, '..');
const ledgerPath = [process.env.DEMO_ACCOUNTS, path.join(root, '../DEMO-ACCOUNTS.local.md'), path.join(process.env.HOME, 'Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md')].find(p => p && fs.existsSync(p));
const ledger = ledgerPath ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]).accounts : {};
const roles = { user: 'owner_user', company: 'owner_company', admin: 'owner_admin' };

// Pages. `find` resolves a link from another page (first match of the selector), `then` opens a state on the page.
const ADMIN_TABS = ['overview', 'users', 'companies', 'requests', 'offers', 'deals', 'reports', 'reviews', 'photos', 'contacts', 'content', 'audit'];
const NEW_REQUEST = '/requests/new/?' + new URLSearchParams({ title: 'საოფისე სკამები 20 ცალი', category: 'furniture', city: 'tbilisi' });
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'requests', path: '/requests/' },
  { name: 'request-view', find: ['/requests/', 'main a[href*="/requests/view/"]'] },
  { name: 'companies', path: '/companies/' },
  { name: 'company-view', find: ['/companies/', 'main a[href*="/companies/view/"]'] },
  { name: 'how-it-works', path: '/how-it-works/' },
  { name: 'terms', path: '/terms/' },
  { name: 'ideas', path: '/ideas/' },
  { name: 'idea-view', find: ['/ideas/', 'main .idea-card h2 a'] },
  { name: '404', path: '/no-such-page-type-audit/' },
  { name: 'login', path: '/account/' },
  { name: 'register', path: '/account/?tab=register' },
  { name: 'requests-new-1', path: '/requests/new/' },
  { name: 'requests-new-2', path: NEW_REQUEST, then: 'requestStep2' },
  { name: 'requests-new-3', path: NEW_REQUEST, then: 'requestStep3' },
  { name: 'header-menu', path: '/', then: 'openMenu', role: 'user' },
  ...['overview', 'requests', 'offers', 'deals', 'saved', 'messages', 'notifications', 'profile'].map(t => ({ name: `user-${t}`, path: `/account/?tab=${t}`, role: 'user' })),
  ...['overview', 'opportunities', 'offers', 'deals', 'saved', 'messages', 'notifications', 'profile', 'business'].map(t => ({ name: `company-${t}`, path: `/account/?tab=${t}`, role: 'company' })),
  { name: 'matching', path: '/matching/', role: 'company' },
  { name: 'offers-new', find: ['/requests/', 'main a[href*="/requests/view/"]'], map: href => '/offers/new/?requestId=' + new URL(href, base).searchParams.get('id'), role: 'company' },
  // The owner's company has no deals; the client's deals cover the stages (one card per deal, title link + open button).
  ...[0, 1, 2].map(n => ({ name: `deal-${n + 1}`, find: ['/account/?tab=deals', 'main li h2 a[href*="/deals/view/"]', n], role: 'user' })),
  ...ADMIN_TABS.map(t => ({ name: `admin-${t}`, path: `/admin/?tab=${t}`, role: 'admin' })),
];

const settle = async page => {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && !(document.querySelector('main')?.innerText || '').includes('იტვირთება…'), null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
};

const ACTIONS = {
  // Desktop: the account menu; phone: the navigation drawer.
  async openMenu(page) { await page.locator('button[aria-controls="ma-account-menu"]:visible, button[aria-controls="ma-mnav"]:visible').first().click(); await page.waitForTimeout(500); },
  // Logged out, so step 3 offers sign-in instead of publishing; the write guard blocks any save anyway.
  async requestStep2(page) {
    await page.locator('#body').fill('გვჭირდება 20 ერგონომიული სკამი ოფისისთვის, მიწოდებით თბილისში, ორი კვირის ვადაში.');
    await page.locator('#quantity').fill('20');
    await page.locator('button[type="submit"][form="post-request-form"]').click();
    await settle(page);
  },
  async requestStep3(page) {
    await ACTIONS.requestStep2(page);
    await page.locator('#neededBy').fill(new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10));
    await page.locator('button[type="submit"][form="post-request-form"]').click();
    await settle(page);
  },
};

function audit(mobile) {
  const toRgb = c => { const cv = document.createElement('canvas').getContext('2d'); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bg = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && (e.querySelector('img') || /url\(/.test(s.backgroundImage))) return null; if (e.tagName === 'IMG' || e.querySelector(':scope > img, :scope > picture')) return null; const c = toRgb(s.backgroundColor); if (c.a > .9) return c; } return { r: 255, g: 255, b: 255 }; };
  const area = el => el.closest('header') && !el.closest('main') ? 'header' : el.closest('footer') && !el.closest('main') ? 'footer' : el.closest('[role="dialog"]') ? 'dialog' : 'main';
  const name = el => { const cls = [...el.classList].map(c => c.replace(/_[A-Za-z0-9-]{5,}$/, '').replace(/^.*__/, '')).slice(0, 2).join('.'); const p = el.parentElement; const pc = p ? [...p.classList].map(c => c.replace(/_[A-Za-z0-9-]{5,}$/, '')).slice(0, 1).join('') : ''; return `${area(el)} › ${pc ? pc + ' > ' : ''}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`; };
  const hidden = el => el.closest('[hidden],[inert],nextjs-portal,.hero-scene__group[aria-hidden],details:not([open]) > :not(summary)');
  const visible = (el, rect) => { if (!rect.width || !rect.height) return false; const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity === 0) return false; if (rect.bottom < -2000 || rect.right < 0 || rect.left > innerWidth) return false; for (let e = el; e; e = e.parentElement) { const st = getComputedStyle(e); if (+st.opacity === 0 || st.clip === 'rect(0px, 0px, 0px, 0px)' || st.clipPath === 'inset(50%)') return false; } return true; };
  const issues = [], sizes = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'svg', 'title', 'text'].includes(el.tagName)) continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!own || hidden(el)) continue;
    const rect = el.getBoundingClientRect(); if (!visible(el, rect)) continue;
    const s = getComputedStyle(el);
    const fs = parseFloat(s.fontSize), lh = s.lineHeight === 'normal' ? fs * 1.2 : parseFloat(s.lineHeight), ratio = lh / fs;
    const heading = !!el.closest('h1,h2,h3,h4,h5,h6,summary,[role="heading"],legend,th,dialog h2'), button = !!el.closest('.ma-btn,button,[role="button"],[role="tab"]');
    const range = document.createRange(); range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top / (lh * .5))));
    const multi = tops.size > 1;
    const label = !!el.closest('label, .ma-field__label, legend') && !button;
    // Text = sentences over 40 characters. Shorter strings, meta lines joined with " · " and bare addresses
    // (e-mail, URL) are labels/meta even when a narrow column wraps them.
    // Table cells are data (meta rules apply), not running text.
    const sentence = !el.closest('td, th') && own.length > 40 && !/ · /.test(own) && !/^\S+@\S+$|^https?:\/\/\S+$/.test(own);
    const kind = heading ? 'heading' : button ? 'button' : sentence ? 'text' : 'meta';
    sizes.set(fs, (sizes.get(fs) || 0) + 1);
    const at = name(el), sample = own.slice(0, 40), minBody = mobile ? 15 : 16;
    const push = o => issues.push({ ...o, at, sample });
    if (kind === 'text' && fs < minBody) push({ rule: `text ≥${minBody}px`, v: fs });
    if (kind !== 'text' && fs < 13) push({ rule: 'meta ≥13px', v: fs });
    // Field label = the label of a text field, select or textarea (not a checkbox/radio row).
    const L = el.closest('label, .ma-field__label'); const ctl = L?.control || L?.closest('.ma-field')?.querySelector('input, select, textarea');
    if (label && L && ctl && !/^(checkbox|radio|range|file)$/.test(ctl.type) && !el.closest('.ma-field__error, .ma-field__help') && fs < 14) push({ rule: 'field label ≥14px', v: fs });
    if (kind === 'text' && multi && (ratio < 1.5 || ratio > 1.75)) push({ rule: 'text line-height 1.55–1.7', v: +ratio.toFixed(2) });
    if (kind === 'meta' && multi && (ratio < 1.3 || ratio > 1.75)) push({ rule: 'wrapped label line-height 1.3–1.7', v: +ratio.toFixed(2) });
    if (kind === 'heading' && multi && (ratio < 1.15 || ratio > 1.4)) push({ rule: 'heading line-height 1.2–1.35', v: +ratio.toFixed(2) });
    if (!heading && !button && (/case/.test(s.fontFeatureSettings) || s.textTransform === 'uppercase') && /[a-zა-ჰ]/.test(own)) push({ rule: 'Mtavruli/uppercase outside headings/buttons' });
    if (kind === 'text' && el.tagName === 'P' && rect.width / fs > 38) push({ rule: 'measure ≤ ~75ch', v: Math.round(rect.width / (fs * .5)) });
    const b = bg(el); if (b) { const fg = toRgb(s.color); const L1 = lum(fg), L2 = lum(b); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const need = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5; if (fg.a > .5 && cr < need && !el.closest(':disabled, [aria-disabled="true"]')) push({ rule: 'contrast AA', v: +cr.toFixed(2) }); }
  }
  for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]), select, textarea')) {
    const rect = el.getBoundingClientRect(); if (hidden(el) || !visible(el, rect)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) issues.push({ rule: 'input ≥16px', at: name(el), v: fs, sample: el.getAttribute('placeholder') || el.name || el.id || '' });
  }
  for (const el of document.querySelectorAll('a, button, summary, [role="tab"], input[type=checkbox], input[type=radio], select')) {
    const rect = el.getBoundingClientRect(); if (hidden(el) || !visible(el, rect) || el.closest('[aria-hidden="true"]') || el.tabIndex < 0 || el.disabled) continue;
    const after = getComputedStyle(el, '::after'); const covered = after.content !== 'none' && after.position === 'absolute' && el.closest('article, li, [class*="card"]');
    // A control inside a label/row that is itself ≥44px tall counts as that row.
    const host = el.closest('label, [role="option"], li'); const hostH = host ? host.getBoundingClientRect().height : 0;
    // WCAG 2.5.8 inline exception: a link that is part of a running sentence keeps the line's height.
    // Chart scrub strip: adjacent full-height day columns (the figure's caption carries the same totals).
    if (el.parentElement && /hitAreas/.test(el.parentElement.className)) continue;
    const inline = /^(A|BUTTON)$/.test(el.tagName) && getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent.trim().length || 0) > el.textContent.trim().length + 10;
    if (Math.min(rect.height, rect.width) < 43.5 && hostH < 43.5 && !covered && !inline && !(el.tagName === 'A' && el.closest('p,dd,dt,td,.ma-prose'))) issues.push({ rule: 'tap target ≥44px', at: name(el), v: Math.round(Math.min(rect.height, rect.width)), sample: (el.textContent.trim() || el.getAttribute('aria-label') || '').slice(0, 30) });
  }
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth;
  return { sizes: [...sizes].sort((a, b) => a[0] - b[0]), issues, overflow };
}

// The local server talks to the live database: every request that could write is stopped in the browser.
// Allowed: GETs, and POSTs to read-only RPCs. Blocked: analytics beacons, every other RPC and any table write.
const READ_RPC = /^(get_|list_|my_(profile|company_review_targets|business_settings|request_draft)$|company_|request_(alert_)?preferences$|site_content$|offer_counts$|engagement_state$|unread_message_count$|compare_offers$|count_matching_suppliers$|verification_record$|home_stats$|request_preferences$|admin_(list_|search_|stats$|overview$|market_metrics$|contact_|message_stats$|conversation_messages$|deal_issues$|business_(audit|queue)$))/;
const blocked = new Set();
async function guard(ctx) {
  await ctx.route(/\/api\/(?!files\/)/, route => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === 'GET' || req.method() === 'HEAD') return route.continue();
    const rpc = u.pathname.match(/\/api\/db\/rpc\/([a-z_0-9]+)/)?.[1];
    if (rpc && READ_RPC.test(rpc)) return route.continue();
    blocked.add(`${req.method()} ${rpc || u.pathname}`);
    return route.fulfill({ status: 204, body: '' });
  });
}
const browser = await chromium.launch();
const states = {};
async function login(role, attempt = 1) {
  if (states[role]) return states[role];
  if (attempt > 1) await new Promise(r => setTimeout(r, 5000));
  const account = ledger[roles[role]];
  if (!account?.password) throw new Error(`No ledger entry for ${roles[role]}`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await guard(ctx);
  const page = await ctx.newPage();
  try {
    await page.goto(base + '/account/', { waitUntil: 'networkidle' });
    await page.locator('#login-email').fill(account.email);
    await page.locator('#login-password').fill(account.password);
    await page.locator('form button[type="submit"]').click();
    await page.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
    await settle(page);
    states[role] = await ctx.storageState();
  } catch { await ctx.close(); if (attempt < 3) return login(role, attempt + 1); throw new Error(`Sign-in failed for ${roles[role]}`); } // never echo Playwright call logs (they hold the filled values)
  await ctx.close().catch(() => {});
  return states[role];
}

const report = {}, totals = {};
const pages = PAGES.filter(p => !only || only.includes(p.name));
if (shots) fs.mkdirSync(shots, { recursive: true });
for (const def of pages) {
  report[def.name] = {};
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const mobile = width < 768;
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce', storageState: def.role ? await login(def.role) : undefined });
    await guard(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
    let url = def.path;
    try {
      if (def.find) {
        await page.goto(base + def.find[0], { waitUntil: 'domcontentloaded' }); await settle(page);
        const href = await page.locator(def.find[1]).nth(def.find[2] || 0).getAttribute('href', { timeout: 15000 });
        url = def.map ? def.map(href) : href;
      }
      await page.goto(base + url, { waitUntil: 'domcontentloaded' }); await settle(page);
      if (def.then) await ACTIONS[def.then](page);
      const r = await page.evaluate(audit, mobile);
      r.errors = def.name === '404' ? errors.filter(e => !/status of 404/.test(e)) : errors; r.url = url;
      report[def.name][width] = r;
      if (shots) { await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.screenshot({ path: path.join(shots, `${def.name}-${width}.png`), fullPage: true }); }
    } catch (e) { report[def.name][width] = { failed: String(e.message).split('\n')[0].slice(0, 200), url }; }
    await ctx.close();
  }
}
await browser.close();

// Summary: per page, issues per viewport; then the grouped detail.
let grand = 0;
console.log('page'.padEnd(22), '1440'.padStart(5), '390'.padStart(5), ' overflow  console');
for (const [name, byW] of Object.entries(report)) {
  const cell = w => byW[w]?.failed ? 'FAIL' : String(byW[w]?.issues.length ?? '-');
  for (const w of [1440, 390]) grand += byW[w]?.issues?.length || 0;
  console.log(name.padEnd(22), cell(1440).padStart(5), cell(390).padStart(5), `  ${byW[1440]?.overflow ?? '-'}/${byW[390]?.overflow ?? '-'}`.padEnd(10), `${byW[1440]?.errors?.length ?? '-'}/${byW[390]?.errors?.length ?? '-'}`);
  for (const w of [1440, 390]) { const r = byW[w]; if (!r?.issues) { if (r?.failed) console.log(`   ${w}: ${r.failed}`); continue; } for (const i of r.issues) totals[i.rule] = (totals[i.rule] || 0) + 1; }
}
console.log('\nby rule:', totals, '\ntotal issues:', grand, '\nblocked writes:', [...blocked].join(', ') || 'none');
if (verbose) for (const [name, byW] of Object.entries(report)) for (const w of [1440, 390]) {
  const r = byW[w]; if (!r?.issues?.length && !r?.errors?.length) continue;
  const grouped = new Map(); for (const i of r.issues) { const k = `${i.rule} | ${i.at} | ${i.v ?? ''}`; if (!grouped.has(k)) grouped.set(k, { ...i, n: 0 }); grouped.get(k).n++; }
  console.log(`\n=== ${name} ${w}  (${r.url}) sizes ${r.sizes.map(([s, n]) => `${s}×${n}`).join(' ')}`);
  for (const [k, v] of grouped) console.log(`  ${k} ×${v.n}  «${v.sample}»`);
  for (const e of r.errors) console.log('  console:', e);
}
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
