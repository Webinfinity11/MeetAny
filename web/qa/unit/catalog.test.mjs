import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readAllRows } from '../../app/lib/read-all-rows.js';
import { tableQuery } from '../../app/lib/table-query.js';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../components/Toasts') return { url: 'data:text/javascript,export function toast() {}', shortCircuit: true };
  return next(specifier, context);
} });
process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL = 'https://auth.example.test/auth';
const { createMarketStore } = await import('../../app/lib/market-store.js');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const records = n => Array.from({ length: n }, (_, i) => ({ id: uuid(i + 1) }));

test('UUID pagination returns every row, including an exact full final page', async () => {
  for (const count of [0, 1, 1000, 1105, 2000]) {
    const all = records(count), calls = [];
    const result = await readAllRows(async path => {
      const params = new URL(path, 'http://localhost').searchParams;
      calls.push(path);
      assert.equal(params.get('order'), 'id.asc');
      const after = params.get('id')?.slice(3) || '';
      return all.filter(row => row.id > after).slice(0, 1000);
    }, '/requests?select=*');
    assert.deepEqual(result, all);
    assert.equal(calls.length, Math.floor(count / 1000) + 1);
  }
});

test('pagination rejects a repeated page or failed page instead of publishing incomplete data', async () => {
  await assert.rejects(readAllRows(async () => records(1000), '/requests?select=*'), /cursor/);
  let calls = 0;
  await assert.rejects(readAllRows(async () => { if (++calls === 2) throw Error('offline'); return records(1000); }, '/offers?select=*'), /offline/);
  await assert.rejects(readAllRows(async () => null, '/requests?select=*'), /response/);
});

test('table cursor remains parameterized and column/table/order injection is rejected', () => {
  const cursor = "x' OR true --";
  const params = new URLSearchParams({ select: 'id,company', role: 'eq.company', id: 'gt.' + cursor, order: 'id.asc', limit: '5000' });
  const query = tableQuery('profiles', params);
  assert.deepEqual(query.values, ['company', cursor]);
  assert(!query.sql.includes(cursor));
  assert.match(query.sql, /"id" > \$2 order by "id" asc limit 1000/);
  for (const [table, search] of [
    ['secrets', ''], ['requests', 'select=id;drop'], ['requests', 'order=id.asc;drop'],
    ['requests', 'limit=-1'], ['requests', 'limit=Infinity'], ['requests', 'created_at=gt.x'],
  ]) assert.throws(() => tableQuery(table, new URLSearchParams(search)), e => e.status === 400 || e.status === 404);
});

function fixture(t, { signedIn = true } = {}) {
  const me = { id: uuid(9000), role: 'company', company: 'Owner' };
  const requests = records(1105).map((r, i) => ({ ...r, owner_id: i === 0 ? me.id : uuid(9001), title: `Request ${i}`, status: 'open', created_at: new Date(2020, 0, i + 1).toISOString(), expires_at: '2099-01-01', category: 'food', city: 'tbilisi' }));
  const profiles = records(1105).map(r => ({ ...r, role: 'company', company: `Company ${r.id}`, created_at: '2026-01-01', offers: [], seeks: [] }));
  const offers = records(1105).map(r => ({ ...r, company_id: me.id, request_id: uuid(1105), created_at: '2026-01-01' }));
  const calls = [];
  let failCursor = false, failDetail = false, holdDetail;
  const token = role => `header.${Buffer.from(JSON.stringify({ role, sub: me.id, exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`;
  t.mock.method(globalThis, 'fetch', async (raw, options = {}) => {
    const url = new URL(raw, 'http://localhost'), params = url.searchParams;
    calls.push(url);
    const reply = data => Response.json(data);
    if (url.hostname === 'auth.example.test') {
      if (url.pathname.endsWith('/get-session')) return reply(signedIn ? { user: { id: me.id } } : null);
      return reply({ token: token(url.pathname.endsWith('/anonymous') ? 'anonymous' : 'authenticated') });
    }
    const rpc = url.pathname.split('/rpc/')[1], args = options.body ? JSON.parse(options.body) : {};
    if (rpc === 'set_my_products') return reply(args.p_items);
    if (rpc === 'my_profile') return reply(me);
    if (rpc === 'company_stats') return reply(args.ids.map(id => ({ company_id: id, offers_sent: 7, offers_chosen: 2 })));
    if (rpc === 'offer_counts') return reply(args.ids.map(id => ({ request_id: id, offers: 1105 })));
    if (rpc === 'engagement_state' || url.pathname.endsWith('/capabilities')) return reply({ engagement: false });
    if (rpc) throw Error('Unexpected RPC: ' + rpc);
    let rows = url.pathname.endsWith('/requests') ? requests : url.pathname.endsWith('/offers') ? offers : profiles;
    for (const [key, value] of params) {
      if (value.startsWith('eq.')) rows = rows.filter(r => String(r[key]) === value.slice(3));
      if (value.startsWith('gt.')) { if (failCursor) throw Error('offline'); rows = rows.filter(r => r[key] > value.slice(3)); }
      if (value.startsWith('in.')) rows = rows.filter(r => value.slice(4, -1).split(',').includes(r[key]));
    }
    if (params.get('id')?.startsWith('eq.') && url.pathname.endsWith('/profiles')) {
      if (holdDetail) await holdDetail;
      if (failDetail) throw Error('offline');
    }
    return reply(rows.slice(0, Number(params.get('limit') || 1000)));
  });
  return { me, requests, profiles, offers, calls, setFailCursor: () => { failCursor = true; }, setFailDetail: () => { failDetail = true; }, holdDetail: promise => { holdDetail = promise; } };
}

