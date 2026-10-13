-- Read-only snapshot inventory; no Auth secrets or ledger passwords are selected.
begin read only;
select jsonb_pretty(jsonb_build_object(
 'database',current_database(),
 'functions',(select jsonb_agg(x order by schema,name,args) from (
 select p.oid,n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,
 oidvectortypes(p.proargtypes) types,pg_get_functiondef(p.oid) definition,
 (select coalesce(jsonb_agg(jsonb_build_object('object',pg_describe_object(d.classid,d.objid,d.objsubid),'type',d.deptype)),'[]') from pg_depend d where d.refclassid='pg_proc'::regclass and d.refobjid=p.oid) dependents
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','meetany_private') and p.prokind='f') x),
 'columns',(select jsonb_agg(x order by table_schema,table_name,ordinal_position) from (select table_schema,table_name,column_name,data_type,ordinal_position from information_schema.columns where table_schema in ('public','meetany_private')) x),
 'foreign_keys',(select jsonb_agg(x) from (select conrelid::regclass::text source,confrelid::regclass::text target,pg_get_constraintdef(oid) definition from pg_constraint where contype='f' and connamespace in ('public'::regnamespace,'meetany_private'::regnamespace)) x),
 'profiles',(select jsonb_agg(x order by email) from (select id,email,company,name,role,about,blocked,verified,onboarding_completed_at from public.profiles) x),
 'requests',(select jsonb_agg(x order by id) from (select id,owner_id,title,hidden,status from public.requests) x),
 'offers',(select jsonb_agg(x order by id) from (select id,request_id,company_id,body,status from public.offers) x),
 'triggers',(select jsonb_agg(x) from (select tgrelid::regclass::text relation,tgname,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace,'meetany_private'::regnamespace))) x),
 'policies',(select jsonb_agg(x) from (select schemaname,tablename,policyname,qual,with_check from pg_policies where schemaname in ('public','meetany_private')) x)
));
commit;
