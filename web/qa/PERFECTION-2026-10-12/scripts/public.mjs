// საჯარო ზონის აუდიტი (მხოლოდ წაკითხვა): კადრები, console/pageerror, ჰორიზონტალური overflow, ტექსტის ამონაწერი.
// გაშვება web/-დან: node qa/PERFECTION-2026-10-12/scripts/public.mjs   (BASE=http://localhost:3300 ნაგულისხმევად)
// არაფერი იგზავნება: ფორმები მხოლოდ იხსნება. პაროლის ველი კადრში არასოდეს ხვდება; ანგარიშის მონაცემები არ იბეჭდება.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';


const base = process.env.BASE || 'http://localhost:3300';
const out = path.resolve(import.meta.dirname, '..', process.env.OUT || 'before', 'public');
const textDir = path.join(out, '_text');
fs.mkdirSync(textDir, { recursive: true });
const ledger = JSON.parse(fs.readFileSync(process.env.LEDGER || '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const results = [];
// ONLY=guest|user და WIDTHS=1440,390 — ნაწილობრივი გაშვებისთვის
const only = process.env.ONLY; const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const loaded = p => p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 45000 }).catch(() => 'timeout');

async function shot(p, name, opts = {}) {
  if (await p.locator('#login-password:visible').count() && !opts.allowLoginForm) throw new Error('password form on screen: ' + name);
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, name + '.png'), fullPage: opts.fullPage !== false });
}

