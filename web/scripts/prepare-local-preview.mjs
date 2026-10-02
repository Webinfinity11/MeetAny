// Local preview only. The remote connection is read-only; writes are limited to
// a newly created database on this computer. No Auth secrets are copied.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const database = `meetany_preview_${Date.now()}`;
const localUrl = `postgresql://${encodeURIComponent(process.env.USER)}@localhost:5432/${database}`;
const q = value => `"${value.replaceAll('"', '""')}"`;
execFileSync('createdb', [database], {stdio: 'pipe'});
const run = file => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database, '-f', file], {stdio: 'pipe'});
run('../db/tests/stub_neon.sql');
run('../db/schema.sql');
const source = new pg.Client({connectionString: process.env.DATABASE_URL});
const target = new pg.Client({connectionString: localUrl});
let complete=false;
try {
  await source.connect(); await target.connect();
  await source.query('begin read only');
  await target.query("begin; set local session_replication_role = 'replica'");
  const profiles = (await source.query('select id,name,email from public.profiles')).rows;
  for (const profile of profiles) await target.query('insert into neon_auth."user"(id,name,email,"emailVerified") values($1,$2,$3,true)', [profile.id, profile.name, profile.email]);
  const tables = (await source.query("select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','meetany_private') order by table_schema,table_name")).rows;
  let copied = 0;
  for (const {table_schema: schema, table_name: table} of tables) {
    const columns = (await target.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position', [schema,table])).rows.map(row => row.column_name);
    if (!columns.length) continue;
    const sourceColumns = new Set((await source.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2', [schema,table])).rows.map(row => row.column_name));
    const common = columns.filter(column => sourceColumns.has(column));
    const rows = (await source.query(`select ${common.map(q).join(',')} from ${q(schema)}.${q(table)}`)).rows;
    await target.query(`delete from ${q(schema)}.${q(table)}`);
    const types = (await target.query('select column_name,data_type from information_schema.columns where table_schema=$1 and table_name=$2', [schema,table])).rows;
    for (const row of rows) {
      const values = common.map(column => {
        const value = row[column];
        // pg encodes native arrays separately from JSON arrays.
        return value && !Array.isArray(value) && !(value instanceof Date) && typeof value === 'object' ? JSON.stringify(value) : value;
      });
      for (let i=0;i<common.length;i++) if (['json','jsonb'].includes(types.find(type => type.column_name === common[i])?.data_type) && values[i] !== null) values[i] = JSON.stringify(row[common[i]]);
      await target.query(`insert into ${q(schema)}.${q(table)}(${common.map(q).join(',')}) overriding system value values(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
      copied++;
    }
  }
  const sequences = (await target.query("select table_schema,table_name,column_name from information_schema.columns where table_schema in ('public','meetany_private') and (is_identity='YES' or column_default like 'nextval%')")).rows;
  for (const col of sequences) {
    const tableName = `${q(col.table_schema)}.${q(col.table_name)}`;
    const sequence = (await target.query('select pg_get_serial_sequence($1,$2) as name',[tableName,col.column_name])).rows[0].name;
    if (sequence) await target.query(`select setval($1,coalesce(max(${q(col.column_name)}),1),max(${q(col.column_name)}) is not null) from ${tableName}`,[sequence]);
  }
  await target.query('commit'); await source.query('commit');
  // Local-only additions may be developed in parallel; apply completed migrations.
  for (const name of ['20261002-company-approval.sql','20261002-admin-management.sql','20261002-registration-analytics.sql']) {
    const file = path.join('../db/migrations',name); if (fs.existsSync(file)) run(file);
  }
  const envFile = '.env.local';
  const original = fs.readFileSync(envFile,'utf8').replace(/^MEETANY_LOCAL_DATABASE_URL=.*\n?/gm,'').replace(/^REGISTRATION_ANALYTICS_ENABLED=.*\n?/gm,'');
  fs.writeFileSync(envFile,`${original.trimEnd()}\nMEETANY_LOCAL_DATABASE_URL=${localUrl}\nREGISTRATION_ANALYTICS_ENABLED=true\n`,{mode:0o600});
  complete=true;
  console.log(`Local preview database ready: ${database}; ${copied} rows copied. Remote writes: 0.`);
} finally {await source.end().catch(()=>{});await target.end().catch(()=>{});if(!complete)execFileSync('dropdb',['--if-exists',database],{stdio:'pipe'});}
