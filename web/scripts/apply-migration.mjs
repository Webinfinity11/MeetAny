import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
// Deliberately pinned to the authorized test branch. Never print connection details.
const migration=process.argv[2]||'contact-events';
const plans={
 addresses:{tables:[],routines:['create_request','update_request','update_my_profile','list_companies']},
 'contact-events':{tables:['contact_events'],routines:['log_contact_event','admin_contact_stats','admin_contact_events']},
 messaging:{tables:['conversations','messages'],routines:['start_conversation','send_message','list_my_conversations','list_messages','mark_read','unread_message_count','admin_message_stats','admin_list_conversations','admin_conversation_messages']},
 'admin-api':{tables:['moderation_audit'],routines:['admin_set_hidden','admin_delete_request','admin_set_blocked','admin_set_verified','admin_list_users','admin_search_requests','admin_search_users','admin_list_audit','admin_stats']},
 'empty-conversations':{file:'20260924-empty-conversations',tables:['conversations'],routines:['start_conversation','list_my_conversations']},
 'company-logo':{file:'20260924-company-logo',tables:[],routines:['update_my_profile','list_companies']},
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
 await pool.query(fs.readFileSync(new URL(`../../db/migrations/${plan.file||`20260923-${migration}`}.sql`,import.meta.url),'utf8'));
 const {rows}=await pool.query(`select
 (select count(*)::int from information_schema.tables where table_schema='meetany_private' and table_name=any($1::text[])) tables,
 (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name=any($2::text[])) routines`,[plan.tables,plan.routines]);
 if(rows[0].tables!==plan.tables.length||rows[0].routines!==plan.routines.length) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 if(migration==='admin-api') {
  const {rows:[v]}=await pool.query(`select position('adminApiVersion' in prosrc)>0 ok from pg_proc where oid='public.admin_stats()'::regprocedure`);
  if(!v.ok) throw Object.assign(new Error(),{code:'MISSING_API_VERSION'});
 }
 if(migration==='empty-conversations') {
  const {rows:[v]}=await pool.query(`select (select count(*)::int from information_schema.columns where table_schema='meetany_private' and table_name='conversations' and column_name='started_by') started_by,
   (select count(*)::int from pg_trigger where tgname='requests_delete_conversations' and tgrelid='public.requests'::regclass) trigger,
   (select count(*)::int from meetany_private.conversations where request_id is null and context_key<>'general') orphans`);
  if(v.started_by!==1||v.trigger!==1||v.orphans!==0) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 }
 if(migration==='company-logo') {
  const {rows:[v]}=await pool.query(`select
   (select count(*)::int from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='logo_url') logo_url,
   (select count(*)::int from pg_constraint where conname='profiles_logo_url_check' and conrelid='public.profiles'::regclass) logo_check,
   (select count(*)::int from pg_proc where proname='update_my_profile' and pronamespace='public'::regnamespace) overloads,
   (select position('logo_url' in pg_get_function_result('public.list_companies()'::regprocedure))>0) catalog,
   has_column_privilege('anonymous','public.profiles','logo_url','SELECT') public_select,
   (select count(*)::int from meetany_private.settings where key='photo_origin') origin`);
  if(v.logo_url!==1||v.logo_check!==1||v.overloads!==1||!v.catalog||!v.public_select) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
  console.log({photoOriginConfigured:v.origin===1});
 }
 if(migration==='addresses') {
  const {rows:columns}=await pool.query(`select table_name,column_name,data_type from information_schema.columns where table_schema='public' and ((table_name='profiles' and column_name in ('address','lat','lng')) or (table_name='requests' and column_name='address_note')) order by table_name,column_name`);
  if(columns.length!==4) throw Object.assign(new Error(),{code:'MISSING_COLUMNS'});
  console.log(columns);
 }
 console.log(`auth-probe: ${migration}, ${rows[0].tables} tables and ${rows[0].routines} RPCs verified`);
} catch(err) {console.error(err.code||'MIGRATION_FAILED');process.exitCode=1;}
finally {if(pool) await pool.end();}
