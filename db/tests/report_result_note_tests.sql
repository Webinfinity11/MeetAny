\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.report_result_note_start as select count(*) n from t.passed;
grant select on t.report_result_note_start to public;
select t.signup('rn_owner','rn-owner@test.ge','{"role":"client","name":"RN Owner","phone":"599778801","city":"tbilisi"}');
select t.signup('rn_a','rn-a@test.ge','{"role":"client","name":"RN Reporter A","phone":"599778802","city":"tbilisi"}');
select t.signup('rn_b','rn-b@test.ge','{"role":"client","name":"RN Reporter B","phone":"599778803","city":"tbilisi"}');
select t.as_user('rn_owner');
select t.put('rn_request',(public.create_request('Report result test','Request for testing report outcomes','furniture','tbilisi')).id);
select t.as_user('rn_a');
select t.put('rn_reject',(public.report_content('request',t.get('rn_request'),'spam','')->>'id')::uuid);
select t.as_anon();
select t.throws($q$select public.list_notifications()$q$,'42501','RN guests cannot read reasons');
select t.as_user('rn_a');
select t.throws($q$select public.admin_resolve_report(t.get('rn_reject'),'reject','forged')$q$,'MA003','RN reporter cannot forge outcome');
select t.as_user('rp_admin');
select t.throws($q$select public.admin_resolve_report(t.get('rn_reject'),'reject',repeat('ა',501))$q$,'MA304','RN 501 characters rejected');
select t.throws($q$select public.admin_resolve_report(t.get('rn_reject'),'reject','  ')$q$,'MA304','RN empty reason rejected');
select public.admin_resolve_report(t.get('rn_reject'),'reject','  დარღვევა არ დადასტურდა  ');
select t.as_user('rn_a');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->>'kind'='report_resolved' and n->'detail'->>'report_id'=t.get('rn_reject')::text
 and n->'detail'->>'resolution'='rejected' and n->'detail'->>'resolution_reason'='დარღვევა არ დადასტურდა'),
 'RN rejected reason and result reach reporter through list_notifications');
select t.as_user('rn_b');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->'detail'->>'report_id'=t.get('rn_reject')::text),'RN other users cannot see rejection reason');
-- Hiding a target closes every open report: each author gets the same reason,
-- paired with their own report id.
select t.put('rn_hide_b',(public.report_content('request',t.get('rn_request'),'fake','')->>'id')::uuid);
select t.as_user('rn_a');
select t.put('rn_hide_a',(public.report_content('request',t.get('rn_request'),'fake','')->>'id')::uuid);
select t.as_user('rp_admin');
select public.admin_resolve_report(t.get('rn_hide_a'),'hide',repeat('ა',500));
select t.as_user('rn_a');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->'detail'->>'report_id'=t.get('rn_hide_a')::text and n->'detail'->>'resolution'='hidden'
 and n->'detail'->>'resolution_reason'=repeat('ა',500)),'RN hide reason preserves 500 Unicode characters');
select t.as_user('rn_b');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->'detail'->>'report_id'=t.get('rn_hide_b')::text and n->'detail'->>'resolution'='hidden'
 and n->'detail'->>'resolution_reason'=repeat('ა',500)),'RN bulk close notifies every reporter');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->'detail'->>'report_id'=t.get('rn_hide_a')::text),'RN each reporter gets only their own report id');
select t.as_user('rn_owner');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') n
 where n->>'kind'='report_resolved'),'RN target owner cannot read reporter outcomes');
select t.as_super();
select t.ok((select hidden from public.requests where id=t.get('rn_request')),'RN original hide action still executes');
select t.ok((select count(*)=3 from meetany_private.reports where target_id=t.get('rn_request') and status='handled'),'RN all reports retain handled state');
select t.ok((select count(*)=2 from meetany_private.business_audit where target_id in(t.get('rn_reject'),t.get('rn_hide_a')) and action like 'report_%'),'RN audit trail preserved');
select t.ok(not exists(select 1 from meetany_private.notifications where user_id in(t.uid('rn_a'),t.uid('rn_b')) and length(detail->>'resolution_reason')>500),'RN notification reasons are bounded');
\o
select 'Report result note tests: '||(count(*)-(select n from t.report_result_note_start))||' passed' from t.passed;
