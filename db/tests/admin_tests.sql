-- Additive admin API: stable keyset pages, server filters, and durable audit.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.admin_start as select count(*) n from t.passed;
create table t.admin_fixture (id uuid primary key);
insert into t.admin_fixture select gen_random_uuid() from generate_series(1,1105);
insert into neon_auth."user" (id,name,email,"emailVerified")
select id,'Admin fixture','admin-page-' || id || '@example.test',true from t.admin_fixture;
insert into public.profiles(id,role,name,company,phone,email,city,industry,created_at)
select id,'company','AdminPage fixture','AdminPage fixture',
 '+995 590 ' || lpad((n/1000)::text,3,'0') || ' ' || lpad((n%1000)::text,3,'0'),
 'admin-page-' || id || '@example.test','tbilisi','furniture','2020-01-01'
from (select id,row_number() over(order by id)::integer n from t.admin_fixture) x;
insert into public.requests(owner_id,title,body,category,city,created_at,expires_at)
select id,'AdminPage fixture','Fixture body for admin pagination','furniture','tbilisi','2020-01-01',now()+interval '1 day'
from t.admin_fixture;
select t.put('admin_lookup_request',(select id from public.requests where title='AdminPage fixture' limit 1));
select t.put('admin_lookup_user',(select id from t.admin_fixture limit 1));
select t.as_user('admin');
select t.ok((public.admin_search_requests(p_q=>t.get('admin_lookup_request')::text)->>'filteredTotal')::int=1,'A request UUID lookup');
select t.ok((public.admin_search_users(p_q=>t.get('admin_lookup_user')::text)->>'filteredTotal')::int=1,'A user UUID lookup');
select t.ok((public.admin_stats()->>'adminApiVersion')::int=1,'A API capability version');
select t.ok(jsonb_array_length(public.admin_search_requests(p_q=>'AdminPage')->'items')=25,'A request default page25');
select t.ok(jsonb_array_length(public.admin_search_users(p_q=>'AdminPage',p_limit=>1000)->'items')=100,'A users cap100');
select t.ok((public.admin_search_requests(p_q=>'AdminPage')->>'filteredTotal')::int=1105,'A request total exceeds1000');
select t.ok((public.admin_search_users(p_q=>'AdminPage',p_role=>'company',p_blocked=>false,p_verified=>false)->>'filteredTotal')::int=1105,'A user combined filters');
select t.ok((public.admin_search_users(p_q=>'AdminPage',p_role=>'client')->>'filteredTotal')::int=0,'A user role filter');
select t.ok((public.admin_search_requests(p_q=>'AdminPage',p_state=>'open',p_category=>'furniture')->>'filteredTotal')::int=1105,'A request combined filters');
select t.ok((public.admin_search_requests(p_q=>'AdminPage',p_category=>'food')->>'filteredTotal')::int=0,'A request category filter');
select t.ok((public.admin_search_requests(p_q=>'%')->>'filteredTotal')::int=0,'A q treats wildcard as literal');
select t.ok(public.admin_search_requests(p_q=>'AdminPage')->'items'->0 ?& array['state','owner_name','owner_company','offer_count'],'A request supporting metadata');
do $$
declare kind text; page jsonb; cursor jsonb; seen uuid[]; item jsonb; item_id uuid; stamp text; pages int;
begin
 foreach kind in array array['requests','users'] loop
  cursor:=null; seen:='{}'; stamp:=null; pages:=0;
  loop
   if kind='requests' then page:=public.admin_search_requests(p_q=>'AdminPage',p_cursor=>cursor,p_limit=>100);
   else page:=public.admin_search_users(p_q=>'AdminPage',p_cursor=>cursor,p_limit=>100); end if;
   if stamp is null then stamp:=page->>'asOf'; end if;
   perform t.ok(page->>'asOf'=stamp,'A '||kind||' stable asOf page '||pages);
   for item in select value from jsonb_array_elements(page->'items') loop
    item_id:=(item->>'id')::uuid;
    if item_id=any(seen) then raise exception 'duplicate page row'; end if;
    seen:=array_append(seen,item_id);
   end loop;
   cursor:=page->'nextCursor'; pages:=pages+1;
   exit when not (page->>'hasMore')::boolean;
   if pages>20 then raise exception 'pagination did not terminate'; end if;
  end loop;
  perform t.ok(cardinality(seen)=1105 and pages=12,'A '||kind||' all identical-timestamp rows returned once');
  perform t.ok(cursor='null'::jsonb,'A '||kind||' final cursor null');
 end loop;
