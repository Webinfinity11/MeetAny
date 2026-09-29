import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Next transpiles this config as CommonJS and supplies __dirname.
globalThis.__dirname = fileURLToPath(new URL('../../', import.meta.url));

function setAuth(t, value) {
  const previous = process.env.NEON_AUTH_BASE_URL;
  process.env.NEON_AUTH_BASE_URL = value;
  t.after(() => { if (previous === undefined) delete process.env.NEON_AUTH_BASE_URL; else process.env.NEON_AUTH_BASE_URL = previous; });
}

test('browser Auth URL and CSP both come from the server Auth environment', async t => {
  setAuth(t, 'https://auth.example.test/custom/auth/');
  const { default: config } = await import('../../next.config.ts?auth-configured');
  assert.equal(config.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL, 'https://auth.example.test/custom/auth');
  const headers = await config.headers();
  const csp = headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  assert(csp.includes('https://auth.example.test'));
  assert(!csp.includes('ep-withered-glade'));
});

test('missing Auth configuration does not silently sign users into the demo environment', async t => {
  setAuth(t, '');
  const { default: config } = await import('../../next.config.ts?auth-missing');
  assert.equal(config.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL, '');
});
