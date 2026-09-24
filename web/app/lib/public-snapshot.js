import 'server-only';
import { asCaller } from './db';

// Same JSON projection as /api/db; timestamps stay strings. All reads use RLS.
const PUBLIC_PROFILE = 'id,phone,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng';

// One statement in one transaction: requests, companies and everything keyed by their ids.
// Materialized CTEs keep the source order (newest requests first, list_companies() order).
const SNAPSHOT_SQL = `
with r as materialized (select * from public.requests order by created_at desc limit 1000),
     c as materialized (select * from public.list_companies())
select json_build_object(
  'requests', (select coalesce(json_agg(r), '[]'::json) from r),
  'companies', (select coalesce(json_agg(c), '[]'::json) from c),
  'companyStats', (select coalesce(json_agg(t), '[]'::json) from public.company_stats(ids => array(select id from c)) t),
  'counts', (select coalesce(json_agg(t), '[]'::json) from public.offer_counts(ids => array(select id from r)) t),
  'profiles', (select coalesce(json_agg(t), '[]'::json) from (select ${PUBLIC_PROFILE} from public.profiles
     where id in (select owner_id from r union select id from c)) t)
) as j`;

async function readPublicSnapshot() {
  try {
    const { requests, companies, companyStats, counts, profiles } = await asCaller({ role: 'anonymous' },
      async db => (await db.query(SNAPSHOT_SQL)).rows[0].j);
    const phones = Object.fromEntries(profiles.map(p => [p.id, p.phone]));
    return { requests, companies: companies.map(c => ({ ...c, phone: phones[c.id] ?? null })), companyStats, counts, profiles };
  } catch (err) {
    // Preserve the existing client retry/unavailable UI during database outages.
    console.error('Public snapshot failed:', err.code || 'database error');
    return null;
  }
}

// Public data only: never retain caller claims, profiles' emails or private offers.
// Fresh for 30 s; after that the stale copy (up to 10 min old) is served at once while a single
// background read refreshes it. A public write drops the copy, so the next page waits for fresh
// data. Failed reads are not cached; concurrent requests share one read.
// Next compiles pages and Route Handlers into separate module graphs. Share the
// public cache on the process global so a handler invalidates the page's copy too.
const FRESH_MS = 30_000, STALE_MS = 600_000, RETRY_MS = 5_000;
const key = Symbol.for('meetany.publicSnapshot');
const state = globalThis[key] ??= { cached: null, expires: 0, pending: null, revision: 0 };
state.staleUntil ??= 0;
export function invalidatePublicSnapshot() {
  state.cached = null;
  state.expires = 0;
  state.staleUntil = 0;
  state.pending = null;
  state.revision++;
}
function refresh() {
  if (!state.pending) {
    const started = state.revision;
    state.pending = readPublicSnapshot().then(snapshot => {
      // A read started before a committed write must never repopulate the cache.
      if (started !== state.revision) return loadPublicSnapshot();
      if (snapshot) {
        state.cached = snapshot;
        state.expires = Date.now() + FRESH_MS;
        state.staleUntil = Date.now() + STALE_MS;
      } else if (state.cached) state.expires = Date.now() + RETRY_MS; // keep serving the stale copy
      return snapshot ?? state.cached;
    }).finally(() => { if (started === state.revision) state.pending = null; });
  }
  return state.pending;
}
export async function loadPublicSnapshot() {
  const now = Date.now();
  if (state.cached && now < state.expires) return state.cached;
  if (state.cached && now < state.staleUntil) { refresh(); return state.cached; }
  return refresh();
}
