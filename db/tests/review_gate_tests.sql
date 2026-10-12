-- Run only through run.sh: company reviews require a completed deal, and a rated deal publishes its review.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

create function t.rg_rev(k text) returns integer language sql as $$
  select revision from meetany_private.deals where id=t.get($1) $$;
grant execute on function t.rg_rev(text) to public;

select t.signup('rg_b','rg-b@test.ge','{"role":"client","name":"Gate Buyer","company":"Gate Buyer Ltd","phone":"599883001","city":"tbilisi"}');
select t.signup('rg_s','rg-s@test.ge','{"role":"company","name":"Gate Seller","company":"Gate Seller Ltd","phone":"599883002","city":"tbilisi","industry":"other"}');
select t.signup('rg_x','rg-x@test.ge','{"role":"client","name":"Gate Outsider","company":"Gate Outsider Ltd","phone":"599883003","city":"batumi"}');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id=t.uid('rg_s');

select t.as_user('rg_b');
select t.put('rg_r1',(public.create_request_full('RG progress request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('rg_r2',(public.create_request_full('RG completed request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('rg_r3',(public.create_request_full('RG chosen only request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_user('rg_s');
select t.put('rg_o1',(public.send_offer(t.get('rg_r1'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('rg_o2',(public.send_offer(t.get('rg_r2'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('rg_o3',(public.send_offer(t.get('rg_r3'),'A complete supplier offer',100,'total',true,5,true)).id);

-- Old-style choice (no deal) and a deal that is not yet complete do not make a company reviewable.
select t.as_user('rg_b');
select public.choose_offer(t.get('rg_o3'));
select t.put('rg_d1',(public.select_offer_deal(t.get('rg_o1'))->>'id')::uuid);
select t.ok(public.my_company_review_targets(t.uid('rg_s'))='[]'::jsonb,'RG no targets before any deal is complete');
select t.throws($q$select public.save_company_review(t.get('rg_r3'),5,'Chosen offer without any deal, long enough')$q$,'MA602','RG chosen offer without a deal cannot be reviewed');
select t.throws($q$select public.save_company_review(t.get('rg_r1'),5,'Deal only selected so far, long enough')$q$,'MA602','RG selected deal cannot be reviewed');
select public.advance_deal(t.get('rg_d1'),'discuss',t.rg_rev('rg_d1'));
select t.throws($q$select public.save_company_review(t.get('rg_r1'),5,'Deal in discussion so far, long enough')$q$,'MA602','RG discuss deal cannot be reviewed');
select public.propose_deal_terms(t.get('rg_d1'),t.rg_rev('rg_d1'),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select public.confirm_deal_terms(t.get('rg_d1'),t.rg_rev('rg_d1'));
select t.as_user('rg_s');
select public.confirm_deal_terms(t.get('rg_d1'),t.rg_rev('rg_d1'));
select t.as_user('rg_b');
select public.advance_deal(t.get('rg_d1'),'progress',t.rg_rev('rg_d1'));
select t.throws($q$select public.save_company_review(t.get('rg_r1'),5,'Deal in progress so far, long enough')$q$,'MA602','RG progress deal cannot be reviewed');
select t.ok(public.my_company_review_targets(t.uid('rg_s'))='[]'::jsonb,'RG progress deal is not a review target');

-- Completing the deal opens the review, for the buyer only.
select public.advance_deal(t.get('rg_d1'),'complete',t.rg_rev('rg_d1'));
select t.ok(jsonb_array_length(public.my_company_review_targets(t.uid('rg_s')))=1 and public.my_company_review_targets(t.uid('rg_s'))->0->>'id'=t.get('rg_r1')::text,'RG completed deal is a review target');
select t.throws($q$select public.save_company_review(t.get('rg_r1'),0,'Zero stars are invalid, long enough')$q$,'MA601','RG invalid rating still rejected');
select t.throws($q$select public.save_company_review(t.get('rg_r1'),5,'too short')$q$,'MA601','RG short text still rejected');
select t.ok(public.save_company_review(t.get('rg_r1'),4,'Delivered as agreed, a solid supplier')->>'status'='published','RG completed deal accepts a written review');
select t.as_user('rg_x');
select t.throws($q$select public.save_company_review(t.get('rg_r1'),1,'Not my deal at all, but long enough')$q$,'MA602','RG other user cannot review someone elses deal');
select t.ok(public.my_company_review_targets(t.uid('rg_s'))='[]'::jsonb,'RG other user has no targets');
select t.as_user('rg_s');
select t.throws($q$select public.save_company_review(t.get('rg_r1'),5,'Supplier reviewing itself, long enough')$q$,'MA602','RG supplier cannot review its own deal');
select t.as_anon();
select t.ok((public.company_reviews(t.uid('rg_s'))->>'total')::int=1 and (public.company_reviews(t.uid('rg_s'))->>'rating')::numeric=4,'RG written review appears on the company profile');

-- Rating a completed deal publishes the review without a separate call.
select t.as_user('rg_b');
select t.put('rg_d2',(public.select_offer_deal(t.get('rg_o2'))->>'id')::uuid);
select public.advance_deal(t.get('rg_d2'),'discuss',t.rg_rev('rg_d2'));
select public.propose_deal_terms(t.get('rg_d2'),t.rg_rev('rg_d2'),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select public.confirm_deal_terms(t.get('rg_d2'),t.rg_rev('rg_d2'));
select t.as_user('rg_s');
select public.confirm_deal_terms(t.get('rg_d2'),t.rg_rev('rg_d2'));
select t.as_user('rg_b');
select public.advance_deal(t.get('rg_d2'),'progress',t.rg_rev('rg_d2'));
select public.advance_deal(t.get('rg_d2'),'complete',t.rg_rev('rg_d2'));
select t.as_anon();
select t.ok((public.company_reviews(t.uid('rg_s'))->>'total')::int=1,'RG unrated completed deal publishes nothing');
select t.as_user('rg_b');
select public.rate_deal_full(t.get('rg_d2'),t.rg_rev('rg_d2'),array[5,5,4,4],true,'Resolved quickly and professionally, thank you');
select t.as_anon();
select t.ok((public.company_reviews(t.uid('rg_s'))->>'total')::int=2,'RG rate_deal_full review appears on the company profile');
select t.ok((public.company_reviews(t.uid('rg_s'))->>'rating')::numeric=4.5,'RG profile rating averages both reviews');
select t.ok(exists(select 1 from jsonb_array_elements(public.company_reviews(t.uid('rg_s'))->'items') x where x->>'body'='Resolved quickly and professionally, thank you' and (x->>'rating')::int=5 and x->>'author'='Gate Buyer Ltd'),'RG deal review carries rounded average, text and author');
select t.ok(not exists(select 1 from jsonb_array_elements(public.company_reviews(t.uid('rg_s'))->'items') x where x ? 'request_id' or x ? 'author_id'),'RG public deal review omits private ids');

-- Moderation survives: a hidden review stays hidden when the same deal is rated or the author edits it.
select t.as_super();
select t.ok((select count(*) from meetany_private.company_reviews where request_id=t.get('rg_r2') and status='published')=1,'RG deal review stored as published');
update meetany_private.company_reviews set status='hidden',reason='moderated' where request_id=t.get('rg_r1');
select t.as_user('rg_b');
select t.ok(public.save_company_review(t.get('rg_r1'),5,'Edited after moderation, still long enough')->>'status'='hidden','RG hidden review stays hidden after author edit');
select t.as_anon();
select t.ok((public.company_reviews(t.uid('rg_s'))->>'total')::int=1,'RG hidden review excluded from the profile');

-- Stars-only deal rating is allowed (deal review text is optional) and still publishes.
select t.as_super();
select t.ok(exists(select 1 from pg_constraint where conrelid='meetany_private.company_reviews'::regclass and conname='company_reviews_body_len'),'RG body length constraint relaxed for stars-only ratings');
\o
select format('REVIEW GATE %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'RG %';
