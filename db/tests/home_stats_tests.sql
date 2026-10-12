-- Run only through run.sh: public home page counters (public.home_stats).
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

create function t.hs_rev(k text) returns integer language sql as $$
  select revision from meetany_private.deals where id=t.get($1) $$;
grant execute on function t.hs_rev(text) to public;
create function t.hs_n(k text) returns integer language sql as $$
  select (public.home_stats()->>$1)::int $$;
grant execute on function t.hs_n(text) to public;
-- Counters before this file; every check below compares the change.
create table t.hs_base as select k,(public.home_stats()->>k)::int n
  from unnest(array['openRequests','verifiedCompanies','offersSent','completedDeals']) k;
grant select on t.hs_base to public;
create function t.hs_d(k text) returns integer language sql as $$
  select t.hs_n($1)-(select n from t.hs_base where hs_base.k=$1) $$;
grant execute on function t.hs_d(text) to public;

select t.signup('hs_b','hs-b@shop.ge','{"role":"client","name":"Home Buyer","company":"Home Buyer Ltd","phone":"599885001","city":"tbilisi"}');
select t.signup('hs_s','hs-s@shop.ge','{"role":"company","name":"Home Seller","company":"Home Seller Ltd","phone":"599885002","city":"tbilisi","industry":"other"}');
select t.signup('hs_u','hs-u@shop.ge','{"role":"company","name":"Home Pending","company":"Home Pending Ltd","phone":"599885003","city":"tbilisi","industry":"other"}');
select t.signup('hs_t','hs-t@meetany.local','{"role":"company","name":"Fixture","company":"Fixture Ltd","phone":"599885004","city":"tbilisi","industry":"other"}');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id in(t.uid('hs_s'),t.uid('hs_t'));

select t.as_anon();
select t.ok(public.home_stats() ?& array['openRequests','verifiedCompanies','offersSent','completedDeals']
  and (select count(*) from jsonb_object_keys(public.home_stats()))=4,'HS result carries the four counters only');
select t.ok(t.hs_d('verifiedCompanies')=1,'HS only verified, non-test companies are counted');

select t.as_user('hs_b');
select t.put('hs_r1',(public.create_request_full('HS open request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('hs_r2',(public.create_request_full('HS deal request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('hs_r3',(public.create_request_full('test','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_anon();
select t.ok(t.hs_d('openRequests')=2,'HS open requests counted, test-titled request is not');

select t.as_user('hs_s');
select t.put('hs_o1',(public.send_offer(t.get('hs_r1'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('hs_o2',(public.send_offer(t.get('hs_r2'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.as_user('hs_t');
select public.send_offer(t.get('hs_r1'),'A complete supplier offer',100,'total',true,5,true);
select t.as_anon();
select t.ok(t.hs_d('offersSent')=2,'HS offers counted, offers from test companies are not');

-- A complete deal: chosen request leaves the open counter, the deal counts once it completes.
select t.as_user('hs_b');
select t.put('hs_d',(public.select_offer_deal(t.get('hs_o2'))->>'id')::uuid);
select t.as_anon();
select t.ok(t.hs_d('openRequests')=1 and t.hs_d('completedDeals')=0,'HS chosen request is no longer open; selected deal is not complete');
select t.as_user('hs_b');
select public.advance_deal(t.get('hs_d'),'discuss',t.hs_rev('hs_d'));
select public.propose_deal_terms(t.get('hs_d'),t.hs_rev('hs_d'),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select public.confirm_deal_terms(t.get('hs_d'),t.hs_rev('hs_d'));
select t.as_user('hs_s');
select public.confirm_deal_terms(t.get('hs_d'),t.hs_rev('hs_d'));
select t.as_user('hs_b');
select public.advance_deal(t.get('hs_d'),'progress',t.hs_rev('hs_d'));
select t.as_anon();
select t.ok(t.hs_d('completedDeals')=0,'HS deal in progress is not counted');
select t.as_user('hs_b');
select public.advance_deal(t.get('hs_d'),'complete',t.hs_rev('hs_d'));
select t.as_anon();
select t.ok(t.hs_d('completedDeals')=1,'HS completed deal is counted');

-- Hidden requests drop out of every counter; blocked companies are not counted.
select t.as_super();
update public.requests set hidden=true where id=t.get('hs_r1');
update public.profiles set blocked=true where id=t.uid('hs_s');
select t.as_anon();
select t.ok(t.hs_d('openRequests')=0 and t.hs_d('offersSent')=1 and t.hs_d('verifiedCompanies')=0,'HS hidden request and blocked company are not counted');
select t.as_super();
update public.requests set status='closed' where id=t.get('hs_r1');
update public.requests set hidden=false where id=t.get('hs_r1');
update public.profiles set blocked=false where id=t.uid('hs_s');
select t.as_anon();
select t.ok(t.hs_d('openRequests')=0,'HS closed request is not open');

select t.as_user('hs_b');
select t.ok(public.home_stats()=(select public.home_stats()),'HS authenticated user can read the counters');
select t.as_super();
select t.ok(has_function_privilege('anonymous','public.home_stats()','EXECUTE') and has_function_privilege('authenticated','public.home_stats()','EXECUTE'),'HS function granted to guests and users');
select t.ok(not has_function_privilege('anonymous','meetany_private.is_test_profile(uuid)','EXECUTE'),'HS private helper is not callable by guests');
\o
select format('HOME STATS %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'HS %';
