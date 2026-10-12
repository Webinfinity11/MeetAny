\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.design_default as select public.site_design()->'config' config;
grant select on t.design_default to public;
select t.ok(not has_table_privilege('anonymous','meetany_private.site_design','SELECT'),'DESIGN private table is not public');
select t.ok(not has_table_privilege('authenticated','meetany_private.site_design','UPDATE'),'DESIGN signed-in users cannot update table directly');
select t.as_anon();
select t.ok((public.site_design()->>'version')::integer=0,'DESIGN default version is public');
select t.ok(public.site_design()->'config'->>'badgeStyle'='outline','DESIGN information defaults to a quiet outline');
select t.throws($q$select public.admin_save_site_design((select config from t.design_default),0)$q$,'42501','DESIGN guest cannot publish');
select t.as_user('bx_client');
select t.throws($q$select public.admin_save_site_design((select config from t.design_default),0)$q$,'MA003','DESIGN customer cannot publish');
select t.as_user('bx_admin');
select t.throws($q$select public.admin_save_site_design(null,0)$q$,'22023','DESIGN null config rejected');
select t.throws($q$select public.admin_save_site_design('[]',0)$q$,'22023','DESIGN array rejected');
select t.throws($q$select public.admin_save_site_design((select config || '{"controlHeight":24}' from t.design_default),0)$q$,'22023','DESIGN undersized controls rejected');
select t.throws($q$select public.admin_save_site_design((select config || '{"primary":"red;display:none"}' from t.design_default),0)$q$,'22023','DESIGN arbitrary CSS rejected');
select t.throws($q$select public.admin_save_site_design((select config || '{"css":"display:none"}' from t.design_default),0)$q$,'22023','DESIGN unknown field rejected');
select t.throws($q$select public.admin_save_site_design((select config || '{"badgeStyle":"bright"}' from t.design_default),0)$q$,'22023','DESIGN unknown information style rejected');
select t.ok((public.admin_save_site_design((select config || '{"controlHeight":52,"spacing":120,"badgeStyle":"soft"}' from t.design_default),0)->>'version')::integer=1,'DESIGN admin publishes first version');
select t.throws($q$select public.admin_save_site_design((select config from t.design_default),0)$q$,'MA409','DESIGN stale editor cannot overwrite published settings');
select t.throws($q$select public.admin_save_site_design((select config from t.design_default),null)$q$,'MA409','DESIGN absent version cannot overwrite published settings');
select t.as_anon();
select t.ok(public.site_design()->'config'->>'controlHeight'='52','DESIGN published controls visible to guests');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.business_audit where action='site_design_saved' and actor_id=t.uid('bx_admin')),'DESIGN publication recorded in audit');
\o
select 'Design settings: 17 assertions passed';
