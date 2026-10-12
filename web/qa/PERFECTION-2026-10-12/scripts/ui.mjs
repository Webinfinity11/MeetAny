// საერთო UI და მობილური (ეტაპი 3): კადრები 390/360 (+1440 ჰედერი/მენიუ/404), CLS, scroll-ის აღდგენა „უკან“-ზე,
// sheet/drawer/modal-ის ანიმაციის ხანგრძლივობა, ტოსტის პოზიცია. მხოლოდ წაკითხვა: ფორმები არ იგზავნება.
// გაშვება web/-დან: BASE=http://localhost:3303 OUT=after node qa/PERFECTION-2026-10-12/scripts/ui.mjs
// ONLY=measure — მხოლოდ გაზომვა კადრების გარეშე.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE || 'http://localhost:3303';
const out = path.resolve(import.meta.dirname, '..', process.env.OUT || 'after', 'ui');
const shots = process.env.ONLY !== 'measure';
fs.mkdirSync(out, { recursive: true });
const ledger = JSON.parse(fs.readFileSync(process.env.LEDGER || '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { base, at: new Date().toISOString(), cls: [], scroll: [], motion: [], toast: [], notes: [] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

const loaded = p => p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 45000 }).catch(() => 'timeout');
const clsInit = () => {
  window.__cls = 0; window.__shifts = [];
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => (s.node?.className?.baseVal ?? s.node?.className ?? s.node?.nodeName ?? '').toString().slice(0, 50)) }); } }).observe({ type: 'layout-shift', buffered: true });
};

async function context(width, role) {
  const height = width === 360 ? 780 : width === 390 ? 844 : 1000;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 640, hasTouch: width < 640, deviceScaleFactor: width < 640 ? 2 : 1 });
  await ctx.addInitScript(clsInit);
  await ctx.addInitScript(() => { try { localStorage.setItem('meetany.theme', 'blue'); } catch {} });
  if (role !== 'guest') {
    const account = ledger.accounts[role === 'company' ? 'owner_company' : 'owner_user'];
    const lp = await ctx.newPage();
    await lp.goto(base + '/account/', { waitUntil: 'networkidle' });
    await lp.locator('#login-email').waitFor({ timeout: 60000 });
    await lp.locator('#login-email').fill(account.email);
    await lp.locator('#login-password').fill(account.password);
    await lp.locator('form button[type="submit"]').click();
    await lp.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
    await loaded(lp); await lp.close();
  }
  return ctx;
}

async function shot(p, name, fullPage = true) {
  if (!shots) return;
  if (await p.locator('#login-password:visible').count()) { report.notes.push(name + ': პაროლის ფორმა — კადრი არ გადაღებულა'); return; }
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(out, name + '.png'), fullPage });
}

async function cls(p, name, width, role) {
  await loaded(p); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts.slice(0, 6) }));
  report.cls.push({ name, width, role, ...r }); save();
  console.log('cls', name, role, width, r.cls);
}

// ანიმაციის გაზომვა: ელემენტის computed animation (ხანგრძლივობა + easing)
const motionOf = (p, selector) => p.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return { duration: s.animationDuration, easing: s.animationTimingFunction, name: s.animationName }; }, selector);