async function metrics(p) {
  return p.evaluate(() => {
    const se = document.scrollingElement; const vw = innerWidth;
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
        let clip = false; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') { clip = true; break; } }
        if (!clip) wide.push((el.className?.baseVal ?? el.className ?? el.tagName).toString().slice(0, 60) + ' →' + Math.round(r.right));
      }
    }
    const small = [];
    for (const el of document.querySelectorAll('main a, main button, main input, main select, header a, header button')) {
      const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 44 && r.width < 44 || r.height < 32) small.push(`${el.tagName}.${String(el.className).slice(0, 40)} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { scrollWidth: se.scrollWidth, innerWidth: vw, overflow: se.scrollWidth > vw, wide: wide.slice(0, 8), small: [...new Set(small)].slice(0, 20), title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()) };
  });
}

async function visit(ctx, name, url, width, after) {
  const p = await ctx.newPage();
  const errors = []; const failed = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/_next/')) failed.push(r.status() + ' ' + r.url().replace(base, '').slice(0, 120)); });
  let status = null;
  try {
    const res = await p.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => p.goto(base + url, { waitUntil: 'load' }));
    status = res?.status();
    const l = await loaded(p);
    const m = await metrics(p);
    const text = await p.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(textDir, `${name}-${width}.txt`), text);
    if (await p.locator('#login-password:visible').count()) results.push({ note: name + ' ' + width + ': პაროლის ფორმა — კადრი არ გადაღებულა' }); else await shot(p, `${name}-${width}`);
    const extra = after ? await after(p) : undefined;
    results.push({ name, url, width, status, loadWait: l === 'timeout' ? 'timeout' : 'ok', errors, failed, ...m, extra });
  } catch (e) {
    results.push({ name, url, width, status, fatal: String(e.message).slice(0, 200), errors, failed });
  }
  return p;
}

function save() { fs.writeFileSync(path.join(out, only || process.env.WIDTHS ? `_results-${only || 'all'}-${widths.join('_')}.json` : '_results.json'), JSON.stringify(results, null, 2)); }

try {
  // 1) id/slug-ების აღმოჩენა კატალოგებიდან
  const disc = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dp = await disc.newPage();
  await dp.goto(base + '/requests/', { waitUntil: 'networkidle' }); await loaded(dp);
  const reqHref = await dp.locator('main a[href*="/requests/view"]').first().getAttribute('href');
  await dp.goto(base + '/companies/', { waitUntil: 'networkidle' }); await loaded(dp);
  const coHref = await dp.locator('main a[href*="/companies/view"]').first().getAttribute('href');
  await dp.goto(base + '/ideas/', { waitUntil: 'networkidle' }); await loaded(dp);
  const ideaHref = await dp.locator('main a[href^="/ideas/"]').first().getAttribute('href').catch(() => null);
  await disc.close();
  console.log('discovered', reqHref, coHref, ideaHref);

  const pages = [
    ['home', '/'], ['requests', '/requests/'], ['requests-search', '/requests/?q=%E1%83%95%E1%83%94%E1%83%91'], ['requests-empty', '/requests/?q=zzzz'],
    ['request-view', reqHref], ['companies', '/companies/'], ['company-view', coHref], ['how', '/how-it-works/'], ['terms', '/terms/'],
    ['ideas', '/ideas/'], ...(ideaHref ? [['idea', ideaHref]] : []), ['account-guest', '/account/'], ['request-nope', '/requests/view?id=nope'], ['company-nope', '/companies/view?id=nope'], ['404', '/nope'],
  ];
  for (const width of only === 'user' ? [] : widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    for (const [name, url] of pages) {
      const p = await visit(ctx, name + '-guest', url, width, async p => {
        const x = {};
        if (name === 'home' && width === 390) {
          await p.locator('[class*="ma-header__menu-btn"]').click(); await p.waitForTimeout(500);
          x.mnav = await p.locator('#ma-mnav').innerText();
          await shot(p, 'mobile-menu-guest-390', { fullPage: false });
          await p.keyboard.press('Escape');
        }
        if (name === 'home' && width === 1440) {
          x.themeBefore = await p.evaluate(() => document.documentElement.dataset.theme);
          await p.locator('header .ma-theme-toggle').click(); await p.waitForTimeout(400);
          x.themeAfter = await p.evaluate(() => document.documentElement.dataset.theme);
          await shot(p, 'home-classic-theme-guest-1440', { fullPage: false });
          await p.locator('header .ma-theme-toggle').click();
          x.footer = await p.locator('footer').innerText().catch(() => null);
          x.footerLinks = await p.locator('footer a').evaluateAll(a => a.map(e => e.getAttribute('href')));
          x.headerLinks = await p.locator('header a').evaluateAll(a => a.map(e => (e.innerText.trim() || e.getAttribute('aria-label')) + ' ' + e.getAttribute('href')));
        }
        if (name === 'requests' && width === 390) {
          const btn = p.locator('main button', { hasText: /ფილტრ/ }).first();
          if (await btn.count()) { await btn.click(); await p.waitForTimeout(600); x.sheet = await p.locator('dialog[open], [role=dialog]').first().innerText().catch(() => null); await shot(p, 'requests-filter-sheet-guest-390', { fullPage: false }); await p.keyboard.press('Escape'); }
          else x.sheet = 'filter button not found';
        }
        if (name === 'request-view') {
          x.aside = await p.locator('main aside').first().innerText().catch(() => null);
          if (width === 390) { x.bar = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().bottom >= innerHeight - 2 && e.innerText).map(e => e.className + ': ' + e.innerText.replace(/\n/g, ' | ')).slice(0, 3)); await shot(p, 'request-view-viewport-guest-390', { fullPage: false }); }
          const offer = p.locator('main a:visible, main button:visible, body [class*="bar"] button:visible, body [class*="bar"] a:visible', { hasText: /შეთავაზ/ }).last();
          x.offerCta = await offer.innerText().catch(() => null);
          if (await offer.count()) {
            await offer.click({ timeout: 8000 }).catch(e => { x.offerClickError = String(e.message).split('\n')[0]; }); await p.waitForTimeout(1200);
            x.afterOfferUrl = p.url().replace(base, '');
            x.modal = await p.locator('dialog[open], [role=dialog]').first().innerText().catch(() => null);
            const hasPwd = await p.locator('#login-password:visible, input[type=password]:visible').count();
            x.modalHasPassword = hasPwd > 0;
            if (x.modal && !hasPwd) await shot(p, `auth-modal-guest-${width}`, { fullPage: false });
          }
        }
        if (name === 'company-view') x.mapOrTabs = await p.locator('main h2, main h3, main [role=tab]').evaluateAll(a => a.map(e => e.innerText.trim()).filter(Boolean));
        if (name === 'companies') x.map = await p.locator('.leaflet-container').count();
        if (name === 'account-guest') { x.form = await p.locator('main form').first().evaluate(f => [...f.querySelectorAll('label,button,a,input')].map(e => e.tagName + ':' + (e.innerText || e.placeholder || e.type || '').trim())).catch(() => null); x.tabs = await p.locator('main [role=tab], main button').evaluateAll(a => a.map(e => e.innerText.trim()).filter(Boolean)); }
        return x;
      });
      await p.close(); save();
      console.log(width, name, results.at(-1).errors?.length, results.at(-1).overflow);
    }
    await ctx.close();
  }

  // 1b) მობილური ქვედა ზოლი (fixed უნდა იყოს viewport-ის ბოლოში) და კომპანიების რუკა
  if (only !== 'user') {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(base + reqHref, { waitUntil: 'networkidle' }); await loaded(p); await p.waitForTimeout(2000);
    const bar = await p.evaluate(() => { const e = document.querySelector('.detail-actionbar'); if (!e) return null; const r = e.getBoundingClientRect(); const cb = []; for (let a = e.parentElement; a; a = a.parentElement) if (getComputedStyle(a).transform !== 'none') cb.push(a.className); return { top: Math.round(r.top), viewport: innerHeight, inViewport: r.bottom <= innerHeight && r.top >= 0, transformedAncestors: cb }; });
    await shot(p, 'request-view-actionbar-guest-390', { fullPage: false });
    await p.goto(base + '/companies/?view=map', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
    const map = { leaflet: await p.locator('.leaflet-container').count(), clusters: await p.locator('.leaflet-marker-icon').count() };
    await shot(p, 'companies-map-guest-390');
    results.push({ name: 'checks', width: 390, extra: { bar, map } }); save();
    console.log('checks', JSON.stringify({ bar, map }));
    await ctx.close();
  }

  // 2) owner_user: ჰედერის ანგარიშის მენიუ და მოთხოვნის aside
  const account = ledger.accounts.owner_user;
  for (const width of only === 'guest' ? [] : widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    const lp = await ctx.newPage();
    await lp.goto(base + '/account/', { waitUntil: 'networkidle' });
    await lp.locator('#login-email').waitFor({ timeout: 60000 });
    await lp.locator('#login-email').fill(account.email);
    await lp.locator('#login-password').fill(account.password);
    await lp.locator('form button[type="submit"]').click();
    await lp.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
    await loaded(lp); await lp.close();
    for (const [name, url] of [['home', '/'], ['request-view', reqHref], ['companies', '/companies/'], ['company-view', coHref]]) {
      const p = await visit(ctx, name + '-user', url, width, async p => {
        const x = {};
        if (name === 'home') {
          if (width === 1440) { await p.locator('header [class*="ma-menu__trigger"]').first().click(); await p.waitForTimeout(400); x.menu = await p.locator('#ma-account-menu').innerText(); await shot(p, 'account-menu-user-1440', { fullPage: false }); await p.keyboard.press('Escape'); }
          else { await p.locator('[class*="ma-header__menu-btn"]').click(); await p.waitForTimeout(500); x.mnav = await p.locator('#ma-mnav').innerText(); await shot(p, 'mobile-menu-user-390', { fullPage: false }); await p.keyboard.press('Escape'); }
        }
        if (name === 'request-view') {
          const aside = p.locator('main aside').first();
          x.aside = await aside.innerText().catch(() => null);
          x.asideButtons = await aside.locator('a, button').evaluateAll(a => a.map(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { text: e.innerText.trim(), cls: String(e.className), color: s.color, bg: s.backgroundColor, border: s.borderColor + ' ' + s.borderWidth, font: s.fontSize + ' ' + s.fontWeight + ' ' + s.fontFeatureSettings, transform: s.textTransform, justify: s.justifyContent, align: s.textAlign, x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) }; })).catch(() => null);
          if (await aside.count()) await aside.screenshot({ path: path.join(out, `request-view-aside-user-${width}.png`) });
          if (width === 390) await shot(p, 'request-view-viewport-user-390', { fullPage: false });
        }
        return x;
      });
      await p.close(); save();
      console.log('user', width, name, results.at(-1).errors?.length, results.at(-1).overflow);
    }
    await ctx.close();
  }
} catch (e) {
  // Playwright-ის შეცდომამ შეიძლება შევსებული ველი შეიცავდეს — არ ვბეჭდავთ.
  console.log('FATAL', String(e.message).split('\n')[0].replace(/fill\(.*\)/, 'fill(…)').slice(0, 160));
  process.exitCode = 1;
} finally {
  save();
  await browser.close();
}
