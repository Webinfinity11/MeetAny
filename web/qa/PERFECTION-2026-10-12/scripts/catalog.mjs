// კატალოგი და დეტალი — after-კადრები (მხოლოდ წაკითხვა): სტუმარი, owner_user, owner_company; 1440 და 390.
// გაშვება web/-დან: BASE=http://localhost:3304 node qa/PERFECTION-2026-10-12/scripts/catalog.mjs
// ჩაწერის RPC-ები (mark_/set_/log_ …) ბრაუზერშივე ითიშება, ასე რომ მფლობელის გვერდის ნახვაც კი ბაზას არ ცვლის.
// პაროლის ველი კადრში არ ხვდება; ანგარიშის მონაცემები არ იბეჭდება.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE || 'http://localhost:3304';
const out = path.resolve(import.meta.dirname, '../after/catalog');
fs.mkdirSync(out, { recursive: true });
const ledger = JSON.parse(fs.readFileSync(process.env.LEDGER || '/Users/kapana/Desktop/infinty/MeetAny/site/DEMO-ACCOUNTS.local.md', 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const only = process.env.ONLY;
const REQUEST = 'f04784a3-5684-4fb9-8e30-7fcd9f4ba043';
const COMPANY = '74cc28fc-47de-45cb-9563-93735b86855e';
const WRITE_RPC = /\/rpc\/(mark_|set_|log_|select_|create_|update_|delete_|send_|report_|withdraw|extend|close_|remove_|save_|upsert|record_|track_)/;
const results = [];

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const loaded = p => p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 20 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 45000 }).catch(() => 'timeout');

async function newContext(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
  // Writes are answered locally (200, null) so the page carries on without touching the database.
  await ctx.route('**/*', route => WRITE_RPC.test(route.request().url()) ? route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }) : route.continue());
  return ctx;
}

async function shot(p, name, fullPage = true) {
  if (await p.locator('#login-password:visible').count()) throw new Error('password form on screen: ' + name);
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, name + '.png'), fullPage });
}

async function visit(ctx, name, url, width, after) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().replace(base, '').slice(0, 120)); });
  try {
    const res = await p.goto(base + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => p.goto(base + url, { waitUntil: 'load' }));
    await loaded(p);
    await p.waitForTimeout(800);
    const m = await p.evaluate(() => ({ overflow: document.scrollingElement.scrollWidth > innerWidth, title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()) }));
    await shot(p, `${name}-${width}`);
    const extra = after ? await after(p) : undefined;
    results.push({ name, url, width, status: res?.status(), errors, ...m, extra });
  } catch (e) {
    results.push({ name, url, width, fatal: String(e.message).split('\n')[0].slice(0, 200), errors });
  }
  await p.close();
  console.log(width, name, results.at(-1).errors?.length ?? 'fatal', results.at(-1).overflow);
}

async function signIn(ctx, key) {
  const account = ledger.accounts[key];
  const lp = await ctx.newPage();
  await lp.goto(base + '/account/', { waitUntil: 'networkidle' });
  await lp.locator('#login-email').waitFor({ timeout: 60000 });
  await lp.locator('#login-email').fill(account.email);
  await lp.locator('#login-password').fill(account.password);
  await lp.locator('form button[type="submit"]').click();
  await lp.locator('#login-email').waitFor({ state: 'detached', timeout: 60000 });
  await loaded(lp);
  // The owner's own request: the first one in "my requests".
  let own = null;
  if (key === 'owner_user') {
    await lp.goto(base + '/account/?tab=requests', { waitUntil: 'networkidle' }); await loaded(lp); await lp.waitForTimeout(1500);
    own = await lp.locator('main a[href*="/requests/view"]').first().getAttribute('href').catch(() => null);
  }
  await lp.close();
  return own;
}

const aside = async p => ({
  aside: await p.locator('main aside').first().innerText().catch(() => null),
  facts: await p.locator('.request-detail-facts > div').evaluateAll(a => a.map(e => { const r = e.getBoundingClientRect(); return `${e.innerText.replace(/\n/g, ': ')} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}w`; })).catch(() => null),
  bar: await p.evaluate(() => { const e = document.querySelector('.detail-actionbar'); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewport: innerHeight, text: e.innerText }; }),
});

try {
  const guestPages = [
    ['home', '/'], ['requests', '/requests/'], ['requests-empty', '/requests/?q=zzzz'], ['request-view', `/requests/view/?id=${REQUEST}`],
    ['companies', '/companies/'], ['companies-map', '/companies/?view=map'], ['company-view', `/companies/view/?id=${COMPANY}`],
    ['terms', '/terms/'], ['request-nope', '/requests/view/?id=nope'], ['company-nope', '/companies/view/?id=nope'], ['404', '/nope'],
  ];
  for (const width of only && only !== 'guest' ? [] : widths) {
    const ctx = await newContext(width);
    for (const [name, url] of guestPages) await visit(ctx, name + '-guest', url, width, async p => {
      if (name === 'request-view') {
        const x = await aside(p);
        if (width === 390) await shot(p, 'request-view-viewport-guest-390', false);
        return x;
      }
      if (name === 'requests' && width === 390) {
        await p.locator('main button', { hasText: /ფილტრ/ }).first().click(); await p.waitForTimeout(700);
        await shot(p, 'requests-filter-sheet-guest-390', false);
        const sheet = await p.locator('dialog[open], [role=dialog]').first().innerText().catch(() => null);
        await p.keyboard.press('Escape');
        return { sheet };
      }
      if (name === 'company-view') return { report: await p.locator('main .report-link').evaluateAll(a => a.map(e => e.closest('section,aside,div')?.className)).catch(() => null) };
    });
    await ctx.close();
  }
  for (const key of ['owner_user', 'owner_company']) {
    if (only && only !== key) continue;
    for (const width of widths) {
      const ctx = await newContext(width);
      const own = await signIn(ctx, key);
      const pages = key === 'owner_user'
        ? [['request-view', `/requests/view/?id=${REQUEST}`], ...(own ? [['request-own', own]] : []), ['companies', '/companies/'], ['company-view', `/companies/view/?id=${COMPANY}`]]
        : [['request-view', `/requests/view/?id=${REQUEST}`], ['requests', '/requests/'], ['company-view', `/companies/view/?id=${COMPANY}`]];
      for (const [name, url] of pages) await visit(ctx, `${name}-${key}`, url, width, async p => {
        if (name.startsWith('request-')) { const x = await aside(p); if (width === 390) await shot(p, `${name}-viewport-${key}-390`, false); return x; }
      });
      await ctx.close();
    }
  }
} catch (e) {
  console.log('FATAL', String(e.message).split('\n')[0].replace(/fill\(.*\)/, 'fill(…)').slice(0, 160));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, `_results${only ? '-' + only : ''}.json`), JSON.stringify(results, null, 2));
  await browser.close();
}
