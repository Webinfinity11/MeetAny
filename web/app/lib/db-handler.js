// MeetAny data API, served by the Next /api/db/[...path] Route Handler.
// It implements the PostgREST subset used by app/lib/market-store.js:
//   GET  /api/db/<table>?select=a,b|*&<col>=eq.<v>|gt.<uuid>|in.(<v>,…)|is.null&order=<col>.asc|desc&limit=<n>
//        tables: requests, offers, profiles
//   POST /api/db/rpc/<function>   JSON body = named arguments of public.<function>
// Each call runs as the caller (anonymous or the signed-in user, from the verified Neon Auth JWT);
// what is readable or writable is decided by RLS, column grants and the SECURITY DEFINER RPCs in
// db/schema.sql. Errors keep the PostgREST shape {message, code, details, hint}.
import { verifyCaller } from './neon-jwt.js';
import { asCaller, isConnectionError } from './db.js';
import { invalidatePublicSnapshot } from './public-snapshot.js';
import { TABLES, tableQuery } from './table-query.js';

// Every function a client may call. Anything else is 404 without touching the database.
const RPCS = new Set([
  'my_profile', 'complete_profile', 'update_my_profile', 'list_companies', 'company_stats', 'offer_counts',
  'create_request', 'update_request', 'close_request', 'extend_request', 'delete_request',
  'send_offer', 'withdraw_offer', 'choose_offer', 'contact_for_request', 'log_contact_event',
  'start_conversation', 'send_message', 'list_my_conversations', 'list_messages', 'mark_read', 'unread_message_count',
  'engagement_state', 'list_notifications', 'mark_notification_read', 'set_notification_email',
  'list_saved_companies', 'set_saved_company', 'request_alert_preferences', 'set_request_alert_preferences',
  'admin_stats', 'admin_list_users', 'admin_search_users', 'admin_search_requests', 'admin_list_audit',
  'admin_search_offers', 'admin_delete_offer', 'admin_delete_request_v2', 'admin_list_audit_v2',
  'admin_set_verified', 'admin_set_blocked', 'admin_set_hidden', 'admin_delete_request',
  'admin_contact_events', 'admin_contact_stats', 'admin_message_stats', 'admin_list_conversations', 'admin_conversation_messages',
]);
// Only writes to public catalog data (requests, offers, company profiles) drop the SSR snapshot;
// personal state (saved, notifications, alerts, messages) and reads never do.
const PUBLIC_WRITES = new Set([
  'create_request', 'update_request', 'close_request', 'extend_request', 'delete_request',
  'admin_delete_offer', 'admin_delete_request_v2',
  'send_offer', 'withdraw_offer', 'choose_offer', 'update_my_profile', 'complete_profile',
  'admin_set_verified', 'admin_set_blocked', 'admin_set_hidden', 'admin_delete_request',
]);

const MAX_BODY = 64 * 1024;
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const bad = (message, code = 'PGRST100') => Object.assign(new Error(message), { status: 400, api: { message, code, details: null, hint: null } });

const q = (name) => '"' + name + '"';

// ---------------------------------------------------------------- POST /rpc/<function>
const signatures = new Map(); // allowlisted name -> [{names, nargs, required, types, retset, rettype}] (stable per deploy)
async function signature(db, name) {
  if (!signatures.has(name)) {
    const { rows } = await db.query(
      `select coalesce(p.proargnames, '{}') as names, p.pronargs as nargs, p.pronargs - p.pronargdefaults as required,
              array(select format_type(t, null) from unnest(p.proargtypes::oid[]) t) as types,
              p.proretset as retset, format_type(p.prorettype, null) as rettype
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1 and p.prokind = 'f'`, [name]);
    // A function missing now may be added by a migration later; only cache what exists.
    if (!rows.length) return rows;
    signatures.set(name, rows);
  }
  return signatures.get(name);
}
async function rpcCall(db, name, args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw bad('body must be a JSON object');
  const keys = Object.keys(args);
  const known = (await signature(db, name)).filter((s) => keys.every((k) => s.names.slice(0, s.nargs).includes(k)));
  if (!known.length) throw Object.assign(bad('unknown function or arguments', 'PGRST202'), { status: 404 });
  const fn = known.find((s) => s.names.slice(0, s.required).every((k) => keys.includes(k)));
  if (!fn) {
    const missing = known[0].names.slice(0, known[0].required).filter((k) => !keys.includes(k));
    throw bad(`MA010: აკლია სავალდებულო არგუმენტები: ${missing.join(', ')}`, 'MA010');
  }
  const values = [], named = [];
  for (const k of keys) {
    const type = fn.types[fn.names.indexOf(k)];
    const v = args[k];
    values.push(v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);
    named.push(`${q(k)} => $${values.length}::${type}`);
  }
  const call = `public.${q(name)}(${named.join(', ')})`;
  const sql = fn.retset ? `select coalesce(json_agg(t), '[]'::json) as j from ${call} t`
    : fn.rettype === 'void' ? `select ${call}, null::json as j`
    : `select to_json(${call}) as j`;
  const { rows } = await db.query(sql, values);
  return rows[0]?.j ?? null;
}

