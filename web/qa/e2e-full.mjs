/**
 * Full local UI E2E. Run: cd web && npm run e2e
 * BASE defaults to http://localhost:3402. Start Next with --webpack.
 * Credentials: ../DEMO-ACCOUNTS.local.md; never included in reports.
 * SQL reads verify persistence. seed() also frees the explicitly authorized local QA quota;
 * every invocation is recorded. Existing requests are closed through their UI.
 * Screenshots stay local; do not commit shots/e2e/*.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import pg from 'pg';
import { makeProductsTemplate } from '../scripts/make-products-template.mjs';

const web = path.resolve(import.meta.dirname, '..');
const root = path.dirname(web);
const out = path.join(web, 'qa/QA-2026-10-13');
const shotsDir = path.join(out, 'shots/e2e');
const BASE = process.env.BASE || 'http://localhost:3402';
const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
assert(local(BASE), 'BASE must be localhost; refusing remote UI mutations');
const env = Object.fromEntries(fs.readFileSync(path.join(web, '.env.local'), 'utf8').split(/\r?\n/).flatMap(line => {
  const match = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
assert(env.DATABASE_URL && local(env.DATABASE_URL), 'DATABASE_URL must be localhost');
if (env.MEETANY_LOCAL_DATABASE_URL) {
  assert(local(env.MEETANY_LOCAL_DATABASE_URL), 'MEETANY_LOCAL_DATABASE_URL must be localhost');
  assert(new URL(env.MEETANY_LOCAL_DATABASE_URL).pathname === new URL(env.DATABASE_URL).pathname, 'local database names must agree');
}
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
const redact = text => secrets.reduce((s, password) => s.replaceAll(password, '[REDACTED]'), String(text).replace(/\u001b\[[0-9;]*m/g, '')).replace(/(postgres(?:ql)?:\/\/)[^\s]+/g, '$1[REDACTED]');
const ts = Date.now(), prefix = `[e2e] ${ts}`;
// HomeLive deliberately hides titles matching /ტესტ|test|e2e/i. Use a neutral, unique title.
const state = { run: ts, phone: `+995 5${String(ts).slice(-8)}`, email: `e2e+${ts}@meetany.local`, title: `ხის მაგიდების შესყიდვა ${ts}` };
const results = [], actors = new Map(), seeds = [], observations = {};
let activePages = new Set(), lastAuth = 0, lastStepFinished = 0;
fs.mkdirSync(shotsDir, { recursive: true });
const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 15000 });
await db.connect();
const sql = async (query, values = []) => (await db.query(query, values)).rows;
// Only call for a documented fixture that cannot be created in the UI. Never
// use this to turn a failed UI operation into a passing result.
function seed(reason, statement) {
  assert(local(env.DATABASE_URL), 'seed requires localhost');
  assert(reason && statement, 'seed requires documented reason and SQL');
  const url = new URL(env.DATABASE_URL);
  const output = execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
    input: `BEGIN;\n${statement}\nCOMMIT;`, encoding: 'utf8',
    env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) },
  });
  seeds.push({ reason, output: redact(output) });
}
/** Authorized local-QA fixture cleanup: after UI cleanup, preserve every request
 * with any offer. Lock the owner like create_request does; close oldest eligible
 * open rows only when quota >=5, targeting <=3. No production connection allowed. */
