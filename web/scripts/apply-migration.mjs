import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
// Deliberately pinned to auth-probe, which also serves production. Never print connection details.
const migration=process.argv[2]||'contact-events';
const dryRun=process.argv.includes('--dry-run');
const inspect=process.argv.includes('--inspect');
const plans={
 'admin-overview':{file:'20261002-admin-overview',tables:[],routines:['admin_overview','admin_stats']},
 'admin-management':{file:'20261002-admin-management',tables:['moderation_audit','company_reviews','business_audit','site_content'],routines:['admin_edit_profile','admin_edit_request','admin_company_settings','admin_manage_plan','save_company_review','site_content','admin_save_site_content','admin_business_audit']},
 'company-approval':{file:'20261002-company-approval',tables:[],routines:['list_companies','company_business_features','company_products','company_distribution_profiles','company_stats','company_reviews','send_offer']},
 'registration-analytics':{file:'20261002-registration-analytics',tables:['registration_sessions','registration_events'],routines:['record_registration_event','admin_registration_analytics']},
 products:{file:'20261001-products',tables:['company_products'],routines:['company_products','set_my_products']},
 'market-metrics':{file:'20261001-market-metrics',tables:[],routines:['admin_market_metrics']},
 distribution:{file:'20261001-distribution',tables:['company_business'],routines:['company_distribution_profiles','set_my_distribution','my_business_settings']},
 reports:{file:'20261001-reports',tables:['reports','business_audit'],routines:['report_content','admin_list_reports','admin_resolve_report']},
 'business-features':{file:'20260930-business-features',tables:['company_business','company_plans','plan_requests','company_reviews','business_audit'],routines:['company_business_features','company_reviews','my_company_review_targets','save_company_review','my_business_settings','set_company_distributor','request_company_plan','cancel_company_plan_request','admin_business_queue','admin_moderate_review','admin_resolve_plan']},
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
 'company-gallery':{file:'20260930-company-gallery',tables:[],routines:['set_my_gallery','list_companies']},
 'admin-photos':{file:'20260930-admin-photos',tables:['moderation_audit'],routines:['admin_remove_company_photo','admin_list_audit_v2']},
};
let pool,client,transactionOpen=false;
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
 client=await pool.connect();
 if(inspect){
  const {rows:[summary]}=await client.query(`select
   (select count(*)::int from public.profiles where role='company') companies,
   (select count(*)::int from public.profiles where role='company' and verified) verified,
   (select count(*)::int from public.profiles where role='company' and not verified) unverified,
   (select count(*)::int from public.profiles where role='company' and blocked) blocked,
   (select count(*)::int from public.profiles where role='company' and verified and not blocked) approved_public,
   (select count(*)::int from public.profiles where role='company' and not verified and not blocked) pending_unblocked`);
  const {rows:objects}=await client.query(`select name,exists(select 1 from information_schema.routines where routine_schema='public' and routine_name=name) present from unnest($1::text[]) name`,[plan.routines]);
  console.log({datasourcePinned:true,migration,companies:summary,routines:objects});
  throw Object.assign(new Error(),{inspected:true});
 }
 const sql=fs.readFileSync(new URL(`../../db/migrations/${plan.file||`20260923-${migration}`}.sql`,import.meta.url),'utf8');
 // Check the entire migration before its final commit on this same connection.
 // A failed contract check rolls back normal applies as well as dry runs.
 if(!/\ncommit;\s*$/.test(sql)) throw Object.assign(new Error(),{code:'NO_FINAL_COMMIT'});
 transactionOpen=true;
 await client.query(sql.replace(/\ncommit;\s*$/,'\n'));
 const {rows}=await client.query(`select
 (select count(*)::int from information_schema.tables where table_schema='meetany_private' and table_name=any($1::text[])) tables,
 (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name=any($2::text[])) routines`,[plan.tables,plan.routines]);
 if(rows[0].tables!==plan.tables.length||rows[0].routines!==plan.routines.length) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 if(migration==='request-alerts-default-on') {
  const {rows:[v]}=await client.query(`select
   to_regprocedure('meetany_private.default_request_alert_preferences(public.profiles)') is not null helper,
   to_regprocedure('meetany_private.notify_matching_request()') is not null trigger_function,
   exists(select 1 from meetany_private.settings where key='request_alerts_default_on' and value='on') marker`);
  if(!v.helper||!v.trigger_function||!v.marker) throw Object.assign(new Error(),{code:'MISSING_DEFAULT_ALERTS'});
 }
 if(migration==='categories') {
  const {rows:[v]}=await client.query(`select cardinality(meetany_private.categories()) keys,
   (select count(*)::int from public.profiles where industry is not null and not meetany_private.is_category(industry)) bad_profiles,
   (select count(*)::int from public.requests where not meetany_private.is_category(category)) bad_requests`);
  if(v.keys!==34||v.bad_profiles!==0||v.bad_requests!==0) throw Object.assign(new Error(),{code:'BAD_CATEGORIES'});
  const {rows}=await client.query(`select 'industry' as field, industry as key, count(*)::int from public.profiles where industry is not null group by 2
   union all select 'category', category, count(*)::int from public.requests group by 2 order by 1,2`);
  console.log(rows);
 }
 if(migration==='admin-api'||migration==='admin-v2') {
  const {rows:[v]}=await client.query(`select prosrc from pg_proc where oid='public.admin_stats()'::regprocedure`);
  if(!new RegExp("'adminApiVersion'\\s*,\\s*"+(migration==='admin-v2'?2:1)+"\\s*,").test(v.prosrc)) throw Object.assign(new Error(),{code:'MISSING_API_VERSION'});
 }
 if(migration==='empty-conversations') {
  const {rows:[v]}=await client.query(`select (select count(*)::int from information_schema.columns where table_schema='meetany_private' and table_name='conversations' and column_name='started_by') started_by,
   (select count(*)::int from pg_trigger where tgname='requests_delete_conversations' and tgrelid='public.requests'::regclass) trigger,
   (select count(*)::int from meetany_private.conversations where request_id is null and context_key<>'general') orphans`);
  if(v.started_by!==1||v.trigger!==1||v.orphans!==0) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 }
 if(migration==='company-logo') {
  const {rows:[v]}=await client.query(`select
   (select count(*)::int from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='logo_url') logo_url,
   (select count(*)::int from pg_constraint where conname='profiles_logo_url_check' and conrelid='public.profiles'::regclass) logo_check,
   (select count(*)::int from pg_proc where proname='update_my_profile' and pronamespace='public'::regnamespace) overloads,
   (select position('logo_url' in pg_get_function_result('public.list_companies()'::regprocedure))>0) catalog,
   has_column_privilege('anonymous','public.profiles','logo_url','SELECT') public_select,
   (select count(*)::int from meetany_private.settings where key='photo_origin') origin`);
  if(v.logo_url!==1||v.logo_check!==1||v.overloads!==1||!v.catalog||!v.public_select) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
  console.log({photoOriginConfigured:v.origin===1});
 }
 if(migration==='company-gallery') {
  const {rows:[v]}=await client.query(`select
   (select count(*)::int from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='gallery') gallery,
   (select count(*)::int from pg_constraint where conname='profiles_gallery_check' and conrelid='public.profiles'::regclass) gallery_check,
   (select position('gallery' in pg_get_function_result('public.list_companies()'::regprocedure))>0) catalog,
   has_column_privilege('anonymous','public.profiles','gallery','SELECT') public_select,
   has_function_privilege('authenticated','public.set_my_gallery(text[])','EXECUTE') rpc`);
  if(v.gallery!==1||v.gallery_check!==1||!v.catalog||!v.public_select||!v.rpc) throw Object.assign(new Error(),{code:'MISSING_OBJECTS'});
 }
 if(migration==='addresses') {
  const {rows:columns}=await client.query(`select table_name,column_name,data_type from information_schema.columns where table_schema='public' and ((table_name='profiles' and column_name in ('address','lat','lng')) or (table_name='requests' and column_name='address_note')) order by table_name,column_name`);
  if(columns.length!==4) throw Object.assign(new Error(),{code:'MISSING_COLUMNS'});
  console.log(columns);
 }
 if(migration==='admin-management') {
  const {rows:[v]}=await client.query(`select
   (select column_default like '%published%' from information_schema.columns where table_schema='meetany_private' and table_name='company_reviews' and column_name='status') reviews_direct,
   (select relrowsecurity from pg_class where oid='meetany_private.site_content'::regclass) cms_rls,
   not has_table_privilege('anonymous','meetany_private.site_content','SELECT') and not has_table_privilege('authenticated','meetany_private.site_content','UPDATE') cms_private,
   has_function_privilege('anonymous','public.site_content()','EXECUTE') public_cms,
   not has_function_privilege('anonymous','public.admin_manage_plan(uuid,text,timestamptz)','EXECUTE') and not has_function_privilege('anonymous','public.admin_business_audit(integer,integer)','EXECUTE') admin_private,
   (select count(*)::int from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) and prosecdef and prosrc like '%meetany_private.require_admin()%') guarded_admin_routines,
   (select pg_get_constraintdef(oid) like '%edit_profile%' and pg_get_constraintdef(oid) like '%edit_request%' from pg_constraint where conrelid='meetany_private.moderation_audit'::regclass and conname='moderation_audit_action_check') audit_actions`,[
    ['admin_edit_profile','admin_edit_request','admin_company_settings','admin_manage_plan','admin_save_site_content','admin_business_audit']]);
  if(!v.reviews_direct||!v.cms_rls||!v.cms_private||!v.public_cms||!v.admin_private||v.guarded_admin_routines!==6||!v.audit_actions) throw Object.assign(new Error(),{code:'BAD_ADMIN_MANAGEMENT_CONTRACT'});
 }
 if(migration==='company-approval') {
  const {rows:[v]}=await client.query(`select
   (select count(*)::int from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) and prosrc like '%meetany_private.can_view_company%') guarded_public_routines,
   (select bool_and(prosrc like '%MA801%' and prosrc like '%not me.verified%') from pg_proc where pronamespace='public'::regnamespace and proname='send_offer') offers_gated,
   exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_public' and qual like '%verified%') profile_policy,
   has_function_privilege('anonymous','meetany_private.can_view_company(uuid)','EXECUTE') public_gate,
   has_function_privilege('authenticated','meetany_private.can_view_company(uuid)','EXECUTE') actor_gate`,[
    ['list_companies','company_business_features','company_products','company_distribution_profiles','company_stats','company_reviews']]);
  if(v.guarded_public_routines!==6||!v.offers_gated||!v.profile_policy||!v.public_gate||!v.actor_gate) throw Object.assign(new Error(),{code:'BAD_COMPANY_APPROVAL_CONTRACT'});
 }
 if(migration==='registration-analytics') {
  const {rows:[v]}=await client.query(`select
   (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='meetany_private' and c.relname=any(array['registration_sessions','registration_events']) and c.relrowsecurity) private_rls_tables,
   exists(select 1 from meetany_private.settings where key='registration_analytics_started_at') started_marker,
   to_regclass('meetany_private.registration_profile_once') is not null completion_unique,
   has_function_privilege('anonymous','public.record_registration_event(uuid,uuid,text,text,text,text)','EXECUTE') guest_events,
   not has_function_privilege('anonymous','public.admin_registration_analytics(integer,text)','EXECUTE') admin_private,
   (select count(*)::int from pg_proc where pronamespace='public'::regnamespace and proname='record_registration_event') event_overloads,
   (select pronargdefaults=2 and prosecdef and prosrc like '%meetany_private.require_user()%' from pg_proc where oid='public.record_registration_event(uuid,uuid,text,text,text,text)'::regprocedure) compatible_completion,
   not has_table_privilege('anonymous','meetany_private.registration_events','SELECT') and not has_table_privilege('authenticated','meetany_private.registration_sessions','SELECT') events_private`);
  if(v.private_rls_tables!==2||!v.started_marker||!v.completion_unique||!v.guest_events||!v.admin_private||v.event_overloads!==1||!v.compatible_completion||!v.events_private) throw Object.assign(new Error(),{code:'BAD_REGISTRATION_ANALYTICS_CONTRACT'});
 }
 if(migration==='admin-overview') {
  const {rows:[v]}=await client.query(`select
   (select prosecdef and provolatile='s' and prosrc like '%meetany_private.require_admin()%' and prosrc like '%generate_series(0,59)%' from pg_proc where oid='public.admin_overview()'::regprocedure) bounded_admin,
   not has_function_privilege('anonymous','public.admin_overview()','EXECUTE') guest_denied,
   has_function_privilege('authenticated','public.admin_overview()','EXECUTE') admin_rpc,
   (select prosrc like '%adminRevision%' and prosrc like '%meetany_private.moderation_audit%' and prosrc like '%meetany_private.business_audit%' from pg_proc where oid='public.admin_stats()'::regprocedure) revision`);
  if(!v.bounded_admin||!v.guest_denied||!v.admin_rpc||!v.revision) throw Object.assign(new Error(),{code:'BAD_ADMIN_OVERVIEW_CONTRACT'});
 }
 await client.query(dryRun?'rollback':'commit');transactionOpen=false;
 if(dryRun)console.log(`auth-probe: ${migration} dry-run ok, objects verified, rolled back`);else console.log(`auth-probe: ${migration}, ${rows[0].tables} tables and ${rows[0].routines} RPCs verified`);
} catch(err) {if(transactionOpen&&client)await client.query('rollback').catch(()=>{});if(!err.inspected){console.error(err.code||'MIGRATION_FAILED');process.exitCode=1;}}
finally {client?.release();if(pool) await pool.end();}
