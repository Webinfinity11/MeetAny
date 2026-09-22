// Postgres access shared by the Next Route Handlers.
// DATABASE_URL (Vercel env, secret) is the neondb_owner connection string of the Neon branch.
// Every request runs in its own transaction as the caller's role (anonymous / authenticated),
// with the verified JWT claims in request.jwt.claims, so the RLS policies and SECURITY DEFINER
// functions of db/schema.sql decide what the caller may see or do (meetany_private.uid()).
import { Pool } from '@neondatabase/serverless';

let pool = null;
function getPool() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!/^postgres(ql)?:\/\//.test(url)) throw Object.assign(new Error('DATABASE_URL is not set'), { status: 500 });
  if (!pool) pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

// claims: { role: 'anonymous' } or { role: 'authenticated', sub, email, emailVerified }.
export async function asCaller(claims, work) {
  const role = claims?.role === 'authenticated' ? 'authenticated' : 'anonymous';
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query("select set_config('request.jwt.claims', $1, true), set_config('statement_timeout', '8000', true)",
      [JSON.stringify({ ...claims, role })]);
    await client.query(`set local role ${role}`);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
