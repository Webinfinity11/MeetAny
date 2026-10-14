// Browser-compatible guest endpoint around the same local-only JWT fixture contract.
import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const port = Number(process.argv[2] || 4447), base = `http://127.0.0.1:${port}`;
const { publicKey, privateKey } = await generateKeyPair('EdDSA');
const jwk = { ...await exportJWK(publicKey), kid: 'company-layout-local', alg: 'EdDSA', use: 'sig' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  const origin = req.headers.origin;
  if (origin && ['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/get-session') return res.end('null');
  if (url.pathname === '/token') return res.end(JSON.stringify({ token: null }));
  if (url.pathname === '/__mint') {
    const sub = url.searchParams.get('sub');
    const token = await new SignJWT({ role: 'authenticated', email: 'qa@local.test', emailVerified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid }).setSubject(sub).setIssuer(base).setAudience(base)
      .setIssuedAt().setExpirationTime('60m').sign(privateKey);
    return res.end(JSON.stringify({ token }));
  }
  res.end(JSON.stringify({ keys: [jwk] }));
}).listen(port, '127.0.0.1', () => console.log(`auth fixture ${base}`));
