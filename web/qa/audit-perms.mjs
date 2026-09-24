// P12 full-stack audit: permission probes against the local /api/db (auth-probe branch).
// Run: QA_ORIGIN=http://localhost:3001 node qa/audit-perms.mjs   (prints a ✅/❌ table; never prints secrets)
// Writes only its own rows: one test request (+ one offer) that the admin deletes in `finally` (with any AUDIT leftovers),
// plus an empty "general" A<->wood conversation if the pair had none. Everything else is read-only or must be refused.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.QA_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const ledger = JSON.parse(fs.readFileSync(path.join(root, '../DEMO-ACCOUNTS.local.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
const secrets = Object.values(ledger.accounts).map(a => a.password).filter(Boolean);
const safe = v => secrets.reduce((t, s) => t.replaceAll(s, '[redacted]'), String(v));
const AUTH = 'https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
const H = { 'Content-Type': 'application/json', Origin: base };

async function login(key) {
  const r = await fetch(AUTH + '/sign-in/email', { method: 'POST', headers: H, body: JSON.stringify({ email: `demo-${key}@meetany.ge`, password: ledger.accounts[key].password }) });
  assert(r.ok, `login ${key}: ${r.status}`);
  const cookie = (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const s = await fetch(AUTH + '/get-session', { headers: { ...H, Cookie: cookie } });
  const jwt = s.headers.get('set-auth-jwt');
  assert(jwt, `no jwt for ${key}`);
  return jwt;
}
async function api(jwt, method, p, body) {
  const t0 = Date.now();
  const r = await fetch(base + '/api/db/' + p, { method, headers: { ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, ms: Date.now() - t0, code: /^(MA\d{3})/.exec(data?.message || '')?.[1] || data?.code || null };
}
const rpc = (jwt, fn, args = {}) => api(jwt, 'POST', 'rpc/' + fn, args);
const rows = [];
const check = (name, expected, actual, ok) => { rows.push({ name, expected, actual, ok }); console.log(`${ok ? '✅' : '❌'} ${name} | ${expected} | ${actual}`); };
const refused = r => r.status >= 400 && r.status < 500;
const desc = r => `${r.status}${r.code ? ' ' + r.code : ''}`;
const NIL = '00000000-0000-4000-8000-000000000000';

const id = k => ledger.accounts[k].id;
const tok = {};
for (const k of ['hotel', 'cafe', 'wood', 'linen', 'admin']) tok[k] = await login(k);
const A = tok.hotel, B = tok.cafe, C1 = tok.wood, C2 = tok.linen, ADM = tok.admin;
let testRequest = null;
const photoRequests = [];
try {
  // ---- tables, anonymous
  let r = await api(null, 'GET', 'profiles?select=*&limit=1');
  check('anon: profiles select=*', '401', desc(r), r.status === 401);
  r = await api(null, 'GET', 'profiles?select=id,email&limit=1');
  check('anon: profiles select=email', '401', desc(r), r.status === 401);
  r = await api(A, 'GET', 'profiles?select=id,email&limit=1');
  check('client: profiles select=email', '403', desc(r), r.status === 403);
  r = await api(null, 'GET', 'profiles?select=id,phone,role&limit=1');
  check('anon: profiles id,phone,role (public by design)', '200', desc(r), r.status === 200 && r.data?.[0]?.phone);
  r = await api(null, 'GET', 'offers?select=*');
  check('anon: offers', '401', desc(r), r.status === 401);
  for (const m of ['PATCH', 'PUT', 'DELETE', 'POST']) {
    r = await api(A, m, 'profiles?id=eq.' + id('cafe'), { role: 'admin' });
    check(`client: ${m} profiles`, '405', desc(r), r.status === 405);
  }
  r = await api(A, 'POST', 'requests', { title: 'x' });
  check('client: POST requests (direct insert)', '405', desc(r), r.status === 405);

  // ---- sealed offers
  const mine = (await api(A, 'GET', 'requests?select=id&owner_id=eq.' + id('hotel'))).data.map(x => x.id);
  r = await api(A, 'GET', 'offers?select=id,request_id,company_id');
  check('client A: offers only on own requests', 'all request_id ∈ own', `${r.data?.length} rows`, r.status === 200 && r.data.every(o => mine.includes(o.request_id)));
  r = await api(C1, 'GET', 'offers?select=id,company_id');
  check('company: offers only own', 'all company_id = self', `${r.data?.length} rows`, r.status === 200 && r.data.every(o => o.company_id === id('wood')));
  const foreign = (await api(ADM, 'GET', 'offers?select=id,request_id,company_id&limit=1000')).data.find(o => o.company_id !== id('wood') && !mine.includes(o.request_id));
  r = await api(A, 'GET', `offers?select=*&id=eq.${foreign.id}`);
  check('client A: read foreign offer by id', '[]', JSON.stringify(r.data), Array.isArray(r.data) && r.data.length === 0);
  r = await api(C1, 'GET', `offers?select=*&id=eq.${foreign.id}`);
  check('company C1: read other company offer by id', '[]', JSON.stringify(r.data), Array.isArray(r.data) && r.data.length === 0);

  // ---- own test request by client B
  r = await rpc(B, 'create_request', { p_title: 'AUDIT test request', p_body: 'temporary request created by qa/audit-perms.mjs', p_category: 'other', p_city: 'tbilisi' });
  assert(r.status === 200 && r.data?.id, 'create test request: ' + desc(r));
  testRequest = r.data.id;
  const T = testRequest;
  r = await rpc(A, 'update_request', { p_request_id: T, p_title: 'HACKED title', p_body: 'hacked body text', p_category: 'other', p_city: 'tbilisi' });
  check('client A: update_request on B request', 'MA107', desc(r), r.code === 'MA107');
  for (const fn of ['close_request', 'extend_request', 'delete_request']) {
    r = await rpc(A, fn, { p_request_id: T });
    check(`client A: ${fn} on B request`, 'MA107', desc(r), r.code === 'MA107');
    r = await rpc(null, fn, { p_request_id: T });
    check(`anon: ${fn}`, '401', desc(r), r.status === 401 || r.code === 'MA001');
  }
  r = await rpc(C1, 'delete_request', { p_request_id: T });
  check('company: delete_request on B request', 'MA107', desc(r), r.code === 'MA107');
  // offers
  r = await rpc(A, 'send_offer', { p_request_id: T, p_body: 'client tries to send an offer' });
  check('client A: send_offer', 'MA201', desc(r), r.code === 'MA201');
  r = await rpc(B, 'send_offer', { p_request_id: T, p_body: 'owner offers on own request' });
  check('owner B: send_offer on own request', 'MA201 (client role)', desc(r), r.code === 'MA201' || r.code === 'MA202');
  r = await rpc(null, 'send_offer', { p_request_id: T, p_body: 'anonymous offer body' });
  check('anon: send_offer', '401', desc(r), r.status === 401 || r.code === 'MA001');
  r = await rpc(C1, 'send_offer', { p_request_id: T, p_body: 'AUDIT offer from company one', p_price_type: 'negotiable' });
  assert(r.status === 200 && r.data?.id, 'C1 offer: ' + desc(r));
  const O = r.data.id;
  r = await rpc(C1, 'send_offer', { p_request_id: T, p_body: 'AUDIT offer with price', p_price: 5, p_price_type: 'negotiable' });
  check('company: negotiable + price', 'MA211', desc(r), r.code === 'MA211');
  r = await api(C2, 'GET', `offers?select=*&request_id=eq.${T}`);
  check('company C2: sees C1 offer on B request', '[]', JSON.stringify(r.data), Array.isArray(r.data) && r.data.length === 0);
  r = await api(A, 'GET', `offers?select=*&request_id=eq.${T}`);
  check('client A: sees offers on B request', '[]', JSON.stringify(r.data), Array.isArray(r.data) && r.data.length === 0);
  r = await api(B, 'GET', `offers?select=id&request_id=eq.${T}`);
  check('owner B: sees offer on own request', '1 row', `${r.data?.length} rows`, r.data?.length === 1);
  for (const [who, tk] of [['client A', A], ['company C2', C2], ['anon', null]]) {
    r = await rpc(tk, 'choose_offer', { p_offer_id: O });
    check(`${who}: choose_offer on B request`, 'refused (MA206/MA001)', desc(r), refused(r));
    r = await rpc(tk, 'withdraw_offer', { p_offer_id: O });
    check(`${who}: withdraw_offer of C1`, 'refused', desc(r), refused(r));
    r = await rpc(tk, 'contact_for_request', { p_request_id: T });
    check(`${who}: contact_for_request (not chosen)`, '[] / empty', JSON.stringify(r.data), r.status === 401 || (Array.isArray(r.data) && r.data.length === 0));
  }
  r = await rpc(B, 'choose_offer', { p_offer_id: NIL });
  check('owner: choose_offer unknown id', 'MA206', desc(r), r.code === 'MA206');

  // ---- profile
  r = await rpc(A, 'update_my_profile', { p_name: 'Hacker', p_company: 'x', p_city: 'tbilisi', p_id: id('cafe') });
  check('update_my_profile with foreign p_id', '404 unknown arg', desc(r), r.status === 404);
  r = await rpc(A, 'update_my_profile', { p_name: 'X', p_company: 'x', p_city: 'tbilisi', p_role: 'admin' });
  check('update_my_profile with p_role', '404 unknown arg', desc(r), r.status === 404);
  r = await rpc(A, 'complete_profile', { p_role: 'admin', p_name: 'Hacker' });
  const me = [(await rpc(A, 'my_profile')).data].flat()[0];
  check('complete_profile p_role=admin on existing user', 'returns unchanged, role stays client', `role=${me?.role}`, me?.role === 'client');
  r = await rpc(null, 'my_profile');
  check('anon: my_profile', '401 / empty', desc(r), r.status === 401 || (Array.isArray(r.data) ? r.data.length === 0 : !r.data?.id));
  r = await rpc(A, 'my_profile');
  check('client: my_profile has only own row', 'id = A', `${(r.data?.id || r.data?.[0]?.id) === id('hotel')}`, (r.data?.id || r.data?.[0]?.id) === id('hotel'));

  // ---- admin-only RPCs
  const admin = [['admin_set_blocked', { p_user_id: NIL, p_blocked: true, p_reason: 'audit' }], ['admin_delete_request', { p_request_id: NIL }], ['admin_set_hidden', { p_request_id: NIL, p_hidden: true, p_reason: 'audit' }], ['admin_set_verified', { p_user_id: NIL, p_verified: true }],
    ['admin_list_users', {}], ['admin_stats', {}], ['admin_search_users', {}], ['admin_search_requests', {}], ['admin_list_audit', {}], ['admin_contact_events', {}], ['admin_contact_stats', {}], ['admin_list_conversations', {}], ['admin_conversation_messages', { p_conversation_id: NIL }], ['admin_message_stats', {}]];
  for (const [fn, args] of admin) {
    const out = [];
    for (const [who, tk] of [['anon', null], ['client', A], ['company', C1]]) { const x = await rpc(tk, fn, args); out.push(`${who}:${desc(x)}`); if (!refused(x)) out.push('LEAK'); }
    check(`non-admin: ${fn}`, 'refused (401/MA003)', out.join(' '), !out.includes('LEAK'));
  }
  r = await rpc(ADM, 'admin_stats');
  check('admin: admin_stats works', '200', desc(r), r.status === 200);

  // ---- messaging
  const convs = (await rpc(A, 'list_my_conversations')).data || [];
  let conv = convs.find(c => c.company_id === id('wood') && c.context_key === 'general');
  if (!conv) { r = await rpc(A, 'start_conversation', { p_company_id: id('wood') }); assert(r.status === 200, 'start conv ' + desc(r)); conv = r.data; }
  for (const [who, tk] of [['company C2', C2], ['client B', B], ['anon', null]]) {
    for (const [fn, args] of [['list_messages', { p_conversation_id: conv.id }], ['send_message', { p_conversation_id: conv.id, p_body: 'intruder' }], ['mark_read', { p_conversation_id: conv.id }]]) {
      r = await rpc(tk, fn, args);
      check(`${who}: ${fn} in A↔C1 conversation`, 'MA501 / 401', desc(r), refused(r));
    }
    r = await rpc(tk, 'list_my_conversations');
    check(`${who}: list_my_conversations excludes it`, 'not listed', desc(r), r.status === 401 || !(r.data || []).some(c => c.id === conv.id));
  }
  r = await rpc(A, 'start_conversation', { p_company_id: id('cafe') });
  check('client: start_conversation with a client', 'MA502', desc(r), r.code === 'MA502');
  r = await rpc(A, 'start_conversation', { p_company_id: id('wood'), p_request_id: T });
  check('client A: start_conversation on B request', 'MA504', desc(r), r.code === 'MA504');
  r = await rpc(A, 'send_message', { p_conversation_id: NIL, p_body: 'x' });
  check('send_message to unknown conversation', 'MA501', desc(r), r.code === 'MA501');
  r = await rpc(A, 'send_message', { p_conversation_id: conv.id, p_body: 'x'.repeat(2001) });
  check('send_message 2001 chars', 'MA505', desc(r), r.code === 'MA505');

  // ---- contact events
  const tests = [['unknown company', { p_target_kind: 'company', p_target_id: NIL, p_kind: 'reveal', p_source: 'company-list' }], ['client as company target', { p_target_kind: 'company', p_target_id: id('cafe'), p_kind: 'reveal', p_source: 'company-list' }],
    ['bad kind', { p_target_kind: 'company', p_target_id: id('wood'), p_kind: 'hack', p_source: 'company-list' }], ['source/kind mismatch', { p_target_kind: 'company', p_target_id: id('wood'), p_kind: 'call', p_source: 'chosen-offer' }], ['fake request id', { p_target_kind: 'request', p_target_id: NIL, p_kind: 'reveal', p_source: 'request-owner' }]];
  for (const [n, args] of tests) { r = await rpc(A, 'log_contact_event', args); check(`log_contact_event: ${n}`, '400', desc(r), r.status === 400); }
  r = await rpc(A, 'log_contact_event', { p_target_kind: 'company', p_target_id: id('wood'), p_kind: 'reveal', p_source: 'company-list', p_actor_id: id('cafe') });
  check('log_contact_event with p_actor_id', '404 unknown arg', desc(r), r.status === 404);

  // ---- photo url
  const bad = ['https://evil.example.com/' + id('hotel') + '/x.jpg', 'javascript:alert(1)//' + id('hotel') + '/x.jpg', 'https://abc.public.blob.vercel-storage.com/' + id('cafe') + '/x.jpg', 'http://localhost/' + id('hotel') + '/x.jpg'];
  for (const url of bad) {
    r = await rpc(A, 'create_request', { p_title: 'AUDIT photo test', p_body: 'temporary photo url check', p_category: 'other', p_city: 'tbilisi', p_photo_url: url });
    if (r.status === 200 && r.data?.id && (await rpc(ADM, 'admin_delete_request', { p_request_id: r.data.id })).status !== 200) photoRequests.push(r.data.id);
    check(`create_request photo_url ${url.slice(0, 40)}…`, 'MA109', desc(r), r.code === 'MA109');
  }

  // ---- other rpc
  r = await rpc(null, 'set_saved_company', { p_company_id: id('wood'), p_saved: true });
  check('anon: set_saved_company', '401', desc(r), r.status === 401);
  r = await rpc(A, 'set_saved_company', { p_company_id: id('cafe'), p_saved: true });
  check('client: save a client account', 'MA302', desc(r), r.code === 'MA302');
  for (const fn of ['pg_sleep', 'set_config', 'to_json', 'current_user', 'version']) { r = await rpc(A, fn, { seconds: 1 }); check(`rpc/${fn} (non-app function)`, '404', desc(r), r.status === 404); }
  r = await rpc(A, 'meetany_private.uid'); check('rpc/meetany_private.uid', '404', desc(r), r.status === 404);
  r = await rpc(A, 'create_request', {});
  check('create_request without arguments', '4xx (client input)', desc(r), r.status >= 400 && r.status < 500);
  r = await rpc(A, 'update_request', { p_request_id: 'not-a-uuid', p_title: 'aaaaaa', p_body: 'bbbbbbbbbbbb', p_category: 'other', p_city: 'tbilisi' });
  check('update_request bad uuid', '400', desc(r), r.status === 400);
  for (const q of ['requests?select=id;drop table x', 'requests?select=id&order=id.asc;select', 'requests?limit=-1', 'requests?limit=abc', 'requests?id=gt.1', 'nosuch']) { r = await api(null, 'GET', q); check(`GET ${q}`, '4xx', desc(r), refused(r)); }
  r = await api(null, 'GET', 'requests?path=profiles&select=*&limit=1');
  check('GET requests?path=profiles (path override, observation)', 'path= ignored', desc(r), r.status !== 401);
  // ---- forged / tampered tokens
  const [h, p, s] = A.split('.'); const claims = JSON.parse(Buffer.from(p, 'base64url').toString()); claims.sub = id('cafe');
  const forged = [h, Buffer.from(JSON.stringify(claims)).toString('base64url'), s].join('.');
  r = await rpc(forged, 'my_profile'); check('JWT with swapped sub', '401', desc(r), r.status === 401);
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ ...claims, role: 'authenticated' })).toString('base64url') + '.';
  r = await rpc(none + 'x', 'my_profile'); check('JWT alg=none', '401', desc(r), r.status === 401);
  r = await rpc('garbage.token.value', 'my_profile'); check('garbage bearer', '401', desc(r), r.status === 401);
  // ---- blob upload
  const blob = (jwt, method, body) => fetch(base + '/api/blob-upload', { method, headers: { ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.status);
  check('blob-upload anon POST', '401', await blob(null, 'POST', { type: 'blob.generate-client-token', payload: { pathname: id('hotel') + '/a.jpg' } }), true);
  let st = await blob(null, 'POST', { type: 'blob.generate-client-token', payload: { pathname: id('hotel') + '/a.jpg' } }); rows[rows.length - 1].actual = String(st); rows[rows.length - 1].ok = st === 401;
  st = await blob(A, 'POST', { type: 'blob.generate-client-token', payload: { pathname: id('cafe') + '/a.jpg' }, }); rows.push({ name: 'blob-upload: token for another user path', expected: '403', actual: String(st), ok: st === 403 }); console.log(`${st === 403 ? '✅' : '❌'} blob foreign path ${st}`);
  st = await blob(A, 'DELETE', { url: `https://abc123.public.blob.vercel-storage.com/${id('cafe')}/a.jpg` }); rows.push({ name: 'blob-upload: DELETE foreign photo', expected: '403', actual: String(st), ok: st === 403 }); console.log(`${st === 403 ? '✅' : '❌'} blob delete foreign ${st}`);
  st = await blob(null, 'DELETE', { url: 'https://abc123.public.blob.vercel-storage.com/x/a.jpg' }); rows.push({ name: 'blob-upload: anon DELETE', expected: '401', actual: String(st), ok: st === 401 }); console.log(`${st === 401 ? '✅' : '❌'} blob anon delete ${st}`);
} finally {
  // Delete every request this run created, then sweep AUDIT-titled leftovers of earlier interrupted runs.
  const created = new Set([testRequest, ...photoRequests].filter(Boolean));
  const listed = await api(ADM, 'GET', `requests?select=id,title&owner_id=in.(${id('hotel')},${id('cafe')})&limit=1000`).catch(() => null);
  for (const x of Array.isArray(listed?.data) ? listed.data : []) if (/^AUDIT\b/.test(x.title)) created.add(x.id);
  for (const t of created) { const r = await rpc(ADM, 'admin_delete_request', { p_request_id: t }).catch(e => ({ status: 'ERR ' + e.message })); console.log(`cleanup request ${t.slice(0, 8)}:`, desc(r)); }
}
// ---- brute force observation (non-existent address only)
const codes = [];
for (let i = 0; i < 8; i++) { const r = await fetch(AUTH + '/sign-in/email', { method: 'POST', headers: H, body: JSON.stringify({ email: 'nobody-audit@example.invalid', password: 'wrong-password-' + i }) }); codes.push(r.status); }
console.log('sign-in wrong password x8 (unknown email):', codes.join(','), '| retry-after header seen:', codes.includes(429));
fs.writeFileSync(path.join(root, 'qa/audit-perms-report.json'), safe(JSON.stringify({ rows, signIn: codes }, null, 1)));
console.log(`\n${rows.filter(r => r.ok).length}/${rows.length} ok`);
