\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.report_start as select count(*) n from t.passed;
grant select on t.report_start to public;
select t.signup('rp_client','rp-client@example.ge','{"role":"client","name":"Report Client","phone":"+995 522 772 001","city":"tbilisi"}');
select t.signup('rp_company','rp-company@example.ge','{"role":"company","name":"Report Owner","company":"Reported Company","phone":"+995 522 772 002","city":"tbilisi","industry":"leasing"}');
select t.signup('rp_other','rp-other@example.ge','{"role":"client","name":"Report Other","phone":"+995 522 772 003","city":"tbilisi"}');
select t.signup('rp_admin','rp-admin@example.ge','{"role":"client","name":"Report Admin","phone":"+995 522 772 004","city":"tbilisi"}');
select t.signup('rp_second','rp-second@example.ge','{"role":"company","name":"Second Owner","company":"Second Company","phone":"+995 522 772 005","city":"tbilisi","industry":"leasing"}');
update public.profiles set role='admin' where id=t.uid('rp_admin');

-- Privileges: the table is private, the RPCs are for signed-in users only.
select t.ok(not has_table_privilege('authenticated','meetany_private.reports','SELECT,INSERT,UPDATE,DELETE'),'RP table not exposed to users');
select t.ok(not has_table_privilege('anonymous','meetany_private.reports','SELECT'),'RP table not exposed to guests');
select t.ok(not has_function_privilege('anonymous','public.report_content(text,uuid,text,text)','EXECUTE'),'RP guest cannot execute report');
select t.ok(not has_function_privilege('anonymous','public.admin_list_reports(text,integer)','EXECUTE'),'RP guest cannot list reports');
select t.ok(has_function_privilege('authenticated','public.report_content(text,uuid,text,text)','EXECUTE'),'RP user can execute report');

select t.as_user('rp_client');
select t.put('rp_request',(public.create_request('Office chairs needed','We need twenty office chairs with delivery','leasing','tbilisi')).id);
select t.as_user('rp_company');
select t.put('rp_offer',(public.send_offer(t.get('rp_request'),'We can deliver the chairs this week')).id);
select t.as_user('rp_second');
select t.put('rp_offer2',(public.send_offer(t.get('rp_request'),'Second supplier offer with delivery')).id);

-- Guests are denied.
select t.as_anon();
select t.throws($q$select public.report_content('request',t.get('rp_request'),'spam','')$q$,'42501','RP guest denied');

-- Self-reports are denied.
select t.as_user('rp_client');
select t.throws($q$select public.report_content('request',t.get('rp_request'),'spam','')$q$,'MA703','RP own request denied');
select t.as_user('rp_company');
select t.throws($q$select public.report_content('company',t.uid('rp_company'),'fake','')$q$,'MA703','RP own company denied');

-- Validation.
select t.as_user('rp_other');
select t.throws($q$select public.report_content('request',t.get('rp_request'),'rude','')$q$,'MA701','RP unknown reason');
select t.throws($q$select public.report_content('request',t.get('rp_request'),'other','  ')$q$,'MA701','RP other needs text');
select t.throws($q$select public.report_content('request',t.get('rp_request'),'spam',repeat('x',501))$q$,'MA701','RP text max 500');
select t.throws($q$select public.report_content('request',gen_random_uuid(),'spam','')$q$,'MA702','RP unknown target');
select t.throws($q$select public.report_content('company',t.uid('rp_other'),'spam','')$q$,'MA702','RP client is not a company target');
select t.throws($q$select public.report_content('thing',t.get('rp_request'),'spam','')$q$,'MA702','RP unknown kind');
-- Offers are sealed: only the request author may report them.
select t.throws($q$select public.report_content('offer',t.get('rp_offer'),'spam','')$q$,'MA702','RP stranger cannot report offer');

-- Successful reports and duplicates.
select t.put('rp_r1',(public.report_content('request',t.get('rp_request'),'spam','')->>'id')::uuid);
select t.throws($q$select public.report_content('request',t.get('rp_request'),'fake','')$q$,'MA704','RP duplicate denied');
select t.put('rp_r2',(public.report_content('company',t.uid('rp_company'),'other','Uses a fake address')->>'id')::uuid);
select t.as_user('rp_company');
select t.put('rp_r3',(public.report_content('request',t.get('rp_request'),'offensive','')->>'id')::uuid);
select t.as_user('rp_client');
select t.put('rp_r4',(public.report_content('offer',t.get('rp_offer'),'spam','')->>'id')::uuid);
select t.put('rp_r5',(public.report_content('offer',t.get('rp_offer2'),'fake','')->>'id')::uuid);

-- Admin functions are admin only.
select t.throws($q$select public.admin_list_reports('new',0)$q$,'MA003','RP non-admin cannot list');
select t.throws($q$select public.admin_resolve_report(t.get('rp_r1'),'reject','Not a problem')$q$,'MA003','RP non-admin cannot resolve');

