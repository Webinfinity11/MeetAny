import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Separate contexts model pages and API handlers running in different Next workers.
const source = readFileSync(new URL('../../app/lib/public-snapshot.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
function worker(database) {
  const context = vm.createContext({ console, Date, asCaller: async (_claims, work) => work({
    query: async sql => sql.includes('json_build_object') ? { rows: [{ j: {
      requests: [...database.requests], companies: [], companyStats: [], counts: [], profiles: [],
    } }] } : { rows: [{ s: null }] },
  }) });
  vm.runInContext(source + '\nglobalThis.api = { loadPublicSnapshot, invalidatePublicSnapshot };', context);
  return context.api;
}

test('a committed request is visible on the next page read even when another worker handles the write', async () => {
  const database = { requests: [] };
  const pageWorker = worker(database), apiWorker = worker(database);
  assert.equal((await pageWorker.loadPublicSnapshot()).requests.length, 0);
  database.requests.push({ id: 'new-request', title: 'სასტუმროს თეთრეული' });
  apiWorker.invalidatePublicSnapshot();
  const snapshot = await pageWorker.loadPublicSnapshot();
  assert.equal(snapshot.requests.length, 1, 'a process-local invalidation cannot evict another worker’s cached snapshot');
  assert.equal(snapshot.requests[0].id, 'new-request');
});

test('public updates and removals do not remain in a previously read page snapshot', async () => {
  const database = { requests: [{ id: 'request', title: 'old' }] };
  const pageWorker = worker(database);
  await pageWorker.loadPublicSnapshot();
  database.requests = [{ id: 'request', title: 'updated' }];
  assert.equal((await pageWorker.loadPublicSnapshot()).requests[0].title, 'updated');
  database.requests = [];
  assert.equal((await pageWorker.loadPublicSnapshot()).requests.length, 0);
});
