\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.engagement_start as select count(*) n from t.passed;
select t.signup('eng_owner','eng-owner@example.test','{"role":"client","name":"Eng Owner","phone":"+995 591 981 001","city":"tbilisi"}');
select t.signup('eng_supplier','eng-supplier@example.test','{"role":"company","name":"Eng Supplier","company":"Eng Company","industry":"furniture","phone":"+995 591 981 002","city":"tbilisi"}');
select t.as_user('eng_owner');
select t.ok(not (public.engagement_state()->>'emailOffers')::boolean,'E email defaults off');
select t.ok(public.set_saved_company(t.uid('eng_supplier'),true),'E save company');
select t.ok(public.set_saved_company(t.uid('eng_supplier'),true),'E repeat save idempotent');
select t.ok(jsonb_array_length(public.engagement_state()->'savedIds')=1,'E save unique');
select t.ok(public.list_saved_companies()->'items'->0->>'company'='Eng Company','E saved company metadata');
select t.throws($$select public.set_saved_company(t.uid('eng_owner'),true)$$,'MA302','E cannot save noncompany');
select t.throws($$select public.set_saved_company(t.uid('eng_supplier'),null)$$,'22023','E invalid saved flag');
select t.throws($$select * from meetany_private.saved_companies$$,'42501','E no direct saved table access');
select t.throws($$select meetany_private.claim_notification_email('test@example.test','https://example.test')$$,'42501','E worker denied to app role');
select t.put('eng_request',(public.create_request('Eng request','A detailed test request body','furniture','tbilisi')).id);
select t.ok(public.set_notification_email(true),'E opt in');
select t.as_user('eng_supplier');
select t.ok(jsonb_array_length(public.engagement_state()->'savedIds')=0,'E saved list private');
select t.ok(public.set_notification_email(true),'E supplier opt in');
select t.put('eng_offer',(public.send_offer(t.get('eng_request'),'Supplier offer description')).id);
select t.lives($$select public.send_offer(t.get('eng_request'),'Edited supplier offer description')$$,'E editing offer succeeds');
select t.as_user('eng_owner');
select t.ok((public.engagement_state()->>'unread')::int=1,'E offer creates exactly one notice');
select t.put('eng_notice',(public.list_notifications()->'items'->0->>'id')::uuid);
select t.as_user('eng_supplier');
select public.mark_notification_read(t.get('eng_notice'));
select t.ok((public.engagement_state()->>'unread')::int=0,'E supplier cannot see owner notice');
select t.as_user('eng_owner');
select t.ok((public.engagement_state()->>'unread')::int=1,'E cannot mark another users notice');
select public.mark_notification_read(t.get('eng_notice'));
select public.mark_notification_read(t.get('eng_notice'));
select t.ok((public.engagement_state()->>'unread')::int=0,'E mark read idempotent');
select public.choose_offer(t.get('eng_offer'));
select t.as_user('eng_supplier');
select t.ok((public.engagement_state()->>'unread')::int=1,'E chosen notice to supplier');
select t.ok(public.list_notifications()->'items'->0->>'kind'='offer_chosen','E correct chosen event');
select t.as_super();
select t.ok((select count(*) from meetany_private.notification_outbox where notification_id in(select id from meetany_private.notifications where request_id=t.get('eng_request')))=2,'E two opted in emails queued');
create table t.eng_jobs(j jsonb);
insert into t.eng_jobs select meetany_private.claim_notification_email('MeetAny <test@example.test>','https://example.test');
select t.ok((select j->>'id' is not null from t.eng_jobs),'E worker claims job');
select t.ok((select (payload->>'text') like '%/requests/view/?id=%' from meetany_private.notification_outbox where id=(select (j->>'id')::uuid from t.eng_jobs)),'E safe request link payload');
select t.ok(not meetany_private.finish_notification_email((select (j->>'id')::uuid from t.eng_jobs),gen_random_uuid(),true),'E wrong lease cannot acknowledge');
select t.ok(meetany_private.finish_notification_email((select (j->>'id')::uuid from t.eng_jobs),(select (j->>'lease')::uuid from t.eng_jobs),false,'provider_http_503'),'E failure reschedules');
select t.ok((select status='pending' and attempts=1 and available_at>now() from meetany_private.notification_outbox where id=(select (j->>'id')::uuid from t.eng_jobs)),'E retry delay set');
select t.as_user('eng_owner');
select public.set_notification_email(false);
select t.as_user('eng_supplier');
select public.set_notification_email(false);
select t.as_super();
select t.ok((select bool_and(status='cancelled') from meetany_private.notification_outbox where notification_id in(select id from meetany_private.notifications where request_id=t.get('eng_request'))),'E opting out cancels queue');
select t.ok(meetany_private.claim_notification_email('test@example.test','https://example.test') is null,'E no opted out delivery');
select t.as_user('eng_owner');
select t.ok(not public.set_saved_company(t.uid('eng_supplier'),false),'E unsave');
select t.ok(jsonb_array_length(public.list_saved_companies()->'items')=0,'E unsaved list empty');
select public.set_saved_company(t.uid('eng_supplier'),true);
select t.as_super();
update public.profiles set blocked=true where id=t.uid('eng_supplier');
select t.as_user('eng_owner');
select t.ok(jsonb_array_length(public.list_saved_companies()->'items')=0,'E blocked company hidden from saved');
select t.as_user('eng_supplier');
select t.throws($$select public.engagement_state()$$,'MA002','E blocked user denied');
select t.as_anon();
select t.throws($$select public.engagement_state()$$,'42501','E anonymous denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('eng_supplier');
select t.as_user('eng_owner');
select public.delete_request(t.get('eng_request'));
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.notifications where request_id=t.get('eng_request')),'E deleted request removes stale notices');
select t.ok(not exists(select 1 from meetany_private.notification_outbox where id=(select (j->>'id')::uuid from t.eng_jobs)),'E cascades queued emails');