for (const width of [390, 360]) {
  // სტუმარი
  const g = await context(width, 'guest');
  let p = await g.newPage();
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' }); await cls(p, 'home', width, 'guest');
  await shot(p, `home-guest-${width}`);
  await p.locator('[class*="ma-header__menu-btn"]').click(); await p.waitForTimeout(60);
  report.motion.push({ what: 'drawer open', width, ...(await motionOf(p, '#ma-mnav')) });
  await p.waitForTimeout(400); await shot(p, `menu-guest-${width}`, false);
  await p.keyboard.press('Escape'); await p.waitForTimeout(40);
  report.motion.push({ what: 'drawer close', width, ...(await motionOf(p, '#ma-mnav')), open: await p.evaluate(() => document.querySelector('#ma-mnav')?.open) });
  await p.waitForTimeout(400);
  report.notes.push({ width, drawerClosedFocus: await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) });

  await p.goto(base + '/requests/', { waitUntil: 'domcontentloaded' }); await cls(p, 'requests', width, 'guest');
  await shot(p, `requests-guest-${width}`);
  // scroll-ის აღდგენა: /requests/ → დეტალი → უკან
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(300);
  const before = await p.evaluate(() => Math.round(scrollY));
  const link = p.locator('main a[href*="/requests/view"]').nth(3);
  if (await link.count()) {
    await link.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const at = await p.evaluate(() => Math.round(scrollY));
    await link.click(); await p.waitForURL(/requests\/view/); await loaded(p); await p.waitForTimeout(600);
    const detailTop = await p.evaluate(() => Math.round(scrollY));
    if (width === 390) await shot(p, `request-view-guest-${width}`);
    await p.goBack(); await loaded(p); await p.waitForTimeout(900);
    const after = await p.evaluate(() => Math.round(scrollY));
    report.scroll.push({ width, before, at, detailTop, after, restored: Math.abs(after - at) < 40 }); save();
    console.log('scroll', width, { at, detailTop, after });
  }
  // soft-ნავიგაციის CLS: დეტალიდან ჰედერით კატალოგზე
  await p.evaluate(() => { window.__cls = 0; window.__shifts = []; });
  await p.locator('header a[href="/requests/"]').first().click().catch(() => p.goto(base + '/requests/'));
  await cls(p, 'requests (soft nav)', width, 'guest');
  const filter = p.locator('main button', { hasText: 'ფილტრ' }).first();
  if (await filter.count()) {
    await filter.click(); await p.waitForTimeout(60);
    report.motion.push({ what: 'filter sheet open', width, ...(await motionOf(p, 'dialog[open]')) });
    await p.waitForTimeout(400);
    const chip = p.locator('dialog[open] label, dialog[open] button[aria-pressed]').nth(1);
    if (await chip.count()) { await chip.click().catch(() => {}); await p.waitForTimeout(300); }
    await shot(p, `requests-sheet-guest-${width}`, false);
    report.notes.push({ width, sheet: await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (!d) return null; const r = d.getBoundingClientRect(); const pad = getComputedStyle(d).paddingBottom; const btns = [...d.querySelectorAll('footer .ma-btn, footer button')].map(b => { const x = b.getBoundingClientRect(); return { t: b.innerText.trim(), w: Math.round(x.width), y: Math.round(x.y) }; }); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, pad, btns }; }) });
    await p.keyboard.press('Escape'); await p.waitForTimeout(40);
    report.motion.push({ what: 'filter sheet close', width, ...(await motionOf(p, 'dialog[data-closing]')) });
    await p.waitForTimeout(400);
  }
  await p.goto(base + '/requests/view?id=f04784a3-5684-4fb9-8e30-7fcd9f4ba043', { waitUntil: 'domcontentloaded' }); await cls(p, 'request-view', width, 'guest');
  await shot(p, `request-view-guest-${width}`);
  await p.goto(base + '/nope-' + width, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  await shot(p, `404-guest-${width}`);
  report.notes.push({ width, notFound: await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, body: document.body.className, margin: getComputedStyle(document.body).margin, font: getComputedStyle(document.body).fontFamily.slice(0, 40) })) });
  // ტოსტი: ქვედა ზოლის თავზე
  await p.goto(base + '/requests/view?id=f04784a3-5684-4fb9-8e30-7fcd9f4ba043', { waitUntil: 'domcontentloaded' }); await loaded(p); await p.waitForTimeout(1500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('meetany:toast', { detail: { title: 'შეცდომის ტესტი', tone: 'danger' } })));
  await p.waitForTimeout(400);
  report.toast.push({ width, ...(await p.evaluate(() => { const t = document.querySelector('[class*="Toasts-module"][aria-live] > div'); const bar = document.querySelector('.detail-actionbar, .ma-actionbar'); const tr = t?.getBoundingClientRect(); const br = bar?.getBoundingClientRect(); return { toastBottom: tr && Math.round(tr.bottom), barTop: br && Math.round(br.top), overlap: !!(tr && br && br.height && tr.bottom > br.top), icon: t?.querySelector('use')?.getAttribute('href') }; })) });
  await shot(p, `toast-guest-${width}`, false);
  await g.close();

  // შესული კლიენტი და კომპანია
  for (const role of ['client', 'company']) {
    const c = await context(width, role);
    p = await c.newPage();
    await p.goto(base + '/account/', { waitUntil: 'domcontentloaded' }); await cls(p, 'account', width, role);
    await shot(p, `account-${role}-${width}`);
    await p.goto(base + '/requests/', { waitUntil: 'domcontentloaded' }); await cls(p, 'requests', width, role);
    await p.evaluate(() => { window.__cls = 0; window.__shifts = []; });
    await p.locator('[class*="ma-header__menu-btn"]').click(); await p.waitForTimeout(300);
    await p.locator('#ma-mnav a[href="/account/"]').first().click().catch(() => {}); await p.waitForURL(/account/).catch(() => {});
    await cls(p, 'account (soft nav)', width, role);
    await p.goto(base + '/requests/', { waitUntil: 'domcontentloaded' }); await loaded(p);
    await p.locator('[class*="ma-header__menu-btn"]').click(); await p.waitForTimeout(450);
    report.notes.push({ width, role, drawer: await p.locator('#ma-mnav').innerText() });
    await shot(p, `menu-${role}-${width}`, false);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await c.close();
  }
  save();
}

// ნელი ქსელი + CPU 4×: skeleton → შინაარსის გადასვლა ხილულია, CLS აქ მოწმდება ნამდვილად
for (const [role, url] of [['guest', '/requests/'], ['client', '/account/'], ['company', '/account/']]) {
  for (const width of [390, 360]) {
    const c = await context(width, role).catch(() => null);
    if (!c) { report.notes.push(`throttled ${role} ${width}: login timeout`); continue; }
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 200000, uploadThroughput: 100000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (!(await p.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => null))) { report.notes.push(`throttled ${role} ${width}: goto timeout`); await c.close(); continue; }
    await p.waitForTimeout(800);
    if (shots && width === 390) await p.screenshot({ path: path.join(out, `skeleton-${url.replaceAll('/', '') || 'home'}-${role}-${width}.png`) });
    await cls(p, url + ' (throttled)', width, role);
    await c.close();
  }
}

// 1440: ჰედერი, ანგარიშის მენიუ, 404
for (const role of ['guest', 'client', 'company']) {
  const c = await context(1440, role);
  const p = await c.newPage();
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' }); await loaded(p);
  if (role === 'guest') { await shot(p, 'header-guest-1440', false); await p.goto(base + '/nope', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shot(p, '404-guest-1440'); }
  else {
    await p.locator('header [class*="ma-menu__trigger"]').first().click(); await p.waitForTimeout(300);
    report.notes.push({ role, menu: await p.locator('#ma-account-menu').innerText() });
    await shot(p, `menu-${role}-1440`, false);
  }
  await c.close();
}
save();
await browser.close();
console.log(JSON.stringify({ cls: report.cls.map(x => [x.name, x.role, x.width, x.cls]), scroll: report.scroll, motion: report.motion, toast: report.toast }, null, 1));
