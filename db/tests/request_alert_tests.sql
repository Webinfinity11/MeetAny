\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.alert_start as select count(*) n from t.passed;
select t.signup('alert_owner','alert-owner@example.test','{"role":"client","name":"Alert Owner","phone":"+995 591 971 001","city":"tbilisi"}');
select t.signup('alert_company','alert-company@example.test','{"role":"company","name":"Alert Supplier","company":"Alert Company","industry":"furniture","phone":"+995 591 971 002","city":"tbilisi"}');
select t.as_user('alert_owner');
select t.throws($$select public.request_alert_preferences()$$,'MA201','A only companies subscribe');
select t.as_user('alert_company');
select t.ok(public.request_alert_preferences()='{"enabled":true,"categories":["furniture"],"cities":["tbilisi"],"emailMode":"off"}'::jsonb,'A profile defaults on');
select t.throws($$select public.set_request_alert_preferences(true,'{}','{tbilisi}')$$,'22023','A category required');
select t.throws($$select public.set_request_alert_preferences(true,'{bad}','{tbilisi}')$$,'22023','A unknown category denied');
select t.throws($$select public.set_request_alert_preferences(true,'{furniture}','{NULL}')$$,'22023','A null city denied');
select t.throws($$select * from meetany_private.request_alert_preferences$$,'42501','A private preferences');
select t.throws($$select meetany_private.claim_request_alert_email('test@example.test','https://example.test')$$,'42501','A worker denied');
select public.set_request_alert_preferences(true,'{furniture}','{tbilisi}','instant');
select t.as_user('alert_owner');
select t.put('alert_match',(public.create_request('Matching furniture request','Detailed matching furniture request','furniture','tbilisi')).id);
select t.put('alert_city',(public.create_request('Different city request','Detailed different city furniture request','furniture','batumi')).id);
select t.put('alert_cat',(public.create_request('Different category request','Detailed different category request','food_fresh','tbilisi')).id);
select t.put('alert_national',(public.create_request('National furniture request','Detailed national furniture request','furniture','georgia')).id);
select t.as_user('alert_company');
select t.ok((public.engagement_state()->>'unread')::int=2,'A category and city matching includes national');
select t.ok(public.list_notifications()->'items'->0->>'kind'='request_match','A request kind returned');
select t.ok(public.list_notifications()->'items'->0->>'category'='furniture','A category metadata');
select t.put('alert_self',(public.create_request('Own furniture request','Detailed own furniture request','furniture','tbilisi')).id);
select t.ok((public.engagement_state()->>'unread')::int=2,'A own request excluded');
select public.set_request_alert_preferences(true,'{furniture}','{tbilisi}','instant');
select t.as_super();
select t.ok((select count(*)=2 from meetany_private.request_alert_emails where status='pending'),'A same preferences preserve queue');
update public.requests set body='Edited description for request' where id=t.get('alert_match');
select t.ok((select count(*)=2 from meetany_private.notifications where user_id=t.uid('alert_company')),'A edits do not duplicate');
create table t.alert_jobs(j jsonb);
insert into t.alert_jobs select meetany_private.claim_request_alert_email('test@example.test','https://example.test');
select t.ok((select j->>'id' is not null from t.alert_jobs),'A instant job claims');
select t.ok((select j->'payload'->>'text' like '%/requests/view/?id=%' from t.alert_jobs),'A link in email');
select t.ok(not meetany_private.finish_request_alert_email((select (j->>'id')::uuid from t.alert_jobs),gen_random_uuid(),true),'A wrong lease denied');
select t.ok(meetany_private.finish_request_alert_email((select (j->>'id')::uuid from t.alert_jobs),(select (j->>'lease')::uuid from t.alert_jobs),false,'provider_http_503'),'A failure reschedules');
update meetany_private.request_alert_emails set available_at=now()-interval '1 day' where id=(select (j->>'id')::uuid from t.alert_jobs);
do $$ declare job jsonb; begin
 job:=meetany_private.claim_request_alert_email('other@example.test','https://changed.test');
 perform t.ok(job->'payload'=(select j->'payload' from t.alert_jobs),'A retry payload frozen');
 perform t.ok(meetany_private.finish_request_alert_email((job->>'id')::uuid,(job->>'lease')::uuid,true),'A completion');
