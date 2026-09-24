// T5.2 research: full-site screenshot review, every role, 1440/390/320, read-only (no submit).
// Run: QA_ORIGIN=http://localhost:3001 node qa/final-shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const executablePath = process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
const safe = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const out = path.join(root, 'qa/shots/final-0924');
fs.mkdirSync(out, { recursive: true });
const viewports = [[1440, 1000, '1440'], [390, 844, '390'], [320, 568, '320']];
const report = {};
const consoleIssues = [];
const slow = [];
let currentTag = 'boot';

const browser = await chromium.launch({ headless: true, executablePath });

async function loaded(p) {
  await p.waitForFunction(() => (document.querySelector('main')?.innerText.length || 0) > 5 && !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main')?.innerText.includes('იტვირთება…'), null, { timeout: 60000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
}
async function go(p, route) {
  currentTag = route;
  const t0 = Date.now();
  await p.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => { await p.goto(base + route, { waitUntil: 'load', timeout: 60000 }); });
  const ms = Date.now() - t0;
  if (ms > 3000) slow.push({ route, ms });
  await loaded(p);
}
async function measure(p) {
  return p.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    return { overflow, text: document.querySelector('main')?.innerText.slice(0, 3000) || '' };
  });
}
const english = /Please |fill out|include an|valid email|Fill in|This field/i;
async function capture(p, name, { fullPage = true } = {}) {
  const m = await measure(p);
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, `${name}.png`), fullPage });
  report[name] = { overflow: m.overflow, englishText: english.test(m.text) };
  console.log('shot', name, JSON.stringify(report[name]));
}
function newPage(ctx) {
  return ctx.newPage().then(p => {
    p.on('console', msg => { if (['error', 'warning'].includes(msg.type())) consoleIssues.push({ tag: currentTag, type: msg.type(), text: safe(msg.text()).slice(0, 300) }); });
    p.on('pageerror', e => consoleIssues.push({ tag: currentTag, type: 'pageerror', text: safe(e.message).slice(0, 300) }));
    return p;
  });
}
async function login(p, key) {
  await go(p, '/account/');
  await p.locator('#login-email').fill(`demo-${key}@meetany.ge`);
  await p.locator('#login-password').fill(ledger.accounts[key].password);
  await p.locator('form button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('#login-email'), null, { timeout: 60000 });
  await loaded(p);
}
async function firstHref(p, route, selector) {
  await go(p, route);
  return p.locator(selector).first().getAttribute('href');
}
async function forEachViewport(p, fn) {
  for (const [w, h, tag] of viewports) {
    await p.setViewportSize({ width: w, height: h });
    await fn(tag, w, h);
  }
}

try {
  // ---- shared: find one real request + one real company (guest, read-only)
  const probe = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pp = await newPage(probe);
  const requestHref = await firstHref(pp, '/requests/', '.card-main-link');
  const companyHref = await firstHref(pp, '/companies/', '.card-main-link');
  assert(requestHref && companyHref, 'no demo request/company found to open');
  await probe.close();

  // ================= GUEST =================
  const guest = await browser.newContext();
  const g = await newPage(guest);
  await forEachViewport(g, async tag => {
    await go(g, '/'); await capture(g, `guest-home-${tag}`);
    await go(g, '/requests/'); await capture(g, `guest-requests-${tag}`);
    await go(g, '/companies/'); await capture(g, `guest-companies-${tag}`);
    await go(g, requestHref); await capture(g, `guest-request-detail-${tag}`);
    await go(g, companyHref); await capture(g, `guest-company-profile-${tag}`);
    await go(g, '/account/'); await capture(g, `guest-login-${tag}`);
    await g.locator('main .ma-tab', { hasText: 'რეგისტრაცია' }).click();
    await g.locator('#reg-name').waitFor({ timeout: 15000 }).catch(() => {});
    await capture(g, `guest-register-${tag}`);
    await go(g, '/terms/'); await capture(g, `guest-terms-${tag}`);
    await go(g, '/nosuch-page-xyz/'); await capture(g, `guest-404-${tag}`);
  });
  await guest.close();

  // ================= CLIENT (hotel) =================
  const clientCtx = await browser.newContext();
  const c = await newPage(clientCtx);
  await login(c, 'hotel');
  // own request with offers, if any
  await go(c, '/account/');
  const ownRows = await c.locator('.account-row__link').evaluateAll(els => els.map(e => e.getAttribute('href')));
  let ownDetailHref = ownRows[0] || null;
  for (const href of ownRows) {
    await go(c, href);
    const n = await c.locator('.ma-ocard').count();
    if (n > 0) { ownDetailHref = href; break; }
  }
  await forEachViewport(c, async tag => {
    await go(c, '/account/'); await capture(c, `client-account-overview-${tag}`);
    await go(c, '/account/?tab=saved'); await capture(c, `client-account-saved-${tag}`);
    await go(c, '/account/?tab=messages'); await capture(c, `client-account-messages-${tag}`);
    const convo = c.locator('.inbox-row').first();
    if (await convo.count().catch(() => 0)) {
      await convo.click().catch(() => {});
      await c.waitForTimeout(500);
      await capture(c, `client-account-conversation-${tag}`);
    }
    await go(c, '/account/?tab=profile'); await capture(c, `client-account-profile-${tag}`);
    await go(c, '/requests/new/');
    await c.locator('#new-request[open] #title').waitFor({ timeout: 30000 }).catch(() => {});
    await capture(c, `client-request-new-${tag}`, { fullPage: false });
    if (ownDetailHref) { await go(c, ownDetailHref); await capture(c, `client-request-detail-${tag}`); }
  });
  await clientCtx.close();

  // ================= COMPANY (supply) =================
  const companyCtx = await browser.newContext();
  const co = await newPage(companyCtx);
  await login(co, 'supply');
  // a request not owned by this company, to view the offer form
  await go(co, '/requests/');
  const otherHrefs = await co.locator('.card-main-link').evaluateAll(els => els.map(e => e.getAttribute('href')));
  let otherDetailHref = null;
  for (const href of otherHrefs) {
    await go(co, href);
    if (await co.locator('.ma-btn', { hasText: 'მიწერა' }).count()) { otherDetailHref = href; break; }
  }
  await forEachViewport(co, async tag => {
    await go(co, '/account/'); await capture(co, `company-account-overview-${tag}`);
    await go(co, '/account/?tab=profile'); await capture(co, `company-account-profile-${tag}`);
    await go(co, '/account/?tab=messages'); await capture(co, `company-account-messages-${tag}`);
    if (otherDetailHref) {
      await go(co, otherDetailHref);
      await capture(co, `company-request-detail-${tag}`);
      const msgBtn = co.locator('.ma-btn', { hasText: 'მიწერა' });
      if (await msgBtn.count()) {
        await msgBtn.click();
        await co.locator('.ma-chat').waitFor({ timeout: 15000 }).catch(() => {});
        await co.waitForTimeout(300);
        await capture(co, `company-request-chat-${tag}`, { fullPage: false });
        await co.keyboard.press('Escape').catch(() => {});
      }
    }
  });
  await companyCtx.close();

  // ================= ADMIN =================
  const adminCtx = await browser.newContext();
  const a = await newPage(adminCtx);
  await login(a, 'admin');
  await forEachViewport(a, async tag => {
    for (const t of ['requests', 'users', 'audit', 'contacts']) {
      await go(a, `/admin/?tab=${t}`);
      await capture(a, `admin-${t}-${tag}`);
    }
  });
  await adminCtx.close();

  fs.writeFileSync(path.join(out, 'final-shots-report.json'), JSON.stringify({ report, consoleIssues, slow }, null, 1));
  console.log('DONE', 'consoleIssues:', consoleIssues.length, 'slow:', slow.length);
} catch (err) {
  console.error('consoleIssues so far:', JSON.stringify(consoleIssues));
  throw new Error(safe(err.stack || err.message));
} finally {
  await browser.close();
}