async function freeRequestQuota(ownerId) {
  assert(local(env.DATABASE_URL), 'freeRequestQuota requires localhost');
  assert(/^[0-9a-f-]{36}$/i.test(ownerId), 'Expected UUID ownerId');
  const before = Number((await sql('select meetany_private.open_count($1::uuid) as n', [ownerId]))[0].n);
  if (before < 5) return;
  seed(`freeRequestQuota(${ownerId}): ${before} open; oldest rows with no offers only; target <=3`, `
    SELECT id FROM public.profiles WHERE id='${ownerId}'::uuid FOR UPDATE;
    WITH candidates AS (
      SELECT r.id FROM public.requests r
      WHERE r.owner_id='${ownerId}'::uuid AND meetany_private.request_state(r)='open'
        AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.request_id=r.id)
      ORDER BY r.created_at, r.id
      LIMIT greatest(meetany_private.open_count('${ownerId}'::uuid)-3,0)
      FOR UPDATE
    ) UPDATE public.requests r SET status='closed' FROM candidates c WHERE r.id=c.id
      RETURNING r.id,r.title,r.status;
  `);
  const after = Number((await sql('select meetany_private.open_count($1::uuid) as n', [ownerId]))[0].n);
  assert(after <= 3, `freeRequestQuota: ${after} remain; requests with offers were preserved`);
}
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
const png = { name: `e2e-${ts}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqXcAAAAASUVORK5CYII=', 'base64') };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => fs.writeFileSync(path.join(out, 'e2e-report.json'), JSON.stringify(results, null, 2) + '\n');
function touch(p) { activePages.add(p); return p; }
async function actor(role, fresh = false) {
  if (actors.has(role)) return actors.get(role);
  const file = `/tmp/e2e-${role}.json`;
  console.log(`CONTEXT ${role}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', reducedMotion: 'reduce', ...(role !== 'newcompany' && !fresh && fs.existsSync(file) ? { storageState: file } : {}) });
  const p = await context.newPage();
  p.setDefaultTimeout(12000); p.setDefaultNavigationTimeout(180000);
  const errors = [], http = [], pendingResponses = new Set();
  p.on('pageerror', e => errors.push(`pageerror: ${redact(e.message)}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`console error: ${redact(m.text())}`); });
  p.on('response', response => {
    if (response.status() < 400) return;
    const request = response.request();
    const url = new URL(response.url());
    // URLs are useful diagnostics; query credentials and auth response tokens are not.
    for (const key of [...url.searchParams.keys()]) if (/token|password|secret|key|code/i.test(key)) url.searchParams.set(key, '[REDACTED]');
    let bodyName = '';
    try { bodyName = request.postDataJSON()?.name || ''; } catch { /* non-JSON body */ }
    const entry = { role, status: response.status(), method: request.method(), url: redact(url.href), rpc: url.pathname.startsWith('/api/db/') ? url.pathname.slice('/api/db/'.length) : bodyName, body: '(response body pending)' };
    http.push(entry);
    const pending = (async () => {
      try {
        const body = await Promise.race([response.text(), sleep(5000).then(() => '(response body timeout)')]);
        entry.body = redact(body).replace(/("(?:access_token|refresh_token|token|password|secret)"\s*:\s*")[^"]*/gi, '$1[REDACTED]').slice(0, 300);
      } catch (error) { entry.body = `Unavailable: ${redact(error.message).slice(0, 200)}`; }
    })();
    pendingResponses.add(pending); void pending.finally(() => pendingResponses.delete(pending));
  });
  const a = { p, context, file, errors, http, pendingResponses, role, authenticated: false, transient: fresh && role !== 'content-guest' };
  actors.set(role, a); return a;
}
async function persist(a) { await a.context.storageState({ path: a.file }); fs.chmodSync(a.file, 0o600); }
async function goto(p, url) { touch(p); await p.goto(BASE + url, { waitUntil: 'domcontentloaded' }); await p.getByRole('main').first().waitFor(); await p.waitForLoadState('networkidle', { timeout: 45000 }); await p.waitForTimeout(1000); }
async function authSubmit(p, submit, done) {
  // 429 retries are the only allowed repeated authentication submissions.
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(Math.max(0, 20000 - (Date.now() - lastAuth)));
    let limited = false;
    const listener = response => { if (response.status() === 429) limited = true; };
    p.on('response', listener); lastAuth = Date.now();
    try { await submit(); await done(); return; }
    catch (error) { if (!limited || attempt === 3) throw error; }
    finally { p.off('response', listener); }
    const delay = [30000, 60000, 120000][attempt];
    console.log(`AUTH 429: backoff ${delay / 1000}s`); await sleep(delay);
  }
}
async function login(role, a, preserveRoute = false) {
  a ||= await actor(role); touch(a.p);
  if (a.authenticated) return a;
  if (!preserveRoute) await goto(a.p, '/account/');
  const email = a.p.getByRole('textbox', { name: /ელფოსტა/ });
  await email.or(a.p.getByRole('heading', { name: /გამარჯობა|ადმინისტრ|ადმინ|მიმოხილვა|შეთავაზების გაგზავნა/ })).first().waitFor({ timeout: 45000 });
  if (await email.isVisible()) {
    assert(!a.attempted, `${role}: login already attempted`); a.attempted = true;
    const account = ledger.accounts[role]; assert(account, `Missing ledger role ${role}`);
    await email.fill(account.email || `demo-${role}@meetany.ge`);
    await a.p.getByLabel('პაროლი', { exact: true }).fill(account.password);
    await authSubmit(a.p, () => a.p.getByRole('button', { name: 'შესვლა', exact: true }).click(), () => email.waitFor({ state: 'hidden', timeout: 45000 }));
  }
  await a.p.waitForTimeout(1000); a.authenticated = true; await persist(a); return a;
}
async function pick(p, label, value) { await p.getByRole('combobox', { name: label }).click(); await p.getByRole('option', { name: value, exact: true }).click(); }
// Follow the visible upload action: it stays disabled until the attachment list loads.
// Setting a hidden input directly can race that initial read and is not a user path.
async function attach(p, label, file) {
  const [chooser] = await Promise.all([
    p.waitForEvent('filechooser'),
    p.getByRole('region', { name: label, exact: true }).getByRole('button', { name: 'დამატება', exact: true }).click(),
  ]);
  await chooser.setFiles(file);
}
async function next(p, step) { await p.getByRole('button', { name: /^(შემდეგი|გადახედვა|გადახედეთ|დაასრულეთ|დასრულება)$/ }).click(); await p.waitForURL(url => step === 'account' ? url.pathname === '/account/' : url.searchParams.get('step') === step, { timeout: 25000 }); }
async function registrationCategory(p) { const chip = p.getByRole('radiogroup', { name: 'დარგი', exact: true }).getByRole('radio', { name: 'ავეჯი', exact: true }); if (!await chip.count()) await p.getByRole('button', { name: /ყველა კატეგორია/ }).click(); await chip.click(); }
async function category(p) { let b = p.getByRole('button', { name: 'ავეჯი', exact: true }); if (!await b.count()) await p.getByRole('button', { name: /ყველა კატეგორია/ }).click(); b = p.getByRole('button', { name: 'ავეჯი', exact: true }); if (await b.getAttribute('aria-pressed') !== 'true') await b.click(); }
// Keep the same role sessions across attempts; only guest scenarios create contexts.
// Retry evidence remains in JSON even when the last attempt succeeds.
async function check(step, fn, fallback) {
  await sleep(Math.max(0, 3000 - (Date.now() - lastStepFinished)));
  const started = Date.now(), attempts = [], pages = new Set();
  let row;
  for (let attempt = 0; attempt <= 2; attempt++) {
    row = await checkAttempt(step, fn, fallback, attempt);
    attempts.push({ ...row });
    for (const page of activePages) pages.add(page);
    if (!row.http.some(response => response.status === 429) || attempt === 2) break;
    console.log(`RETRY ${step}: HTTP 429; waiting 60s (${attempt + 1}/2)`);
    // A failed rate-limited login can resume; authenticated roles reuse storage/session.
    for (const actor of actors.values()) {
      if (!actor.authenticated && row.http.some(response => response.role === actor.role && response.status === 429)) actor.attempted = false;
    }
    await sleep(60000);
  }
  row.attempts = attempts;
  row.ms = Date.now() - started;
  results.push(row); save(); console.log(`${row.status} ${step}: ${row.reason.slice(0, 350)}`);
  for (const actor of [...actors.values()]) {
    if (actor.transient && pages.has(actor.p)) {
      await actor.context.close(); actors.delete(actor.role);
    }
  }
  lastStepFinished = Date.now();
}
async function checkAttempt(step, fn, fallback, attempt) {
  console.log(`START ${step}`);
  const started = Date.now(); activePages = new Set(fallback ? [fallback] : []);
  const offsets = new Map([...actors.values()].map(a => [a, a.errors.length]));
  const httpOffsets = new Map([...actors.values()].map(a => [a, a.http.length]));
  const seedOffset = seeds.length;
  const reasons = [], shots = [];
  try { await fn(); } catch (error) {
    reasons.push(redact(error.message));
    for (const page of activePages) {
      const alerts = await page.getByRole('alert').allTextContents().catch(() => []);
      reasons.push(...alerts.filter(text => text.trim()).map(text => `UI: ${redact(text)}`));
    }
  }
  if (!activePages.size) { const a = await actor('evidence-guest'); await goto(a.p, '/').catch(e => reasons.push(redact(e.message))); }
  for (const p of activePages) {
    const a = [...actors.values()].find(a => a.p === p);
    for (const width of [1440, 390, 360]) {
      try {
        await p.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await p.waitForTimeout(250);
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (overflow > 0) reasons.push(`${a?.role}: document overflow ${overflow}px at ${width}`);
        if (width !== 360) {
          const file = `${String(results.length + 1).padStart(2, '0')}-${step.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}-${a?.role || 'page'}-attempt${attempt + 1}-${width}.png`;
          await p.screenshot({ path: path.join(shotsDir, file), fullPage: true, timeout: 15000, mask: [p.locator('input[type=password]')] }); shots.push(`shots/e2e/${file}`);
        }
      } catch (error) { reasons.push(`capture ${width}: ${redact(error.message)}`); }
    }
    await p.setViewportSize({ width: 1440, height: 1000 }).catch(() => {});
  }
  for (const a of actors.values()) reasons.push(...a.errors.slice(offsets.get(a) || 0).map(error => `${a.role}: ${error}`));
  await Promise.all([...actors.values()].flatMap(a => [...a.pendingResponses]));
  const http = [...actors.values()].flatMap(a => a.http.slice(httpOffsets.get(a) || 0));
  reasons.push(...http.map(r => `${r.role}: HTTP ${r.status} ${r.method} ${r.url} RPC=${r.rpc || '(none)'} body=${r.body}`));
  const row = { http, seeds: seeds.slice(seedOffset), observations: observations[step] || {}, step, status: reasons.length ? 'FAIL' : 'PASS', reason: [...new Set(reasons)].join(' | ') || 'UI და შემოწმებები წარმატებულია', shots, ms: Date.now() - started };
  return row;
}
const company = await actor('newcompany'), hotel = await actor('hotel'), wood = await actor('wood'), admin = await actor('owner_admin');
const p = company.p, h = hotel.p, w = wood.p, a = admin.p;
const required = key => assert(state[key], `Prerequisite missing: ${key}; previous flow did not complete`);
const requestRoute = () => { required('requestId'); return `/requests/view/?id=${state.requestId}`; };
const dealRoute = () => { required('dealId'); return `/deals/view/?id=${state.dealId}`; };
async function requireDealStage(stage) {
  required('dealId');
  const row = (await sql('select stage from meetany_private.deals where id=$1', [state.dealId]))[0];
  assert(row?.stage === stage, `Prerequisite missing: deal stage ${stage}; actual ${row?.stage || 'absent'}`);
}
const reviewText = `${prefix} კარგი ხარისხი და შეთანხმებული მიწოდება.`;
const reason = `${prefix} გთხოვთ გადაამოწმოთ საგადასახადო დოკუმენტი.`;
async function moderation(page, message) { const dialog = page.locator('#moderation[open]'); await dialog.waitFor(); const field = dialog.getByRole('textbox'); if (await field.count()) await field.fill(message); await dialog.locator('button[type=submit]').click(); await dialog.waitFor({ state: 'hidden' }); }
async function openCompany() { required('companyId'); await goto(a, `/admin/?tab=companies&q=${state.companyId}`); await a.getByRole('button', { name: 'დეტალების ნახვა' }).first().click(); }
async function sendOffer() {
  await goto(w, `/offers/new/?requestId=${state.requestId}`);
  await w.getByRole('textbox', { name: 'მოკლე აღწერა *', exact: true }).fill(`${prefix} თორმეტი ხის მაგიდა, მიწოდებით და აწყობით.`);
  await w.getByRole('textbox', { name: /თანხა ლარში/ }).fill('2400'); await pick(w, /მიწოდების ვადა/, '7 დღე');
  await pick(w, /გადახდის პირობები/, '100% მიწოდებისას');
  await attach(w, 'ფაილები', { ...png, name: 'e2e-offer.png' });
  await w.getByRole('button', { name: 'e2e-offer.png', exact: true }).waitFor();
  await w.getByRole('button', { name: 'შეთავაზების გაგზავნა', exact: true }).click();
  await w.getByRole('dialog').waitFor({ timeout: 30000 });
  const offers = await sql("select id from public.offers where request_id=$1 and status='sent'", [state.requestId]); assert.equal(offers.length, 1); state.offerId = offers[0].id;
}
try {
  await check('A01-register-company', async () => {
    await goto(p, '/account/?tab=register&role=company');
    await p.getByRole('textbox', { name: /ელფოსტა/ }).waitFor({ timeout: 45000 });
    if (!await p.getByRole('textbox', { name: /კომპანიის დასახელება/ }).count()) await p.getByRole('button', { name: /კომპანია/ }).click();
    await p.getByRole('textbox', { name: /კომპანიის დასახელება/ }).fill(`${prefix} კომპანია`);
    await p.getByRole('textbox', { name: /საკონტაქტო პირი/ }).fill('[e2e] საკონტაქტო პირი');
    await p.getByRole('textbox', { name: /მობილური ტელეფონი/ }).fill(state.phone);
    await p.getByRole('textbox', { name: /ელფოსტა/ }).fill(state.email);
    await p.getByLabel(/^პაროლი\s/).fill(ledger.accounts.wood.password);
    await pick(p, /ქალაქი/, 'თბილისი'); await registrationCategory(p);
    await p.getByRole('checkbox', { name: /ვეთანხმები/ }).check();
    await authSubmit(p, () => p.getByRole('button', { name: /^(ანგარიშის შექმნა|რეგისტრაცია|დარეგისტრირდით)$/ }).click(), async () => {
      await p.waitForURL('**/onboarding/**', { timeout: 45000 });
    });
    await persist(company);
    state.companyId = (await sql('select id from public.profiles where email=$1', [state.email]))[0]?.id; required('companyId');
  }, p);
  // Preserve A01 FAIL and its original screenshots. This is profile completion,
  // not another sign-up/login; the authenticated session is reused.
  if (await p.getByRole('heading', { name: 'რეგისტრაციის დასრულება', exact: true }).isVisible()) {
    await check('A01b-complete-profile-recovery', async () => {
      await p.getByRole('textbox', { name: /კომპანიის დასახელება/ }).fill(`${prefix} კომპანია`);
      await p.getByRole('textbox', { name: /საკონტაქტო პირი/ }).fill('[e2e] საკონტაქტო პირი');
      await p.getByRole('textbox', { name: /მობილური ტელეფონი/ }).fill(state.phone);
      const email = p.getByRole('textbox', { name: /ელფოსტა/ });
      if (await email.isEnabled()) await email.fill(state.email);
      await pick(p, /ქალაქი/, 'თბილისი'); await registrationCategory(p);
      await p.getByRole('checkbox', { name: /ვეთანხმები/ }).check();
      await p.getByRole('button', { name: 'დაასრულეთ რეგისტრაცია', exact: true }).click();
      await p.waitForURL('**/onboarding/**', { timeout: 45000 });
      await persist(company);
      state.companyId = (await sql('select id from public.profiles where email=$1', [state.email]))[0]?.id;
      required('companyId');
    }, p);
  }
  // Recover identity for continued diagnostics after a redirect failure, without re-registering.
  state.companyId ||= (await sql('select id from public.profiles where email=$1', [state.email]))[0]?.id;
  await check('A02-onboarding-type-both', async () => { required('companyId'); await goto(p, '/onboarding/?step=type'); await p.getByRole('radio', { name: /ორივე|ყიდვა და გაყიდვა/ }).check(); await category(p); await next(p, 'details'); }, p);
  await check('A03-onboarding-details-minimal', async () => { required('companyId'); await goto(p, '/onboarding/?step=details'); await p.getByRole('textbox', { name: /საკონტაქტო პირი/ }).fill('[e2e] საკონტაქტო პირი'); await pick(p, /ქალაქი/, 'თბილისი'); await next(p, 'profile'); }, p);
  await check('A04-onboarding-profile-logo', async () => { required('companyId'); await goto(p, '/onboarding/?step=profile'); await p.getByLabel('კომპანიის შესახებ', { exact: false }).fill(`${prefix} ვამზადებთ ავეჯს ბიზნესებისთვის თბილისში.`); await p.getByLabel(/^ლოგო.*დაამატეთ$/).setInputFiles(png); await p.getByText('ფოტო შენახულია.', { exact: true }).waitFor({ timeout: 30000 }); await next(p, 'provide'); }, p);
  await check('A05-onboarding-product-service', async () => { required('companyId'); await goto(p, '/onboarding/?step=provide'); await p.getByRole('button', { name: 'დაამატეთ პროდუქტი', exact: true }).click(); await p.getByLabel('სახელი', { exact: true }).fill(`${prefix} მაგიდა`); await p.getByLabel('მოკლე აღწერა', { exact: true }).fill('[e2e] მიწოდებით'); await p.getByRole('textbox', { name: /^მომსახურებები/ }).fill(`${prefix} მონტაჟი`); await p.getByRole('textbox', { name: /^მომსახურებები/ }).press('Enter'); await next(p, 'need'); }, p);
  await check('A06-onboarding-xlsx-import', async () => {
    required('companyId'); await goto(p, '/onboarding/?step=provide');
    const download = p.waitForEvent('download'); await p.getByRole('link', { name: 'შაბლონის ჩამოტვირთვა (.xlsx)', exact: true }).click(); const file = await download; assert.equal(await file.failure(), null); assert(fs.statSync(await file.path()).size > 0);
    const rows = [1, 2, 3].map(i => [`e2e-${ts}-${i}`, `${prefix} იმპორტი ${i}`, 'ცალი', 100 * i, '[e2e] XLSX']);
    await p.getByLabel('პროდუქტების ფაილი', { exact: true }).setInputFiles({ name: 'e2e-products.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: makeProductsTemplate(rows) });
    await p.getByText('3 დაემატება · 0 განახლდება · 0 შეცდომა', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'დადასტურება', exact: true }).click();
    await p.getByRole('region', { name: 'იმპორტის წინასწარი ნახვა' }).waitFor({ state: 'hidden' });
    await next(p, 'need'); await goto(p, '/onboarding/?step=provide'); for (const row of rows) await p.getByText(row[1], { exact: true }).first().waitFor();
  }, p);
  await check('A07-onboarding-need', async () => { required('companyId'); await goto(p, '/onboarding/?step=need'); await category(p); await next(p, 'verify'); }, p);
  await check('A07b-verification-required-legal-details', async () => {
    required('companyId'); await goto(p, '/onboarding/?step=verify');
    await p.getByRole('button', { name: 'იურიდიული სახელი', exact: true }).click();
    await p.getByLabel('იურიდიული სახელი', { exact: true }).fill(`${prefix} შპს`);
    await p.getByLabel('საიდენტიფიკაციო კოდი', { exact: true }).fill('404000213');
    await next(p, 'profile');
  }, p);
  await check('A08-onboarding-verify-documents', async () => {
    required('companyId'); await goto(p, '/onboarding/?step=verify');
    for (const [label, name] of [['რეგისტრაციის ამონაწერი', 'e2e-registration.png'], ['საგადასახადო დოკუმენტი', 'e2e-tax.png']]) { if (label === 'საგადასახადო დოკუმენტი') await p.getByRole('button', { name: '2. საგადასახადო', exact: true }).click(); await attach(p, label, { ...png, name }); await p.getByRole('button', { name, exact: true }).waitFor({ timeout: 30000 }); }
    await p.getByRole('button', { name: 'განხილვაზე გაგზავნა', exact: true }).click(); await p.getByText('განსახილველი', { exact: true }).first().waitFor(); await next(p, 'review');
  }, p);
  await check('A09-onboarding-review-dashboard', async () => { required('companyId'); await goto(p, '/onboarding/?step=review'); await next(p, 'account'); assert((await sql('select onboarding_completed_at from public.profiles where id=$1', [state.companyId]))[0]?.onboarding_completed_at); await persist(company); }, p);
  await check('B01-hotel-close-old-e2e-requests', async () => {
    await login('hotel', hotel);
    const account = ledger.accounts.hotel, email = account.email || 'demo-hotel@meetany.ge';
    const old = await sql("select r.id from public.requests r join public.profiles p on p.id=r.owner_id where p.email=$1 and (r.title ilike '%e2e-%' or r.title ~ '^ხის მაგიდების შესყიდვა [0-9]{13}$') and meetany_private.request_state(r)='open'", [email]);
    for (const row of old) { await goto(h, `/requests/view/?id=${row.id}`); await h.getByText('სხვა მოქმედებები', { exact: true }).click(); await h.getByRole('button', { name: 'მოთხოვნის დახურვა', exact: true }).click(); await h.getByRole('dialog').getByRole('button', { name: 'მოთხოვნის დახურვა', exact: true }).click(); await h.getByRole('dialog').waitFor({ state: 'hidden' }); }
    const ownerId = (await sql('select id from public.profiles where email=$1', [email]))[0]?.id;
    assert(ownerId, 'hotel profile required for quota cleanup');
    await freeRequestQuota(ownerId);
    await goto(h, '/account/?tab=requests');
  }, h);
  await check('B02-hotel-publish-request-photo', async () => {
    await login('hotel', hotel); await goto(h, '/requests/new/'); await h.getByRole('textbox', { name: /^სათაური/ }).fill(state.title); await pick(h, /კატეგორია/, 'ავეჯი'); await h.getByRole('textbox', { name: /^აღწერა/ }).fill(`${prefix} გვჭირდება 12 ხის მაგიდა სასტუმროსთვის, თბილისში მიწოდებით და აწყობით.`); await h.getByRole('textbox', { name: /^რაოდენობა/ }).fill('12'); await h.getByLabel('მოთხოვნის ფოტოს არჩევა', { exact: true }).setInputFiles(png);
    await h.getByRole('button', { name: /^(შემდეგი: მიწოდება|შემდეგი: გადახედვა|მოთხოვნის გამოქვეყნება)$/ }).click(); await pick(h, /ქალაქი/, 'თბილისი'); await h.getByLabel(/სასურველი თარიღი/).fill(new Date(ts + 14 * 86400000).toISOString().slice(0, 10)); await h.getByRole('textbox', { name: /^მისამართი/ }).fill('[e2e] თბილისი'); await h.getByRole('button', { name: /^(შემდეგი: მიწოდება|შემდეგი: გადახედვა|მოთხოვნის გამოქვეყნება)$/ }).click(); await h.getByRole('button', { name: /^(შემდეგი: მიწოდება|შემდეგი: გადახედვა|მოთხოვნის გამოქვეყნება)$/ }).click(); await h.getByRole('heading', { name: 'მოთხოვნა გამოქვეყნდა', exact: true }).waitFor({ timeout: 30000 });
    const row = (await sql('select id,photo_url from public.requests where title=$1', [state.title]))[0]; assert(row?.photo_url); state.requestId = row.id; state.requestPublishedAt = Date.now();
  }, h);
  for (const [name, route] of [['B03-guest-request-list', '/requests/'], ['B04-guest-home', '/']]) await check(name, async () => { required('requestId'); const guest = await actor(name, true); const openedAt = Date.now(); await goto(guest.p, route); await guest.p.getByText(state.title, { exact: true }).first().waitFor(); observations[name] = { title: state.title, navigationToVisibleMs: Date.now() - openedAt, sincePublishConfirmedMs: Date.now() - state.requestPublishedAt }; });
  await check('B05-wood-matching', async () => { required('requestId'); await login('wood', wood); await goto(w, '/matching/'); await w.getByText(state.title, { exact: true }).first().waitFor(); }, w);
  await check('B06-wood-offer-file', async () => { required('requestId'); await login('wood', wood); await sendOffer(); }, w);
  await check('B07-wood-withdraw-offer', async () => { required('offerId'); await goto(w, requestRoute()); await w.getByRole('button', { name: 'შეთავაზების გაუქმება', exact: true }).click(); await w.getByRole('dialog').getByRole('button', { name: 'შეთავაზების გაუქმება', exact: true }).click(); await w.getByRole('dialog').waitFor({ state: 'hidden' }); const remaining = (await sql('select status from public.offers where id=$1', [state.offerId]))[0]; assert(!remaining || remaining.status === 'withdrawn', 'Offer must be withdrawn or deleted'); }, w);
  await check('B08-wood-resend-offer', async () => { required('offerId'); await sendOffer(); }, w);
  await check('B09-hotel-compare-select', async () => { required('offerId'); await goto(h, `/requests/compare/?id=${state.requestId}`); await h.getByRole('button', { name: /^(შეთავაზების არჩევა|არჩევა)$/ }).first().click(); await h.getByRole('dialog').getByRole('button', { name: /^(შეთავაზების არჩევა|არჩევა)$/ }).click(); await h.waitForURL('**/deals/view/**', { timeout: 30000 }); state.dealId = new URL(h.url()).searchParams.get('id'); required('dealId'); }, h);
  await check('B10-deal-discuss-both-directions', async () => {
    for (const [from, to, message] of [[h, w, `${prefix} აწყობა შედის?`], [w, h, `${prefix} დიახ, აწყობა შედის.`]]) {
      await goto(from, dealRoute()); const open = from.getByRole('button', { name: 'ჩატის გახსნა', exact: true }); await open.or(from.getByRole('textbox', { name: 'შეტყობინება', exact: true })).first().waitFor(); if (await open.isVisible()) await open.click();
      await from.getByRole('textbox', { name: 'შეტყობინება', exact: true }).fill(message); await from.getByRole('textbox', { name: 'შეტყობინება', exact: true }).locator('..').getByRole('button', { name: 'გაგზავნა', exact: true }).click();
      await from.getByRole('log').getByText(message, { exact: false }).waitFor();
      await goto(to, dealRoute()); const recipientOpen = to.getByRole('button', { name: 'ჩატის გახსნა', exact: true }); await recipientOpen.or(to.getByRole('textbox', { name: 'შეტყობინება', exact: true })).first().waitFor(); if (await recipientOpen.isVisible()) await recipientOpen.click(); await to.getByRole('log').getByText(message, { exact: false }).waitFor();
    }
  }, h);
  await check('B11-deal-terms-both-confirm', async () => {
    await requireDealStage('discuss');
    await goto(w, dealRoute()); await w.getByRole('button', { name: 'ახალი პირობები', exact: true }).click(); const modal = w.getByRole('dialog'); await modal.getByRole('spinbutton', { name: /ჯამური ფასი/ }).fill('2400'); await modal.getByRole('textbox', { name: /მიწოდების ადგილი/ }).fill('[e2e] თბილისი'); await modal.getByRole('combobox', { name: /გადახდა/ }).click(); await w.getByRole('option', { name: '100% მიწოდებისას', exact: true }).click(); await modal.getByRole('button', { name: 'ცვლილების შეთავაზება', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
    for (const page of [h, w]) { await goto(page, dealRoute()); await page.getByRole('button', { name: 'პირობების დადასტურება', exact: true }).click(); await page.waitForTimeout(1200); }
    const row = (await sql('select buyer_confirmed_at,supplier_confirmed_at from meetany_private.deals where id=$1', [state.dealId]))[0]; assert(row.buyer_confirmed_at && row.supplier_confirmed_at);
  }, w);
  await check('B12-deal-progress-file-download', async () => {
    await requireDealStage('terms');
    await goto(w, dealRoute()); await w.getByRole('button', { name: 'შესრულების დაწყება', exact: true }).click(); await w.getByLabel('რა გაკეთდა', { exact: true }).fill(`${prefix} წარმოება დაიწყო`); await w.getByRole('button', { name: 'განახლების დამატება', exact: true }).click();
    await attach(w, 'შესრულების ფოტოები და ფაილები', { ...png, name: 'e2e-progress.png' }); await w.getByRole('button', { name: 'e2e-progress.png', exact: true }).waitFor();
    await goto(h, dealRoute()); const download = h.waitForEvent('download'); await h.getByRole('button', { name: 'e2e-progress.png', exact: true }).click(); const file = await download; assert.equal(await file.failure(), null); assert.deepEqual(fs.readFileSync(await file.path()), png.buffer);
  }, w);
  await check('B13-deal-complete', async () => { await requireDealStage('progress'); await goto(h, dealRoute()); await h.getByRole('button', { name: 'მიღებულია, დასრულება', exact: true }).click(); await h.getByRole('dialog').getByRole('button', { name: 'დასრულების დადასტურება', exact: true }).click(); await h.getByRole('button', { name: 'თანამშრომლობის შეფასება', exact: true }).waitFor(); }, h);
  await check('B14-deal-review', async () => {
    await requireDealStage('complete');
    await goto(h, dealRoute()); await h.getByRole('button', { name: 'თანამშრომლობის შეფასება', exact: true }).click(); const modal = h.getByRole('dialog');
    for (const criterion of ['ხარისხი', 'ვადების დაცვა', 'კომუნიკაცია', 'საიმედოობა']) await modal.getByRole('group', { name: criterion, exact: true }).getByRole('button', { name: '5 ვარსკვლავი', exact: true }).click(); await modal.getByRole('button', { name: 'დიახ', exact: true }).click(); await modal.getByRole('textbox').fill(reviewText); await modal.getByRole('button', { name: 'შეფასების გაგზავნა', exact: true }).click(); await modal.waitFor({ state: 'hidden' }); state.reviewCreated = true;
  }, h);
  await check('B15-review-public-profile', async () => { required('reviewCreated'); const guest = await actor('review-guest', true); state.woodId = (await sql('select id from public.profiles where email=$1', [ledger.accounts.wood.email || 'demo-wood@meetany.ge']))[0]?.id; assert(state.woodId); await goto(guest.p, `/companies/view/?id=${state.woodId}`); await guest.p.getByText(reviewText, { exact: true }).waitFor(); });
  await check('C01-admin-return-documents', async () => { required('companyId'); await login('owner_admin', admin); await openCompany(); await a.getByRole('button', { name: 'დოკუმენტების დაბრუნება…', exact: true }).click(); await moderation(a, reason); }, a);
  await check('C02-company-return-reason', async () => { required('companyId'); await goto(p, '/onboarding/?step=verify'); await p.getByText(/^დაბრუნებულია/, { exact: false }).first().waitFor(); await p.getByText(reason, { exact: false }).waitFor(); }, p);
  await check('C03-company-resubmit-documents', async () => { required('companyId'); await goto(p, '/onboarding/?step=verify'); await p.getByRole('button', { name: 'ხელახლა გაგზავნა', exact: true }).click(); await p.getByText('განსახილველი', { exact: true }).first().waitFor(); }, p);
  await check('C04-admin-approve-verification', async () => { await login('owner_admin', admin); await openCompany(); await a.getByRole('button', { name: 'დოკუმენტების დადასტურება…', exact: true }).click(); await moderation(a, `${prefix} ორივე დოკუმენტი გადამოწმებულია.`); assert((await sql('select verified from public.profiles where id=$1', [state.companyId]))[0]?.verified); }, a);
  await check('C05-company-public-verification-badge', async () => { required('companyId'); const guest = await actor('verified-guest', true); await goto(guest.p, `/companies/view/?id=${state.companyId}`); await guest.p.getByRole('img', { name: 'ვერიფიცირებული კომპანია', exact: true }).waitFor(); });
  for (const [name, button, hidden] of [['C06-admin-hide-review', 'დამალვა…', true], ['C07-admin-restore-review', 'აღდგენა…', false]]) await check(name, async () => {
    required('reviewCreated'); await login('owner_admin', admin); await goto(a, '/admin/?tab=reviews'); await a.getByRole('searchbox', { name: 'ძიება', exact: true }).fill(String(ts)); const row = a.getByRole('row').filter({ hasText: reviewText }); await row.getByRole('button', { name: button, exact: true }).click(); await moderation(a, `${prefix} შეფასების მოდერაცია`);
    const guest = await actor('moderation-guest'); await goto(guest.p, `/companies/view/?id=${state.woodId}`); if (hidden) assert.equal(await guest.p.getByText(reviewText, { exact: true }).count(), 0); else await guest.p.getByText(reviewText, { exact: true }).waitFor();
  }, a);
  await check('C08-hotel-complaint', async () => { required('companyId'); await login('hotel', hotel); await goto(h, `/companies/view/?id=${state.companyId}`); await h.getByRole('button', { name: 'დარღვევის შეტყობინება', exact: true }).click(); const dialog = h.getByRole('dialog'); await dialog.getByLabel('სხვა მიზეზი', { exact: true }).check(); await dialog.getByRole('textbox').fill(`${prefix} სატესტო საჩივარი`); await dialog.getByRole('button', { name: 'გაგზავნა', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); state.complaint = true; }, h);
  await check('C09-admin-resolve-complaint', async () => { required('complaint'); await login('owner_admin', admin); await goto(a, '/admin/?tab=reports'); const row = a.getByRole('row').filter({ hasText: `${prefix} სატესტო საჩივარი` }); await row.getByRole('button', { name: 'უარყოფა…', exact: true }).click(); await moderation(a, `${prefix} დარღვევა არ დადასტურდა.`); }, a);
  await check('C10-hotel-complaint-result-georgian', async () => { required('complaint'); await goto(h, '/account/?tab=notifications'); await h.getByText('საჩივარი განხილულია', { exact: true }).first().waitFor(); const text = await h.getByRole('main').innerText(); const untranslated = text.match(/\b(dismissed|resolved|rejected|pending)\b/); assert(!untranslated, `Complaint status must be Georgian; displayed: ${untranslated?.[0]}`); assert(/უარყოფილია|დარღვევა არ დადასტურდა/.test(text), 'Georgian complaint resolution missing'); }, h);
  await check('C11-admin-catalog-image-public', async () => {
    await login('owner_admin', admin); await goto(a, '/admin/?tab=content');
    state.contentOriginal = await a.getByRole('main').getByRole('img').first().getAttribute('src');
    const original = await a.request.get(new URL(state.contentOriginal, BASE).href);
    assert(original.ok(), 'Original catalog image backup fetch failed');
    state.contentBackup = { mimeType: original.headers()['content-type'].split(';')[0], buffer: await original.body() };
    assert(state.contentBackup.buffer.length, 'Original image backup is empty');
    await a.getByRole('main').locator('input[type=file]').first().setInputFiles({ ...png, name: 'e2e-content.png' });
    await a.waitForFunction(original => document.querySelector('main img')?.getAttribute('src') !== original, state.contentOriginal);
    state.contentChanged = await a.getByRole('main').getByRole('img').first().getAttribute('src');
    await a.getByRole('button', { name: 'ცვლილებების გამოქვეყნება', exact: true }).click(); await a.getByText('კატალოგის ფოტოები გამოქვეყნდა.', { exact: true }).first().waitFor();
    const guest = await actor('content-guest', true); await goto(guest.p, '/companies/'); await guest.p.waitForFunction(url => [...document.images].some(img => decodeURIComponent(img.src).includes(url)), state.contentChanged);
  }, a);
  await check('C12-admin-catalog-image-restore', async () => {
    required('contentChanged'); await goto(a, '/admin/?tab=content');
    // Restore the original bytes through the same upload UI, not a default that
    // might overwrite somebody else's pre-existing catalog image.
    assert(state.contentBackup, 'Original catalog image backup required');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[state.contentBackup.mimeType];
    assert(extension, 'Unsupported original image type');
    await a.getByRole('main').locator('input[type=file]').first().setInputFiles({ name: `e2e-restored.${extension}`, ...state.contentBackup });
    await a.waitForFunction(previous => document.querySelector('main img')?.getAttribute('src') !== previous, state.contentChanged);
    await a.getByRole('button', { name: 'ცვლილებების გამოქვეყნება', exact: true }).click(); await a.getByText('კატალოგის ფოტოები გამოქვეყნდა.', { exact: true }).first().waitFor();
    const guest = await actor('content-guest'); await goto(guest.p, '/companies/'); assert(!await guest.p.getByRole('img').evaluateAll((imgs, url) => imgs.some(img => decodeURIComponent(img.src).includes(url)), state.contentChanged));
  }, a);
  await check('D01-guest-request-login-context', async () => {
    required('companyId');
    const open = (await sql("select id from public.requests where status='open' and chosen_offer_id is null and not hidden and expires_at > now() order by created_at desc limit 1"))[0];
    assert(open, 'D requires an open request fixture');
    const redirectRequestId = open.id;
    // The newly verified company has never logged in (A performed sign-up).
    // Use its one sign-in here so hotel/wood/admin each still log in once.
    const guest = await actor('newcompany-login', true);
    ledger.accounts['newcompany-login'] = { email: state.email, password: ledger.accounts.wood.password };
    await goto(guest.p, `/requests/view/?id=${redirectRequestId}`);
    await guest.p.getByRole('link', { name: 'შედით, რომ გაგზავნოთ შეთავაზება', exact: true }).click();
    await guest.p.waitForURL('**/account/**');
    const url = new URL(guest.p.url());
    assert(url.searchParams.get('next')?.includes(redirectRequestId), 'CTA next must preserve request id');
    assert(url.searchParams.get('context'), 'CTA context required');
    await login('newcompany-login', guest, true);
    await guest.p.waitForURL(url => url.pathname === '/offers/new/' && url.searchParams.get('requestId') === redirectRequestId, { timeout: 30000 });
    await guest.p.getByRole('textbox', { name: /^მოკლე აღწერა/ }).waitFor();
  });

} finally {
  save();
  const elapsed = Date.now() - ts;
  console.table(results.map(({ step, status, reason, ms }) => ({ step, status, reason: reason.slice(0, 180), ms })));
  console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s; PASS ${results.filter(r => r.status === 'PASS').length}; FAIL ${results.filter(r => r.status === 'FAIL').length}; seeds ${seeds.length}`);
  const flows = path.join(out, 'FLOWS.md'); const existing = fs.readFileSync(flows, 'utf8').split('\n\n## მუდმივი E2E —')[0];
  let number = Math.max(11, ...[...existing.matchAll(/^\| QA-(\d{2,4}) \|/gm)].map(m => Number(m[1]))) + 1;
  const clean = s => s.replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ').slice(0, 1600);
  const failures = results.filter(r => r.status === 'FAIL');
  const roots = failures.filter(r => !r.reason.includes('Prerequisite missing:'));
  const dependent = failures.filter(r => r.reason.includes('Prerequisite missing:'));
  const source = step => step.startsWith('A01') ? 'web/app/components/market/AuthForms.tsx; db/schema.sql (complete_profile)' : step.startsWith('A') ? 'web/app/components/market/OnboardSteps.tsx; VerificationDocuments.tsx' : /^B0[34]/.test(step) ? 'web/app/lib/market-store.js; web/app/lib/catalog-visibility.js' : /^B0[12]/.test(step) ? 'web/app/components/market/PostRequestPage.tsx; db/schema.sql' : /^B0[5-8]/.test(step) ? 'web/app/components/market/SendOfferForm.tsx; RequestViewPageContent.tsx' : step.startsWith('B') ? 'web/app/components/market/DealViewPageContent.tsx' : step.startsWith('C10') ? 'web/app/components/market/EngagementPanels.tsx (NoticeDetail)' : /^C1[12]/.test(step) ? 'web/app/components/market/AdminContentEditor.tsx; CompaniesPageContent.tsx' : step.startsWith('C') ? 'web/app/components/market/VerificationDocuments.tsx; AdminReviews.tsx; AdminReports.tsx' : 'web/app/components/market/AuthForms.tsx; RequestViewPageContent.tsx';
  const summary = `\n\n## მუდმივი E2E — ${new Date(ts).toISOString()}\n\nგაშვება: \`cd web && npm run dev -- --port 3402 --webpack\`, შემდეგ \`cd web && npm run e2e\`. BASE: ${BASE}. ხანგრძლივობა: ${(elapsed / 1000).toFixed(1)} წმ. PASS: ${results.length - failures.length}; FAIL: ${failures.length}. SQL seed: ${seeds.length} (გამოძახებები: ${JSON.stringify(seeds)}). [სრული ანგარიში](e2e-report.json). FAIL დამოკიდებულება მიუთითებს შეუსრულებელ წინაპირობაზე და არა დადასტურებულ დამოუკიდებელ პროდუქტის ხარვეზზე.\n\n| ნაბიჯი | შედეგი |\n|---|---|\n${results.map(r => `| ${r.step} | ${r.status} |`).join('\n')}\n\n| ID | ფაქტი | მტკიცებულება | სიმძიმე | ფაილი | acceptance |\n|---|---|---|---|---|---|\n${roots.map(r => `| QA-${number++} | ${r.step}: ${clean(r.reason)} | ${r.shots.map(s => `[კადრი](${s})`).join(', ')}; e2e-report.json | ${r.reason.includes('Prerequisite') ? 'დამოკიდებულება' : 'P2 / დასაკვლევი'} | ${source(r.step)}; runner: web/qa/e2e-full.mjs (${r.step}); root cause დასადგენია | შესაბამისი ნაბიჯი სრულდება UI-ით, console/pageerror/overflow = 0 |`).join('\n')}\n\nდარჩენილი: ${failures.length ? failures.map(r => r.step).join(', ') : 'არ არის'}. სკრინშოტები ადგილობრივია, git-ში არ დაამატოთ.\n`;
  const dependencyRow = dependent.length ? `\n| QA-${number++} | დამოკიდებული ნაბიჯები — იხ. e2e-report.json (${dependent.length} ნაბიჯი) | [ანგარიში](e2e-report.json) | დამოკიდებულება | web/qa/e2e-full.mjs | ფესვური ბლოკერების გასწორების შემდეგ ნაბიჯები სრულდება |\n` : '';
  fs.writeFileSync(flows, existing + summary.replace('\n\nდარჩენილი:', dependencyRow + '\n\nდარჩენილი:'));
  await browser.close(); await db.end(); process.exitCode = failures.length ? 1 : 0;
}
