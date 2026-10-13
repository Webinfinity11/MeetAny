// Interaction checks on :3001 with saved sessions from qa-full-0930.mjs. Read-only except save/unsave toggle (restored).
import fs from 'node:fs';
import { chromium } from 'playwright';
const O = 'http://localhost:3001', OUT = 'qa/shots/qa-full-0930';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const res = [];
const log = (k, v) => { res.push({ k, v }); console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v)); };
async function ctxFor(role, vp) { const f = `/tmp/qa0930-${role}.json`; return await browser.newContext({ viewport: vp, ...(role !== 'guest' && fs.existsSync(f) ? { storageState: f } : {}) }); }
const D = { width: 1440, height: 1000 }, M = { width: 390, height: 844 };
const main = p => p.locator('main').innerText();
const ready = async p => { await p.waitForFunction(() => !!document.querySelector('main')?.innerText.trim() && !document.querySelector('main [aria-busy="true"]'), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800); };
const step = async (name, fn) => { try { await fn(); } catch (e) { log(name + ' EXC', e.message.slice(0, 160)); } };

// guest
{ const c = await ctxFor('guest', D), p = await c.newPage();
  await step('g.home.search', async () => { await p.goto(O + '/'); await ready(p); const inp = p.locator('main input[type="search"], main input[role="combobox"], main input').first(); await inp.click(); await inp.fill('ტექ'); await p.waitForTimeout(1200); log('g.home.suggestions', await p.locator('[role="listbox"] [role="option"]').count()); await p.screenshot({ path: `${OUT}/flow-g-home-search.png` }); await inp.press('Enter'); await p.waitForTimeout(1500); log('g.home.search.url', p.url().replace(O, '')); });
  await step('g.companies.filter', async () => { await p.goto(O + '/companies/'); await ready(p); const before = await p.locator('a[href*="/companies/view"]').count(); await p.locator('aside button, aside a').filter({ hasText: 'ლოგისტიკა' }).first().click(); await p.waitForTimeout(1200); log('g.companies.filter', { before, after: await p.locator('a[href*="/companies/view"]').count(), url: p.url().replace(O, ''), heading: (await p.locator('main h2').first().innerText().catch(() => '')) }); });
  await step('g.companies.sort', async () => { const btn = p.getByRole('combobox').or(p.locator('button[aria-haspopup="listbox"]')); log('g.companies.sortControls', await btn.count()); await btn.last().click(); await p.waitForTimeout(400); log('g.companies.sortOptions', await p.getByRole('option').allInnerTexts()); await p.keyboard.press('Escape'); });
  await step('g.companies.map', async () => { await p.goto(O + '/companies/'); await ready(p); await p.getByRole('button', { name: /რუკა/ }).click(); await p.waitForTimeout(3000); log('g.companies.map', { leaflet: await p.locator('.leaflet-container').count(), markers: await p.locator('.leaflet-marker-icon').count(), url: p.url().replace(O, '') }); await p.screenshot({ path: `${OUT}/flow-g-companies-map.png` }); });
  await step('g.company.call', async () => { await p.goto(O + '/companies/view/?id=3d12ff1f-0d72-4a53-a92f-1830cfd5b290'); await ready(p); const b = p.getByRole('button', { name: /დარეკვა/ }).or(p.getByRole('link', { name: /დარეკვა/ })).first(); const before = await b.innerText(); await b.click(); await p.waitForTimeout(1500); log('g.company.call', { before: before.replace(/\s+/g, ' '), after: (await b.innerText().catch(() => '')).replace(/\s+/g, ' '), dialog: await p.getByRole('dialog').count(), url: p.url().replace(O, '') }); await p.screenshot({ path: `${OUT}/flow-g-company-call.png` }); });
  await step('g.company.save', async () => { await p.goto(O + '/companies/view/?id=3d12ff1f-0d72-4a53-a92f-1830cfd5b290'); await ready(p); await p.getByRole('button', { name: /შენახვა/ }).first().click(); await p.waitForTimeout(1500); log('g.company.save', { url: p.url().replace(O, ''), dialog: await p.getByRole('dialog').count(), loginForm: await p.locator('#login-email').count(), toast: (await p.locator('[role="status"],[role="alert"]').allInnerTexts()).join('|').slice(0, 120) }); await p.screenshot({ path: `${OUT}/flow-g-company-save.png` }); });
  await step('g.request.chat', async () => { await p.goto(O + '/requests/view/?id=fe713e7f-9ac8-40b1-95a7-c9231316d9ca'); await ready(p); log('g.request.buttons', (await p.locator('main button, main a.ma-btn').allInnerTexts()).map(s => s.replace(/\s+/g, ' ')).filter(Boolean).slice(0, 12)); });
  await step('g.requests.new', async () => { await p.goto(O + '/requests/new/'); await ready(p); log('g.requests.new', { url: p.url().replace(O, ''), text: (await main(p)).replace(/\s+/g, ' ').slice(0, 220) }); });
  await step('g.404', async () => { await p.goto(O + '/nope/'); await p.waitForTimeout(800); log('g.404', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160)); });
  await step('g.mobile.menu', async () => { await p.setViewportSize(M); await p.goto(O + '/'); await ready(p); const burger = p.locator('header button[aria-label*="მენ"], header button[aria-expanded]').first(); await burger.click(); await p.waitForTimeout(600); log('g.mobile.menu', (await p.locator('header, [role="dialog"]').allInnerTexts()).join('|').replace(/\s+/g, ' ').slice(0, 260)); await p.screenshot({ path: `${OUT}/flow-g-mobile-menu.png` }); });
  await c.close(); }

