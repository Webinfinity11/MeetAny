// Lists (and with --delete removes) leftover "AUDIT …" requests from qa/audit-perms.mjs runs, via the admin demo account.
// Run: QA_ORIGIN=http://localhost:3001 node qa/audit-leftovers.mjs [--delete]   (auth-probe only; never prints secrets)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const AUTH = 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
assert(AUTH.includes('ep-withered-glade-b54ts1g5'));
const H = { 'Content-Type': 'application/json', Origin: base };
const r = await fetch(AUTH + '/sign-in/email', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo-admin@meetany.ge', password: ledger.accounts.admin.password }) });
assert(r.ok, 'admin login ' + r.status);
const cookie = (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
const jwt = (await fetch(AUTH + '/get-session', { headers: { ...H, Cookie: cookie } })).headers.get('set-auth-jwt');
assert(jwt, 'no admin jwt');
const api = async (method, p, body) => {
  const res = await fetch(base + '/api/db/' + p, { method, headers: { Authorization: 'Bearer ' + jwt, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const names = Object.fromEntries(Object.entries(ledger.accounts).map(([k, a]) => [a.id, k]));
const all = (await api('GET', 'requests?select=id,title,owner_id,hidden&order=created_at.desc&limit=1000')).data;
assert(Array.isArray(all), 'requests list');
const hits = all.filter(x => /^AUDIT\b/.test(x.title));
const offers = (await api('GET', 'offers?select=id,request_id&limit=1000')).data || [];
for (const x of hits) console.log(`${x.id.slice(0, 8)} | ${x.title} | ${names[x.owner_id] || x.owner_id.slice(0, 8)} | offers ${offers.filter(o => o.request_id === x.id).length}${x.hidden ? ' | hidden' : ''}`);
console.log(`${hits.length} AUDIT request(s)`);
if (process.argv.includes('--delete')) {
  for (const x of hits) { const d = await api('POST', 'rpc/admin_delete_request', { p_request_id: x.id }); console.log(`delete ${x.id.slice(0, 8)}: ${d.status}`); }
  const left = (await api('GET', 'requests?select=id,title&limit=1000')).data.filter(x => /^AUDIT\b/.test(x.title));
  const orphan = ((await api('GET', 'offers?select=id,request_id&limit=1000')).data || []).filter(o => hits.some(x => x.id === o.request_id));
  console.log(`after: ${left.length} AUDIT request(s), ${orphan.length} offer(s) on deleted requests`);
}
