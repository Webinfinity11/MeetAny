import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { groupOf } from '../../app/lib/categories-data.js';

// Matching v2 keeps the category groups in the database (meetany_private.category_groups); they must equal categories-data.js.
const sql = readFileSync(new URL('../../../db/migrations/20261013-matching-v2.sql', import.meta.url), 'utf8');
const body = sql.slice(sql.indexOf('function meetany_private.category_groups()'), sql.indexOf('function meetany_private.category_group_members'));
const dbGroups = Object.fromEntries([...body.matchAll(/\('([a-z_]+)','([a-z_]+)'\)/g)].map(([, category, group]) => [category, group]));

test('database category groups equal the JS category groups', () => {
  assert.ok(Object.keys(dbGroups).length > 30);
  assert.deepEqual(dbGroups, groupOf);
});
