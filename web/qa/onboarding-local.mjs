// Default: isolated in-memory fixtures. --real-local: bounded local PostgreSQL + JWKS + owned dev runtime.
// Run against: NEON_AUTH_BASE_URL=http://127.0.0.1:3028/__qa_auth npm run dev -- --hostname 127.0.0.1 --port 3028
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { categories } from '../app/lib/categories-data.js';
async function runMocked() {
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3028';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local origin required');
const out = path.resolve('qa/shots/onboarding-local');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const timer = setTimeout(() => { console.error('FAIL: 180 second suite limit'); void browser.close(); process.exitCode = 1; }, 180000);
const id = '00000000-0000-4000-8000-000000000028';
const photo = origin + '/assets/photos/fresh-produce.jpg';
const seed = {
  id, role: 'company', blocked: false, verified: false, name: 'ირაკლი ხინიკაძე', company: 'Coffee House Georgia', city: 'tbilisi', industry: 'catering', phone: '+995 555 00 00 28', email: 'onboarding@example.test',
  about: 'ყავის ქსელი 8 ფილიალით საქართველოში. ვაწვდით ყავის მარცვლებს და HoReCa პროდუქციას სხვა ბიზნესებსაც.', offers: ['ყავის მარცვლები'], seeks: ['შეფუთვა'], service_cities: ['batumi'], logo_url: null, gallery: [photo], address: 'ყაზბეგის გამზ. 12', lat: 41.7, lng: 44.8, created_at: '2026-10-01T00:00:00Z',
  account_intent: 'both', employee_band: '8-50', founded_year: 2020, markets: ['საქართველო'], languages: ['ქართული'], legal_name: 'შპს ქოფი ჰაუს ჯორჯია', registration_code: '405678123', legal_form: 'შპს', contact_position: 'დირექტორი', website: 'https://example.test', business_tags: ['ყავა და სასმელები', 'HoReCa', 'კვების მომსახურება'], certificates: ['ISO 22000', 'HACCP'], provide_categories: ['catering', 'beverages', 'packaging'], need_categories: ['food_fresh', 'packaging', 'cleaning'], verification_documents_status: 'pending',
};
const detailKeys = ['account_intent', 'employee_band', 'founded_year', 'markets', 'languages', 'legal_name', 'registration_code', 'legal_form', 'contact_position', 'website', 'business_tags', 'certificates'];
const steps = ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review'];
const errors = [], unexpected = [], reports = [];
function jwt(role) { return 'qa.' + Buffer.from(JSON.stringify({ sub: id, role, email: seed.email, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'; }
async function fixture(role = 'company', registration = false) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const state = { profile: structuredClone({ ...seed, role }), products: [{ name: 'ყავის მარცვლები', photoUrl: photo, note: 'არაბიკა HoReCa-სთვის' }], signedIn: role !== 'guest', registration, hasProfile: !registration, fail: '', calls: [] };
  if (registration) state.signedIn = false;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), body = request.postDataJSON?.bind(request);
    const json = value => route.fulfill({ json: value });
    if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith('/__qa_auth/')) {
      const endpoint = url.pathname.slice('/__qa_auth/'.length);
      if (endpoint === 'get-session') return json(state.signedIn ? { user: { id, email: seed.email } } : null);
      if (endpoint === 'token') return json({ token: jwt('authenticated') });
      if (endpoint === 'token/anonymous') return json({ token: jwt('anonymous') });
      if (endpoint === 'sign-up/email') return json({ user: { id } });
      if (endpoint === 'email-otp/verify-email') { state.signedIn = true; return json({ success: true }); }
      if (endpoint === 'sign-in/email') { state.signedIn = true; return json({ user: { id } }); }
      if (endpoint === 'email-otp/send-verification-otp') return json({ success: true });
      unexpected.push(endpoint); return route.abort();
    }
    if (url.pathname.startsWith('/api/db/')) {
      const fn = url.pathname.split('/').at(-1);
      const args = request.method() === 'POST' ? body() : {};
      state.calls.push({ fn, args });
      if (state.fail === fn) { state.fail = ''; return route.fulfill({ status: 400, json: { code: 'MA902', message: 'MA902' } }); }
      if (fn === 'my_profile') return json(state.signedIn && state.hasProfile ? state.profile : []);
      if (fn === 'company_products') return json(state.products);
      if (fn === 'set_onboarding_details') {
        assert.deepEqual(Object.keys(args).sort(), detailKeys.map(k => 'p_' + k).sort());
        if (['legal_name', 'registration_code', 'legal_form'].some(key => state.profile[key] !== args['p_' + key])) state.profile.verification_documents_status = 'not_submitted';
        for (const key of detailKeys) state.profile[key] = args['p_' + key];
        return json(state.profile);
      }
      if (fn === 'set_matching_categories') {
        assert([...args.p_provide, ...args.p_need].every(key => Object.hasOwn(categories, key)), 'exact taxonomy keys');
        state.profile.provide_categories = args.p_provide; state.profile.need_categories = args.p_need;
        return json({ provide: args.p_provide, need: args.p_need });
      }
      if (fn === 'update_my_profile') {
        for (const [key, value] of Object.entries(args)) if (key !== 'p_logo_url' || value !== null) state.profile[key.slice(2)] = value;
        return json(state.profile);
      }
      if (fn === 'set_my_products') { state.products = structuredClone(args.p_items); return json(state.products); }
      if (fn === 'complete_profile') {
        state.profile = { ...state.profile, ...Object.fromEntries(Object.entries(args).map(([key, value]) => [key.slice(2), value])) }; state.hasProfile = true; return json(state.profile);
      }
      if (fn === 'capabilities') return json({ engagement: true, emailDelivery: false });
      if (fn === 'engagement_state') return json({ savedIds: [], unread: 0, notifications: { items: [], nextCursor: null }, emailOffers: false });
      if (fn === 'unread_message_count') return json(0);
      if (fn === 'admin_stats') return json({ adminApiVersion: 1 });
      if (['company_stats', 'offer_counts', 'list_my_conversations', 'list_messages', 'company_distribution_profiles', 'company_reviews', 'my_company_review_targets', 'list_matching'].includes(fn)) return json([]);
      if (fn === 'company_business_features') return json({});
      if (fn === 'site_content') return json({});
      if (['requests', 'profiles', 'offers'].includes(fn)) return json([]);
      unexpected.push(fn); return route.abort();
    }
    if (url.pathname.startsWith('/api/analytics/')) return json({ enabled: false });
    if (url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state };
}
async function open(page, step = 'type') { await page.goto(origin + '/onboarding/?step=' + step); await page.locator('main h1').waitFor(); }
async function save(page) { await page.getByRole('button', { name: 'შენახვა', exact: true }).click(); await page.getByText('ცვლილებები შენახულია.', { exact: true }).waitFor(); }
try {
  const { context, page, state } = await fixture();
  await open(page);
  await page.getByRole('radio', { name: 'მომწოდებლების პოვნა' }).check();
  // A concurrent change in an unrelated field must survive replacement.
  state.profile.languages = ['ქართული', 'English'];
  await save(page);
  assert.equal(state.profile.account_intent, 'buy'); assert.equal(state.profile.role, 'company');
  assert.deepEqual(state.profile.languages, ['ქართული', 'English']); assert.equal(state.profile.website, seed.website);
  await page.reload(); await page.getByRole('radio', { name: 'მომწოდებლების პოვნა' }).waitFor(); assert(await page.getByRole('radio', { name: 'მომწოდებლების პოვნა' }).isChecked());
  await page.getByRole('button', { name: 'შემდეგი' }).click(); await page.getByLabel('იურიდიული სახელი', { exact: true }).waitFor();
  await page.getByLabel('იურიდიული სახელი', { exact: true }).fill('შპს ახალი სახელი');
  state.fail = 'set_onboarding_details';
  await page.getByRole('button', { name: 'შენახვა', exact: true }).click(); await page.getByRole('alert').waitFor();
  assert.equal(await page.getByText('ცვლილებები შენახულია.', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('იურიდიული სახელი', { exact: true }).inputValue(), 'შპს ახალი სახელი');
  await save(page); assert.equal(state.profile.legal_name, 'შპს ახალი სახელი'); assert.equal(state.profile.verification_documents_status, 'not_submitted');
  assert.deepEqual(state.profile.service_cities, ['batumi']); assert.equal(state.profile.lat, 41.7);
  await page.getByRole('button', { name: 'უკან', exact: true }).click(); await page.getByRole('radio', { name: 'მომწოდებლების პოვნა' }).waitFor();
  assert(await page.getByRole('radio', { name: 'მომწოდებლების პოვნა' }).isChecked());
  await open(page, 'profile'); await page.getByLabel('აღწერა', { exact: true }).fill('განახლებული პროფილის რეალური აღწერა'); await save(page);
  await page.reload(); await page.getByLabel('აღწერა', { exact: true }).waitFor(); assert.equal(await page.getByLabel('აღწერა', { exact: true }).inputValue(), 'განახლებული პროფილის რეალური აღწერა');
  assert.equal(await page.getByRole('textbox', { name: 'ტეგები', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'ტეგები — საკუთარი', exact: true }).click();
  await page.getByRole('textbox', { name: 'ტეგები', exact: true }).fill('QA custom tag');
  await page.getByRole('textbox', { name: 'ტეგები', exact: true }).press('Enter');
  await page.getByRole('checkbox', { name: 'HACCP', exact: true }).uncheck();
  await save(page); await open(page, 'profile');
  assert(state.profile.business_tags.includes('QA custom tag'));
  assert(!await page.getByRole('checkbox', { name: 'HACCP', exact: true }).isChecked());
  state.profile.certificates = ['Existing custom certificate', 'ISO 22000', 'HACCP', 'A', 'B', 'C', 'D', 'E'];
  await open(page, 'profile');
  assert(await page.getByRole('checkbox', { name: 'Existing custom certificate', exact: true }).isChecked());
  assert(await page.getByRole('checkbox', { name: 'Fair Trade', exact: true }).isDisabled());
  await save(page); assert.equal(state.profile.certificates.length, 8);
  assert(state.profile.certificates.includes('Existing custom certificate'));
  state.profile.certificates = [...seed.certificates];
  state.profile.legal_name = null;
  await open(page, 'profile');
  const nav = page.getByRole('navigation', { name: 'პროფილის ნაბიჯები', exact: true });
  assert.equal(await nav.getByRole('button', { name: /კომპანიის მონაცემები/ }).getAttribute('data-complete'), null);
  assert.equal(await nav.getByRole('button', { name: /ანგარიშის ტიპი/ }).getAttribute('data-complete'), 'true');
  state.profile.legal_name = seed.legal_name;
  await open(page, 'provide'); await page.getByLabel(/^სახელი/).fill('განახლებული ყავა');
  state.fail = 'set_my_products';
  await page.getByRole('button', { name: 'შენახვა', exact: true }).click(); await page.getByRole('alert').waitFor();
  assert.equal(await page.getByText('ცვლილებები შენახულია.', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel(/^სახელი/).inputValue(), 'განახლებული ყავა');
  await save(page); assert.equal(state.products[0].name, 'განახლებული ყავა');
  await open(page, 'need'); await page.getByRole('button', { name: 'დასუფთავება', exact: true }).click(); await save(page);
  assert(!state.profile.need_categories.includes('cleaning')); assert.deepEqual(state.profile.provide_categories, seed.provide_categories);
  await page.reload(); await page.getByRole('button', { name: 'დასუფთავება', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'დასუფთავება', exact: true }).getAttribute('aria-pressed'), 'false');
  await open(page, 'review'); assert.equal(await page.getByText('3 / 3 დოკუმენტი ატვირთულია').count(), 0);
  assert(await page.getByText('დოკუმენტები არ არის წარდგენილი', { exact: true }).isVisible());
  assert(!state.calls.some(call => call.fn === 'admin_set_document_status'));
  assert.equal(await page.getByRole('navigation', { name: 'პროფილის ნაბიჯები', exact: true }).getByRole('button', { name: /ვერიფიკაცია/ }).getAttribute('data-complete'), null);
  reports.push('PASS: raw profile, full replacement preservation, intent/role, save/reload/back/retry, profile, products, exact taxonomy, document status');
  state.profile = structuredClone(seed);
  for (const width of [1200, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const step of steps) {
      await open(page, step); await page.getByRole('button', { name: 'შენახვა', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${step}@${width}`);
      if (width === 390 && step !== 'type') {
        const boxes = await Promise.all(['უკან', 'შენახვა', step === 'review' ? 'დასრულება' : 'შემდეგი'].map(name => page.getByRole('button', { name, exact: true }).boundingBox()));
        assert(boxes.every(box => box && Math.abs(box.y - boxes[0].y) < 2), `actions share one row: ${step}`);
      }
      await page.screenshot({ path: path.join(out, `${step}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  reports.push('PASS: seven steps at 1200/390/1440, no horizontal overflow');
  await context.close();
  for (const role of ['guest', 'client', 'admin']) {
    const f = await fixture(role); await open(f.page);
    await f.page.getByRole('heading', { name: role === 'guest' ? 'კომპანიის პროფილის შექმნა' : 'კომპანიის ანგარიშის გვერდი' }).waitFor();
    assert(!f.state.calls.some(call => ['set_onboarding_details', 'set_matching_categories'].includes(call.fn)));
    await f.context.close();
  }
  reports.push('PASS: guest/client/admin state and no unauthorized mutation');
  const unavailable = await fixture(); unavailable.state.fail = 'company_products';
  await unavailable.page.goto(origin + '/onboarding/');
  await unavailable.page.getByRole('button', { name: 'ხელახლა ცდა', exact: true }).click();
  await unavailable.page.getByRole('radio', { name: 'ორივე', exact: false }).waitFor();
  delete unavailable.state.profile.business_tags;
  await unavailable.page.reload();
  await unavailable.page.getByText('პროფილის ახალი ველები მიუწვდომელია.', { exact: false }).waitFor();
  assert(!unavailable.state.calls.some(call => call.fn === 'set_onboarding_details'));
  await unavailable.context.close();
  const blocked = await fixture(); blocked.state.profile.blocked = true; await open(blocked.page);
  await blocked.page.getByRole('heading', { name: 'ანგარიში შეზღუდულია' }).waitFor();
  assert(!blocked.state.calls.some(call => call.fn === 'set_onboarding_details'));
  await blocked.context.close();
  reports.push('PASS: load failure retry, missing migration fields fail closed, blocked account');
  const f = await fixture('company', true);
  await f.page.goto(origin + '/account/?tab=register&role=company');
  await f.page.getByLabel('სახელი და გვარი', { exact: false }).fill('სატესტო მფლობელი');
  await f.page.getByLabel('კომპანია', { exact: false }).fill('სატესტო კომპანია');
  await f.page.getByLabel('მობილური ტელეფონი', { exact: false }).fill('+995 555 00 00 28');
  await f.page.getByLabel('ელფოსტა', { exact: false }).fill(seed.email);
  await f.page.getByLabel('პაროლი', { exact: false }).fill('LocalFixtureOnly123');
  // Exercise the project's accessible CustomSelect.
  await f.page.locator('#reg-industry').click();
  await f.page.getByRole('option', { name: 'კვების ორგანიზება', exact: true }).click();
  await f.page.locator('#reg-terms').check();
  await f.page.getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
  await f.page.getByLabel('კოდი', { exact: true }).fill('123456');
  await f.page.getByRole('button', { name: 'დადასტურება', exact: true }).click();
  await f.page.waitForURL('**/onboarding/?step=type');
  assert.equal(f.state.profile.role, 'company'); assert(f.state.calls.some(call => call.fn === 'complete_profile'));
  await f.context.close();
  reports.push('PASS: registration → email verification → complete_profile → onboarding');
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  reports.push('PASS: zero page errors / unexpected external requests; fixture contexts closed; no persistent test data');
  console.log(reports.join('\n')); console.log('Screenshots:', out);
} catch (error) { console.log(reports.join('\n')); console.error(error.stack); for (const context of browser.contexts()) { const page = context.pages().at(-1); if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); console.error((await page.locator('main').innerText().catch(() => '')).slice(0, 1800)); } } process.exitCode = 1; }
finally { clearTimeout(timer); await browser.close(); }

}

// Real-local mode intentionally owns its runtime. It never loads or uses production DATABASE_URL.
async function runRealLocal() {
  const { default: pg } = await import('pg');
  const http = await import('node:http');
  const { randomUUID } = await import('node:crypto');
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { createWriteStream } = await import('node:fs');
  const dsn = process.env.QA_LOCAL_DATABASE_URL || 'postgresql://localhost/meetany_preview_1790926297336';
  const target = new URL(dsn);
  assert(['postgres:', 'postgresql:'].includes(target.protocol) && ['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname === '/meetany_preview_1790926297336', 'Only the named local preview database is permitted');
  const port = Number(process.env.QA_PORT || 3248), origin = `http://127.0.0.1:${port}`, auth = `http://127.0.0.1:${port + 1}`;
  const out = path.resolve('qa/shots/onboarding-real-local');
  await fs.mkdir(out, { recursive: true });
  const id = randomUUID(), email = `${id}@onboarding-local.test`;
  const sql = new pg.Client({ connectionString: dsn, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  const report = { pass: false, checks: [], errors: [], unexpectedRequests: [], cleanup: null };
  let browser, next, authServer, log, timeout, connected = false, context, page, shuttingDown = false;
  const controller = new AbortController();
  const signals = () => { controller.abort(new Error('Interrupted')); void browser?.close(); };
  process.once('SIGINT', signals); process.once('SIGTERM', signals);
  const requests = [];
  try {
    await sql.connect(); connected = true;
    assert.equal((await sql.query('select current_database() as name')).rows[0].name, 'meetany_preview_1790926297336');
    // Confirm the actual deployed argument names before constructing any fixtures.
    const contract = (await sql.query("select proname,proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname=any($1)", [['set_onboarding_details', 'set_matching_categories', 'set_my_products', 'my_profile']])).rows;
    assert.equal(contract.length, 4);
    assert.equal(contract.find(row => row.proname === 'set_onboarding_details').proargnames.length, 12);
    const { publicKey, privateKey } = await generateKeyPair('EdDSA');
    const jwk = { ...await exportJWK(publicKey), kid: id, alg: 'EdDSA', use: 'sig' };
    const token = async (anonymous = false) => new SignJWT(anonymous ? { role: 'anonymous' } : { role: 'authenticated', email, emailVerified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: id }).setSubject(anonymous ? 'anonymous' : id).setIssuer(auth).setAudience(auth).setIssuedAt().setExpirationTime('10m').sign(privateKey);
    const bearer = await token(), anonymous = await token(true);
    authServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true');
      const data = req.url === '/.well-known/jwks.json' ? { keys: [jwk] }
        : req.url === '/get-session' ? { user: { id, email } }
        : req.url === '/token/anonymous' ? { token: anonymous } : req.url === '/token' ? { token: bearer } : null;
      res.statusCode = data ? 200 : 404; res.end(JSON.stringify(data));
    });
    await new Promise((resolve, reject) => { authServer.once('error', reject); authServer.listen(port + 1, '127.0.0.1', resolve); });
    next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      env: { ...process.env, DATABASE_URL: '', MEETANY_LOCAL_DATABASE_URL: dsn, NEON_AUTH_BASE_URL: auth, REQUIRE_EMAIL_VERIFICATION: 'off', REGISTRATION_ANALYTICS_ENABLED: 'false', BLOB_READ_WRITE_TOKEN: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    log = createWriteStream(path.join(out, 'runtime.log')); next.stdout.pipe(log); next.stderr.pipe(log);
    timeout = setTimeout(() => { controller.abort(new Error('Real-local suite exceeded 180 seconds')); void browser?.close(); next?.kill('SIGTERM'); }, 180000);
    await new Promise((resolve, reject) => {
      const startTimer = setTimeout(() => reject(new Error('Local dev startup exceeded 45 seconds')), 45000);
      const done = error => { clearTimeout(startTimer); if (error) reject(error); else resolve(); };
      next.stdout.on('data', data => { if (/Ready in/.test(String(data))) done(); });
      next.once('error', done); next.once('exit', code => done(new Error(`Local dev exited ${code}`)));
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const api = async (name, data = {}) => {
      controller.signal.throwIfAborted();
      const response = await context.request.post(`${origin}/api/db/rpc/${name}`, { headers: { Authorization: `Bearer ${bearer}` }, data, timeout: 15000 });
      assert(response.ok(), `${name}: HTTP ${response.status()} ${await response.text()}`);
      const result = await response.json(); return name === 'my_profile' && Array.isArray(result) ? result[0] : result;
    };
    // A unique, verified local auth identity; complete_profile still owns application-role creation.
    await sql.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,true)', [id, 'Onboarding QA', email]);
    await api('complete_profile', { p_role: 'company', p_name: 'სატესტო პირი', p_company: 'QA Onboarding', p_phone: '+995 5' + String(Date.now()).slice(-8), p_city: 'tbilisi', p_industry: 'catering' });
    const photoOrigin = (await sql.query('select meetany_private.photo_origin() as origin')).rows[0].origin;
    assert(photoOrigin, 'Local preview photo origin must already be configured');
    const photo = `${photoOrigin}/${id}/gallery-onboarding.png`, logo = `${photoOrigin}/${id}/logo-onboarding.png`;
    await api('set_my_gallery', { p_urls: [photo] });
    await api('update_my_profile', { p_name: 'სატესტო პირი', p_company: 'QA Onboarding', p_city: 'tbilisi', p_industry: 'catering', p_about: '', p_offers: [], p_seeks: [], p_service_cities: ['batumi'], p_address: null, p_lat: 41.7, p_lng: 44.8, p_logo_url: logo });
    const image = await fs.readFile('public/assets/photos/fresh-produce.jpg');
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      // Only fixture image bytes are replaced. All auth, DB reads and DB writes go through HTTP.
      if ([photo, logo].includes(url.href)) return route.fulfill({ contentType: 'image/jpeg', body: image });
      if (![origin, auth].includes(url.origin) || url.pathname.startsWith('/api/blob-upload')) { report.unexpectedRequests.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/db/rpc/')) requests.push(url.pathname.split('/').at(-1));
      return route.continue();
    });
    page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') report.errors.push(message.text()); });
    const open = async step => { controller.signal.throwIfAborted(); await page.goto(`${origin}/onboarding/?step=${step}`); await page.getByRole('button', { name: 'შენახვა', exact: true }).waitFor(); };
    const save = async () => { await page.getByRole('button', { name: 'შენახვა', exact: true }).click(); await page.getByText('ცვლილებები შენახულია.', { exact: true }).waitFor(); };
    const reload = async () => { await page.reload(); await page.getByRole('button', { name: 'შენახვა', exact: true }).waitFor(); };
    const add = async (label, text) => { if (!await page.getByRole('textbox', { name: label, exact: true }).isVisible()) await page.getByRole('button', { name: `${label} — საკუთარი`, exact: true }).click(); await page.getByRole('textbox', { name: label, exact: true }).fill(text); await page.getByRole('textbox', { name: label, exact: true }).press('Enter'); };
    const check = async expected => {
      const row = (await sql.query('select * from public.profiles where id=$1', [id])).rows[0];
      const raw = await api('my_profile');
      for (const [key, value] of Object.entries(expected)) { assert.deepEqual(row[key], value, `SQL ${key}`); assert.deepEqual(raw[key], value, `my_profile ${key}`); }
      assert.equal(row.role, 'company'); assert.equal(row.verified, false);
      return row;
    };
    // Hold the first real profile read briefly to inspect the accessible loading shell.
    let releaseLoading, interceptLoading;
    const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
    const loadingSeen = new Promise(resolve => { interceptLoading = resolve; });
    let holdFirstProfile = true;
    const hold = async route => {
      if (holdFirstProfile) { holdFirstProfile = false; interceptLoading(); await loadingGate; }
      if (!shuttingDown) await route.fallback().catch(error => { if (!shuttingDown) report.errors.push(error.message); });
    };
    await page.route('**/rpc/my_profile', hold);
    await page.goto(`${origin}/onboarding/?step=type`);
    await Promise.race([loadingSeen, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Profile read was not reached')), 15000); timer.unref(); })]);
    assert(await page.getByRole('status', { name: 'კომპანიის პროფილი იტვირთება…', exact: true }).isVisible());
    assert(await page.locator('.ma-skel').count() > 0);
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, `loading-${width}.png`), fullPage: true });
    }
    releaseLoading();
    await page.getByRole('button', { name: 'შენახვა', exact: true }).waitFor(); await page.setViewportSize({ width: 1200, height: 1000 });
    report.checks.push('Existing Skeletons in onboarding shell; 1200/390 loading without overflow');
    for (const [intent, label] of [['buy', 'მომწოდებლების პოვნა'], ['sell', 'კლიენტების პოვნა'], ['both', 'ორივე']]) {
      await page.getByRole('radio', { name: label }).check(); await save(); await reload();
      assert(await page.getByRole('radio', { name: label }).isChecked()); await check({ account_intent: intent });
    }
    for (const key of ['catering', 'beverages', 'packaging']) await page.getByRole('button', { name: categories[key], exact: true }).click();
    await save(); await reload(); await check({ provide_categories: ['beverages', 'catering', 'packaging'], need_categories: [] });
    report.checks.push('type: buy/sell/both persisted across reload; company role unchanged; exact matching keys');
    await open('details');
    const fields = { 'იურიდიული სახელი': 'შპს ქოფი ჰაუს QA', 'საიდენტიფიკაციო კოდი': '405678128', 'დაფუძნდა': '2020', 'ტიპი': 'შპს', 'მისამართი': 'ყაზბეგის გამზ. 12', 'საკონტაქტო პირი': 'ირაკლი ხინიკაძე', 'პოზიცია': 'დირექტორი', 'ვებგვერდი': 'https://example.test/coffee' };
    for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: label !== 'საკონტაქტო პირი' }).fill(value);
    await page.getByLabel('თანამშრომლები', { exact: true }).selectOption('8-50'); await page.getByLabel('ქალაქი', { exact: false }).selectOption('kutaisi');
    await add('ბაზრები', 'საქართველო'); await add('ბაზრები', 'ევროპა'); await add('ენები', 'ქართული'); await add('ენები', 'English');
    await save(); await reload();
    for (const [label, value] of Object.entries(fields)) assert.equal(await page.getByLabel(label, { exact: label !== 'საკონტაქტო პირი' }).inputValue(), value);
    const expected = { account_intent: 'both', legal_name: fields['იურიდიული სახელი'], registration_code: fields['საიდენტიფიკაციო კოდი'], founded_year: 2020, legal_form: 'შპს', employee_band: '8-50', address: fields['მისამართი'], name: fields['საკონტაქტო პირი'], city: 'kutaisi', contact_position: 'დირექტორი', website: fields['ვებგვერდი'], markets: ['საქართველო', 'ევროპა'], languages: ['ქართული', 'English'], service_cities: ['batumi'], lat: 41.7, lng: 44.8, logo_url: logo, gallery: [photo], verification_documents_status: 'not_submitted' };
    await check(expected); report.checks.push('details: every new detail, profile contact/location, and preserved media/coordinates verified by SQL + my_profile after reload');
    await open('profile');
    await page.getByLabel('კომპანიის სახელი', { exact: false }).fill('Coffee House Georgia QA');
    await page.getByLabel('აღწერა', { exact: true }).fill('ყავის ქსელი საქართველოში. ვაწვდით ყავის მარცვლებს და HoReCa პროდუქციას სხვა ბიზნესებსაც.');
    await page.getByLabel('ძირითადი დარგი', { exact: false }).selectOption('beverages');
    await add('ტეგები', 'ყავა'); await add('ტეგები', 'HoReCa');
    await page.getByRole('checkbox', { name: 'ISO 22000', exact: true }).check(); await page.getByRole('checkbox', { name: 'HACCP', exact: true }).check();
    await save(); await reload();
    Object.assign(expected, { company: 'Coffee House Georgia QA', industry: 'beverages', about: 'ყავის ქსელი საქართველოში. ვაწვდით ყავის მარცვლებს და HoReCa პროდუქციას სხვა ბიზნესებსაც.', business_tags: ['ყავა', 'HoReCa'], certificates: ['ISO 22000', 'HACCP'] });
    await check(expected); assert.equal(await page.getByLabel('აღწერა', { exact: true }).inputValue(), expected.about);
    report.checks.push('profile: company/about/industry/tags/certificates saved; all earlier onboarding fields preserved');
    await open('provide'); await page.getByRole('button', { name: 'პროდუქტის ან მომსახურების დამატება', exact: true }).click();
    await page.getByLabel(/^სახელი/).fill('ყავის მარცვლები'); await page.getByLabel('მოკლე აღწერა', { exact: true }).fill('არაბიკა HoReCa-სთვის');
    await page.getByRole('button', { name: categories.wholesale, exact: true }).click(); await add('რას სთავაზობთ', 'ყავის მიწოდება');
    await save(); await reload(); assert.equal(await page.getByLabel(/^სახელი/).inputValue(), 'ყავის მარცვლები');
    const products = [{ name: 'ყავის მარცვლები', photoUrl: photo, note: 'არაბიკა HoReCa-სთვის' }];
    assert.deepEqual((await sql.query('select items from meetany_private.company_products where company_id=$1', [id])).rows[0].items, products);
    assert.deepEqual(await api('company_products', { p_company_id: id }), products);
    Object.assign(expected, { provide_categories: ['beverages', 'catering', 'packaging', 'wholesale'], offers: ['ყავის მიწოდება'] }); await check(expected);
    report.checks.push('provide: real set_my_products JSONB, gallery URL, offers, categories, SQL/private table + company_products reload');
    await open('need');
    for (const key of ['food_fresh', 'packaging', 'cleaning']) await page.getByRole('button', { name: categories[key], exact: true }).click();
    await add('რას ეძებთ', 'ბრენდირებული ჭიქები'); await save(); await reload();
    Object.assign(expected, { need_categories: ['cleaning', 'food_fresh', 'packaging'], seeks: ['ბრენდირებული ჭიქები'] }); await check(expected);
    assert.equal(await page.getByRole('button', { name: categories.cleaning, exact: true }).getAttribute('aria-pressed'), 'true');
    report.checks.push('need: exact need categories + seeks; full persisted row and other-step fields preserved');
    const labels = { not_submitted: 'დოკუმენტები არ არის წარდგენილი', pending: 'დოკუმენტები განხილვაშია', approved: 'დოკუმენტები დამტკიცებულია', rejected: 'დოკუმენტები უარყოფილია' };
    const writes = () => requests.filter(name => /^(set_|update_|admin_)/.test(name));
    for (const [status, label] of Object.entries(labels)) {
      // Fixture setup only, confined to our UUID. The UI must never write this state.
      await sql.query('update public.profiles set verification_documents_status=$1 where id=$2', [status, id]);
      const before = writes().length;
      for (const step of ['verify', 'review']) {
        await open(step); await page.getByText(label, { exact: true }).waitFor();
        await page.getByRole('button', { name: 'შენახვა', exact: true }).click(); await page.getByText('მონაცემები გადამოწმებულია.', { exact: true }).waitFor();
      }
      assert.equal(writes().length, before); await check({ verification_documents_status: status });
    }
    report.checks.push('verify/review: all four real statuses; no document/admin/profile writes and no approval elevation');
    await sql.query("update public.profiles set verification_documents_status='pending' where id=$1", [id]);
    // A later legal identity edit must revoke document review in the real RPC.
    await open('details'); await page.getByLabel('იურიდიული სახელი', { exact: true }).fill('შპს ქოფი ჰაუს QA განახლებული'); await save(); await reload();
    Object.assign(expected, { legal_name: 'შპს ქოფი ჰაუს QA განახლებული' }); await check(expected);
    report.checks.push('Real legal-identity change resets documents to not_submitted without changing verified');
    for (const width of [1200, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const step of ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']) {
        await open(step); await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${step}@${width} overflow`);
        if (width === 390 && step !== 'type') {
        const boxes = await Promise.all(['უკან', 'შენახვა', step === 'review' ? 'დასრულება' : 'შემდეგი'].map(name => page.getByRole('button', { name, exact: true }).boundingBox()));
        assert(boxes.every(box => box && Math.abs(box.y - boxes[0].y) < 2), `actions share one row: ${step}`);
      }
      await page.screenshot({ path: path.join(out, `${step}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    report.checks.push('7 real persisted screens × 1200/390/1440: no horizontal overflow');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.unexpectedRequests, []);
    report.pass = true;
  } catch (error) {
    report.failure = String(error.message).replaceAll(dsn, '[local database]'); process.exitCode = 1;
    await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  } finally {
    shuttingDown = true; clearTimeout(timeout); process.removeListener('SIGINT', signals); process.removeListener('SIGTERM', signals);
    await browser?.close();
    // Stop API access before cleanup: otherwise late polling could recreate the auth mirror.
    if (next && next.exitCode === null && next.signalCode === null) {
      next.kill('SIGTERM');
      await Promise.race([once(next, 'exit'), new Promise(resolve => { const timer = setTimeout(resolve, 4000); timer.unref(); })]);
      if (next.exitCode === null && next.signalCode === null) { next.kill('SIGKILL'); await once(next, 'exit'); }
    }
    if (authServer?.listening) await new Promise(resolve => authServer.close(resolve));
    log?.end();
    if (connected) {
      try {
        await sql.query('delete from neon_auth."user" where id=$1 and email=$2', [id, email]);
        const remaining = (await sql.query('select (select count(*) from neon_auth."user" where id=$1) as auth, (select count(*) from public.profiles where id=$1) as profiles, (select count(*) from meetany_private.company_products where company_id=$1) as products', [id])).rows[0];
        report.cleanup = Object.fromEntries(Object.entries(remaining).map(([key, value]) => [key, Number(value)]));
        assert.deepEqual(report.cleanup, { auth: 0, profiles: 0, products: 0 });
      } catch (error) { report.pass = false; report.cleanupError = error.message; process.exitCode = 1; }
      await sql.end();
    }
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}

if (process.argv.includes('--real-local') || process.env.QA_REAL_LOCAL === '1') await runRealLocal();
else await runMocked();