// ---------------------------------------------------------------- handler
function pgError(err, role) {
  const body = { message: err.message, code: err.code || null, details: err.detail || null, hint: err.hint || null };
  if (err.code === '42501') return reply(role === 'authenticated' ? 403 : 401, body);        // privilege / RLS
  if (err.code === 'P0001' || /^(22|23)/.test(err.code || '')) return reply(400, body);      // MAxxx and bad input
  if (err.code === '42883' || err.code === '42703') return reply(400, { ...body, message: 'MA010: არასწორი არგუმენტები', code: 'MA010' });
  if (err.code === '57014') return reply(504, { ...body, message: 'statement timeout' });
  if (isConnectionError(err)) {
    console.warn('api/db: database unavailable', err.code || err.message || 'connection error');
    return reply(503, { message: 'database unavailable', code: 'MA998', details: null, hint: null });
  }
  console.error('api/db:', err.code, err.message);
  return reply(500, { message: 'server error', code: 'MA999', details: null, hint: null });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/db\/?/, '').replace(/^\/+|\/+$/g, '');
    const name = path.startsWith('rpc/') ? path.slice(4) : null;
    if (name !== null && !RPCS.has(name)) return reply(404, { message: 'unknown function', code: 'PGRST202', details: null, hint: null });
    if (name !== null && request.method === 'POST' && Number(request.headers.get('content-length')) > MAX_BODY)
      return reply(413, { message: 'body too large', code: 'PGRST413', details: null, hint: null });
    let claims;
    try { claims = await verifyCaller(request.headers.get('authorization')); }
    catch (err) {
      if (err.status === 500) { console.error('api/db:', err.message); return reply(500, { message: 'server not configured', code: 'MA999', details: null, hint: null }); }
      return reply(401, { message: 'JWT invalid', code: 'PGRST301', details: null, hint: null });
    }
    try {
      let result;
      if (request.method === 'GET' && path === 'capabilities') {
        result = await asCaller(claims, async (db) => ({ engagement: !!(await db.query("select to_regprocedure('public.engagement_state()') is not null as enabled")).rows[0].enabled, emailDelivery: process.env.NOTIFICATION_EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY && !!process.env.NOTIFICATION_FROM && !!process.env.APP_ORIGIN }));
      } else if (request.method === 'GET' && TABLES.has(path)) {
        const { sql, values } = tableQuery(path, url.searchParams);
        result = await asCaller(claims, async (db) => (await db.query(sql, values)).rows[0].j);
      } else if (request.method === 'POST' && name !== null) {
        const text = await request.text();
        if (text.length > MAX_BODY) return reply(413, { message: 'body too large', code: 'PGRST413', details: null, hint: null });
        let args = {};
        if (text.trim()) { try { args = JSON.parse(text); } catch { throw bad('invalid JSON body', 'PGRST102'); } }
        result = await asCaller(claims, (db) => rpcCall(db, name, args));
        if (PUBLIC_WRITES.has(name)) invalidatePublicSnapshot();
      } else if (TABLES.has(path) || name !== null) {
        return new Response(null, { status: 405, headers: { Allow: TABLES.has(path) ? 'GET' : 'POST' } });
      } else {
        return reply(404, { message: 'not found', code: 'PGRST205', details: null, hint: null });
      }
      return reply(200, result);
    } catch (err) {
      if (err.api) return reply(err.status, err.api);
      if (err.status === 500) { console.error('api/db:', err.message); return reply(500, { message: 'server not configured', code: 'MA999', details: null, hint: null }); }
      return pgError(err, claims.role);
    }
  },
};
