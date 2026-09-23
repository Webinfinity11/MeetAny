import 'server-only';
import { asCaller } from './db';

// Same JSON projection as /api/db; timestamps stay strings. All reads use RLS.
const PUBLIC_PROFILE = 'id,phone,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng';
const read = (sql, values = []) => asCaller({ role: 'anonymous' }, async db =>
  (await db.query(sql, values)).rows[0].j);
const collect = sql => `select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`;
const chunks = ids => Array.from({ length: Math.ceil(ids.length / 500) }, (_, i) => ids.slice(i * 500, (i + 1) * 500));
const rpc = (name, ids) => Promise.all(chunks(ids).map(part =>
  read(collect(`select * from public.${name}(ids => $1::uuid[])`), [part]))).then(parts => parts.flat());

async function readPublicSnapshot() {
  try {
    const [requests, companies] = await Promise.all([
      read(collect('select * from public.requests order by created_at desc limit 1000')),
      read(collect('select * from public.list_companies()')),
    ]);
    const ids = [...new Set([...requests.map(r => r.owner_id), ...companies.map(c => c.id)])];
    const [companyStats, counts, profiles] = await Promise.all([
      rpc('company_stats', companies.map(c => c.id)),
      rpc('offer_counts', requests.map(r => r.id)),
      Promise.all(chunks(ids).map(part => read(collect(`select ${PUBLIC_PROFILE} from public.profiles where id::text = any($1::text[]) limit 1000`), [part]))).then(parts => parts.flat()),
    ]);
    const phones = Object.fromEntries(profiles.map(p => [p.id, p.phone]));
    return { requests, companies: companies.map(c => ({ ...c, phone: phones[c.id] ?? null })), companyStats, counts, profiles };
  } catch (err) {
    // Preserve the existing client retry/unavailable UI during database outages.
    console.error('Public snapshot failed:', err.code || 'database error');
    return null;
  }
}

// Public data only: never retain caller claims, profiles' emails or private offers.
// A hard TTL bounds staleness; failed reads are not cached. Concurrent page requests
// share the same refresh rather than exhausting the five-connection pool.
// Next compiles pages and Route Handlers into separate module graphs. Share the
// public cache on the process global so a handler invalidates the page's copy too.
const key = Symbol.for('meetany.publicSnapshot');
const state = globalThis[key] ??= { cached: null, expires: 0, pending: null, revision: 0 };
export function invalidatePublicSnapshot() {
  state.cached = null;
  state.expires = 0;
  state.pending = null;
  state.revision++;
}
export async function loadPublicSnapshot() {
  if (state.cached && Date.now() < state.expires) return state.cached;
  if (!state.pending) {
    const started = state.revision;
    state.pending = readPublicSnapshot().then(snapshot => {
      // A read started before a committed write must never repopulate the cache.
      if (started !== state.revision) return loadPublicSnapshot();
      state.cached = snapshot;
      state.expires = snapshot ? Date.now() + 30_000 : 0;
      return snapshot;
    }).finally(() => { if (started === state.revision) state.pending = null; });
  }
  return state.pending;
}
