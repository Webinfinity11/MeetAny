// auth-probe only. Permission probes use random missing IDs; no real record is mutated.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const base = process.env.BASE || 'http://localhost:3003';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const authBase = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
assert.equal(authBase, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./);
const ledgerText = fs.readFileSync(new URL('../../DEMO-ACCOUNTS.local.md', import.meta.url), 'utf8');
const ledger = JSON.parse(ledgerText.match(/```json\n([\s\S]*?)\n```/)[1]);
const account = key => {
  const a = ledger.accounts[key];
  const email = a?.email || ledgerText.split('\n').find(line => line.startsWith('|') && line.includes(key))?.match(/[\w.+-]+@[\w.-]+/)?.[0];
  assert(a?.id && a?.password && email, 'Missing account');
  return { ...a, key, email };
};
const handler = fs.readFileSync(new URL('../app/lib/db-handler.js', import.meta.url), 'utf8');
const names = [...handler.match(/const RPCS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'(admin_[^']+)'/g)].map(m => m[1]);
const id = randomUUID(), reason = 'QA missing target check';
const args = Object.fromEntries(names.map(name => [name, {}]));
Object.assign(args, {
  admin_set_verified: { p_user_id: id, p_verified: true },
  admin_set_blocked: { p_user_id: id, p_blocked: true, p_reason: reason },
  admin_set_hidden: { p_request_id: id, p_hidden: true, p_reason: reason },
  admin_delete_request: { p_request_id: id },
  admin_delete_request_v2: { p_request_id: id, p_reason: reason },
  admin_delete_offer: { p_offer_id: id, p_reason: reason },
  admin_conversation_messages: { p_conversation_id: id },
});
let total = 0, failures = 0, stage = 'initialization', browser;
function check(name, ok, details = '') {
  total++; if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${details ? ' '+details : ''}`);
}
async function login(a) {
  const jar = new Map();
  async function auth(route, body) {
    const res = await fetch(authBase + route, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error('Auth failed'), { status: res.status });
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], i = pair.indexOf('='); jar.set(pair.slice(0,i), pair.slice(i+1));
    }
    return data;
  }
  await auth('/sign-in/email', { email: a.email, password: a.password });
  const data = await auth('/token');
  assert(data?.token);
  assert.equal(JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url')).sub, a.id);
  return { ...a, jwt: data.token };
}
async function rpc(a, name, body = args[name] || {}) {
  const res = await fetch(`${base}/api/db/rpc/${name}`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json', ...(a ? { Authorization: 'Bearer '+a.jwt } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
function envelope(data) {
  return Array.isArray(data?.items) && 'nextCursor' in data && typeof data.hasMore === 'boolean' &&
    typeof data.filteredTotal === 'number' && typeof data.asOf === 'string';
}
try {
  stage = 'owner_user login'; const user = await login(account('owner_user'));
  stage = 'owner_company login'; let company;
  try { company = await login(account('owner_company')); }
  catch { stage = 'linen fallback login'; company = await login(account('linen')); console.log('Company fallback: linen'); }
  stage = 'owner_admin login'; const admin = await login(account('owner_admin'));
  for (const [a, role] of [[user, 'client'], [company, 'company'], [admin, 'admin']]) {
    stage = `${a.key} role`;
    const result = await rpc(a, 'my_profile', {});
    const profile = Array.isArray(result.data) ? result.data[0] : result.data;
    assert.equal(result.status, 200); assert.equal(profile?.role, role);
    check(stage, true);
  }
  for (const a of [user, company, null]) for (const name of names) {
    stage = `${a?.key || 'anonymous'} ${name}`;
    const { status, data } = await rpc(a, name);
    check(stage, a ? status === 400 && data?.hint === 'MA003' : status === 401 && data?.code === '42501',
      `HTTP ${status} ${data?.hint || data?.code || ''}`);
  }
  stage = 'owner_admin admin_stats';
  let result = await rpc(admin, 'admin_stats');
  check(stage, result.status === 200 && result.data?.adminApiVersion === 2);
  for (const name of ['admin_search_offers', 'admin_list_audit_v2']) {
    stage = `owner_admin ${name}`; result = await rpc(admin, name);
    check(stage, result.status === 200 && envelope(result.data));
  }
  for (const [name, hint] of [['admin_delete_offer', 'MA206'], ['admin_delete_request_v2', 'MA106']]) {
    stage = `owner_admin ${name} missing UUID`; result = await rpc(admin, name);
    check(stage, result.status === 400 && result.data?.hint === hint, `HTTP ${result.status} ${result.data?.hint || result.data?.code || ''}`);
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const a of [user, company]) {
    stage = `${a.key} browser denial`;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(base+'/account/');
      await page.locator('#login-email').fill(a.email);
      await page.locator('#login-password').fill(a.password);
      await page.locator('form button[type="submit"]').click();
      await page.locator('#login-email').waitFor({ state: 'hidden', timeout: 90000 });
      await page.goto(base+'/admin/', { waitUntil: 'networkidle' });
      await page.getByText('ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.', { exact: true }).waitFor({ timeout: 60000 });
      check(stage, await page.locator('main table').count() === 0);
    } finally { await context.close(); }
  }
} catch {
  // Auth/Playwright errors may contain credentials; only the safe stage is logged.
  check(stage+' completed', false);
} finally {
  if (browser) await browser.close();
  console.log(`Admin v2 permissions: ${total-failures}/${total} PASS (${names.length} admin RPCs)`);
  if (failures) process.exitCode = 1;
}
