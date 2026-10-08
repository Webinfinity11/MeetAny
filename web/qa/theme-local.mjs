// Browser-only fixtures: no login, database writes or uploaded test files.
// Run from web: QA_ORIGIN=http://localhost:3210 node qa/theme-local.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.QA_ORIGIN || 'http://localhost:3210';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local preview required');
const output = path.resolve('qa/shots/theme-local');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const id = '00000000-0000-4000-8000-000000000081';
const buyer = '00000000-0000-4000-8000-000000000082';
const requestId = '00000000-0000-4000-8000-000000000083';
const offerId = '00000000-0000-4000-8000-000000000084';
const dealId = '00000000-0000-4000-8000-000000000085';
const now = new Date().toISOString();
const profile = {
  id, role: 'company', name: 'მარიამ კაპანაძე', company: 'ლურჯი სტუდია', email: 'preview-theme@meetany.ge', phone: '+995 555 00 00 81',
  city: 'tbilisi', industry: 'other', verified: true, blocked: false, about: 'ბიზნესის მომსახურება და პროდუქტის მიწოდება.',
  offers: ['დიზაინი'], seeks: [], service_cities: ['tbilisi'], gallery: [], logo_url: null, created_at: now,
  account_intent: 'both', employee_band: '1-7', founded_year: 2020, markets: ['საქართველო'], languages: ['ქართული'],
  legal_name: 'შპს ლურჯი სტუდია', registration_code: '405678181', legal_form: 'შპს', contact_position: 'დირექტორი',
  website: null, business_tags: [], certificates: [], provide_categories: ['other'], need_categories: ['other'], verification_documents_status: 'not_submitted',
};
const request = { id: requestId, owner_id: buyer, title: 'ბრენდირებული ქაღალდის ჭიქები', body: 'გვჭირდება ბეჭდვა და ქაღალდის ჭიქების მიწოდება თბილისში.', photo_url: '/assets/photos/fresh-produce.jpg', category: 'other', city: 'tbilisi', quantity: 2000, unit: 'pcs', status: 'open', created_at: now, expires_at: '2099-01-01T00:00:00Z' };
const offer = { id: offerId, request_id: requestId, company_id: id, body: 'ქაღალდის ჭიქების ხარისხიანი ბეჭდვა და მიწოდება.', price: 1, price_type: 'unit', delivery_days: 10, vat_included: true, delivery_included: true, status: 'sent', created_at: now, updated_at: now };
const deal = { id: dealId, request_id: requestId, offer_id: offerId, buyer_id: buyer, supplier_id: id, stage: 'selected', revision: 1, selected_at: now, quantity: 2000, unit: 'pcs', total_price: 2000, delivery_days: 10, delivery_date: null, delivery_place: 'თბილისი', payment_terms: 'მიწოდებისას', includes: ['ბეჭდვა'], events: [] };
const report = { checks: [], views: [], pageErrors: [], consoleErrors: [], unexpected: [] };
const check = (value, label) => { assert(value, label); report.checks.push(label); };
function token(actor) { return `qa.${Buffer.from(JSON.stringify({ sub: actor || id, role: actor ? 'authenticated' : 'anonymous', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`; }
async function fixture(role = 'guest', saved) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  if (saved !== undefined) await context.addInitScript(value => localStorage.setItem('meetany.theme', value), saved);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), fn = url.pathname.split('/').at(-1);
    const actor = role === 'guest' ? null : role === 'client' ? buyer : id;
    const json = data => route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' } });
    if (url.hostname.includes('neonauth') || url.pathname.startsWith('/__qa_auth/')) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type' } });
      if (fn === 'get-session') return json(actor ? { user: { id: actor, email: profile.email } } : null);
      if (fn === 'token' || fn === 'anonymous') return json({ token: token(actor) });
      report.unexpected.push(url.pathname); return route.abort();
    }
    if (req.resourceType() === 'image' && url.hostname.endsWith('.public.blob.vercel-storage.com')) return route.fulfill({ contentType: 'image/jpeg', body: await fs.readFile(path.resolve('public/assets/photos/fresh-produce.jpg')) });
    if (url.origin !== origin) { report.unexpected.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith('/api/db/')) {
      if (fn === 'my_profile') return json(actor ? { ...profile, id: actor, role } : []);
      if (fn === 'profiles') return json(url.searchParams.get('role') === 'eq.company' ? [profile] : [profile, { ...profile, id: buyer, role: 'client', company: 'Coffee House', name: 'ანა კაპანაძე' }]);
      if (fn === 'requests') return json([request]);
      if (fn === 'offers') return json([offer]);
      if (fn === 'capabilities') return json({ engagement: true, emailDelivery: false });
      if (fn === 'engagement_state') return json({ savedIds: [], unread: 0, notifications: { items: [], nextCursor: null }, emailOffers: false });
      if (fn === 'unread_message_count') return json(0);
      if (fn === 'site_content') return json({});
      if (fn === 'get_deal') return json(deal);
      if (fn === 'get_deal_contact') return json([{ ...profile, id: role === 'company' ? buyer : id }]);
      if (fn === 'compare_offers') return json([{ ...offer, company: profile.company, city: 'tbilisi', verified: true, total_gel: 2000, best_price: true, fastest: true, eligible: true, commercial_terms: [] }]);
      if (['company_business_features', 'company_products', 'company_stats', 'offer_counts', 'list_my_conversations', 'list_messages', 'company_distribution_profiles', 'company_reviews', 'my_company_review_targets', 'list_matching'].includes(fn)) return json([]);
      report.unexpected.push(fn); return route.abort();
    }
    if (url.pathname.startsWith('/api/analytics/')) return json({ enabled: false });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  return { context, page };
}
async function ready(page, route) {
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'ლურჯი თემა', exact: true }).waitFor();
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('.ma-header') || !!document.querySelector('.ma-header__login,.ma-header__account'));
  await page.evaluate(() => document.fonts.ready);
}
async function view(page, name, theme, width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const buttons = [...document.querySelectorAll('.ma-btn--primary:not(:disabled):not([aria-disabled=true])')].filter(b => b.getBoundingClientRect().width);
    const ctaLabels = [...document.querySelectorAll('.ma-header__cta span')];
    return { theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth,
      compactHeader: innerWidth >= 768 || ctaLabels.every(el => !el.getBoundingClientRect().width),
      primary: root.getPropertyValue('--action-strong').trim(), buttons: buttons.map(b => ({ label: b.textContent, color: getComputedStyle(b).backgroundColor })) };
  });
  check(state.theme === theme && !state.overflow, `${name}: ${theme}, width ${width}, no overflow`);
  check(state.compactHeader, `${name}: mobile header CTA stays inside its button`);
  if (theme === 'blue') check(state.buttons.every(b => b.color === 'rgb(37, 99, 235)'), `${name}: primary buttons use blue`);
  const file = `${name}-${theme}-${width}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: true, animations: 'disabled' });
  report.views.push(file);
}
try {
  const { context, page } = await fixture();
  await ready(page, '/');
  const toggle = page.getByRole('button', { name: 'ლურჯი თემა', exact: true });
  check(await toggle.getAttribute('aria-pressed') === 'false', 'Fresh visit uses classic');
  await toggle.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.ma-theme-toggle')?.getAttribute('aria-pressed') === 'true');
  check(await toggle.getAttribute('aria-pressed') === 'true', 'Keyboard enables blue theme');
  check(await page.evaluate(() => localStorage.getItem('meetany.theme')) === 'blue', 'Choice is persisted');
  await page.getByRole('navigation', { name: 'მთავარი ნავიგაცია' }).getByRole('link', { name: 'კომპანიები', exact: true }).click();
  await page.waitForURL('**/companies/');
  check(await toggle.getAttribute('aria-pressed') === 'true', 'Next navigation preserves theme');
  await page.reload(); await toggle.waitFor();
  await page.waitForFunction(() => document.querySelector('.ma-theme-toggle')?.getAttribute('aria-pressed') === 'true');
  check(await toggle.getAttribute('aria-pressed') === 'true', 'Reload restores theme');
  const other = await context.newPage(); await other.goto(origin + '/account/');
  await other.getByRole('button', { name: 'ლურჯი თემა', exact: true }).waitFor();
  await other.waitForFunction(() => document.querySelector('.ma-theme-toggle')?.getAttribute('aria-pressed') === 'true');
  await toggle.click();
  await other.waitForFunction(() => document.documentElement.dataset.theme === 'classic');
  check(await other.getByRole('button', { name: 'ლურჯი თემა' }).getAttribute('aria-pressed') === 'false', 'Other tabs synchronize');
  await other.close();
  for (const theme of ['classic', 'blue']) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) await toggle.click();
    for (const [name, route] of [['home', '/'], ['requests', '/requests/'], ['companies', '/companies/'], ['how', '/how-it-works/'], ['auth', '/account/'], ['post', '/requests/new/'], ['terms', '/terms/'], ['ideas', '/ideas/']]) {
      await ready(page, route);
      for (const width of [1440, 1200, 390]) await view(page, name, theme, width);
    }
  }
  await context.close();
  for (const role of ['company', 'client']) {
    const f = await fixture(role, 'blue');
    const routes = role === 'company' ? [['account', '/account/'], ['matching', '/matching/'], ['offer', `/offers/new/?requestId=${requestId}`], ['onboard', '/onboarding/?step=type'], ['deal', `/deals/view/?id=${dealId}`]] : [['client-account', '/account/?tab=requests'], ['compare', `/requests/compare/?id=${requestId}`]];
    for (const [name, route] of routes) {
      await ready(f.page, route);
      for (const width of [1440, 1200, 390]) await view(f.page, name, 'blue', width);
    }
    await f.context.close();
  }
  const stored = await fixture('guest', 'blue');
  // Hold hydration: the saved palette must already be set by the initial HTML.
  stored.page.removeAllListeners('console'); // Blocked hydration requests are intentional in this one case.
  await stored.context.route('**/_next/static/**/*.js', route => route.abort());
  await stored.page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  check(await stored.page.evaluate(() => document.documentElement.dataset.theme) === 'blue', 'Saved blue theme is applied before hydration');
  await stored.context.close();
  const invalid = await fixture('guest', 'invalid'); await ready(invalid.page, '/');
  check(await invalid.page.evaluate(() => document.documentElement.dataset.theme) === 'classic', 'Invalid storage uses classic');
  await invalid.context.close();
  const denied = await fixture();
  await denied.context.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await ready(denied.page, '/'); await denied.page.getByRole('button', { name: 'ლურჯი თემა' }).click();
  check(await denied.page.evaluate(() => document.documentElement.dataset.theme) === 'blue', 'Toggle works with storage blocked');
  await denied.context.close();
  check(report.pageErrors.length === 0 && report.consoleErrors.length === 0 && report.unexpected.length === 0, 'No runtime/console errors or unexpected API calls');
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS: ${report.checks.length} checks, ${report.views.length} views; database writes 0`);
} catch (error) {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ...report, failure: error.message }, null, 2));
  console.error(error.message); process.exitCode = 1;
} finally { await browser.close(); }
