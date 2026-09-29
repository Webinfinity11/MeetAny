import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Pool } from '@neondatabase/serverless';

// Read-only asset-reference inventory. Never output raw column values or credentials.
const root = path.resolve(import.meta.dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
assert(/^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(process.env.DATABASE_URL).hostname), 'Unexpected database host');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const report = { readOnly: true, columns: [], references: [] };
try {
  const db = await pool.connect();
  try {
    await db.query('begin isolation level repeatable read read only');
    await db.query("set local statement_timeout = '8000'");
    assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only, 'on');
    const { rows } = await db.query(`select c.table_schema, c.table_name, c.column_name
      from information_schema.columns c join information_schema.tables t
      on (t.table_schema=c.table_schema and t.table_name=c.table_name)
      where c.table_schema in ('public','meetany_private') and t.table_type='BASE TABLE'
      and c.data_type in ('text','character varying','json','jsonb','ARRAY')
      order by c.table_schema,c.table_name,c.ordinal_position`);
    assert(rows.some(c => c.table_name === 'profiles' && c.column_name === 'logo_url'));
    assert(rows.some(c => c.table_name === 'requests' && c.column_name === 'photo_url'));
    for (const c of rows) {
      const column = [c.table_schema,c.table_name,c.column_name].join('.');
      const value = quote(c.column_name) + '::text';
      const { rows: matches } = await db.query(`select found[1] as asset, count(*)::int as occurrences
        from ${quote(c.table_schema)}.${quote(c.table_name)},
        lateral regexp_matches(${value}, '/assets/[A-Za-z0-9_./%-]+', 'g') as found
        where ${value} like '%/assets/%' group by found[1] order by found[1]`);
      report.columns.push(column);
      report.references.push(...matches.map(m => ({ column, ...m })));
    }
    await db.query('rollback');
  } finally { db.release(); }
} finally { await pool.end(); }
const dir = path.join(root, 'qa/shots/cleanup-2026-09-29');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'asset-db-references.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ readOnly: true, columns: report.columns.length, distinctAssets: new Set(report.references.map(r => r.asset)).size, references: report.references }));
