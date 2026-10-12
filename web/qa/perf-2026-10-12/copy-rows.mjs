// Run from web/: SOURCE_URL=<read-only source> TARGET_DB=meetany_preview_<n> node qa/perf-2026-10-12/copy-rows.mjs
// Same copy as scripts/prepare-local-preview.mjs, without touching .env.local. The source is
// opened in a READ ONLY transaction; writes go only to the local loopback database.
import assert from 'node:assert/strict';
import pg from 'pg';
const target = `postgresql://${encodeURIComponent(process.env.USER)}@localhost:5432/${process.env.TARGET_DB}`;
assert(/^meetany_preview_\d+$/.test(process.env.TARGET_DB || ''), 'TARGET_DB must be a local meetany_preview_<n>');
const q = v => `"${v.replaceAll('"', '""')}"`;
const src = new pg.Client({ connectionString: process.env.SOURCE_URL }), dst = new pg.Client({ connectionString: target });
await src.connect(); await dst.connect();
try {
  await src.query('begin read only');
  await dst.query("begin; set local session_replication_role = 'replica'");
  for (const p of (await src.query('select id,name,email from public.profiles')).rows)
    await dst.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,true) on conflict do nothing', [p.id, p.name, p.email]);
  const tables = (await src.query("select table_schema s,table_name t from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','meetany_private') order by 1,2")).rows;
  let copied = 0;
  for (const { s, t } of tables) {
    const cols = (await dst.query('select column_name c,data_type d from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position', [s, t])).rows;
    if (!cols.length) continue;
    const have = new Set((await src.query('select column_name c from information_schema.columns where table_schema=$1 and table_name=$2', [s, t])).rows.map(r => r.c));
    const common = cols.filter(c => have.has(c.c));
    const rows = (await src.query(`select ${common.map(c => q(c.c)).join(',')} from ${q(s)}.${q(t)}`)).rows;
    await dst.query(`delete from ${q(s)}.${q(t)}`);
    for (const row of rows) {
      const values = common.map(({ c, d }) => {
        const v = row[c];
        if (v === null || v === undefined) return v;
        if (d === 'json' || d === 'jsonb') return JSON.stringify(v);
        return v && !Array.isArray(v) && !(v instanceof Date) && typeof v === 'object' ? JSON.stringify(v) : v;
      });
      await dst.query(`insert into ${q(s)}.${q(t)}(${common.map(c => q(c.c)).join(',')}) overriding system value values(${values.map((_, i) => '$' + (i + 1)).join(',')})`, values);
      copied++;
    }
  }
  const seqs = (await dst.query("select table_schema s,table_name t,column_name c from information_schema.columns where table_schema in ('public','meetany_private') and (is_identity='YES' or column_default like 'nextval%')")).rows;
  for (const { s, t, c } of seqs) {
    const name = `${q(s)}.${q(t)}`;
    const seq = (await dst.query('select pg_get_serial_sequence($1,$2) n', [name, c])).rows[0].n;
    if (seq) await dst.query(`select setval($1,coalesce(max(${q(c)}),1),max(${q(c)}) is not null) from ${name}`, [seq]);
  }
  await dst.query('commit'); await src.query('rollback');
  await dst.query('analyze');
  console.log(`${process.env.TARGET_DB}: ${copied} rows copied; source writes: 0`);
} finally { await src.end().catch(() => {}); await dst.end().catch(() => {}); }