end $$;
update public.requests set hidden=true where id=t.get('alert_match');
select t.as_user('alert_company');
select t.ok((public.engagement_state()->>'unread')::int=1,'A hidden removed from inbox and badge');
select public.set_request_alert_preferences(true,'{furniture}','{georgia,tbilisi}','daily');
select t.ok(public.request_alert_preferences()->'cities'='["georgia"]'::jsonb,'A nationwide normalizes cities');
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.request_alert_emails where status in('pending','processing')),'A changed preferences cancel pending');
-- Fixture inserts avoid the unrelated per-owner five-open-requests limit.
insert into public.requests(owner_id,title,body,category,city) values
(t.uid('alert_owner'),'Daily request one','Detailed daily request one','furniture','batumi'),
(t.uid('alert_owner'),'Daily request two','Detailed daily request two','furniture','kutaisi');
select t.ok((select count(*)=1 from meetany_private.request_alert_emails where status='pending'),'A daily requests grouped');
select t.ok(meetany_private.claim_request_alert_email('test@example.test','https://example.test') is null,'A digest waits until due');
update meetany_private.request_alert_emails set available_at=now()-interval '1 minute' where status='pending';
truncate t.alert_jobs;
insert into t.alert_jobs select meetany_private.claim_request_alert_email('test@example.test','https://example.test');
select t.ok((select j->'payload'->>'subject' like '%(2)%' from t.alert_jobs),'A digest includes two requests');
select t.as_user('alert_company');
select public.set_request_alert_preferences(false,'{furniture}','{georgia}','daily');
select public.set_request_alert_preferences(true,'{furniture}','{georgia}','daily');
select t.as_super();
insert into public.requests(owner_id,title,body,category,city) values(t.uid('alert_owner'),'Reenabled daily request','Detailed reenabled daily request','furniture','batumi');
select t.ok((select count(*)=1 from meetany_private.request_alert_emails where status='pending'),'A reenable creates fresh daily bucket');
select t.ok(not meetany_private.finish_request_alert_email((select (j->>'id')::uuid from t.alert_jobs),(select (j->>'lease')::uuid from t.alert_jobs),true),'A optout invalidates old lease');
update public.profiles set blocked=true where id=t.uid('alert_company');
insert into public.requests(owner_id,title,body,category,city) values(t.uid('alert_owner'),'Blocked company request','Detailed blocked company request','furniture','tbilisi');
select t.ok(not exists(select 1 from meetany_private.notifications n join public.requests r on r.id=n.request_id where r.title='Blocked company request' and n.user_id=t.uid('alert_company')),'A blocked company excluded');
select t.ok(meetany_private.claim_request_alert_email('test@example.test','https://example.test') is null,'A blocked company receives no email');
update public.profiles set blocked=false where id=t.uid('alert_company');
insert into public.requests(owner_id,title,body,category,city,hidden) values(t.uid('alert_owner'),'Hidden request fixture','Detailed hidden request fixture','furniture','tbilisi',true);
select t.ok(not exists(select 1 from meetany_private.notifications n join public.requests r on r.id=n.request_id where r.title='Hidden request fixture'),'A hidden insert excluded');
do $$ declare n int; begin
 select count(*) into n from meetany_private.notifications;
 begin
 insert into public.requests(owner_id,title,body,category,city) values(t.uid('alert_owner'),'Rollback request fixture','Detailed rollback request fixture','furniture','tbilisi');
 raise exception 'rollback';
 exception when raise_exception then null; end;
 perform t.ok((select count(*) from meetany_private.notifications)=n,'A rollback creates no notification');