select t.as_user('rp_admin');
select t.ok((public.admin_list_reports('new',0)->>'newCount')::int>=5,'RP admin sees new count');
select t.ok((select (v->>'target_reports')::int=2 and (v->>'target_new')::int=2 from jsonb_array_elements(public.admin_list_reports('new',0)->'items') v where v->>'id'=t.get('rp_r1')::text),'RP count of reports on the same target');
select t.ok((select v->>'reporter_name'='Report Other' and v->>'target_label'='Office chairs needed' from jsonb_array_elements(public.admin_list_reports('new',0)->'items') v where v->>'id'=t.get('rp_r1')::text),'RP list shows reporter and target');
select t.ok((select v->>'context_id'=t.get('rp_request')::text from jsonb_array_elements(public.admin_list_reports('new',0)->'items') v where v->>'id'=t.get('rp_r4')::text),'RP offer report links its request');
select t.throws($q$select public.admin_list_reports('open',0)$q$,'22023','RP invalid status filter');
select t.throws($q$select public.admin_resolve_report(t.get('rp_r1'),'hide','')$q$,'MA304','RP resolution needs reason');
select t.throws($q$select public.admin_resolve_report(t.get('rp_r1'),'delete','Spam content')$q$,'22023','RP invalid action');

-- Reject: only this report is closed, the target stays.
select public.admin_resolve_report(t.get('rp_r2'),'reject','Address checked');
select t.throws($q$select public.admin_resolve_report(t.get('rp_r2'),'reject','Again')$q$,'MA706','RP handled report cannot be resolved twice');
select t.as_super();
select t.ok((select status='handled' and resolution='rejected' and handled_by=t.uid('rp_admin') from meetany_private.reports where id=t.get('rp_r2')),'RP reject marks handled');
select t.ok(not (select blocked from public.profiles where id=t.uid('rp_company')),'RP reject keeps company');

-- Hide a request: hidden via admin_set_hidden, every new report on it closed, both audit logs written.
select t.as_user('rp_admin');
select public.admin_resolve_report(t.get('rp_r1'),'hide','Spam request');
select t.as_super();
select t.ok((select hidden and hidden_reason='Spam request' from public.requests where id=t.get('rp_request')),'RP hide hides request');
select t.ok((select count(*)=0 from meetany_private.reports where target_id=t.get('rp_request') and status='new'),'RP hide closes all reports on target');
select t.ok(exists(select 1 from meetany_private.moderation_audit where target_id=t.get('rp_request') and action='request.hide'),'RP hide writes moderation audit');
select t.ok((select count(*)=2 from meetany_private.business_audit where target_id in (t.get('rp_r1'),t.get('rp_r2')) and action like 'report_%'),'RP resolutions audited');

-- Hide an offer: deleted via admin_delete_offer.
select t.as_user('rp_admin');
select public.admin_resolve_report(t.get('rp_r4'),'hide','Spam offer');
select t.as_super();
select t.ok(not exists(select 1 from public.offers where id=t.get('rp_offer')),'RP hide deletes offer');
select t.ok(exists(select 1 from meetany_private.moderation_audit where target_id=t.get('rp_offer') and action='offer.delete'),'RP offer delete audited');
select t.as_user('rp_admin');
select t.ok((select (v->>'target_exists')::boolean=false and v->>'target_label'='Reported Company' from jsonb_array_elements(public.admin_list_reports('handled',0)->'items') v where v->>'id'=t.get('rp_r4')::text),'RP deleted offer keeps its label');

-- Hide a company: blocked via admin_set_blocked.
select t.as_user('rp_client');
select t.put('rp_r6',(public.report_content('company',t.uid('rp_second'),'fake','')->>'id')::uuid);
select t.as_user('rp_admin');
select public.admin_resolve_report(t.get('rp_r6'),'hide','Fake company');
select t.as_super();
select t.ok((select blocked from public.profiles where id=t.uid('rp_second')),'RP hide blocks company');
select t.ok((select status='handled' and resolution='hidden' from meetany_private.reports where id=t.get('rp_r6')),'RP hide marks handled');
-- A chosen offer cannot be deleted; the report stays open.
update public.profiles set blocked=false where id=t.uid('rp_second');
select t.as_user('rp_client');
select t.as_super();
update public.requests set hidden=false where id=t.get('rp_request');
select t.as_user('rp_client');
select public.choose_offer(t.get('rp_offer2'));
select t.as_user('rp_admin');
select t.throws($q$select public.admin_resolve_report(t.get('rp_r5'),'hide','Chosen offer')$q$,'MA207','RP chosen offer cannot be deleted');
select t.as_super();
select t.ok((select status='new' from meetany_private.reports where id=t.get('rp_r5')),'RP failed hide leaves report open');

-- Re-reporting after a report is handled is allowed (only one active report per target).
select t.as_user('rp_other');
select t.lives($q$select public.report_content('request',t.get('rp_request'),'fake','')$q$,'RP report again after handling');

-- Daily limit: 10 reports per user per day.
select t.as_super();
insert into meetany_private.reports(reporter_id,target_kind,target_id,reason,created_at)
select t.uid('rp_other'),'request',gen_random_uuid(),'spam',now()-interval '1 hour' from generate_series(1,8);
select t.as_user('rp_other');
select t.throws($q$select public.report_content('company',t.uid('rp_company'),'spam','')$q$,'MA705','RP daily limit');
select t.as_super();
update meetany_private.reports set created_at=now()-interval '2 days' where reporter_id=t.uid('rp_other') and target_label='';
select t.as_user('rp_other');
select t.lives($q$select public.report_content('company',t.uid('rp_company'),'spam','')$q$,'RP limit is per day');

-- Blocked users cannot report.
select t.as_super();
update public.profiles set blocked=true where id=t.uid('rp_other');
select t.as_user('rp_other');
select t.throws($q$select public.report_content('company',t.uid('rp_second'),'spam','')$q$,'MA002','RP blocked user denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('rp_other');
\o
select 'Report tests: '||(count(*)-(select n from t.report_start))||' passed' from t.passed;
