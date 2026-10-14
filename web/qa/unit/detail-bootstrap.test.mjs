import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { if (specifier === '../components/Toasts') return { url: 'data:text/javascript,export function toast() {}', shortCircuit: true }; return next(specifier, context); } });
process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL = 'https://auth.example.test/auth';
globalThis.window = undefined;
globalThis.sessionStorage = null;
const { createMarketStore } = await import('../../app/lib/market-store.js');
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const company = id => ({ id, role: 'company', company: id, verified: true, created_at: '2026-10-14' });
const initial = { detail: { kind: 'company', id }, companies: [company(id)], requests: [], profiles: [], counts: [], companyStats: [] };
const payload = companies => ({ me: null, companies, requests: [], profiles: [], counts: [], companyStats: [], offers: [], contacts: [], capabilities: {} });
function setup(t, hold = false) {
 const location = { href: `http://localhost/companies/view/?id=${id}` }, calls = [];
 let release, entered;
 const started = new Promise(resolve => { entered = resolve; });
 t.mock.property(globalThis, 'window', { location });
 t.mock.method(globalThis, 'fetch', async raw => {
  const url = new URL(raw, 'http://localhost');
  if (url.pathname.endsWith('/get-session')) return Response.json(null);
  assert.equal(url.pathname, '/api/db/bootstrap'); calls.push(url);
  if (calls.length === 1 && hold) { entered(); await new Promise(resolve => { release = resolve; }); }
  return Response.json(url.searchParams.has('detail') ? { ...payload([]), seeded: true } : payload([company(id), company(other)]));
 });
 return { location, calls, started, release: () => release() };
}
test('seeded detail survives an empty bootstrap and account navigation restores the full cache immediately', async t => {
 const f = setup(t), store = createMarketStore({ initial });
 await store.ready(); assert.equal(store.getCompany(id)?.id, id);
 assert.equal(f.calls[0].searchParams.get('seeded'), '1');
 f.location.href = 'http://localhost/account/';
 await store.revalidate();
 assert.equal(f.calls[1].search, ''); assert.equal(store.getCompany(other)?.id, other);
});
test('navigation during a detail bootstrap queues the destination load', async t => {
 const f = setup(t, true), store = createMarketStore({ initial });
 await f.started;
 f.location.href = 'http://localhost/account/';
 const destination = store.revalidate(); f.release(); await destination;
 assert.equal(f.calls.length, 2); assert.equal(f.calls[1].search, '');
 assert.equal(store.getCompany(other)?.id, other);
});
