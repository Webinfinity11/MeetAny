-- Run after the deal migrations. Terminal deal outcomes must agree in admin rows, filters and exports.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.ars_start as select count(*) n from t.passed;
select t.signup('ars_b','ars-b@test.ge','{"role":"client","name":"Admin State Buyer","phone":"599889501","city":"tbilisi"}');
select t.signup('ars_s','ars-s@test.ge','{"role":"client","name":"Admin State Supplier","phone":"599889502","city":"tbilisi"}');
create table t.ars_fixture (
 key text primary key, id uuid not null default gen_random_uuid(), offer_id uuid not null default gen_random_uuid(),
 expected text not null, stage text, chosen boolean not null, hidden boolean not null default false, category text not null default 'furniture'
);
insert into t.ars_fixture(key,expected,stage,chosen,hidden,category) values
 ('open','open',null,false,false,'furniture'),
 ('closed','closed',null,false,false,'furniture'),
 ('expired','expired',null,false,false,'furniture'),
 ('legacy','chosen',null,true,false,'furniture'),
 ('selected','chosen','selected',true,false,'furniture'),
 ('progress','chosen','progress',true,false,'furniture'),
 ('cancelled','cancelled','cancelled',true,false,'furniture'),
 ('complete','complete','complete',true,false,'other'),
 ('hidden-cancelled','hidden','cancelled',true,true,'furniture'),
 ('hidden-complete','hidden','complete',true,true,'other'),
 ('hidden-selected','hidden','selected',true,true,'furniture');
grant select on t.ars_fixture to public;
insert into public.requests(id,owner_id,title,body,category,city,status,hidden,hidden_reason,created_at,expires_at)
 select id,t.uid('ars_b'),'ARS fixture '||key,'Admin terminal state regression fixture',category,'tbilisi',
  case when key='closed' or chosen then 'closed' else 'open' end,hidden,case when hidden then 'Admin state fixture hidden' end,
  '2020-01-01'::timestamptz,case when key='expired' then '2020-01-02'::timestamptz else now()+interval '1 day' end
 from t.ars_fixture;
insert into public.offers(id,request_id,company_id,body,price,price_type,status)
 select offer_id,id,t.uid('ars_s'),'Admin state chosen offer fixture',100,'total','chosen' from t.ars_fixture where chosen;
update public.requests r set chosen_offer_id=f.offer_id from t.ars_fixture f where f.id=r.id and f.chosen;
insert into meetany_private.deals(request_id,offer_id,buyer_id,supplier_id,stage,buyer_confirmed_at,supplier_confirmed_at,complete_at,cancelled_at)
 select id,offer_id,t.uid('ars_b'),t.uid('ars_s'),stage,
  case when stage in ('progress','complete') then now() end,case when stage in ('progress','complete') then now() end,
  case when stage='complete' then now() end,case when stage='cancelled' then now() end
 from t.ars_fixture where stage is not null;

select t.as_user('admin');
select t.ok((public.admin_search_requests(p_q=>'ARS fixture')->>'filteredTotal')::int=11,'ARS joins never duplicate request totals');
select t.ok(jsonb_array_length(public.admin_search_requests(p_q=>'ARS fixture')->'items')=11,'ARS unfiltered admin and export projection retains every fixture');
do $$
declare fixture record; item jsonb; page jsonb; expected_count integer;
begin
 for fixture in select * from t.ars_fixture loop
  page:=public.admin_search_requests(p_q=>fixture.id::text);
  item:=page->'items'->0;
  perform t.ok((page->>'filteredTotal')::int=1 and item->>'state'=fixture.expected,'ARS UUID lookup state '||fixture.key);
  perform t.ok((item->>'offer_count')::int=case when fixture.chosen then 1 else 0 end,'ARS offer metadata '||fixture.key);
  perform t.ok(item ?& array['owner_name','owner_company','deal_id','deal_stage'],'ARS owner and deal metadata '||fixture.key);
  perform t.ok((item->>'deal_stage') is not distinct from fixture.stage,'ARS joined deal stage '||fixture.key);
  if fixture.chosen then perform t.ok(item->>'chosen_offer_id'=fixture.offer_id::text,'ARS historical selection preserved '||fixture.key); end if;
 end loop;
 for fixture in select distinct expected from t.ars_fixture loop
  select count(*) into expected_count from t.ars_fixture where expected=fixture.expected;
  page:=public.admin_search_requests(p_q=>'ARS fixture',p_state=>fixture.expected);
  perform t.ok((page->>'filteredTotal')::int=expected_count,'ARS filtered total '||fixture.expected);
  perform t.ok(jsonb_array_length(page->'items')=expected_count and not exists(select 1 from jsonb_array_elements(page->'items') x where x->>'state'<>fixture.expected),'ARS filtered rows '||fixture.expected);
 end loop;
