-- Run last, after all v1 suites and 20260929-admin-v2.sql twice.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.admin_v2_start as select count(*) n from t.passed;
create table t.v2_baseline as select * from meetany_private.moderation_audit;
create table t.v2_legacy as select oid,prosrc,proargtypes from pg_proc where oid in
 ('public.admin_delete_request(uuid)'::regprocedure,'public.admin_list_audit(jsonb,integer)'::regprocedure);
insert into public.requests(owner_id,title,body,category,city,hidden,created_at)
values(t.uid('fl_c'),'V2 request context','V2 request body fixture','furniture','tbilisi',true,'2020-01-01');
select t.put('v2_request',(select id from public.requests where title='V2 request context'));
insert into public.offers(request_id,company_id,body,status,created_at)
select t.get('v2_request'),id,case when n=1 then 'V2 100% literal_body' else 'V2 plain offer body' end,
 case when n=2 then 'chosen' when n=3 then 'declined' else 'sent' end,'2020-01-01'
from (select id,row_number() over(order by id) n from t.admin_fixture order by id limit 205) x;
select t.put('v2_offer',(select id from public.offers where body='V2 100% literal_body'));
select t.put('v2_chosen',(select id from public.offers where request_id=t.get('v2_request') and status='chosen'));
select t.put('v2_declined',(select id from public.offers where request_id=t.get('v2_request') and status='declined'));
update public.requests set chosen_offer_id=t.get('v2_chosen') where id=t.get('v2_request');
-- Every protected entry point rejects all non-admin identities before input validation.
do $$
declare who text; call text; expected text;
begin
 foreach who in array array['fl_c','company','blocked','anonymous'] loop
  perform t.as_super();
  if who='fl_c' then perform t.as_user('fl_c'); expected:='MA003';
  elsif who='company' then perform t.as_id((select id from t.admin_fixture limit 1)); expected:='MA003';
  elsif who='blocked' then
   update public.profiles set blocked=true where id=t.uid('admin');
   perform t.as_user('admin'); expected:='MA002';
  else perform t.as_anon(); expected:='42501'; end if;
  foreach call in array array['admin_search_offers()','admin_delete_offer(null,null)',
    'admin_delete_request_v2(null,null)','admin_list_audit_v2()','admin_stats()'] loop
   perform t.throws('select public.'||call,expected,'V2 denied '||who||' '||call);
  end loop;
 end loop;
 perform t.as_super();
 update public.profiles set blocked=false where id=t.uid('admin');
end $$;
select t.as_user('admin');
select t.ok((public.admin_stats()->>'adminApiVersion')::int=2,'V2 exact capability');
select t.ok(public.admin_stats() ?& array['users','companies','verified','open','requests','offers','chosen','hidden','blocked'],'V2 stats keys preserved');
select t.ok((public.admin_search_offers(p_q=>'V2 request context')->>'filteredTotal')::int=205,'V2 request title search');
select t.ok((public.admin_search_offers(p_q=>t.get('v2_offer')::text)->>'filteredTotal')::int=1,'V2 UUID search');
select t.ok((public.admin_search_offers(p_q=>'%')->>'filteredTotal')::int=1,'V2 percent literal');
select t.ok((public.admin_search_offers(p_q=>'_')->>'filteredTotal')::int=1,'V2 underscore literal');
select t.ok((public.admin_search_offers(p_q=>'  v2 100%  ')->>'filteredTotal')::int=1,'V2 trimmed case insensitive body search');
select t.ok((public.admin_search_offers(p_q=>'AdminPage fixture')->>'filteredTotal')::int>=205,'V2 company search');
select t.ok((public.admin_search_offers(p_q=>'V2 request context',p_status=>'chosen')->>'filteredTotal')::int=1,'V2 chosen filter');
select t.ok((public.admin_search_offers(p_q=>'V2 request context',p_status=>'declined')->>'filteredTotal')::int=1,'V2 declined filter');
select t.ok((public.admin_search_offers(p_q=>'V2 request context',p_status=>'sent')->>'filteredTotal')::int=203,'V2 sent filter');
select t.ok(jsonb_array_length(public.admin_search_offers()->'items')=25,'V2 default page');
select t.ok(jsonb_array_length(public.admin_search_offers(p_limit=>1000)->'items')=100,'V2 limit cap');
select t.ok(public.admin_search_offers(p_q=>t.get('v2_offer')::text)->'items'->0 @> '{"request_hidden":true,"company_name":"AdminPage fixture","request_title":"V2 request context"}','V2 joined metadata');
do $$
declare reason text; fn text;
begin
 foreach fn in array array['admin_delete_offer','admin_delete_request_v2'] loop
  foreach reason in array array[null::text,'','  ','ab',repeat('x',501)] loop
   perform t.throws(format('select public.%I(%L,%L)',fn,case when fn='admin_delete_offer' then t.get('v2_offer') else t.get('v2_request') end,reason),'MA304','V2 mandatory reason '||fn||' '||coalesce(length(reason)::text,'null'));
  end loop;
 end loop;
