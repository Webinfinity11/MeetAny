// Postgres access shared by the Next Route Handlers.
// DATABASE_URL (Vercel env, secret) is the neondb_owner connection string of the Neon branch.
// Every request runs in its own transaction as the caller's role (anonymous / authenticated),
// with the verified JWT claims in request.jwt.claims, so the RLS policies and SECURITY DEFINER
// functions of db/schema.sql decide what the caller may see or do (meetany_private.uid()).
import { Pool } from '@neondatabase/serverless';
import pg from 'pg';

let pool = null;
function getPool() {
  const localUrl = String(process.env.MEETANY_LOCAL_DATABASE_URL || '').trim();
  if (localUrl && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname)) throw new Error('Local database must use a loopback host');
  const url = localUrl || String(process.env.DATABASE_URL || '').trim();
  if (!/^postgres(ql)?:\/\//.test(url)) throw Object.assign(new Error('DATABASE_URL is not set'), { status: 500 });
  if (!pool) {
    const Driver = localUrl ? pg.Pool : Pool;
    pool = new Driver({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 });
    // An idle client whose WebSocket drops emits 'error' on the pool; unhandled, it kills the process.
    pool.on('error', (err) => console.warn('db pool:', err?.code || err?.message || 'connection error'));
  }
  return pool;
}

// Failures of the connection itself (Neon WebSocket ErrorEvent, cold compute, reset, admin shutdown),
// as opposed to errors Postgres reports about a statement (those always carry a SQLSTATE code).
export function isConnectionError(err) {
  if (!err || err.status) return false;
  if (err.constructor?.name === 'ErrorEvent' || err.type === 'error') return true;
  const code = err.code || '';
  return !code || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', '57P01', '57P02', '57P03', '08000', '08003', '08006'].includes(code);
}

// begin + claims + role in one simple-protocol round trip; claims are inlined as a quoted literal.
async function open(role, claims) {
  const client = await getPool().connect();
  try {
    // The preview uses a local Auth metadata mirror. Verified JWTs can introduce
    // a newly signed-up user without copying credentials or writing to Neon.
    if (process.env.MEETANY_LOCAL_DATABASE_URL && role === 'authenticated' && claims?.sub && claims?.email) {
      await client.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,$4) on conflict(id) do update set "emailVerified"=excluded."emailVerified" where neon_auth."user"."emailVerified" is distinct from excluded."emailVerified"', [claims.sub,'ანგარიში',claims.email,claims.emailVerified === true]);
    }
    await client.query(`begin; select set_config('request.jwt.claims', ${client.escapeLiteral(JSON.stringify({ ...claims, role }))}, true), `
      + `set_config('statement_timeout', '8000', true); set local role ${role}`);
    return client;
  } catch (err) {
    client.release(isConnectionError(err) ? err : undefined);
    throw err;
  }
}

// claims: { role: 'anonymous' } or { role: 'authenticated', sub, email, emailVerified }.
export async function asCaller(claims, work) {
  const role = claims?.role === 'authenticated' ? 'authenticated' : 'anonymous';
  let client;
  // Nothing has run yet, so one retry on a fresh connection is always safe.
  try { client = await open(role, claims); }
  catch (err) {
    if (!isConnectionError(err)) throw err;
    client = await open(role, claims);
  }
  let broken;
  try {
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (err) {
    if (isConnectionError(err)) broken = err;
    else await client.query('rollback').catch((e) => { broken = e; });
    throw err;
  } finally {
    client.release(broken);
  }
}
