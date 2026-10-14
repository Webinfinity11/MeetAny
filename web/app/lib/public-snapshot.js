import 'server-only';
import { asCaller } from './db';

// Same JSON projection as /api/db; timestamps stay strings. All reads use RLS.
// phone is no longer public (migration 20261007-contact-visibility); contact is revealed by RPC after selection.
const PUBLIC_PROFILE = 'id,role,company,industry,verified,verified_at,city,about,offers,seeks,service_cities,created_at,address,lat,lng,logo_url,gallery';

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

// Home page counters (migration 20261012-home-stats). Optional: a database without the function
// yet still serves the snapshot; the home page then simply hides the counters.
/** @returns {Promise<{openRequests: number, verifiedCompanies: number, offersSent: number, completedDeals: number} | null>} */
async function readHomeStats(db) {
  await db.query('savepoint home_stats');
  try { return (await db.query('select public.home_stats() as s')).rows[0].s; }
  catch (err) {
    if (!err.code) throw err;
    await db.query('rollback to savepoint home_stats');
    return null;
  }
}

async function readPublicSnapshot() {
  try {
    const { requests, companies, companyStats, counts, profiles, homeStats } = await asCaller({ role: 'anonymous' },
      async db => ({ ...(await db.query(SNAPSHOT_SQL)).rows[0].j, homeStats: await readHomeStats(db) }));
    const phones = Object.fromEntries(profiles.map(p => [p.id, p.phone]));
    return { requests, companies: companies.map(c => ({ ...c, phone: phones[c.id] ?? null })), companyStats, counts, profiles, homeStats };
  } catch (err) {
    // Preserve the existing client retry/unavailable UI during database outages.
    console.error('Public snapshot failed:', err.code || 'database error');
    return null;
  }
}

// Share only an in-flight read, never a completed snapshot. A process-global TTL
// cannot be invalidated by writes handled in another Next worker or instance.
// Reading again for each page request makes a committed request visible immediately
// on a new tab/reload; database outages use the existing unavailable/retry UI.
const key = Symbol.for('meetany.publicSnapshot');
const state = globalThis[key] ??= { pending: null, revision: 0 };
export function invalidatePublicSnapshot() {
  state.pending = null;
  state.revision++;
}
export async function loadPublicSnapshot() {
  if (!state.pending) {
    const started = state.revision;
    state.pending = readPublicSnapshot().then(snapshot => {
      // A read started before a local committed write must not win the race.
      return started === state.revision ? snapshot : loadPublicSnapshot();
    }).finally(() => { if (started === state.revision) state.pending = null; });
  }
  return state.pending;
}

// Detail pages serialize only their own public records. Parameterized UUIDs and the
// anonymous caller preserve the catalog's RLS and public profile projection.
async function readPublicDetail(id, company) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) return null;
  const requestFilter = company
    ? "owner_id=$1::uuid and not hidden and chosen_offer_id is null and status<>'closed' and expires_at>now()"
    : 'id=$1::uuid';
  const sql = `with r as materialized (select * from public.requests where ${requestFilter} order by created_at desc),
    c as materialized (select * from public.list_companies() where id=$1::uuid and $2::boolean)
  select json_build_object(
    'detail', json_build_object('kind',case when $2::boolean then 'company' else 'request' end,'id',$1::uuid),
    'companyExtras', case when $2::boolean then public.company_detail_extras($1::uuid) else null end,
    'requests', (select coalesce(json_agg(r), '[]'::json) from r),
    'companies', (select coalesce(json_agg(c), '[]'::json) from c),
    'companyStats', (select coalesce(json_agg(t), '[]'::json) from public.company_stats(ids => array(select id from c)) t),
    'counts', (select coalesce(json_agg(t), '[]'::json) from public.offer_counts(ids => array(select id from r)) t),
    'profiles', (select coalesce(json_agg(t), '[]'::json) from (select ${PUBLIC_PROFILE} from public.profiles
      where id in (select owner_id from r union select id from c)) t)
  ) as j`;
  try {
    return await asCaller({ role: 'anonymous' }, async db => (await db.query(sql, [id, company])).rows[0].j);
  } catch (err) {
    console.error('Public detail failed:', err.code || 'database error');
    return null;
  }
}
export const loadPublicRequest = id => readPublicDetail(id, false);
export const loadPublicCompany = id => readPublicDetail(id, true);