// user
{ const c = await ctxFor('owner_user', D), p = await c.newPage();
  await step('u.requestnew.validation', async () => { await p.goto(O + '/requests/new/'); await ready(p); await p.locator('main form button[type="submit"], main button[type="submit"]').first().click(); await p.waitForTimeout(800); log('u.requestnew.validation', { errors: await p.locator('[role="alert"], .ma-field__error, [aria-invalid="true"]').count(), text: (await main(p)).replace(/\s+/g, ' ').slice(0, 300) }); await p.screenshot({ path: `${OUT}/flow-u-requestnew.png`, fullPage: true }); });
  await step('u.save.toggle', async () => { await p.goto(O + '/companies/view/?id=3d12ff1f-0d72-4a53-a92f-1830cfd5b290'); await ready(p); const b = p.getByRole('button', { name: /შენახვა|შენახულია/ }).first(); const t0 = await b.innerText(); await b.click(); await p.waitForTimeout(1500); const t1 = await b.innerText(); await b.click(); await p.waitForTimeout(1500); log('u.save.toggle', { t0, t1, t2: await b.innerText() }); });
  await step('u.header', async () => { await p.goto(O + '/'); await ready(p); await p.locator('header [aria-controls="ma-account-menu"]').click(); await p.waitForTimeout(400); log('u.menu', (await p.getByRole('menuitem').allInnerTexts())); await p.screenshot({ path: `${OUT}/flow-u-menu.png` }); });
  await step('u.request.detail.own', async () => { await p.goto(O + '/account/?tab=requests'); await ready(p); log('u.account.requests', (await main(p)).replace(/\s+/g, ' ').slice(0, 400)); });
  await step('u.messages', async () => { await p.goto(O + '/account/?tab=messages'); await ready(p); log('u.account.messages', (await main(p)).replace(/\s+/g, ' ').slice(0, 300)); });
  await step('u.admin.denied', async () => { await p.goto(O + '/admin/'); await ready(p); log('u.admin', (await main(p)).replace(/\s+/g, ' ').slice(0, 160)); });
  await c.close(); }

// company
{ const c = await ctxFor('owner_company', D), p = await c.newPage();
  await step('c.business', async () => { await p.goto(O + '/account/?tab=business'); await p.waitForFunction(() => !/იტვირთება/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 30000 }).catch(() => log('c.business', 'STILL LOADING after 30s')); await p.waitForTimeout(500); log('c.business', (await main(p)).replace(/\s+/g, ' ').slice(0, 700)); await p.screenshot({ path: `${OUT}/flow-c-business-d.png`, fullPage: true }); await p.setViewportSize(M); await p.reload(); await p.waitForTimeout(4000); await p.screenshot({ path: `${OUT}/flow-c-business-m.png`, fullPage: true }); });
  await step('c.offers', async () => { await p.setViewportSize(D); await p.goto(O + '/account/?tab=offers'); await ready(p); log('c.offers', (await main(p)).replace(/\s+/g, ' ').slice(0, 300)); });
  await step('c.profile', async () => { await p.goto(O + '/account/?tab=profile'); await ready(p); log('c.profile.fields', await p.locator('main input, main textarea, main select').count()); await p.screenshot({ path: `${OUT}/flow-c-profile.png`, fullPage: true }); });
  await step('c.request.offer', async () => { await p.goto(O + '/requests/view/?id=fe713e7f-9ac8-40b1-95a7-c9231316d9ca'); await ready(p); log('c.request.buttons', (await p.locator('main button, main a.ma-btn').allInnerTexts()).map(s => s.replace(/\s+/g, ' ')).filter(Boolean).slice(0, 12)); await p.screenshot({ path: `${OUT}/flow-c-request.png` }); });
  await c.close(); }

// admin
{ const c = await ctxFor('owner_admin', D), p = await c.newPage();
  for (const t of ['plans', 'reviews', 'overview']) await step('a.' + t, async () => { await p.goto(O + '/admin/?tab=' + t); await p.waitForFunction(() => !/იტვირთება/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 25000 }).catch(() => {}); await p.waitForTimeout(600); log('a.' + t, (await main(p)).replace(/\s+/g, ' ').slice(0, 350)); await p.screenshot({ path: `${OUT}/flow-a-${t}.png` }); });
  await c.close(); }
fs.writeFileSync(OUT + '/flows.json', JSON.stringify(res, null, 1)); await browser.close();
