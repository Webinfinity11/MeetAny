// Local UI regressions with mocked read-only data; no remote data is changed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3029';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const profile = { id, role: 'company', company: 'კატალოგის მიღმა კომპანია', industry: 'food_fresh', city: 'tbilisi', offers: ['პროდუქტის მიწოდება'], seeks: [], service_cities: ['tbilisi'], created_at: '2026-01-01', phone: '+995 555 00 00 00', about: 'პროფილი იტვირთება უშუალოდ იდენტიფიკატორით.' };
const browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/get-session', r => r.fulfill({ json: null }));
  await context.route('**/token/anonymous', r => r.fulfill({ json: { token: 'header.eyJyb2xlIjoiYW5vbnltb3VzIn0.signature' } }));
  let mode = 'found', detailCalls = 0;
  await context.route('**/api/db/**', async route => {
    const url = new URL(route.request().url());
    const direct = url.pathname.endsWith('/profiles') && url.searchParams.get('id') === 'eq.' + id;
    if (direct) {
      detailCalls++;
      await new Promise(resolve => setTimeout(resolve, 250));
      return route.fulfill(mode === 'error' ? { status: 503, json: { message: 'offline' } } : { json: mode === 'found' ? [profile] : [] });
    }
    if (url.pathname.endsWith('/company_stats')) return route.fulfill({ json: [{ company_id: id, offers_sent: 4, offers_chosen: 1 }] });
    return route.fulfill({ json: [] });
  });
  for (const state of ['found', 'missing', 'error']) {
    mode = state;
    await page.goto(`${origin}/companies/view/?id=${id}`, { waitUntil: 'networkidle' });
    const expected = state === 'found' ? profile.company : state === 'missing' ? 'კომპანია ვერ მოიძებნა' : 'სერვისი დროებით მიუწვდომელია';
    await page.locator('main h1, main h2').filter({ hasText: expected }).waitFor();
    if (state === 'error') {
      mode = 'found';
      await page.getByRole('button', { name: 'ხელახლა ცდა', exact: true }).click();
      await page.getByRole('heading', { name: profile.company, exact: true }).waitFor();
    }
    console.log(`PASS company detail: ${state}${state === 'error' ? ' + retry' : ''}`);
  }
  assert(detailCalls >= 4);
  assert.deepEqual(errors, []);
  await context.close();
  // Real local API, anonymous RLS: cursor results stay after the last page's ID.
  const api = await browser.newContext();
  const response = await api.request.get(`${origin}/api/db/profiles?select=id&role=eq.company&order=id.asc&limit=1`);
  assert.equal(response.status(), 200);
  const [first] = await response.json();
  assert(first, 'Expected a public company fixture in the local environment');
  const next = await api.request.get(`${origin}/api/db/profiles?select=id&role=eq.company&order=id.asc&limit=1000&id=gt.${first.id}`);
  assert.equal(next.status(), 200);
  assert((await next.json()).every(row => row.id > first.id));
  const privateColumn = await api.request.get(`${origin}/api/db/profiles?select=email&order=id.asc&id=gt.${first.id}`);
  assert.equal(privateColumn.status(), 401);
  console.log('PASS live anonymous cursor + private-column protection');
  await api.close();
} finally { await browser.close(); }
