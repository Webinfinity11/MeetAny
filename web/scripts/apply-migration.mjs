import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
// Deliberately pinned to the authorized test branch. Never print connection details.
let pool;
try {
 const envFile=new URL('../.env.local',import.meta.url);
 if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }
 if(!/^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(process.env.DATABASE_URL).hostname))
  throw Object.assign(new Error(),{code:'WRONG_BRANCH'});
 pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 await pool.query(fs.readFileSync(new URL('../../db/migrations/20260923-contact-events.sql',import.meta.url),'utf8'));
 const {rows}=await pool.query(`select
 (select count(*)::int from information_schema.tables where table_schema='meetany_private' and table_name='contact_events') tables,
 (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name in ('log_contact_event','admin_contact_stats','admin_contact_events')) routines`);
 if(rows[0].tables!==1||rows[0].routines!==3) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 console.log('auth-probe: contact_events and 3 RPCs verified');
} catch(err) {console.error(err.code||'MIGRATION_FAILED');process.exitCode=1;}
finally {if(pool) await pool.end();}
