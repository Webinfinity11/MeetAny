// Verifies Neon Auth JWTs (EdDSA, JWKS at <NEON_AUTH_BASE_URL>/.well-known/jwks.json).
// No secret is involved: NEON_AUTH_BASE_URL is a public value kept in a Vercel env var
// (db/CONTRACT.md §9). Token shapes: user tokens have iss = aud = the Auth URL origin;
// anonymous tokens (GET /token/anonymous) have iss = the full Auth URL and aud = the origin.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { asCaller } from './db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let cached = null;

function authConfig() {
  const base = String(process.env.NEON_AUTH_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw Object.assign(new Error('NEON_AUTH_BASE_URL is not set'), { status: 500 });
  if (!cached || cached.base !== base) {
    const origin = new URL(base).origin;
    // The key set is fetched once and cached across warm invocations (jose handles kid rotation).
    cached = { base, origin, jwks: createRemoteJWKSet(new URL(base + '/.well-known/jwks.json'), { timeoutDuration: 5000 }) };
  }
  return cached;
}
const unauthorized = (why) => Object.assign(new Error(why), { status: 401 });
const bearer = (authorization) => /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(String(authorization || '').trim())?.[1];
const emailCheckOff = () => String(process.env.REQUIRE_EMAIL_VERIFICATION || 'on').toLowerCase() === 'off';

// The claims api/_db.js puts into request.jwt.claims: only verified, needed fields.
function userClaims(payload) {
  if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw unauthorized('bad subject');
  if (payload.banned === true) throw unauthorized('banned');
  return { role: 'authenticated', sub: payload.sub, email: String(payload.email || ''), emailVerified: payload.emailVerified === true };
}

// Any caller of api/db: no token -> anonymous; a valid anonymous or user token -> its claims;
// an invalid or expired token -> 401 (the browser then fetches a fresh one and retries once).
export async function verifyCaller(authorization) {
  const token = bearer(authorization);
  if (!token) return { role: 'anonymous' };
  const { base, origin, jwks } = authConfig();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { algorithms: ['EdDSA'], issuer: [origin, base], audience: origin, clockTolerance: 5 }));
  } catch (err) {
    throw unauthorized('invalid token: ' + (err?.code || err?.message));
  }
  if (payload.role === 'anonymous') return { role: 'anonymous' };
  if (payload.role === 'authenticated') return userClaims(payload);
  throw unauthorized('unknown role');
}

// Returns the verified claims of a signed-in user, else throws (status 401). Used by blob-upload.
// The email must be verified unless REQUIRE_EMAIL_VERIFICATION=off (sign-up without an email code).
export async function verifyNeonJwt(authorization) {
  const claims = await verifyCaller(authorization);
  if (claims.role !== 'authenticated') throw unauthorized('not a user token');
  if (!claims.emailVerified && !emailCheckOff()) throw unauthorized('email not verified');
  return claims;
}

// The caller's own profile row or null (as the caller; RLS applies). Keeps "only signed-in,
// non-blocked users with a profile can upload".
export async function myProfile(claims) {
  const { rows } = await asCaller(claims, (db) => db.query('select to_json(p) as p from public.my_profile() p'));
  return rows[0]?.p?.id ? rows[0].p : null;
}
