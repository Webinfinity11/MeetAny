// Onboarding before/after screenshots: every step at 1440 and 390, against in-browser fixtures only.
// No request reaches a database: /api/db/* and the auth endpoints are answered here; nothing is submitted.
// Run: NEON_AUTH_BASE_URL=http://127.0.0.1:3028/__qa_auth npx next dev --hostname 127.0.0.1 --port 3028
//      node qa/onboarding-v2-2026-10-13/shots.mjs before|after
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const label = process.argv[2] || 'after';
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3028';
const out = path.resolve('qa/onboarding-v2-2026-10-13', label);
await fs.mkdir(out, { recursive: true });
const id = '00000000-0000-4000-8000-000000000028';
const photo = origin + '/assets/photos/fresh-produce.jpg';
const seed = {
  id, role: 'company', blocked: false, verified: false, name: 'ნინო ბერიძე', company: 'სატესტო კომპანია', city: 'tbilisi', industry: 'logistics', phone: '+995 555 00 00 28', email: 'onboarding@example.test',
  about: 'ტვირთის გადაზიდვა საქართველოში და კავკასიის რეგიონში. ვმუშაობთ HoReCa და საცალო ქსელებთან.', offers: ['საბაჟო მომსახურება'], seeks: ['შეფუთვა'], service_cities: [], logo_url: null, gallery: [photo], address: 'ყაზბეგის გამზ. 12', lat: 41.7, lng: 44.8, created_at: '2026-10-01T00:00:00Z',
  account_intent: 'both', employee_band: '8-50', founded_year: 2018, markets: ['საქართველო'], languages: ['ქართული'], legal_name: 'შპს სატესტო კომპანია', registration_code: '405678123', legal_form: 'შპს', contact_position: 'დირექტორი', website: 'https://example.test', business_tags: ['HoReCa', 'დისტრიბუცია'], certificates: ['ISO სერტიფიკატი'], provide_categories: [], need_categories: ['packaging', 'cleaning'], verification_documents_status: 'not_submitted', onboarding_completed_at: null,
};
const steps = ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review'];
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const jwt = () => 'qa.' + Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', email: seed.email, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
const report = [];
for (const [width, height] of [[1440, 900], [390, 844], [360, 740]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'reduce', serviceWorkers: 'block', isMobile: width < 500, hasTouch: width < 500 });
  const errors = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = value => route.fulfill({ json: value });
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/__qa_auth/')) {
      const endpoint = url.pathname.slice('/__qa_auth/'.length);
      if (endpoint === 'get-session') return json({ user: { id, email: seed.email } });
      if (endpoint.startsWith('token')) return json({ token: jwt() });
      return route.abort();
    }
    if (url.pathname.startsWith('/api/db/')) {
      const fn = url.pathname.split('/').at(-1);
      if (fn === 'my_profile') return json(seed);
      if (fn === 'bootstrap') return json({ me: seed, companies: [], requests: [], offers: [], profiles: [], stats: null, counts: [], companyStats: [], contacts: [], capabilities: { engagement: true, emailDelivery: false }, engagement: { savedIds: [], savedRequestIds: [], unread: 0, notifications: { items: [], nextCursor: null }, emailOffers: false } });
      if (fn === 'company_products') return json([{ name: 'ყუთები და პალეტები', photoUrl: photo, note: 'ევრო-პალეტი, მუყაოს ყუთები' }]);
      if (fn === 'capabilities') return json({ engagement: true, emailDelivery: false });
      if (fn === 'engagement_state') return json({ savedIds: [], unread: 0, notifications: { items: [], nextCursor: null }, emailOffers: false });
      if (fn === 'unread_message_count') return json(0);
      if (fn === 'company_business_features' || fn === 'site_content') return json({});
      if (fn === 'verification_documents' || fn === 'my_verification_documents') return json([]);
      // Any write is refused: these shots never save.
      if (request.method() === 'POST' && /^(set_|update_|complete_|upload)/.test(fn)) return route.fulfill({ status: 400, json: { message: 'read-only fixture' } });
      return json([]);
    }
    if (url.pathname.startsWith('/api/analytics/')) return json({ enabled: false });
    if (url.pathname.startsWith('/api/')) return json({});
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const [i, step] of steps.entries()) {
    await page.goto(origin + '/onboarding/?step=' + step);
    await page.locator('main h1').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // The dev-only Next.js badge is not part of the page.
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.screenshot({ path: path.join(out, `${i + 1}-${step}-${width}.png`), fullPage: true });
    if (width < 500 && ['type', 'details'].includes(step)) await page.screenshot({ path: path.join(out, `${i + 1}-${step}-${width}-viewport.png`) });
    // Readability audit inside the onboarding content (header and dev chrome excluded).
    const audit = await page.evaluate(() => {
      const root = document.querySelector('main');
      const sizes = new Map(), small = new Set(), targets = new Set();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!node.textContent.trim() || !el.getClientRects().length || el.closest('[aria-hidden=true]')) continue;
        const style = getComputedStyle(el), size = parseFloat(style.fontSize);
        sizes.set(size, (sizes.get(size) || 0) + 1);
        if (size < 14) small.add(`${size}px "${node.textContent.trim().slice(0, 24)}"`);
      }
      for (const el of root.querySelectorAll('button, a, input, select, textarea, label[class]')) {
        const box = el.getBoundingClientRect();
        if (!box.width || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden' || (el.matches('input') && getComputedStyle(el).opacity === '0')) continue;
        if (box.height < 44 && !el.closest('label') ) targets.add(`${Math.round(box.height)}px ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}"`);
      }
      return { sizes: [...sizes.keys()].sort((a, b) => b - a), small: [...small], targets: [...targets] };
    });
    report.push(`${width} ${step}: overflow ${overflow}; sizes ${audit.sizes.join('/')}${audit.small.length ? '; <14: ' + audit.small.join(', ') : ''}${audit.targets.length ? '; <44: ' + audit.targets.join(', ') : ''}`);
  }
  report.push(`${width} console errors: ${errors.length}${errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : ''}`);
  await context.close();
}
await browser.close();
console.log(report.join('\n'));