end $$;
select t.throws($$select public.admin_delete_offer(gen_random_uuid(),'valid reason')$$,'MA206','V2 absent offer');
select t.throws($$select public.admin_delete_offer(t.get('v2_chosen'),'valid reason')$$,'MA207','V2 chosen protected');
select t.throws($$select public.admin_delete_request_v2(gen_random_uuid(),'valid reason')$$,'MA106','V2 absent request');
select t.throws($$select public.admin_search_offers(p_status=>'invalid')$$,'22023','V2 invalid status');
select t.throws($$select public.admin_search_offers(p_q=>repeat('x',201))$$,'22023','V2 long query');
select t.throws($$select public.admin_list_audit_v2(p_action=>'invalid')$$,'22023','V2 invalid action');
select t.throws($$select public.admin_list_audit_v2(p_target_type=>'invalid')$$,'22023','V2 invalid target');
do $$
declare fn text;
begin
 foreach fn in array array['admin_search_offers','admin_list_audit_v2'] loop
  perform t.throws(format('select public.%I(p_limit=>0)',fn),'22023','V2 invalid limit '||fn);
  perform t.throws(format('select public.%I(p_cursor=>%L)',fn,'{}'),'22023','V2 invalid cursor '||fn);
 end loop;
end $$;
-- Both cursor readers: complete traversal, tie-breaking and insertion horizon.
do $$
declare kind text; page jsonb; cursor jsonb; seen uuid[]; item jsonb; stamp text; total int; pages int;
begin
 foreach kind in array array['offers','audit'] loop
  cursor:=null; seen:='{}'; stamp:=null; pages:=0;
  loop
   if kind='offers' then page:=public.admin_search_offers(p_q=>'V2 request context',p_cursor=>cursor,p_limit=>7);
   else page:=public.admin_list_audit_v2(p_cursor=>cursor,p_limit=>7); end if;
   if stamp is null then stamp:=page->>'asOf'; total:=(page->>'filteredTotal')::int; end if;
   if page->>'asOf'<>stamp or (page->>'filteredTotal')::int<>total then raise exception 'unstable envelope'; end if;
   for item in select value from jsonb_array_elements(page->'items') loop
    if (item->>'id')::uuid=any(seen) then raise exception 'duplicate row'; end if;
    seen:=array_append(seen,(item->>'id')::uuid);
   end loop;
   cursor:=page->'nextCursor'; pages:=pages+1;
   exit when not (page->>'hasMore')::boolean;
   if pages>1000 then raise exception 'pagination did not terminate'; end if;
  end loop;
  perform t.ok(cardinality(seen)=total and pages>1 and cursor='null'::jsonb,'V2 complete cursor traversal '||kind);
 end loop;