end $$;
select t.as_super();
update public.requests set hidden=true where id=t.get('admin_lookup_request');
update public.profiles set blocked=true,verified=true where id=t.get('admin_lookup_user');
select t.as_user('admin');
select t.ok((public.admin_search_requests(p_q=>'AdminPage',p_state=>'hidden')->>'filteredTotal')::int=1,'A hidden filter includes moderated rows');
select t.ok((public.admin_search_users(p_q=>'AdminPage',p_blocked=>true,p_verified=>true)->>'filteredTotal')::int=1,'A positive boolean filters include blocked profile');
select t.as_super();
update public.requests set hidden=false,status='closed' where id=t.get('admin_lookup_request');
update public.profiles set blocked=false,verified=false where id=t.get('admin_lookup_user');
select t.as_user('admin');
select t.ok((public.admin_search_requests(p_q=>'AdminPage',p_state=>'closed')->>'filteredTotal')::int=1,'A closed state filter');
select t.as_super();
update public.requests set status='open',expires_at='2020-01-02' where id=t.get('admin_lookup_request');
select t.as_user('admin');
select t.ok((public.admin_search_requests(p_q=>'AdminPage',p_state=>'expired')->>'filteredTotal')::int=1,'A expired state computed on server');
select t.as_super();
update public.requests set expires_at=now()+interval '1 day' where id=t.get('admin_lookup_request');
select t.as_user('admin');
select t.throws($$select public.admin_search_requests(p_state=>'invalid')$$,'22023','A validates state');
select t.throws($$select public.admin_search_requests(p_category=>'invalid')$$,'22023','A validates category');
select t.throws($$select public.admin_search_users(p_role=>'owner')$$,'22023','A validates role');
select t.throws($$select public.admin_search_users(p_q=>repeat('x',201))$$,'22023','A validates q');
select t.throws($$select public.admin_list_audit(p_limit=>0)$$,'22023','A validates limit');
select t.throws($$select public.admin_search_users(p_cursor=>'{}')$$,'22023','A validates missing cursor fields');
select t.throws($$select public.admin_search_users(p_cursor=>'{"id":"bad","created_at":"yesterday","asOf":"now"}')$$,'22023','A validates typed cursor');
select t.throws($$select public.admin_search_users(p_cursor=>'{"id":"00000000-0000-0000-0000-000000000001","created_at":"2020-01-01","asOf":"infinity"}')$$,'22023','A rejects infinite asOf');
select t.throws($$select * from meetany_private.moderation_audit$$,'42501','A audit direct reads denied even admin');
select t.throws($$delete from meetany_private.moderation_audit$$,'42501','A audit direct deletes denied admin');
select t.as_user('fl_c');
select t.throws($$select public.admin_search_requests()$$,'MA003','A nonadmin request query denied');
select t.throws($$select public.admin_search_users()$$,'MA003','A nonadmin users query denied');
select t.throws($$select public.admin_list_audit()$$,'MA003','A nonadmin audit query denied');
select t.as_anon();
select t.throws($$select public.admin_search_requests()$$,'42501','A anonymous query denied');
select t.throws($$select public.admin_list_audit()$$,'42501','A anonymous audit denied');
select t.as_super();
update public.profiles set blocked=true where id=t.uid('admin');
select t.as_user('admin');
select t.throws($$select public.admin_search_requests()$$,'MA002','A blocked admin query denied');
select t.throws($$select public.admin_list_audit()$$,'MA002','A blocked admin audit denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('admin');
select t.put('admin_audit_target',(select id from public.requests where title='AdminPage fixture' limit 1));
select t.put('admin_audit_user',(select id from t.admin_fixture limit 1));
create table t.audit_before as select count(*) n from meetany_private.moderation_audit;
select t.as_user('admin');
select public.admin_set_hidden(t.get('admin_audit_target'),true,'  fixture moderation  ');
select public.admin_set_hidden(t.get('admin_audit_target'),false);
select public.admin_set_blocked(t.get('admin_audit_user'),true,'fixture block');
select public.admin_set_blocked(t.get('admin_audit_user'),false);
select public.admin_set_verified(t.get('admin_audit_user'),true);
select public.admin_set_verified(t.get('admin_audit_user'),false);
select public.admin_delete_request(t.get('admin_audit_target'));
-- Legacy delete remains idempotent and must not log success for absent targets.
select public.admin_delete_request(t.get('admin_audit_target'));
select t.throws(format('select public.admin_set_hidden(%L,true)',t.get('admin_audit_target')),'MA106','A missing target fails');
select t.throws(format('select public.admin_set_blocked(%L,true)',t.uid('admin')),'MA301','A own block fails');
select t.throws(format('select public.admin_set_verified(%L,true)',t.uid('fl_c')),'MA303','A client verify fails');
select t.as_super();
select t.ok((select count(*) from meetany_private.moderation_audit)=(select n+7 from t.audit_before),'A exactly seven successful moderation audit records');
select t.ok((select count(*) from meetany_private.moderation_audit where target_id=t.get('admin_audit_target'))=3,'A deleted target history survives');
select t.ok((select actor_id=t.uid('admin') and reason='fixture moderation' and old_flags='{"hidden":false}'::jsonb and new_flags='{"hidden":true}'::jsonb from meetany_private.moderation_audit where target_id=t.get('admin_audit_target') and action='request.hide'),'A actor reason before and after flags');
select t.ok(not exists(select 1 from meetany_private.moderation_audit a cross join lateral jsonb_object_keys(a.old_flags||a.new_flags) k where k not in ('hidden','deleted','blocked','verified')),'A audit flags exclude personal data');
select t.throws($$update meetany_private.moderation_audit set reason='tamper'$$,'42501','A audit update immutable even owner');
select t.throws($$delete from meetany_private.moderation_audit$$,'42501','A audit delete immutable even owner');
select t.throws($$truncate meetany_private.moderation_audit$$,'42501','A audit truncate immutable even owner');
-- A deliberately failing audit insert must roll back the corresponding moderation mutation.
create function t.reject_audit_insert() returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='test audit storage failure'; end$$;
create trigger test_audit_failure before insert on meetany_private.moderation_audit for each row execute function t.reject_audit_insert();
select t.as_user('admin');
select t.throws(format('select public.admin_set_blocked(%L,true)',t.get('admin_audit_user')),'23514','A audit failure propagates');
select t.as_super();
select t.ok((select not blocked from public.profiles where id=t.get('admin_audit_user')),'A failed audit rolls back moderation');
drop trigger test_audit_failure on meetany_private.moderation_audit;
-- Explicit rollback also undoes both changes.
begin;
select t.as_user('admin');
select public.admin_set_blocked(t.get('admin_audit_user'),true);
rollback;
select t.as_super();
select t.ok((select not blocked from public.profiles where id=t.get('admin_audit_user')),'A transaction rollback restores profile');
select t.ok((select count(*) from meetany_private.moderation_audit)=(select n+7 from t.audit_before),'A rollback leaves no audit success');
select t.as_user('admin');
select t.ok(jsonb_array_length(public.admin_list_audit(p_limit=>2)->'items')=2 and (public.admin_list_audit(p_limit=>2)->>'hasMore')::boolean,'A audit first page');
select t.ok((public.admin_list_audit(p_limit=>2)->'items'->0->>'id') <> (public.admin_list_audit(p_cursor=>public.admin_list_audit(p_limit=>2)->'nextCursor',p_limit=>2)->'items'->0->>'id'),'A audit next page differs');
select t.as_super();
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s ADMIN TESTS PASSED',count(*)-(select n from t.admin_start)) from t.passed;
