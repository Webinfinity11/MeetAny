-- Run only through run.sh: public request budget sync and saved requests.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

select t.signup('pb_b','pb-b@test.ge','{"role":"client","name":"Budget Buyer","company":"Budget Buyer Ltd","phone":"599884101","city":"tbilisi"}');
select t.signup('pb_s','pb-s@test.ge','{"role":"company","name":"Budget Seller","company":"Budget Seller Ltd","phone":"599884102","city":"tbilisi","industry":"other"}');
select t.signup('pb_x','pb-x@test.ge','{"role":"client","name":"Budget Other","company":"Budget Other Ltd","phone":"599884103","city":"batumi"}');

select t.as_user('pb_b');
select t.put('pb_r1',(public.create_request_full('PB range request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{"budgetType":"range","budgetMin":1000,"budgetMax":1800}',gen_random_uuid())).id);
select t.put('pb_r2',(public.create_request_full('PB exact request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{"budgetType":"exact","budgetMin":25000}',gen_random_uuid())).id);
select t.put('pb_r3',(public.create_request_full('PB negotiable request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{"budgetType":"negotiable"}',gen_random_uuid())).id);
select t.put('pb_r4',(public.create_request_full('PB private request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{"budgetType":"range","budgetMin":500,"budgetMax":900,"budgetPrivate":true}',gen_random_uuid())).id);
select t.put('pb_r5',(public.create_request_full('PB hidden request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);

select t.as_user('pb_s');
select t.ok((select budget_type='range' and budget_min=1000 and budget_max=1800 from public.requests where id=t.get('pb_r1')),'PB range budget is public');
select t.ok((select budget_type='exact' and budget_min=25000 and budget_max is null from public.requests where id=t.get('pb_r2')),'PB exact budget is public with no max');
select t.ok((select budget_type is null and budget_min is null and budget_max is null from public.requests where id=t.get('pb_r3')),'PB negotiable budget stays empty');
select t.ok((select budget_type is null and budget_min is null and budget_max is null from public.requests where id=t.get('pb_r4')),'PB private budget never enters the public table');

-- Changing preferences re-syncs, and a later private flag clears the public values.
select t.as_user('pb_b');
select public.set_request_preferences(t.get('pb_r1'),'{"budgetType":"exact","budgetMin":2000}');
select t.ok((select budget_type='exact' and budget_min=2000 and budget_max is null from public.requests where id=t.get('pb_r1')),'PB range switched to exact');
select public.set_request_preferences(t.get('pb_r1'),'{"budgetType":"range","budgetMin":1000,"budgetMax":1800,"budgetPrivate":true}');
select t.ok((select budget_type is null and budget_min is null and budget_max is null from public.requests where id=t.get('pb_r1')),'PB private flag clears public budget');
select public.set_request_preferences(t.get('pb_r1'),'{"budgetType":"range","budgetMin":1000,"budgetMax":1800}');
select t.throws($q$select public.set_request_preferences(t.get('pb_r1'),'{"budgetType":"range","budgetMin":1000,"budgetMax":900}')$q$,'MA902','PB invalid range rejected');
select t.ok((select budget_max=1800 from public.requests where id=t.get('pb_r1')),'PB rejected update leaves public budget unchanged');

-- Backfill: a request whose public columns were wiped is restored from preferences when the migration is applied again.
select t.as_super();
update public.requests set budget_type=null,budget_min=null,budget_max=null where id in(t.get('pb_r1'),t.get('pb_r2'),t.get('pb_r4'));
\i :mig
select t.as_super();
select t.ok((select budget_type='range' and budget_min=1000 and budget_max=1800 from public.requests where id=t.get('pb_r1')),'PB backfill restores range');
select t.ok((select budget_type='exact' and budget_min=25000 and budget_max is null from public.requests where id=t.get('pb_r2')),'PB backfill restores exact');
select t.ok((select budget_type is null from public.requests where id=t.get('pb_r4')),'PB backfill keeps private budgets empty');

-- Saved requests.
select t.as_user('pb_s');
select t.ok(public.set_saved_request(t.get('pb_r1'),true),'PB save request');
select t.ok(public.set_saved_request(t.get('pb_r1'),true),'PB saving twice is idempotent');
select t.ok(public.set_saved_request(t.get('pb_r2'),true),'PB save second request');
select t.ok((select jsonb_array_length(public.engagement_state()->'savedRequestIds')=2 and (public.engagement_state()->'savedRequestIds') ? t.get('pb_r1')::text),'PB engagement_state lists savedRequestIds');
select t.ok((public.list_saved_requests()->'items'->0->>'request_id')=t.get('pb_r2')::text,'PB saved list is newest first');
select t.ok((public.list_saved_requests()->'items'->0->>'owner_company')='Budget Buyer Ltd' and (public.list_saved_requests()->'items'->1->>'budget_type')='range' and (public.list_saved_requests()->'items'->0->>'state')='open','PB saved list carries owner, budget and state');
select t.ok(not public.set_saved_request(t.get('pb_r2'),false),'PB unsave request');
select t.ok(jsonb_array_length(public.list_saved_requests()->'items')=1 and jsonb_array_length(public.engagement_state()->'savedRequestIds')=1,'PB unsave removes from list and state');
select t.as_user('pb_x');
select t.ok(public.engagement_state()->'savedRequestIds'='[]'::jsonb and public.list_saved_requests()->'items'='[]'::jsonb,'PB saved requests are per user');

select t.as_user('pb_b');
select t.throws($q$select public.set_saved_request(t.get('pb_r1'),true)$q$,'MA902','PB own request cannot be saved');
select t.throws($q$select public.set_saved_request(gen_random_uuid(),true)$q$,'MA106','PB unknown request cannot be saved');

-- Hidden requests: cannot be saved, and a saved one disappears from list and state.
select t.as_super();
update public.requests set hidden=true where id=t.get('pb_r5');
select t.as_user('pb_x');
select t.throws($q$select public.set_saved_request(t.get('pb_r5'),true)$q$,'MA106','PB hidden request cannot be saved');
select t.ok(public.set_saved_request(t.get('pb_r3'),true),'PB save visible request');
select t.as_super();
update public.requests set hidden=true where id=t.get('pb_r3');
select t.as_user('pb_x');
select t.ok(public.engagement_state()->'savedRequestIds'='[]'::jsonb and public.list_saved_requests()->'items'='[]'::jsonb,'PB hidden saved request disappears');

-- Blocked users are refused, the private table is not directly readable.
select t.as_super();
update public.profiles set blocked=true where id=t.uid('pb_x');
select t.as_user('pb_x');
select t.throws($q$select public.set_saved_request(t.get('pb_r2'),true)$q$,'MA002','PB blocked user cannot save');
select t.throws($q$select * from meetany_private.saved_requests$q$,'42501','PB saved_requests table is private');

\o
select t.as_super();
