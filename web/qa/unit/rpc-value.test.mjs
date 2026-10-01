import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpcValue } from '../../app/lib/rpc-value.js';

test('JSON lists, empty lists and nested values use JSON, not PostgreSQL array syntax', () => {
  for (const value of [[], [{ name: 'სუფრა', note: 'კომენტარი', photoUrl: 'https://example.test/photo.jpg' }], { nested: [1, null] }, 'text', 4, false]) {
    assert.deepEqual(JSON.parse(rpcValue(value, 'jsonb')), value);
    assert.deepEqual(JSON.parse(rpcValue(value, 'json')), value);
  }
  assert.equal(rpcValue(null, 'jsonb'), null);
});

test('SQL text arrays keep their native parameter form', () => {
  const cities = ['tbilisi', 'batumi'];
  assert.equal(rpcValue(cities, 'text[]'), cities);
  assert.equal(rpcValue([], 'text[]').length, 0);
  assert.equal(rpcValue(12.5, 'numeric'), 12.5);
});