-- Page traversal exercises equal timestamps and records beyond the catalog's 1,000 limit.
insert into meetany_private.saved_companies(user_id,company_id,created_at)
select t.uid('eng_owner'),id,'2020-01-01' from t.admin_fixture;
select t.as_user('eng_owner');
do $$
declare page jsonb; cursor jsonb; seen uuid[]:='{}'; item jsonb; id uuid;
begin
 loop
  page:=public.list_saved_companies(cursor);
  for item in select value from jsonb_array_elements(page->'items') loop
   id:=(item->>'company_id')::uuid;
   if id=any(seen) then raise exception 'duplicate saved page'; end if;
   seen:=array_append(seen,id);
  end loop;
  cursor:=nullif(page->'nextCursor','null'::jsonb); exit when cursor is null;
 end loop;
 perform t.ok(cardinality(seen)=1106,'E saved traversal beyond1000 and equal timestamps');
end $$;
select t.put('eng_request2',(public.create_request('Eng notification paging','Detailed notification paging request','furniture','tbilisi')).id);
select t.as_super();
insert into public.offers(request_id,company_id,body,created_at)
select t.get('eng_request2'),id,'Notification paging offer body','2020-01-01' from t.admin_fixture order by id limit 62;
select t.as_user('eng_owner');
select t.ok((public.engagement_state()->>'unread')::int=62,'E unread count spans all pages');
do $$
declare page jsonb; cursor jsonb; seen uuid[]:='{}'; item jsonb; id uuid;
begin
 loop
  page:=public.list_notifications(cursor);
  for item in select value from jsonb_array_elements(page->'items') loop
   id:=(item->>'id')::uuid;
   if id=any(seen) then raise exception 'duplicate notification page'; end if;
   seen:=array_append(seen,id);
  end loop;
  cursor:=nullif(page->'nextCursor','null'::jsonb); exit when cursor is null;
 end loop;
 perform t.ok(cardinality(seen)=62,'E notification complete cursor traversal');
end $$;
select t.throws($$select public.list_notifications('{"id":"bad"}'::jsonb)$$,'22023','E invalid notification cursor');
select t.as_super();
do $$
declare before_count int;
begin
 select count(*) into before_count from meetany_private.notifications;
 begin
  insert into public.offers(request_id,company_id,body) values(t.get('eng_request2'),t.uid('eng_supplier'),'Rollback test offer description');
  raise exception 'rollback fixture';
 exception when raise_exception then null;
 end;
 perform t.ok((select count(*) from meetany_private.notifications)=before_count,'E rolled back offer creates no notice');
end $$;
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s ENGAGEMENT TESTS PASSED',count(*)-(select n from t.engagement_start)) from t.passed;
