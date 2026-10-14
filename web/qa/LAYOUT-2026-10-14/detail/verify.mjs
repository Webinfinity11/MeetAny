// Local-only layout, preview, overlays and optional offer → comparison → deal flow.
// BASE=http://127.0.0.1:3443 AUTH=http://127.0.0.1:4443 MUTATE=1 node qa/LAYOUT-2026-10-14/detail/verify.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const BASE = process.env.BASE || 'http://127.0.0.1:3443', AUTH = process.env.AUTH || 'http://127.0.0.1:4443';
for (const value of [BASE, AUTH]) assert(['127.0.0.1', 'localhost'].includes(new URL(value).hostname));
const OUT = 'qa/LAYOUT-2026-10-14/detail';
const request = '0101aaac-f4e6-4ed4-b1bd-5a52e0942db9', own = '012ca27c-5913-46e2-899f-254785bd3d23';
const open = 'f6723c6b-823d-4f9d-9297-20cdfd86e4ab', flow = process.env.FLOW_REQUEST_ID || 'ec2c93bc-41d1-4121-a992-6ffbd0c73d6d';
const ids = { client: 'bacf1572-7493-4ac9-bfc7-95719e911c4c', company: '74cc28fc-47de-45cb-9563-93735b86855e' };
const result = { pages: [], overlays: [], checks: [], pageErrors: [], failures: [] };
const resultName = process.env.RESULT_NAME || (process.env.ONLY_FLOW === '1' ? 'flow' : process.env.ONLY_OVERLAY === '1' ? 'overlay' : 'verify');
assert(/^[a-z-]+$/.test(resultName));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
async function context(role, width) {
  const jwt = role === 'guest' ? null : (await (await fetch(`${AUTH}/__mint?sub=${ids[role]}`)).json()).token;
  const c = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await c.route(`${AUTH}/**`, route => route.request().url().includes('/.well-known/') ? route.continue() : route.fulfill({ headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'set-auth-jwt', ...(jwt ? { 'set-auth-jwt': jwt } : {}) }, json: route.request().url().includes('/get-session') ? (jwt ? { user: { id: ids[role], email: 'qa@local.test', name: 'QA' } } : null) : { token: jwt } }));
  await c.route(/https:\/\/.*\/auth\//, r => r.abort());
  await c.addInitScript(signed => { try { if (signed) localStorage.setItem('meetany.session', '1'); } catch {} }, !!jwt);
  c.on('page', p => p.on('pageerror', e => result.pageErrors.push({ role, width, url: p.url(), error: e.message })));
  return c;
}
async function visit(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.locator('main h1').waitFor();
  await page.waitForFunction(() => document.querySelector('button[aria-controls="ma-account-menu"]') || document.querySelector('header a[href="/account/"]')?.textContent.includes('შესვლა'), null, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForFunction(() => { const text = document.querySelector('main')?.innerText || ''; return text && !text.includes('ანგარიში მოწმდება') && !text.includes('იტვირთება'); });
  await page.waitForFunction(() => ![...document.querySelectorAll('main [aria-busy=true],main [class*=skeleton i],main .ma-skel')].some(e => e.getClientRects().length));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
async function overlay(page, role, width, slug) {
  await page.evaluate(() => scrollTo(0, 0));
  for (const label of ['შეტყობინებები', 'პროფილი']) {
    const opener = page.locator(label === "შეტყობინებები" ? 'header button[aria-controls="notification-list"]' : 'header button[aria-controls="ma-account-menu"]');
    if (!await opener.isVisible()) continue;
    await opener.click(); await page.waitForTimeout(200);
    const menuId = label === 'შეტყობინებები' ? 'notification-list' : 'ma-account-menu';
    await page.locator(`#${menuId}`).waitFor({ state: 'visible' });
    const hits = await page.evaluate(menuId => {
      const open = document.getElementById(menuId);
      if (!open) throw new Error('Menu did not open');
      const r = open.getBoundingClientRect(), hits = new Set();
      for (let y = r.top + 8; y < Math.min(r.bottom - 4, innerHeight); y += 10) for (let x = r.left + 8; x < r.right - 4; x += 24) {
        const e = document.elementFromPoint(x, y); if (e && !open.contains(e) && !e.closest('header[class*=ma-header]')) hits.add(`${e.tagName}.${String(e.className).slice(0, 40)}`);
      }
      return [...hits];
    }, menuId);
    result.overlays.push({ role, width, slug, label, hits }); assert.equal(hits.length, 0, `${slug} ${width} overlay`);
    await page.keyboard.press('Escape');
  }
}
async function preview(page, width) {
  await page.locator('#make-offer-form').waitFor();
  assert.equal(await page.locator('button[form="make-offer-form"]').count(), 1);
  assert.equal(await page.locator('main aside button.ma-btn--primary').count(), 0);
  assert.equal(await page.locator('[data-form-footer] button[form="make-offer-form"]').count(), 1);
  await page.locator('button[form="make-offer-form"]:visible').click();
  await page.waitForFunction(() => document.activeElement?.id === 'of-price');
  await page.locator('#of-price').fill('1200');
  await page.locator('#of-deliveryDays').click();
  await page.getByRole('option', { name: '7 დღე', exact: true }).click();
  await page.locator('#of-body').fill('სატესტო შეთავაზება: მიწოდება შეთანხმებული პირობებით.');
  if (width < 1024) await page.locator('aside > details > summary').click();
  const panel = page.getByRole('region', { name: 'შეთავაზების წინასწარი ხედი', exact: true });
  assert.match(await panel.innerText(), /1[\s,]?200/);
  assert.match(await panel.innerText(), /7 დღე/);
  assert.match(await panel.innerText(), /სატესტო შეთავაზება/);
  await page.getByRole('button', { name: 'ერთეულის', exact: true }).click();
  assert.match(await panel.innerText(), /96[\s,]?000/);
  await page.getByRole('button', { name: 'შეთანხმებით', exact: true }).click();
  assert.match(await panel.innerText(), /ფასი შეთანხმებით/);
  if (width < 1024) await page.locator('aside > details > summary').click();
  result.checks.push({ name: 'single-footer-submit-validation-and-live-preview', width, passed: true });
}
try {
  if (process.env.ONLY_FLOW !== '1') for (const role of (process.env.ROLES || 'guest,client,company').split(',')) for (const width of (process.env.WIDTHS || '1440,980,390,360,320').split(',').map(Number)) {
    const c = await context(role, width), page = await c.newPage();
    const routes = role === 'guest' ? [['request-view', `/requests/view/?id=${request}`]] : role === 'client' ? [['request-view-own', `/requests/view/?id=${own}`], ['compare-offers', `/requests/compare/?id=${request}`], ['deal-view', '/deals/view/?id=8e6766e1-b67e-408a-a8c0-e9e6944e115b']] : [['request-view-company', `/requests/view/?id=${open}`], ['offers-new-form', `/offers/new/?requestId=${open}`]];
    for (const [slug, path] of routes) {
      await visit(page, path);
      if (process.env.ONLY_OVERLAY === '1') { await overlay(page, role, width, slug); continue; }
      if (slug === 'compare-offers') await page.locator('table').waitFor();
      if (slug === 'request-view-own') { await page.locator('.request-workspace[data-owner]').waitFor(); await page.locator('.request-management').waitFor(); }
      if (slug === 'offers-new-form') await page.locator('#make-offer-form').waitFor();
      const metrics = await page.evaluate(() => ({ overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), scrollHeight: document.documentElement.scrollHeight, h1: Math.round(document.querySelector('main h1').getBoundingClientRect().top), panel: [...document.querySelectorAll('main aside')].map(e => ({ width: Math.round(e.getBoundingClientRect().width), position: getComputedStyle(e).position })), formWidth: document.querySelector('#make-offer-form')?.getBoundingClientRect().width }));
      result.pages.push({ role, width, slug, ...metrics }); assert.equal(metrics.overflow, 0, `${slug} ${width} overflow`);
      if (slug.startsWith('request-view') && width <= 390) assert(metrics.h1 <= 120, `${slug} title ${metrics.h1}`);
      if (slug === 'compare-offers') {
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        const serious = await page.evaluate(async () => (await axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)));
        assert.deepEqual(serious, []); result.checks.push({ name: 'compare-axe', width, passed: true });
        if (width !== 320 && width !== 980) await page.screenshot({ path: `${OUT}/after/client-compare-offers-${width}.png`, fullPage: true });
      }
      if (slug === 'offers-new-form') await preview(page, width);
      if (role !== 'guest') await overlay(page, role, width, slug);
      console.log(`${role} ${width} ${slug}: ${metrics.scrollHeight}, overflow ${metrics.overflow}`);
      fs.writeFileSync(`${OUT}/${resultName}.json`, JSON.stringify(result, null, 2) + '\n');
    }
    if (process.env.ONLY_OVERLAY !== '1' && role === 'client' && width === 390) {
      await visit(page, '/requests/view/?id=9bb4fc42-e88b-4fe9-bc80-13d142899365');
      await page.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
      const editor = page.locator('dialog[open]'); await editor.waitFor();
      await editor.locator('input,textarea').first().waitFor();
      await page.keyboard.press('Escape'); await editor.waitFor({ state: 'hidden' });
      result.checks.push({ name: 'request-editor-open-close', width, passed: true });
    }
    if (process.env.ONLY_OVERLAY !== '1' && role === 'company' && width === 390) {
      await visit(page, `/offers/new/?requestId=${request}`);
      assert.equal(await page.locator('main h1').innerText(), 'შეთავაზების რედაქტირება');
      assert.equal(await page.locator('button[form="make-offer-form"]:visible').innerText(), 'შეთავაზების განახლება');
      await page.screenshot({ path: `${OUT}/after/company-offers-edit-390.png`, fullPage: true });
      result.checks.push({ name: 'editing-layout', width, passed: true });
    }
    await c.close();
  }
  if (process.env.MUTATE === '1') {
    const company = await context('company', 1440), client = await context('client', 390);
    const cp = await company.newPage(), bp = await client.newPage();
    await visit(cp, `/offers/new/?requestId=${flow}`);
    await cp.locator('#of-price').fill('2400');
    await cp.locator('#of-deliveryDays').click(); await cp.getByRole('option', { name: '7 დღე', exact: true }).click();
    const body = `P8 ადგილობრივი QA: მოთხოვნის შესრულება შეთანხმებით ${Date.now()}`;
    await cp.locator('#of-body').fill(body);
    await cp.locator('button[form="make-offer-form"]:visible').click();
    await cp.locator('dialog[open]').waitFor();
    result.checks.push({ name: 'send-offer', request: flow, passed: true });
    await visit(cp, `/offers/new/?requestId=${flow}`);
    assert.match(await cp.locator('main h1').innerText(), /რედაქტირება/);
    await cp.locator('#of-body').fill(body + ' — განახლებულია');
    await cp.locator('button[form="make-offer-form"]:visible').click();
    await cp.waitForURL(`**/requests/view/?id=${flow}`);
    result.checks.push({ name: 'edit-offer', passed: true });
    await visit(bp, `/requests/compare/?id=${flow}`);
    await bp.getByRole('article').filter({ hasText: body }).waitFor();
    result.checks.push({ name: 'offer-visible-in-comparison', passed: true });
    await visit(bp, `/requests/view/?id=${flow}`);
    await bp.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).first().click();
    const dialog = bp.locator('dialog[open]'); await dialog.waitFor();
    assert(await dialog.evaluate(e => e.contains(document.activeElement)));
    await bp.screenshot({ path: `${OUT}/after/client-choose-offer-flow-390.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'შეთავაზების არჩევა', exact: true }).click();
    await bp.waitForURL('**/deals/view/?id=*'); await bp.getByRole('heading', { name: 'არჩეული შეთავაზება', exact: true }).waitFor();
    const dealUrl = bp.url(); result.checks.push({ name: 'choose-offer-sheet-to-deal', url: dealUrl, passed: true });
    await bp.getByRole('button', { name: 'ჩატის გახსნა', exact: true }).click();
    await bp.getByRole('button', { name: 'პირობები შეთანხმებულია', exact: true }).waitFor();
    result.checks.push({ name: 'deal-selected-to-discuss', passed: true });
    await bp.screenshot({ path: `${OUT}/after/client-deal-flow-390.png`, fullPage: true });
    await company.close(); await client.close();
  }
  assert.equal(result.pageErrors.length, 0);
} catch (error) { result.failures.push({ error: error.stack }); console.error(error); process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync(`${OUT}/${resultName}.json`, JSON.stringify(result, null, 2) + '\n'); }
