// Local-only Auth stand-in for perf runs: serves an ephemeral JWKS for the Next server and
// mints user JWTs for measure.mjs. Loopback only; no real Auth, no secrets.
//   node qa/perf-2026-10-12/auth-fixture.mjs [port=3012]
import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const port = Number(process.argv[2] || 3012), base = `http://127.0.0.1:${port}`;
const { publicKey, privateKey } = await generateKeyPair('EdDSA');
const jwk = { ...await exportJWK(publicKey), kid: 'perf-local', alg: 'EdDSA', use: 'sig' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/__mint') {
    const sub = url.searchParams.get('sub');
    const token = await new SignJWT({ role: 'authenticated', email: 'perf@local.test', emailVerified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'perf-local' }).setSubject(sub).setIssuer(base).setAudience(base)
      .setIssuedAt().setExpirationTime('60m').sign(privateKey);
    return res.end(JSON.stringify({ token }));
  }
  res.end(JSON.stringify({ keys: [jwk] }));
}).listen(port, '127.0.0.1', () => console.log(`auth fixture ${base}`));