end $$;
update public.requests set status='closed' where id=t.get('alert_national');
select t.as_user('alert_company');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') x where x->>'request_id'=t.get('alert_national')::text),'A closed requests removed');
select t.as_anon();
select t.throws($$select public.set_request_alert_preferences(true,'{furniture}','{tbilisi}')$$,'42501','A anonymous cannot subscribe');
select t.as_super();
delete from public.requests where id=t.get('alert_national');
select t.ok(not exists(select 1 from meetany_private.notifications where request_id=t.get('alert_national')),'A deletion cascades');
-- Profile-derived defaults without a saved preference row.
select t.signup('default_company','default-company@example.test','{"role":"company","name":"Default Supplier","company":"Default Company","industry":"freight","phone":"+995 591 971 003","city":"tbilisi"}');
select t.as_super();
insert into public.requests(owner_id,title,body,category,city) values
(t.uid('alert_owner'),'Default match','Detailed default matching request','freight','tbilisi'),
(t.uid('alert_owner'),'Default other city','Detailed default different city','freight','batumi'),
(t.uid('alert_owner'),'Default other category','Detailed default other category','food_fresh','tbilisi'),
(t.uid('default_company'),'Default self','Detailed default own request','freight','tbilisi');
select t.ok((select count(*)=1 from meetany_private.notifications where user_id=t.uid('default_company')),'A missing row matches only category and city, excludes self');
select t.ok(not exists(select 1 from meetany_private.request_alert_emails where user_id=t.uid('default_company')),'A missing row creates zero email jobs');
update public.profiles set blocked=true where id=t.uid('default_company');
insert into public.requests(owner_id,title,body,category,city) values(t.uid('alert_owner'),'Default blocked','Detailed default blocked request','freight','tbilisi');
select t.ok((select count(*)=1 from meetany_private.notifications where user_id=t.uid('default_company')),'A missing row blocked company excluded');
update public.profiles set blocked=false,service_cities='{georgia,tbilisi}' where id=t.uid('default_company');
select t.as_user('default_company');
select t.ok(public.request_alert_preferences()->'cities'='["georgia"]'::jsonb,'A default georgia normalized');
select public.set_request_alert_preferences(false,'{}','{}');
select t.ok(not (public.request_alert_preferences()->>'enabled')::boolean,'A empty explicit optout accepted');
select t.as_super();
insert into public.requests(owner_id,title,body,category,city) values(t.uid('alert_owner'),'Default opted out','Detailed default opted out request','freight','tbilisi');
select t.ok((select count(*)=1 from meetany_private.notifications where user_id=t.uid('default_company')),'A saved optout respected');
-- Simulate the pre-migration marker and both legacy preference shapes locally.
delete from meetany_private.settings where key='request_alerts_default_on';
update meetany_private.request_alert_preferences set enabled=false where user_id=t.uid('alert_company');
\ir ../migrations/20260929-request-alerts-default-on.sql
select t.ok((select enabled and email_mode='daily' from meetany_private.request_alert_preferences where user_id=t.uid('alert_company')),'A legacy nonempty row enabled and email mode preserved');
select t.ok(not exists(select 1 from meetany_private.request_alert_preferences where user_id=t.uid('default_company')),'A legacy empty row removed');
select t.as_user('default_company');
select public.set_request_alert_preferences(false,'{}','{}');
select t.as_super();
\ir ../migrations/20260929-request-alerts-default-on.sql
select t.ok((select not enabled from meetany_private.request_alert_preferences where user_id=t.uid('default_company')),'A migration rerun preserves new optout');
select t.ok((select not enabled from meetany_private.default_request_alert_preferences((select p from public.profiles p where id=t.uid('alert_owner')))),'A client defaults disabled');
select t.ok((select not enabled from meetany_private.default_request_alert_preferences(jsonb_populate_record(null::public.profiles,'{"role":"company","city":"tbilisi"}'::jsonb))),'A missing industry disables defaults');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s REQUEST ALERT TESTS PASSED',count(*)-(select n from t.alert_start)) from t.passed;
