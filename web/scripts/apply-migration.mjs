import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
// Deliberately pinned to auth-probe, which also serves production. Never print connection details.
const migration=process.argv[2]||'contact-events';
const dryRun=process.argv.includes('--dry-run');
const plans={
 'request-alerts-default-on':{file:'20260929-request-alerts-default-on',tables:['request_alert_preferences'],routines:['request_alert_preferences']},
 categories:{file:'20260929-categories',tables:[],routines:['set_request_alert_preferences']},
 'admin-v2': {
  file: '20260929-admin-v2',
  tables: ['moderation_audit'],
  routines: ['admin_search_offers', 'admin_delete_offer',
    'admin_delete_request_v2', 'admin_list_audit_v2', 'admin_stats'],
 },
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
 const sql=fs.readFileSync(new URL(`../../db/migrations/${plan.file||`20260923-${migration}`}.sql`,import.meta.url),'utf8');
 if(dryRun) {
  // Run the whole migration and roll it back: constraint or mapping errors surface, nothing is kept.
  if(!/\ncommit;\s*$/.test(sql)) throw Object.assign(new Error(),{code:'NO_FINAL_COMMIT'});
  await pool.query(sql.replace(/\ncommit;\s*$/,'\nrollback;\n'));
 } else await pool.query(sql);
 if(dryRun) {console.log(`auth-probe: ${migration} dry-run ok, rolled back`);throw Object.assign(new Error(),{dry:true});}
 const {rows}=await pool.query(`select
 (select count(*)::int from information_schema.tables where table_schema='meetany_private' and table_name=any($1::text[])) tables,
 (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name=any($2::text[])) routines`,[plan.tables,plan.routines]);
 if(rows[0].tables!==plan.tables.length||rows[0].routines!==plan.routines.length) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 if(migration==='request-alerts-default-on') {
  const {rows:[v]}=await pool.query(`select
   to_regprocedure('meetany_private.default_request_alert_preferences(public.profiles)') is not null helper,
   to_regprocedure('meetany_private.notify_matching_request()') is not null trigger_function,
   exists(select 1 from meetany_private.settings where key='request_alerts_default_on' and value='on') marker`);
  if(!v.helper||!v.trigger_function||!v.marker) throw Object.assign(new Error(),{code:'MISSING_DEFAULT_ALERTS'});
 }
 if(migration==='categories') {
  const {rows:[v]}=await pool.query(`select cardinality(meetany_private.categories()) keys,
   (select count(*)::int from public.profiles where industry is not null and not meetany_private.is_category(industry)) bad_profiles,
   (select count(*)::int from public.requests where not meetany_private.is_category(category)) bad_requests`);
  if(v.keys!==34||v.bad_profiles!==0||v.bad_requests!==0) throw Object.assign(new Error(),{code:'BAD_CATEGORIES'});
  const {rows}=await pool.query(`select 'industry' as field, industry as key, count(*)::int from public.profiles where industry is not null group by 2
   union all select 'category', category, count(*)::int from public.requests group by 2 order by 1,2`);
  console.log(rows);
 }
 if(migration==='admin-api'||migration==='admin-v2') {
  const {rows:[v]}=await pool.query(`select prosrc from pg_proc where oid='public.admin_stats()'::regprocedure`);
  if(!new RegExp("'adminApiVersion'\\s*,\\s*"+(migration==='admin-v2'?2:1)+"\\s*,").test(v.prosrc)) throw Object.assign(new Error(),{code:'MISSING_API_VERSION'});
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
} catch(err) {if(!err.dry) {console.error(err.code||'MIGRATION_FAILED');process.exitCode=1;}}
finally {if(pool) await pool.end();}