end $$;
select t.ok((public.admin_search_requests(p_q=>'ARS fixture',p_state=>'complete',p_category=>'other')->>'filteredTotal')::int=1,'ARS complete plus category filter');
select t.ok((public.admin_search_requests(p_q=>'ARS fixture',p_state=>'complete',p_category=>'furniture')->>'filteredTotal')::int=0,'ARS category does not leak hidden complete into complete filter');
select t.ok((public.admin_search_requests(p_q=>'ARS fixture',p_state=>'cancelled')->>'filteredTotal')::int=1,'ARS hidden cancelled excluded from cancelled filter');
select t.ok((public.admin_search_requests(p_q=>'ARS fixture',p_state=>'chosen')->>'filteredTotal')::int=3,'ARS chosen filter excludes complete cancelled and hidden');
-- Identical timestamps exercise the UUID tiebreaker. Export consumes this same paginated RPC.
do $$
declare page jsonb; cursor jsonb; seen uuid[]:='{}'; item jsonb; stamp text; pages integer:=0;
begin
 loop
  page:=public.admin_search_requests(p_q=>'ARS fixture',p_cursor=>cursor,p_limit=>2);
  if stamp is null then stamp:=page->>'asOf'; end if;
  perform t.ok(page->>'asOf'=stamp and (page->>'filteredTotal')::int=11,'ARS stable cursor snapshot and total '||pages);
  for item in select value from jsonb_array_elements(page->'items') loop
   perform t.ok(not (item->>'id')::uuid=any(seen),'ARS no duplicate paged row');
   seen:=array_append(seen,(item->>'id')::uuid);
  end loop;
  pages:=pages+1;
  exit when not (page->>'hasMore')::boolean;
  cursor:=page->'nextCursor';
  if pages>10 then raise exception 'ARS pagination did not terminate'; end if;
 end loop;
 perform t.ok(cardinality(seen)=11 and pages=6,'ARS CSV pagination returns all states exactly once');
 perform t.ok(page->'nextCursor'='null'::jsonb,'ARS final cursor is null');
end $$;
select t.throws($q$select public.admin_search_requests(p_state=>'invalid')$q$,'22023','ARS invalid state still rejected');
select t.throws($q$select public.admin_search_requests(p_cursor=>'{}')$q$,'22023','ARS invalid cursor still rejected');
select t.throws($q$select public.admin_search_requests(p_limit=>0)$q$,'22023','ARS invalid limit still rejected');
select t.as_user('ars_b');
select t.throws($q$select public.admin_search_requests(p_state=>'cancelled')$q$,'MA003','ARS personal caller still denied');
select t.as_anon();
select t.throws($q$select public.admin_search_requests(p_state=>'complete')$q$,'42501','ARS anonymous caller still denied');
select t.as_super();
select t.ok(not has_function_privilege('anonymous','public.admin_search_requests(text,text,text,jsonb,integer)','EXECUTE') and has_function_privilege('authenticated','public.admin_search_requests(text,text,text,jsonb,integer)','EXECUTE'),'ARS RPC grants preserved');
update public.profiles set blocked=true where id=t.uid('admin');
select t.as_user('admin');
select t.throws($q$select public.admin_search_requests(p_state=>'complete')$q$,'MA002','ARS blocked admin still denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('admin');
\o
select format('ADMIN REQUEST STATES %s ASSERTIONS PASSED',count(*)-(select n from t.ars_start)) from t.passed;
