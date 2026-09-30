import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

export { assert };
export const root = path.resolve(import.meta.dirname, '../..');
export const origin = process.env.QA_ORIGIN || 'http://localhost:3001';
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).flatMap(line => {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
export const branch = 'auth-probe';
export const auth = env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
export function guard() {
  assert.equal(process.env.QA_BRANCH || branch, branch, 'QA_BRANCH უნდა იყოს auth-probe');
  assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'მხოლოდ ლოკალური QA_ORIGIN');
  assert.match(new URL(env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'მხოლოდ auth-probe ბაზა');
  assert.equal(auth, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth');
}
guard();
const ledgerPath = [path.join(root, 'DEMO-ACCOUNTS.local.md'), path.join(root, '../DEMO-ACCOUNTS.local.md')].find(p => fs.existsSync(p));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
export const demoSnapshotIds = { profiles: Object.values(ledger.accounts).map(a => a.id).filter(Boolean), requests: Object.values(ledger.v2?.requests || {}) };
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
secrets.push(env.DATABASE_URL, env.BLOB_READ_WRITE_TOKEN);
export const safe = value => secrets.filter(Boolean).reduce((s, secret) => s.replaceAll(secret, '[redacted]'), String(value)).replace(/\x1b\[[0-9;]*m/g, '').replace(/Bearer\s+[^\s"']+/g, 'Bearer [redacted]');
export const sql = neon(env.DATABASE_URL, { fetchOptions: { signal: undefined } });
export const query = (text, values = []) => { guard(); return sql.query(text, values, { fetchOptions: { signal: AbortSignal.timeout(8000) } }); };
export const credentials = key => ({ email: ledger.accounts[key].email || `demo-${key}@meetany.ge`, password: ledger.accounts[key].password });
export const randomPassword = () => { const p = crypto.randomBytes(24).toString('base64url'); secrets.push(p); return p; };
export function validateRunId(run) { assert.match(run || '', /^[0-9]{13}(?:-[a-z][a-z0-9-]{0,40})?$/, 'არასწორი run-id'); return run; }
export const markerFor = run => `[e2e:${validateRunId(run)}]`;
export const journalDir = path.join(root, 'qa/e2e/runs');
export function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', safe(JSON.stringify(data, null, 2)) + '\n', { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}
class TrackedSet extends Set {
  constructor(changed) { super(); this.changed = changed; }
  add(value) { super.add(value); this.changed(); return this; }
}

const tokens = new WeakMap();
export async function token(p) {
  const cached = tokens.get(p);
  if (cached && cached.expires > Date.now()) return cached.value;
  const remember = value => { tokens.set(p, { value, expires: Date.now() + 300000 }); return value; };
  const r = await p.request.get(auth + '/token', { timeout: 10000 });
  if (r.ok()) { const data = await r.json(); if (data?.token) return remember(data.token); }
  const anon = await p.request.get(auth + '/token/anonymous', { timeout: 10000 });
  assert(anon.ok(), 'ანონიმური JWT ვერ ჩაიტვირთა');
  return remember((await anon.json()).token);
}
export async function api(p, route, body) {
  const jwt = await token(p);
  const r = await p.request.fetch(origin + '/api/db/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${jwt}` }, ...(body === undefined ? {} : { data: body }), timeout: 10000 });
  const text = await r.text();
  let data = null;
  if (text.trim()) { try { data = JSON.parse(text); } catch { throw new Error(`${route}: HTTP ${r.status()}, პასუხი JSON არ არის`); } }
  if (r.ok?.() !== false && r.status() >= 200 && r.status() < 300) p.qaScenario?.record(route, data);
  return { status: r.status(), data };
}
export async function db(p, route, body) {
  const r = await api(p, route, body);
  assert([200, 204].includes(r.status), `${route}: HTTP ${r.status}; ${safe(r.data?.message || '')}`);
  return r.data;
}
export const rpc = (p, fn, args = {}) => db(p, 'rpc/' + fn, args);
export async function go(p, route) {
  const anchor = p.locator('a').filter({ visible: true });
  const hrefs = await anchor.evaluateAll(links => links.map(a => a.getAttribute('href')));
  if (p.url().startsWith(origin) && hrefs.includes(route)) {
    await p.locator(`a[href="${route}"]`).filter({ visible: true }).first().click();
    await p.waitForURL(origin + route);
  } else await p.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await p.locator('main').waitFor();
  await p.waitForFunction(() => !!document.querySelector('main')?.innerText.trim() && !document.querySelector('main [aria-busy="true"]'), null, { timeout: 18000 });
  assert(!(await p.locator('main').innerText()).includes('სერვისი დროებით მიუწვდომელია'), 'UI: სერვისი დროებით მიუწვდომელია');
}
export async function login(p, account = 'hotel') {
  const c = typeof account === 'string' ? credentials(account) : account;
  if (typeof account === 'string') {
    const response = await p.request.post(auth + '/sign-in/email', { data: c, timeout: 10000 });
    assert(response.ok(), `შესვლის API: HTTP ${response.status()}`);
    tokens.delete(p);
    const me = (await rpc(p, 'my_profile'))[0];
    assert(me && !me.blocked, 'აქტიური პროფილი ვერ მოიძებნა');
    return me;
  }
  await go(p, '/account/');
  await p.locator('#login-email').fill(c.email);
  await p.locator('#login-password').fill(c.password);
  await p.locator('main form button[type="submit"]').click();
  await p.locator('#login-email').waitFor({ state: 'hidden', timeout: 15000 });
  tokens.delete(p);
  const me = (await rpc(p, 'my_profile'))[0];
  assert(me && !me.blocked, 'შესვლის შემდეგ აქტიური პროფილი უნდა არსებობდეს');
  return me;
}
export async function logout(p) {
  await go(p, '/account/?tab=profile');
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.locator('header [aria-controls="ma-account-menu"]').click();
  await p.getByRole('menuitem', { name: 'გასვლა', exact: true }).click();
  await p.locator('#login-email').waitFor();
  tokens.delete(p);
  assert.equal((await rpc(p, 'my_profile')).length, 0, 'გასვლის შემდეგ სესია დარჩა');
}
export async function until(fn, description, timeout = 7000) {
  const end = Date.now() + timeout;
  do { if (await fn()) return; await new Promise(r => setTimeout(r, 180)); } while (Date.now() < end);
  assert.fail(description);
}
export async function requestRow(p, id) { return (await db(p, `requests?select=*&id=eq.${id}`))[0]; }
export const requestPath = id => `/requests/view/?id=${id}`;
export async function profileArgs(p) {
  return { p_name: p.name, p_company: p.company, p_city: p.city, p_industry: p.industry, p_about: p.about || '', p_offers: p.offers || [], p_seeks: p.seeks || [], p_service_cities: p.service_cities || [], p_address: p.address, p_lat: p.lat, p_lng: p.lng };
}

export class Scenario {
  constructor(browser, name, run) {
    validateRunId(run);
    this.branch = branch;
    this.browser = browser; this.name = name; this.run = run; this.marker = markerFor(run);
    this.steps = []; this.cspViolations = []; this.contexts = []; this.accounts = new TrackedSet(() => this.persist()); this.offers = new TrackedSet(() => this.persist()); this.messages = new TrackedSet(() => this.persist()); this.conversations = new TrackedSet(() => this.persist()); this.requests = new TrackedSet(() => this.persist()); this.contacts = new TrackedSet(() => this.persist()); this.photos = new TrackedSet(() => this.persist()); this.emails = new TrackedSet(() => this.persist()); this.restores = []; this.cleanupLog = []; this.stopped = false;
    this.journalFile = path.join(journalDir, run + '.json');
  }
  persist() {
    if (!this.journalFile) return;
    atomicJson(this.journalFile, { version: 1, branch, name: this.name, run: this.run, marker: this.marker, requests: [...this.requests], offers: [...this.offers], messages: [...this.messages], conversations: [...this.conversations], accounts: [...this.accounts], contacts: [...this.contacts], photos: [...this.photos], emails: [...this.emails], restores: this.restores, cleanupLog: this.cleanupLog, cleaned: !!this.cleaned });
  }
  record(route, data) {
    if (!data || Array.isArray(data)) return;
    if (route.endsWith('create_request') && data.title?.includes(this.marker)) { this.requests.add(data.id); if (data.photo_url) this.photos.add(data.photo_url); }
    if (route.endsWith('send_offer') && this.requests.has(data.request_id)) this.offers.add(data.id);
    if (route.endsWith('start_conversation') && this.requests.has(data.request_id)) this.conversations.add(data.id);
    if (route.endsWith('send_message') && data.body?.includes(this.marker)) { this.messages.add(data.id); this.conversations.add(data.conversation_id); }
    if (route.endsWith('complete_profile') && this.emails.has(data.email)) this.accounts.add(data.id);
    if (route.endsWith('log_contact_event') && data.recorded && data.id) this.contacts.add(data.id);
  }
  restoreAfter(restore) { this.restores.push(restore); this.persist(); }
  async page(account, cleaning = false) {
    assert(cleaning || !this.stopped, 'სცენარის დრო ამოიწურა');
    const ctx = await this.browser.newContext({ viewport: { width: 1440, height: 1000 } });
    this.contexts.push(ctx);
    await ctx.exposeBinding('qaCspViolation', (_source, event) => this.cspViolations.push(event));
    await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
      window.qaCspViolation({ directive: event.effectiveDirective, blockedURI: event.blockedURI, disposition: event.disposition });
    }));
    const p = await ctx.newPage(); this.current = p; p.qaScenario = this;
    p.qaNetwork = [];
    p.on('requestfailed', r => p.qaNetwork.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    p.on('response', r => { if(r.status() >= 400) p.qaNetwork.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    p.setDefaultTimeout(12000); p.setDefaultNavigationTimeout(12000);
    p.on('response', async r => {
      // Capture ONLY IDs returned to this browser; never delete events by time range.
      try {
        if (!r.ok()) return;
        if (r.url().includes('/api/db/rpc/')) this.record(new URL(r.url()).pathname, await r.json());
        if (r.url().endsWith('/api/blob-upload') && r.request().method() === 'POST') { const d = await r.json(); if (d.url) this.photos.add(d.url); }
        if (r.url().endsWith('/sign-up/email')) { const d = await r.json(); if (this.emails.has(d.user?.email)) this.accounts.add(d.user.id); }
      } catch { /* Closed page; SQL marker recovery below covers created requests. */ }
    });
    if (account) await login(p, account);
    return p;
  }
  async shot(p = this.current) {
    if (!p || p.isClosed()) return null;
    this.shotCounter = (this.shotCounter || 0) + 1;
    const file = `qa/shots/e2e/${this.name}-${this.shotCounter}.png`;
    try {
      await p.addStyleTag({ content: 'nextjs-portal{display:none!important} input[autocomplete="current-password"],input[autocomplete="new-password"]{visibility:hidden!important}' });
      await p.screenshot({ path: path.join(root, file), fullPage: true, timeout: 2500 });
      if (!this.firstShot) { fs.copyFileSync(path.join(root, file), path.join(root, `qa/shots/e2e/${this.name}.png`)); this.firstShot = file; }
      return file;
    } catch { return null; }
  }
  async step(name, expected, fn, p = this.current) {
    if (this.stopped) return false;
    this.current = p || this.current;
    const start = Date.now();
    try { const evidence = await fn(); this.steps.push({ name, status: 'PASS', expected, evidence, ms: Date.now() - start }); this.checkpoint?.(); return true; }
    catch (e) {
      const visibleState = await p?.locator('main').innerText({ timeout: 500 }).catch(() => '') || '';
      const screenshot = await this.shot(p);
      const actual = visibleState.includes('სერვისი დროებით მიუწვდომელია') ? 'UI: სერვისი დროებით მიუწვდომელია. ' + e.message : e.message;
      this.steps.push({ name, status: 'FAIL', expected, actual: safe(actual), visibleState: safe(visibleState.slice(0, 1000)), network: p?.qaNetwork, screenshot, ms: Date.now() - start });
      this.checkpoint?.(); return false;
    }
  }
  async fixture(p, suffix = '') {
    assert(!this.stopped, 'სცენარის დრო ამოიწურა');
    const r = await rpc(p, 'create_request', { p_title: `ავეჯის მიწოდება ${this.marker} ${suffix}`, p_body: 'გვჭირდება ხის მაგიდა, ადგილზე მიტანით და აწყობით.', p_category: 'furniture', p_city: 'tbilisi', p_quantity: 2, p_unit: 'pcs' });
    this.requests.add(r.id); return r;
  }
  async cleanup() {
    // SQL is limited to this run's IDs + marker. App mutations and assertions use /api/db.
    guard();
    if (this.cleaned) return;
    this.persist();
    for (const restore of [...this.restores].reverse()) {
      if (restore.done) continue;
      try {
        const keys = Object.keys(restore.fields);
        assert(keys.every(k => ['address','lat','lng','offers','blocked','blocked_reason','verified','verified_at'].includes(k)));
        const existing = await query('select count(*)::int n from public.profiles where id=$1 and email=$2', [restore.id, restore.email]);
        assert.equal(existing[0].n, 1);
        const sets = keys.map((key, i) => `"${key}"=$${i + 3}`).join(',');
        await query(`update public.profiles set ${sets} where id=$1 and email=$2`, [restore.id, restore.email, ...keys.map(k => restore.fields[k])]);
        restore.done = true; this.persist();
        this.cleanupLog.push({ restore: 'PASS', fields: keys, method: 'auth-probe SQL; exact profile ID + email' });
      }
      catch (e) { this.cleanupLog.push({ restore: 'FAIL', reason: safe(e.message) }); }
    }
    const owned = await query('select id, photo_url from public.requests where position($1 in title)>0', [this.marker]);
    for (const r of owned) { this.requests.add(r.id); if (r.photo_url) this.photos.add(r.photo_url); }
    const ids = [...this.requests], contactIds = [...this.contacts];
    let cids = [], counts = { messages: 0, conversations: 0, requests: 0, offers: 0 };
    if (ids.length) {
      const mismatched = await query('select count(*)::int n from public.requests where id=any($1::uuid[]) and position($2 in title)=0', [ids, this.marker]);
      assert.equal(mismatched[0].n, 0, 'cleanup: მოთხოვნის ID ამ run-მარკერს არ ეკუთვნის');
      const conversations = await query('select id, context_key from meetany_private.conversations where context_key=any($1::text[]) or id=any($2::uuid[])', [ids, [...this.conversations]]);
      assert(conversations.every(c => ids.includes(c.context_key)), 'cleanup: საუბარი ამ გაშვების მოთხოვნას არ ეკუთვნის');
      cids = conversations.map(c => c.id);
      for (const id of cids) this.conversations.add(id);
      counts = (await query(`select (select count(*)::int from meetany_private.messages where conversation_id=any($1::uuid[])) messages, (select count(*)::int from meetany_private.conversations where id=any($1::uuid[])) conversations, (select count(*)::int from public.requests where id=any($2::uuid[])) requests, (select count(*)::int from public.offers where request_id=any($2::uuid[])) offers`, [cids, ids]))[0];
      const foreign = await query('select count(*)::int n from meetany_private.messages where conversation_id=any($1::uuid[]) and position($2 in body)=0', [cids, this.marker]);
      assert.equal(foreign[0].n, 0, 'cleanup: საუბარში სხვა გაშვების შეტყობინებაა');
      this.cleanupLog.push({ phase: 'before-delete', ...counts }); this.persist();
      await sql.transaction([
        sql.query('delete from meetany_private.messages where conversation_id=any($1::uuid[]) and position($2 in body)>0', [cids, this.marker]),
        sql.query('delete from meetany_private.conversations where id=any($1::uuid[]) and context_key=any($2::text[])', [cids, ids]),
        sql.query('delete from public.requests where id=any($1::uuid[]) and position($2 in title)>0', [ids, this.marker]),
      ], { fetchOptions: { signal: AbortSignal.timeout(8000) } });
    }
    let contactCount = 0;
    if (contactIds.length) {
      contactCount = (await query('select count(*)::int n from meetany_private.contact_events where id=any($1::uuid[])', [contactIds]))[0].n;
      this.cleanupLog.push({ phase: 'before-delete-contacts', contacts: contactCount }); this.persist();
      await query('delete from meetany_private.contact_events where id=any($1::uuid[])', [contactIds]);
    }
    for (const url of this.photos) {
      assert(new URL(url).hostname.endsWith('.public.blob.vercel-storage.com'), 'cleanup: უცნობი Blob');
      const { del } = await import('@vercel/blob');
      await del(url, { token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(8000) });
    }
    const remaining = (await query(`select (select count(*) from public.requests where id=any($1::uuid[])) + (select count(*) from public.offers where request_id=any($1::uuid[])) + (select count(*) from meetany_private.conversations where id=any($2::uuid[])) + (select count(*) from meetany_private.messages where conversation_id=any($2::uuid[])) + (select count(*) from meetany_private.contact_events where id=any($3::uuid[])) as n`, [ids, [...new Set([...cids, ...this.conversations])], contactIds]))[0].n;
    assert.equal(Number(remaining), 0, 'cleanup: ჩანაწერები დარჩა');
    this.cleanupLog.push({ ...counts, contacts: contactCount, photos: this.photos.size, remaining: Number(remaining) });
    if (this.emails.size) {
      const emails = [...this.emails];
      assert(emails.every(email => email.includes(this.run) && email.endsWith('@meetany.local')));
      const { request } = await import('playwright');
      const context = await request.newContext();
      const admin = { request: context };
      try {
      await login(admin, 'owner_admin');
      const users = await query('select id from public.profiles where email=any($1::text[])', [emails]);
      for (const u of users) this.accounts.add(u.id);
      for (const u of users) await rpc(admin, 'admin_set_blocked', { p_user_id: u.id, p_blocked: true, p_reason: 'ავტომატური შემოწმება დასრულდა' });
      const states = await rpc(admin, 'admin_list_users');
      assert(users.every(u => states.find(p => p.id === u.id)?.blocked), 'სატესტო ანგარიში არ დაბლოკილა');
      const orphan = await query('select id from neon_auth."user" u where email=any($1::text[]) and not exists(select 1 from public.profiles p where p.id=u.id)', [emails]);
      if (orphan.length) await query('delete from neon_auth."user" u where email=any($1::text[]) and id=any($2::uuid[]) and not exists(select 1 from public.profiles p where p.id=u.id)', [emails, orphan.map(u => u.id)]);
      this.cleanupLog.push({ accountsBlocked: users.length, incompleteAccountsDeleted: orphan.length });
      } finally { await context.dispose(); }
    }
    this.cleaned = !this.restores.some(r => !r.done);
    this.persist();
    assert(this.cleaned, 'cleanup: პროფილის აღდგენა ვერ დასრულდა');
  }
}

/** Picks a value in a native <select> or in CustomSelect (a combobox button whose hidden native select is its next sibling). */
export async function choose(page, selector, value) {
  const el = page.locator(selector);
  const tag = await el.evaluate(e => e.tagName);
  return (tag === 'SELECT' ? el : page.locator(`${selector} + select`)).selectOption(value);
}
