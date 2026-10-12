-- Run only through run.sh: public completed-deal counters on the company profile.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

create function t.cs_rev(k text) returns integer language sql as $$
  select revision from meetany_private.deals where id=t.get($1) $$;
grant execute on function t.cs_rev(text) to public;
-- Drives a selected deal through discuss/terms/progress; the caller is the buyer.
create function t.cs_progress(d text,buyer text,seller text) returns void language plpgsql as $$
begin
  perform t.as_user(buyer);
  perform public.advance_deal(t.get(d),'discuss',t.cs_rev(d));
  perform public.propose_deal_terms(t.get(d),t.cs_rev(d),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
  perform public.confirm_deal_terms(t.get(d),t.cs_rev(d));
  perform t.as_user(seller);
  perform public.confirm_deal_terms(t.get(d),t.cs_rev(d));
  perform t.as_user(buyer);
  perform public.advance_deal(t.get(d),'progress',t.cs_rev(d));
end $$;
grant execute on function t.cs_progress(text,text,text) to public;

select t.signup('cs_b','cs-b@test.ge','{"role":"client","name":"Stats Buyer","company":"Stats Buyer Ltd","phone":"599884001","city":"tbilisi"}');
select t.signup('cs_s','cs-s@test.ge','{"role":"company","name":"Stats Seller","company":"Stats Seller Ltd","phone":"599884002","city":"tbilisi","industry":"other"}');
select t.signup('cs_c','cs-c@test.ge','{"role":"company","name":"Stats Company Buyer","company":"Stats Company Buyer Ltd","phone":"599884003","city":"tbilisi","industry":"other"}');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id in(t.uid('cs_s'),t.uid('cs_c'));

select t.as_anon();
select t.ok(public.company_public_stats(t.uid('cs_s'))='{"completedDeals":0,"completedAsBuyer":0}'::jsonb,'CS guest reads zero counters');

select t.as_user('cs_b');
select t.put('cs_r1',(public.create_request_full('CS completed request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('cs_r2',(public.create_request_full('CS progress request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('cs_r3',(public.create_request_full('CS cancelled request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_user('cs_s');
select t.put('cs_o1',(public.send_offer(t.get('cs_r1'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('cs_o2',(public.send_offer(t.get('cs_r2'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('cs_o3',(public.send_offer(t.get('cs_r3'),'A complete supplier offer',100,'total',true,5,true)).id);

select t.as_user('cs_b');
select t.put('cs_d1',(public.select_offer_deal(t.get('cs_o1'))->>'id')::uuid);
select t.put('cs_d2',(public.select_offer_deal(t.get('cs_o2'))->>'id')::uuid);
select t.put('cs_d3',(public.select_offer_deal(t.get('cs_o3'))->>'id')::uuid);
select t.as_anon();
select t.ok((public.company_public_stats(t.uid('cs_s'))->>'completedDeals')::int=0,'CS selected deals are not counted');

select t.cs_progress('cs_d1','cs_b','cs_s');
select t.cs_progress('cs_d2','cs_b','cs_s');
select t.as_user('cs_b');
select public.advance_deal(t.get('cs_d1'),'complete',t.cs_rev('cs_d1'));
select public.advance_deal(t.get('cs_d3'),'cancelled',t.cs_rev('cs_d3'));

select t.as_anon();
select t.ok(public.company_public_stats(t.uid('cs_s'))='{"completedDeals":1,"completedAsBuyer":0}'::jsonb,'CS only the complete deal is counted (progress and cancelled are not)');
select t.as_user('cs_b');
select t.ok(public.company_public_stats(t.uid('cs_s'))->>'completedDeals'='1','CS authenticated user reads the same counter');
select t.ok(public.company_public_stats(t.uid('cs_s')) ?& array['completedDeals','completedAsBuyer'] and (select count(*) from jsonb_object_keys(public.company_public_stats(t.uid('cs_s'))))=2,'CS result carries counters only');

-- A company that bought from another company counts it as buyer, not as supplier.
select t.as_user('cs_c');
select t.put('cs_r4',(public.create_request_full('CS company buyer request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_user('cs_s');
select t.put('cs_o4',(public.send_offer(t.get('cs_r4'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.as_user('cs_c');
select t.put('cs_d4',(public.select_offer_deal(t.get('cs_o4'))->>'id')::uuid);
select t.cs_progress('cs_d4','cs_c','cs_s');
select t.as_user('cs_c');
select public.advance_deal(t.get('cs_d4'),'complete',t.cs_rev('cs_d4'));
select t.as_anon();
select t.ok(public.company_public_stats(t.uid('cs_s'))='{"completedDeals":2,"completedAsBuyer":0}'::jsonb,'CS supplier counter includes deals with company buyers');
select t.ok(public.company_public_stats(t.uid('cs_c'))='{"completedDeals":0,"completedAsBuyer":1}'::jsonb,'CS buyer-side deals counted separately');

-- Other roles, unknown ids and blocked companies yield zeros, never an error.
select t.ok(public.company_public_stats(t.uid('cs_b'))='{"completedDeals":0,"completedAsBuyer":0}'::jsonb,'CS non-company profile returns zeros');
select t.ok(public.company_public_stats(gen_random_uuid())='{"completedDeals":0,"completedAsBuyer":0}'::jsonb,'CS unknown id returns zeros');
select t.ok(public.company_public_stats(null)='{"completedDeals":0,"completedAsBuyer":0}'::jsonb,'CS null id returns zeros');
select t.as_super();
update public.profiles set blocked=true where id=t.uid('cs_s');
select t.as_anon();
select t.ok(public.company_public_stats(t.uid('cs_s'))='{"completedDeals":0,"completedAsBuyer":0}'::jsonb,'CS blocked company returns zeros');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('cs_s');
select t.ok(has_function_privilege('anonymous','public.company_public_stats(uuid)','EXECUTE') and has_function_privilege('authenticated','public.company_public_stats(uuid)','EXECUTE'),'CS function granted to guests and users');
\o
select format('COMPANY DEAL STATS %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'CS %';
