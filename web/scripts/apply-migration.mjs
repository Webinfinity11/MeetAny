import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
// Deliberately pinned to the authorized test branch. Never print connection details.
const migration=process.argv[2]||'contact-events';
const plans={
 addresses:{tables:[],routines:['create_request','update_request','update_my_profile','list_companies']},
 'contact-events':{tables:['contact_events'],routines:['log_contact_event','admin_contact_stats','admin_contact_events']},
 messaging:{tables:['conversations','messages'],routines:['start_conversation','send_message','list_my_conversations','list_messages','mark_read','unread_message_count','admin_message_stats','admin_list_conversations','admin_conversation_messages']},
};
let pool;
try {
 if(!Object.hasOwn(plans,migration)) throw Object.assign(new Error(),{code:'UNKNOWN_MIGRATION'});
 const plan=plans[migration];
 const envFile=new URL('../.env.local',import.meta.url);
 if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }
 if(!/^ep-withered-glade-b54ts1g5(?:-pooler)?\./.test(new URL(process.env.DATABASE_URL).hostname))
  throw Object.assign(new Error(),{code:'WRONG_BRANCH'});
 pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 await pool.query(fs.readFileSync(new URL(`../../db/migrations/20260923-${migration}.sql`,import.meta.url),'utf8'));
 const {rows}=await pool.query(`select
 (select count(*)::int from information_schema.tables where table_schema='meetany_private' and table_name=any($1::text[])) tables,
 (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name=any($2::text[])) routines`,[plan.tables,plan.routines]);
 if(rows[0].tables!==plan.tables.length||rows[0].routines!==plan.routines.length) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 if(migration==='addresses') {
  const {rows:columns}=await pool.query(`select table_name,column_name,data_type from information_schema.columns where table_schema='public' and ((table_name='profiles' and column_name in ('address','lat','lng')) or (table_name='requests' and column_name='address_note')) order by table_name,column_name`);
  if(columns.length!==4) throw Object.assign(new Error(),{code:'MISSING_COLUMNS'});
  console.log(columns);
 }
 console.log(`auth-probe: ${migration}, ${rows[0].tables} tables and ${rows[0].routines} RPCs verified`);
} catch(err) {console.error(err.code||'MIGRATION_FAILED');process.exitCode=1;}
finally {if(pool) await pool.end();}