end $$;
select t.as_super();
select t.ok((select count(*) from meetany_private.moderation_audit)=(select count(*) from t.v2_baseline),'V2 failed calls emit no audit');
select t.ok((select count(*) from public.offers where request_id=t.get('v2_request'))=205,'V2 failures retain offers');
create trigger test_v2_audit_failure before insert on meetany_private.moderation_audit for each row execute function t.reject_audit_insert();
select t.as_user('admin');
select t.throws($$select public.admin_delete_offer(t.get('v2_offer'),'valid reason')$$,'23514','V2 offer audit storage failure');
select t.throws($$select public.admin_delete_request_v2(t.get('v2_request'),'valid reason')$$,'23514','V2 request audit storage failure');
select t.as_super();
drop trigger test_v2_audit_failure on meetany_private.moderation_audit;
select t.ok((select count(*) from public.offers where request_id=t.get('v2_request'))=205,'V2 audit failure restores cascaded offers');
select t.ok(exists(select 1 from public.requests where id=t.get('v2_request')),'V2 audit failure restores request');
begin;
select t.as_user('admin');
select public.admin_delete_offer(t.get('v2_offer'),'valid reason');
select public.admin_delete_request_v2(t.get('v2_request'),'valid reason');
rollback;
select t.as_super();
select t.ok((select count(*) from public.offers where request_id=t.get('v2_request'))=205,'V2 explicit rollback restores offers');
select t.ok((select count(*) from meetany_private.moderation_audit)=(select count(*) from t.v2_baseline),'V2 rollback emits no audit');
select t.as_user('admin');
select public.admin_delete_offer(t.get('v2_offer'),'  offer moderation  ');
select public.admin_delete_offer(t.get('v2_declined'),repeat('x',500));
select t.ok((public.admin_list_audit_v2(p_action=>'offer.delete',p_target_type=>'offer')->>'filteredTotal')::int=2,'V2 combined audit filters');
select t.ok((select bool_and(x->'target_name'='null'::jsonb and x->>'target_exists'='false' and x->>'target_context'='V2 request context' and x->>'target_context_id'=t.get('v2_request')::text) from jsonb_array_elements(public.admin_list_audit_v2(p_action=>'offer.delete')->'items') x),'V2 deleted offer retains request context only');
select public.admin_set_hidden(t.get('v2_request'),false,'visible again');
select t.ok(public.admin_list_audit_v2(p_action=>'request.show')->'items'->0 @> '{"target_name":"V2 request context","target_exists":true}','V2 existing request name');
select public.admin_delete_request_v2(t.get('v2_request'),'  request moderation  ');
select t.ok(public.admin_list_audit_v2(p_action=>'request.delete')->'items'->0 @> '{"target_name":null,"target_exists":false,"reason":"request moderation"}','V2 deleted request name');
select t.ok((select bool_and(x->'target_context'='null'::jsonb and x->>'target_context_id'=t.get('v2_request')::text) from jsonb_array_elements(public.admin_list_audit_v2(p_action=>'offer.delete')->'items') x),'V2 deleted context keeps identifier');
select t.as_super();
select t.ok((select count(*) from meetany_private.moderation_audit)=(select count(*)+4 from t.v2_baseline),'V2 exactly four successful mutations logged');
select t.ok((select reason='offer moderation' and actor_id=t.uid('admin') and old_flags->>'status'='sent' and old_flags->>'request_id'=t.get('v2_request')::text and old_flags->>'deleted'='false' and old_flags ? 'company_id' and new_flags='{"deleted":true}'::jsonb from meetany_private.moderation_audit where target_id=t.get('v2_offer')),'V2 offer audit flags and trimmed reason');
select t.ok(not exists(select 1 from meetany_private.moderation_audit a cross join lateral jsonb_object_keys(a.old_flags||a.new_flags) k where a.target_type='offer' and k not in ('deleted','status','request_id','company_id')),'V2 offer audit excludes content');
select t.ok(not exists(select * from t.v2_baseline except select * from meetany_private.moderation_audit),'V2 original audit unchanged');
select t.ok(not exists(select oid,prosrc,proargtypes from t.v2_legacy except select oid,prosrc,proargtypes from pg_proc),'V2 legacy signatures and bodies unchanged');
select t.as_user('admin');
select t.lives($$select public.admin_delete_request(t.get('v2_request'))$$,'V2 legacy absent delete still no-op');
select t.as_super();
do $$
declare hidden_count int; blocked_count int;
begin
 select count(*) into hidden_count from public.requests where hidden;
 select count(*) into blocked_count from public.profiles where blocked and role<>'admin';
 perform t.as_user('admin');
 perform t.ok((public.admin_stats()->>'hidden')::int=hidden_count,'V2 hidden count');
 perform t.ok((public.admin_stats()->>'blocked')::int=blocked_count,'V2 blocked nonadmins count');
 perform t.as_super();
