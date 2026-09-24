import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { api, db, guard, markerFor, Scenario, journalDir } from './lib.mjs';
import { readManifests } from './cleanup.mjs';

function caller(status, text) {
  return { request: {
    get: async () => ({ ok: () => true, json: async () => ({ token: 'unit-test-token' }) }),
    fetch: async () => ({ status: () => status, text: async () => text }),
  } };
}
test('void RPC: 204 empty and 200 null are both accepted', async () => {
  assert.equal(await db(caller(204, ''), 'rpc/delete_request', {}), null);
  assert.equal(await db(caller(200, 'null'), 'rpc/delete_request', {}), null);
});
test('permissions retain HTTP status and MA error', async () => {
  const result = await api(caller(403, '{"hint":"MA003"}'), 'rpc/admin_list_users', {});
  assert.equal(result.status, 403); assert.equal(result.data.hint, 'MA003');
  await assert.rejects(db(caller(500, '{"message":"server error"}'), 'requests'), /HTTP 500/);
});
test('HTML/error responses get a useful route/status diagnostic', async () => {
  await assert.rejects(api(caller(502, '<html>gateway</html>'), 'requests'), /requests: HTTP 502/);
});
test('branch and run-id guards reject foreign targets/path traversal', () => {
  const previous = process.env.QA_BRANCH;
  try { process.env.QA_BRANCH = 'production'; assert.throws(guard, /auth-probe/); }
  finally { if (previous === undefined) delete process.env.QA_BRANCH; else process.env.QA_BRANCH = previous; }
  assert.throws(() => markerFor('../../prod'));
  assert.throws(() => readManifests(''));
});
test('recovery journal persists IDs without passwords; wrong marker is refused', () => {
  const run = Date.now() + '-unit';
  const file = path.join(journalDir, run + '.json');
  try {
    const t = new Scenario(null, 'unit', run); t.persist();
    t.requests.add('00000000-0000-4000-8000-000000000001');
    t.emails.add(`e2e+${run}-client@meetany.local`);
    const [m] = readManifests(run);
    assert.equal(m.marker, `[e2e:${run}]`); assert.equal(m.requests.length, 1);
    assert.equal(Object.hasOwn(m, 'password'), false);
    m.marker = '[e2e:some-other-run]'; fs.writeFileSync(file, JSON.stringify(m));
    assert.throws(() => readManifests(run));
  } finally { fs.rmSync(file, { force: true }); }
});
