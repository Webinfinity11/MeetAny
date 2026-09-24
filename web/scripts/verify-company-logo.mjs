// T12.4a live check of the company logo path against the local API on auth-probe:
// upload -> update_my_profile(p_logo_url) -> list_companies / public profile -> MA115 cases ->
// replace (old file deleted) -> remove ('') -> cleanup. Credentials are read from
// DEMO-ACCOUNTS.local.md and never printed. The company's other profile fields are sent back unchanged.
//   DEMO_API_ORIGIN=http://localhost:3001 node scripts/verify-company-logo.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { upload } from '@vercel/blob/client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const AUTH = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
assert.equal(AUTH, 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth', 'Wrong Neon Auth branch');
assert.match(new URL(process.env.DATABASE_URL).hostname, /^ep-withered-glade-b54ts1g5(?:-pooler)?\./, 'Wrong database branch');
const BASE = process.env.DEMO_API_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(BASE).hostname), 'Use a local API connected to auth-probe');

// First company row of the accounts table: | business | email | password | role |
const account = fs.readFileSync(path.join(ROOT, '..', 'DEMO-ACCOUNTS.local.md'), 'utf8').split('\n')
  .map(l => l.split('|').map(x => x.trim())).find(c => c.length === 6 && c[4] === 'company' && c[2].includes('@'));
assert(account, 'No company account');
const [email, password] = [account[2], account[3]];

async function call(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data, res };
}
const jar = new Map();
async function auth(route, body) {
  const out = await call(AUTH + route, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
    body: body ? JSON.stringify(body) : undefined });
  if (out.status >= 400) throw new Error(`auth ${route}: HTTP ${out.status}`);
  for (const c of out.res.headers.getSetCookie()) { const pair = c.split(';')[0]; const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
  return out.data;
}
await auth('/sign-in/email', { email, password });
const jwt = (await auth('/token'))?.token;
assert(jwt, 'no JWT');
const uid = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')).sub;
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt };
const rpc = (name, args = {}, headers = H) => call(`${BASE}/api/db/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
const one = d => Array.isArray(d) ? d[0] : d;

const results = [];
const check = (label, ok, detail = '') => { results.push({ label, ok: !!ok, detail }); assert(ok, `${label} ${detail}`); };
const uploaded = new Set();
const before = one((await rpc('my_profile')).data);
check('company profile', before?.role === 'company' && before.id === uid);
const fields = p => ({ p_name: p.name, p_company: p.company, p_city: p.city, p_industry: p.industry, p_about: p.about,
  p_offers: p.offers, p_seeks: p.seeks, p_service_cities: p.service_cities, p_address: p.address, p_lat: p.lat, p_lng: p.lng });
const setLogo = logo => rpc('update_my_profile', { ...fields(before), p_logo_url: logo });
const remove = url => call(`${BASE}/api/blob-upload`, { method: 'DELETE', headers: H, body: JSON.stringify({ url }) });
async function uploadLogo(file, name, type = 'image/jpeg') {
  const blob = await upload(`${uid}/${name}`, file, { access: 'public', handleUploadUrl: BASE + '/api/blob-upload',
    contentType: type, multipart: false, headers: { Authorization: 'Bearer ' + jwt } });
  uploaded.add(blob.url);
  return blob.url;
}

try {
  check('starts without a logo', before.logo_url == null, String(before.logo_url));
  const photo = new Blob([fs.readFileSync(path.join(ROOT, 'public/assets/photos/cardboard-packaging.jpg'))], { type: 'image/jpeg' });
  const url1 = await uploadLogo(photo, `logo-${Date.now().toString(36)}.jpg`);
  check('logo uploaded to own folder', new URL(url1).pathname.startsWith(`/${uid}/logo-`));

  let big = null;
  try { await uploadLogo(new Blob([Buffer.alloc(2 * 1024 * 1024 + 1024, 0xff)], { type: 'image/jpeg' }), `logo-big${Date.now().toString(36)}.jpg`); }
  catch (err) { big = err; }
  check('logo over 2 MB refused by Blob', big && /size|large|exceed/i.test(big.message), big?.message?.slice(0, 80));

  let set = await setLogo(url1);
  check('update_my_profile p_logo_url', set.status === 200 && one(set.data)?.logo_url === url1, `HTTP ${set.status}`);
  const listed = (await rpc('list_companies', {}, { 'Content-Type': 'application/json' })).data.find(c => c.id === uid);
  check('list_companies has logo_url (anonymous)', listed?.logo_url === url1);
  const pub = (await call(`${BASE}/api/db/profiles?select=id,logo_url&id=eq.${uid}`)).data;
  check('public profiles select has logo_url', one(pub)?.logo_url === url1);

  for (const [label, bad] of [
    ['foreign domain', `https://evil.example.com/${uid}/logo-x.jpg`],
    ['another user folder', url1.replace(uid, '00000000-0000-4000-8000-000000000000')],
    ['not a logo- file', url1.replace('/logo-', '/photo-')],
  ]) {
    const r = await setLogo(bad);
    check(`${label} -> 400 MA115`, r.status === 400 && JSON.stringify(r.data).includes('MA115'), `HTTP ${r.status} ${r.data?.code || r.data?.hint || ''}`);
  }
  const foreignDelete = await call(`${BASE}/api/blob-upload`, { method: 'DELETE', headers: H,
    body: JSON.stringify({ url: url1.replace(uid, '00000000-0000-4000-8000-000000000000') }) });
  check('DELETE of another user file -> 403', foreignDelete.status === 403, `HTTP ${foreignDelete.status}`);

  // Replace: new logo saved, then the old file is removed (what MarketStore.updateProfile does).
  const url2 = await uploadLogo(photo, `logo-${Date.now().toString(36)}b.jpg`);
  set = await setLogo(url2);
  check('replace logo', one(set.data)?.logo_url === url2);
  const del1 = await remove(url1);
  check('old logo deleted by owner', del1.status === 200, `HTTP ${del1.status}`);
  uploaded.delete(url1);

  set = await setLogo('');
  check("'' removes the logo", set.status === 200 && one(set.data)?.logo_url == null);
  const del2 = await remove(url2);
  check('removed logo file deleted', del2.status === 200, `HTTP ${del2.status}`);
  uploaded.delete(url2);

  const after = one((await rpc('my_profile')).data);
  const keys = ['name', 'company', 'city', 'industry', 'about', 'offers', 'seeks', 'service_cities', 'address', 'lat', 'lng'];
  check('other profile fields unchanged', keys.every(k => JSON.stringify(after[k]) === JSON.stringify(before[k])));
  check('logo_url back to null', after.logo_url == null);
} finally {
  const now = one((await rpc('my_profile')).data);
  if (now?.logo_url) await setLogo('');
  for (const url of uploaded) await remove(url);
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.label}${r.detail && !r.ok ? ' — ' + r.detail : ''}`);
  console.log(`${results.filter(r => r.ok).length}/${results.length} checks passed; leftover uploads cleaned: ${uploaded.size}`);
}
