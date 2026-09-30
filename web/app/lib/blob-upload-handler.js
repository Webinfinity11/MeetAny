// POST   /api/blob-upload  Vercel Blob client-upload token for a request photo, company logo or gallery photo (handleUpload).
// DELETE /api/blob-upload  {url}: removes the caller's own photo or logo (a failed create_request, a
//                          replaced or removed logo); an admin may remove any user's file (photo moderation).
//
// Rules (db/CONTRACT.md §6.1): Neon Auth JWT verified against the remote JWKS with pinned
// issuer/audience; caller has a profile and is not blocked (rpc/my_profile with the caller's own
// token); pathname is exactly <sub>/<name>.<jpg|png|webp|gif>; only jpeg/png/webp/gif, at most 5 MB,
// random suffix, no overwrite, token valid 5 minutes. A logo is <sub>/logo-<name>.<ext>, at most 2 MB
// (update_my_profile accepts only that file name, MA115). A gallery photo is <sub>/gallery-<name>.<ext>,
// at most 5 MB (set_my_gallery accepts only that file name, MA116).
// Env: BLOB_READ_WRITE_TOKEN (secret, set by the Blob integration), NEON_AUTH_BASE_URL,
// DATABASE_URL (secret) for the profile check through api/_db.js.
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { verifyNeonJwt, myProfile } from './neon-jwt.js';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([A-Za-z0-9_-]{1,64})\.(jpg|png|webp|gif)$/;
const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Authenticated, verified, profile completed and not blocked -> claims; otherwise a Response.
async function caller(request) {
  let claims;
  try { claims = await verifyNeonJwt(request.headers.get('authorization')); }
  catch (err) { return json(err.status === 500 ? 500 : 401, { error: err.status === 500 ? 'server not configured' : 'unauthorized' }); }
  let profile;
  try { profile = await myProfile(claims); }
  catch (err) { console.error('blob-upload: profile check failed', err?.message); return json(502, { error: 'profile check failed' }); }
  if (!profile || profile.id !== claims.sub || profile.blocked) return json(403, { error: 'forbidden' });
  return claims;
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 4096) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function createToken(request) {
  const who = await caller(request);
  if (who instanceof Response) return who;
  const body = await readJson(request);
  // Only token generation is served; there is no onUploadCompleted callback.
  if (!body || body.type !== 'blob.generate-client-token' || typeof body.payload?.pathname !== 'string')
    return json(400, { error: 'bad request' });
  try {
    const result = await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname, _clientPayload, multipart) => {
        const m = NAME.exec(pathname);
        if (!m || m[1] !== who.sub || multipart) throw Object.assign(new Error('forbidden pathname'), { forbidden: true });
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: m[2].startsWith('logo-') ? LOGO_MAX_BYTES : MAX_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({ uid: who.sub }),
        };
      },
    });
    return json(200, result);
  } catch (err) {
    if (err?.forbidden) return json(403, { error: 'forbidden' });
    console.error('blob-upload: token failed', err?.message);
    return json(500, { error: 'upload not available' });
  }
}

async function removePhoto(request) {
  let claims;
  try { claims = await verifyNeonJwt(request.headers.get('authorization')); }
  catch (err) { return json(err.status === 500 ? 500 : 401, { error: err.status === 500 ? 'server not configured' : 'unauthorized' }); }
  const body = await readJson(request);
  let url;
  try { url = new URL(String(body?.url || '')); } catch { return json(400, { error: 'bad request' }); }
  const file = url.pathname.slice(1);
  const m = /^([0-9a-f-]{36})\/[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png|webp|gif)$/i.exec(file);
  if (url.protocol !== 'https:' || !BLOB_HOST.test(url.hostname) || url.search || url.hash || url.username || url.port || !m)
    return json(403, { error: 'forbidden' });
  // Another user's file: only an active admin (photo moderation, after admin_remove_company_photo).
  if (m[1] !== claims.sub) {
    let profile;
    try { profile = await myProfile(claims); }
    catch (err) { console.error('blob-upload: profile check failed', err?.message); return json(502, { error: 'profile check failed' }); }
    if (!profile || profile.id !== claims.sub || profile.blocked || profile.role !== 'admin') return json(403, { error: 'forbidden' });
  }
  try { await del(url.origin + url.pathname); return json(200, { deleted: true }); }
  catch (err) { console.error('blob-upload: delete failed', err?.message); return json(500, { error: 'delete failed' }); }
}

export default {
  async fetch(request) {
    if (request.method === 'POST') return createToken(request);
    if (request.method === 'DELETE') return removePhoto(request);
    return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } });
  },
};
