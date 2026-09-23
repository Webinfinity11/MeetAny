// MeetAny data API, served by the Next /api/db/[...path] Route Handler.
// It implements the PostgREST subset used by app/lib/market-store.js:
//   GET  /api/db/<table>?select=a,b|*&<col>=eq.<v>|in.(<v>,…)|is.null&order=<col>.asc|desc&limit=<n>
//        tables: requests, offers, profiles
//   POST /api/db/rpc/<function>   JSON body = named arguments of public.<function>
// Each call runs as the caller (anonymous or the signed-in user, from the verified Neon Auth JWT);
// what is readable or writable is decided by RLS, column grants and the SECURITY DEFINER RPCs in
// db/schema.sql. Errors keep the PostgREST shape {message, code, details, hint}.
import { verifyCaller } from './neon-jwt.js';
import { asCaller } from './db.js';

const TABLES = new Set(['requests', 'offers', 'profiles']);
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_BODY = 64 * 1024, MAX_LIMIT = 1000, MAX_IN = 500;

const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const bad = (message, code = 'PGRST100') => Object.assign(new Error(message), { status: 400, api: { message, code, details: null, hint: null } });
const q = (name) => '"' + name + '"';

// ---------------------------------------------------------------- GET /<table>
function tableQuery(table, params) {
  if (!TABLES.has(table)) throw Object.assign(bad('unknown table', 'PGRST205'), { status: 404 });
  const select = params.get('select') || '*';
  const cols = select === '*' ? '*' : select.split(',').map((c) => {
    if (!IDENT.test(c)) throw bad('bad select');
    return q(c);
  }).join(', ');
  const where = [], values = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'path'].includes(key)) continue;
    if (!IDENT.test(key)) throw bad('bad filter column');
    let m;
    if ((m = /^eq\.(.*)$/s.exec(raw))) { values.push(m[1]); where.push(`${q(key)} = $${values.length}`); }
    else if ((m = /^in\.\((.*)\)$/s.exec(raw))) {
      const list = m[1] === '' ? [] : m[1].split(',').map((v) => v.replace(/^"(.*)"$/, '$1'));
      if (list.length > MAX_IN) throw bad('too many values');
      values.push(list); where.push(`${q(key)}::text = any($${values.length}::text[])`);
    }
    else if (raw === 'is.null') where.push(`${q(key)} is null`);
    else if (raw === 'not.is.null') where.push(`${q(key)} is not null`);
    else throw bad('unsupported filter');
  }
  const order = (params.get('order') || '').split(',').filter(Boolean).map((o) => {
    const m = /^([a-z_][a-z0-9_]*)\.(asc|desc)(?:\.nulls(first|last))?$/.exec(o);
    if (!m) throw bad('bad order');
    return `${q(m[1])} ${m[2]}${m[3] ? ' nulls ' + m[3] : ''}`;
  });
  const limit = params.has('limit') ? Number(params.get('limit')) : MAX_LIMIT;
  if (!Number.isInteger(limit) || limit < 0) throw bad('bad limit');
  const sql = `select coalesce(json_agg(t), '[]'::json) as j from (select ${cols} from public.${q(table)}`
    + (where.length ? ' where ' + where.join(' and ') : '')
    + (order.length ? ' order by ' + order.join(', ') : '')
    + ` limit ${Math.min(limit, MAX_LIMIT)}) t`;
  return { sql, values };
}

// ---------------------------------------------------------------- POST /rpc/<function>
const signatures = new Map(); // function name -> [{names, types, retset, rettype}] (schema is stable per deploy)
async function signature(db, name) {
  if (!signatures.has(name)) {
    const { rows } = await db.query(
      `select coalesce(p.proargnames, '{}') as names, p.pronargs as nargs,
              array(select format_type(t, null) from unnest(p.proargtypes::oid[]) t) as types,
              p.proretset as retset, format_type(p.prorettype, null) as rettype
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1 and p.prokind = 'f'`, [name]);
    signatures.set(name, rows);
  }
  return signatures.get(name);
}
async function rpcCall(db, name, args) {
  if (!IDENT.test(name)) throw Object.assign(bad('unknown function', 'PGRST202'), { status: 404 });
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw bad('body must be a JSON object');
  const keys = Object.keys(args);
  const fn = (await signature(db, name)).find((s) => keys.every((k) => s.names.slice(0, s.nargs).includes(k)));
  if (!fn) throw Object.assign(bad('unknown function or arguments', 'PGRST202'), { status: 404 });
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
  if (err.code === '57014') return reply(504, { ...body, message: 'statement timeout' });
  console.error('api/db:', err.code, err.message);
  return reply(500, { message: 'server error', code: 'MA999', details: null, hint: null });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/db\/?/, '')).replace(/^\/+|\/+$/g, '');
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
      } else if (request.method === 'POST' && path.startsWith('rpc/')) {
        const text = await request.text();
        if (text.length > MAX_BODY) return reply(413, { message: 'body too large', code: 'PGRST413', details: null, hint: null });
        let args = {};
        if (text.trim()) { try { args = JSON.parse(text); } catch { throw bad('invalid JSON body', 'PGRST102'); } }
        result = await asCaller(claims, (db) => rpcCall(db, path.slice(4), args));
      } else if (TABLES.has(path) || path.startsWith('rpc/')) {
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
