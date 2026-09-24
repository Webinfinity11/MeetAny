-- T12.3b: empty conversations stay with their starter; request deletion removes its conversations.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
select t.as_super();
create table t.cleanup_start as select count(*) n from t.passed;
grant select on t.cleanup_start to public;
select t.signup('cc_client','cc-client@example.test','{"role":"client","name":"Cleanup Client","phone":"+995 598 417 301","city":"tbilisi"}');
select t.signup('cc_company','cc-company@example.test','{"role":"company","name":"Cleanup Supplier","company":"Cleanup Company","industry":"furniture","phone":"+995 598 417 302","city":"tbilisi"}');

-- Empty conversation: visible to the starter only, to both after the first message.
select t.as_user('cc_client');
select t.put('cc_general',(public.start_conversation(t.uid('cc_company'))->>'id')::uuid);
select t.ok((public.start_conversation(t.uid('cc_company'))->>'started_by')=t.uid('cc_client')::text,'C starter recorded');
select t.ok(jsonb_array_length(public.list_my_conversations())=1,'C starter sees empty conversation');
select t.as_user('cc_company');
select t.ok(public.list_my_conversations()='[]'::jsonb,'C other side does not see empty conversation');
select t.as_user('cc_client');
select public.send_message(t.get('cc_general'),'first message');
select t.as_user('cc_company');
select t.ok(public.list_my_conversations()->0->>'id'=t.get('cc_general')::text,'C other side sees conversation after first message');

-- Company starts on a request: the request author sees it only after a message.
select t.as_user('cc_client');
select t.put('cc_req',(public.create_request('Cleanup request','Request removed with conversations','furniture','tbilisi')).id);
select t.as_user('cc_company');
select t.put('cc_ctx',(public.start_conversation(t.uid('cc_company'),t.get('cc_req'))->>'id')::uuid);
select t.ok(jsonb_array_length(public.list_my_conversations())=2,'C company starter sees request conversation');
select t.as_user('cc_client');
select t.ok(jsonb_array_length(public.list_my_conversations())=1,'C author does not see empty request conversation');
select t.ok(public.start_conversation(t.uid('cc_company'),t.get('cc_req'))->>'started_by'=t.uid('cc_company')::text,'C second start keeps starter');
select t.ok(jsonb_array_length(public.list_my_conversations())=1,'C second start does not reveal empty conversation');
select t.as_user('cc_company');
select public.send_message(t.get('cc_ctx'),'offer question');
select t.as_user('cc_client');
select t.ok(jsonb_array_length(public.list_my_conversations())=2,'C author sees request conversation after message');

-- Legacy rows without a starter stay hidden until the first message.
select t.as_user('cc_client');
select t.put('cc_req2',(public.create_request('Cleanup request two','Request deleted by admin','furniture','tbilisi')).id);
select t.as_super();
insert into meetany_private.conversations(client_id,company_id,request_id,context_key)
values(t.uid('cc_client'),t.uid('cc_company'),t.get('cc_req2'),t.get('cc_req2')::text);
select t.put('cc_legacy',(select id from meetany_private.conversations where context_key=t.get('cc_req2')::text));
select t.as_user('cc_client');
select t.ok(jsonb_array_length(public.list_my_conversations())=2,'C legacy empty hidden from client');
select t.as_user('cc_company');
select t.ok(jsonb_array_length(public.list_my_conversations())=2,'C legacy empty hidden from company');

-- delete_request removes the request conversation and messages; the general thread stays.
select t.as_user('cc_client');
select public.delete_request(t.get('cc_req'));
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.conversations where id=t.get('cc_ctx')),'C delete_request removes conversation');
select t.ok(not exists(select 1 from meetany_private.messages where conversation_id=t.get('cc_ctx')),'C delete_request removes messages');
select t.ok(exists(select 1 from meetany_private.messages where conversation_id=t.get('cc_general')),'C delete_request keeps general conversation');
select t.as_user('cc_client');
select t.throws($$select public.list_messages(t.get('cc_ctx'))$$,'MA501','C deleted conversation unreadable');

-- admin_delete_request does the same and still writes the audit row.
select t.as_user('cc_company');
select public.send_message(t.get('cc_legacy'),'before moderation');
select t.as_user('admin');
select public.admin_delete_request(t.get('cc_req2'));
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.conversations where id=t.get('cc_legacy')),'C admin delete removes conversation');
select t.ok(not exists(select 1 from meetany_private.messages where conversation_id=t.get('cc_legacy')),'C admin delete removes messages');
select t.ok(exists(select 1 from meetany_private.moderation_audit where target_id=t.get('cc_req2') and action='request.delete'),'C admin delete audited');

-- The migration removes conversations orphaned before it existed and is rerunnable.
alter table public.requests disable trigger requests_delete_conversations;
select t.as_user('cc_client');
select t.put('cc_req3',(public.create_request('Cleanup request three','Orphaned before the migration','furniture','tbilisi')).id);
select t.put('cc_orphan',(public.start_conversation(t.uid('cc_company'),t.get('cc_req3'))->>'id')::uuid);
select t.as_super();
delete from public.requests where id=t.get('cc_req3');
alter table public.requests enable trigger requests_delete_conversations;
select t.ok((select request_id is null from meetany_private.conversations where id=t.get('cc_orphan')),'C orphan fixture');
\ir ../migrations/20260924-empty-conversations.sql
select t.ok(not exists(select 1 from meetany_private.conversations where id=t.get('cc_orphan')),'C migration removes orphan');
select t.ok(exists(select 1 from meetany_private.conversations where id=t.get('cc_general')),'C migration keeps general conversation');
select t.ok(not has_function_privilege('authenticated','meetany_private.delete_request_conversations()','execute'),'C trigger function private');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s CONVERSATION CLEANUP TESTS PASSED',count(*)-(select n from t.cleanup_start)) from t.passed;
select format('TOTAL %s SQL ASSERTIONS PASSED',count(*)) from t.passed;