test('store retains old owned requests, all companies, and offers beyond row 1000', async t => {
  const f = fixture(t), store = createMarketStore({ background: false });
  await store.refresh();
  assert.equal(store.isAvailable(), true);
  assert.equal(store.listRequests({ state: '' }).length, 1105);
  assert.equal(store.listRequests({ ownerId: f.me.id, state: '' })[0].id, uuid(1));
  assert.equal(store.listCompanies().length, 1105);
  assert.equal(store.getCompany(uuid(1105)).id, uuid(1105));
  assert.equal(store.myOffers().length, 1105);
  await store.ensureRequest(uuid(1105));
  assert.equal(store.visibleOffers(uuid(1105)).length, 1105);
  assert(f.calls.some(url => url.searchParams.get('id') === 'gt.' + uuid(1000)));
  f.setFailCursor();
  t.mock.method(console, 'error', () => {});
  await store.refresh();
  assert.equal(store.isStale(), true);
  assert.equal(store.listRequests({ state: '' }).length, 1105, 'failed refresh keeps the previous complete cache');
});

test('company detail works without the catalog, distinguishes missing/error, and ignores stale responses', async t => {
  const f = fixture(t, { signedIn: false });
  const store = createMarketStore({ background: false });
  assert.equal(store.getCompany(uuid(1105)), null);
  await store.ensureCompany(uuid(1105));
  assert.equal(store.getCompany(uuid(1105)).company, `Company ${uuid(1105)}`);
  assert.deepEqual(store.companyStats(uuid(1105)), { sent: 7, chosen: 2 });
  assert.equal(await store.ensureCompany('bad-id'), null);
  assert.equal(await store.ensureCompany(uuid(8000)), null);
  let release;
  f.holdDetail(new Promise(resolve => { release = resolve; }));
  const pending = store.ensureCompany(uuid(1105));
  await store.refresh();
  f.profiles[1104].company = 'Newer name';
  await store.refresh();
  release();
  await pending;
  assert.equal(store.getCompany(uuid(1105)).company, 'Newer name');
  f.setFailDetail();
  await assert.rejects(store.ensureCompany(uuid(1105)));
  assert.equal(store.getCompany(uuid(1105)).company, 'Newer name');
});

test('saving products preserves the complete JSON array, including empty lists', async t => {
  fixture(t); const store=createMarketStore({background:false});
  const products=[{name:'Chair',photoUrl:'https://example.test/chair.jpg'},{name:'Desk',photoUrl:'https://example.test/desk.jpg'}];
  assert.deepEqual(await store.setMyProducts(products),products);
  assert.deepEqual(await store.setMyProducts([]),[]);
});

test('public discovery omits internal fixtures while owners and admin can inspect them', () => {
 const now=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString();
 const normal={id:uuid(910),role:'company',company:'ტექსტილის პარტნიორი',about:'',offers:[],seeks:[],service_cities:[],city:'tbilisi',industry:'textiles',created_at:now};
 const internal={...normal,id:uuid(911),company:'სატესტო კომპანია'};
 const requests=[{id:uuid(912),owner_id:normal.id,title:'ტესტრექ',body:'ტექსტი',category:'textiles',city:'tbilisi',created_at:now,expires_at:expires,status:'open'}, {id:uuid(913),owner_id:normal.id,title:'სადემო მაგალითი: თეთრეული',body:'ტექსტი',category:'textiles',city:'tbilisi',created_at:now,expires_at:expires,status:'open'}];
 const store=createMarketStore({initial:{companies:[normal,internal],profiles:[],requests,companyStats:[],counts:[]},background:false});
 assert.deepEqual(store.listCompanies().map(c=>c.id),[normal.id]);
 assert.equal(store.listCompanies({includeTests:true}).length,2);
 assert.deepEqual(store.listRequests().map(r=>r.id),[uuid(913)]);
 assert.equal(store.listRequests({ownerId:normal.id}).length,2);
 assert.equal(store.listRequests({includeHidden:true,state:''}).length,2);
 assert.equal(store.getRequest(uuid(912)).title,'ტესტრექ');
});