end $$;
select t.put('v2_user',(select id from t.admin_fixture limit 1));
select t.as_user('admin');
select public.admin_set_blocked(t.get('v2_user'),true,'blocked fixture');
select t.ok(public.admin_list_audit_v2(p_action=>'user.block')->'items'->0 @> '{"target_name":"AdminPage fixture","target_exists":true}','V2 user target name');
select t.as_super();
do $$
declare actor_name text; actor_email text; item jsonb;
begin
 select coalesce(nullif(company,''),name),email into actor_name,actor_email from public.profiles where id=t.uid('admin');
 perform t.as_user('admin');
 item:=public.admin_list_audit_v2(p_action=>'user.block')->'items'->0;
 perform t.ok(item->>'actor_name'=actor_name and item->>'actor_email'=actor_email,'V2 actor resolved from profile');
 perform t.as_super();
end $$;
update public.profiles set company='Renamed V2 company',name='V2 contact name' where id=t.get('v2_user');
select t.as_user('admin');
select t.ok(public.admin_list_audit_v2(p_action=>'user.block')->'items'->0->>'target_name'='Renamed V2 company','V2 name resolved on read');
select t.as_super();
delete from public.profiles where id=t.get('v2_user');
select t.as_user('admin');
select t.ok(public.admin_list_audit_v2(p_action=>'user.block')->'items'->0 @> '{"target_name":null,"target_exists":false}','V2 deleted user target');
select t.as_super();
-- v1 replay replaces admin_stats with version 1, but cannot remove v2 RPCs or narrow checks.
\ir ../migrations/20260923-admin-api.sql
select t.as_user('admin');
select t.ok((public.admin_stats()->>'adminApiVersion')::int=1,'V2 v1 replay capability downgrade is explicit');
select t.lives($$select public.admin_search_offers()$$,'V2 offer reader survives v1 replay');
select t.lives($$select public.admin_list_audit_v2(p_target_type=>'offer')$$,'V2 audit reader survives v1 replay');
select t.throws($$select public.admin_delete_offer(gen_random_uuid(),'valid reason')$$,'MA206','V2 offer mutation survives v1 replay');
select t.throws($$select public.admin_delete_request_v2(gen_random_uuid(),'valid reason')$$,'MA106','V2 request mutation survives v1 replay');
select t.as_super();
-- Exercise successful offer deletion after replay, including the widened audit checks.
insert into public.requests(owner_id,title,body,category,city)
values(t.uid('fl_c'),'V2 replay request','V2 replay request body','furniture','tbilisi');
select t.put('v2_replay_request',(select id from public.requests where title='V2 replay request'));
insert into public.offers(request_id,company_id,body)
select t.get('v2_replay_request'),id,'V2 replay offer body' from t.admin_fixture where id in(select id from public.profiles) limit 1;
select t.put('v2_replay_offer',(select id from public.offers where request_id=t.get('v2_replay_request')));
select t.as_user('admin');
select t.lives($$select public.admin_delete_offer(t.get('v2_replay_offer'),'replay reason')$$,'V2 offer audit insert survives v1 replay');
select t.lives($$select public.admin_delete_request_v2(t.get('v2_replay_request'),'replay reason')$$,'V2 request delete survives v1 replay');
select t.as_super();
\ir ../migrations/20260929-admin-v2.sql
select t.as_user('admin');
select t.ok((public.admin_stats()->>'adminApiVersion')::int=2,'V2 replay restores exact capability');
select t.as_super();
select t.ok(not exists(select * from t.v2_baseline except select * from meetany_private.moderation_audit),'V2 replay preserves original audit');
select t.ok((select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='admin_delete_request')=1,'V2 no legacy delete overload');
select t.ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where pronamespace='public'::regnamespace and proname in('admin_search_offers','admin_delete_offer','admin_delete_request_v2','admin_list_audit_v2')),'V2 all new RPCs hardened');
select t.throws($$update meetany_private.moderation_audit set reason='tamper'$$,'42501','V2 audit still immutable');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s ADMIN V2 TESTS PASSED',count(*)-(select n from t.admin_v2_start)) from t.passed;
