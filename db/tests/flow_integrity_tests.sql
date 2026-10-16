\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.signup('fi_b','fi-b@test.ge','{"role":"client","name":"Flow Buyer","company":"Flow Buyer","phone":"599886101","city":"tbilisi"}');
select t.signup('fi_s','fi-s@test.ge','{"role":"company","name":"Flow Seller","company":"Flow Seller","phone":"599886102","city":"tbilisi","industry":"furniture"}');
select t.signup('fi_x','fi-x@test.ge','{"role":"company","name":"Flow Other","company":"Flow Other","phone":"599886103","city":"tbilisi","industry":"furniture"}');
update public.profiles set verified=true,provide_categories=array['furniture'] where id in(t.uid('fi_s'),t.uid('fi_x'));

select t.as_user('fi_s');
select t.ok(jsonb_array_length(public.set_my_products((select jsonb_agg(jsonb_build_object('name','Product '||n)) from generate_series(1,15) n)))=15,'FI 15 products accepted');
select t.throws($q$select public.set_my_products((select jsonb_agg(jsonb_build_object('name','Product '||n)) from generate_series(1,16) n))$q$,'MA622','FI 16 products rejected on server');
select t.ok(jsonb_array_length(public.company_products(t.uid('fi_s')))=15,'FI rejected replacement leaves catalog intact');
select t.ok(jsonb_array_length(public.set_my_products('[{"name":"მაგიდა","code":" A "},{"name":"მაგიდა","code":"B"}]'))=2,'FI same name with different codes is valid');
select t.ok(public.company_products(t.uid('fi_s'))->0->>'code'='A','FI codes normalized on save');
select t.throws($q$select public.set_my_products('[{"name":"First","code":"A"},{"name":"Second","code":" A "}]')$q$,'MA623','FI duplicate code rejected');
select t.throws($q$select public.set_my_products('[{"name":"First","code":"A"},{"name":"Second","code":"A"}]')$q$,'P0001','FI duplicate error uses the HTTP validation error protocol');
select t.throws($q$select public.set_my_products('[{"name":" Table "},{"name":"table","code":" "}]')$q$,'MA623','FI duplicate uncoded name rejected');
select t.ok(jsonb_array_length(public.company_products(t.uid('fi_s')))=2,'FI duplicate save is atomic');

select t.as_user('fi_b');
select t.put('fi_r',(public.create_request_full('მუხის მაგიდა','მუხის მაგიდა ოფისისთვის','furniture','tbilisi',null,2,'pcs',(now() at time zone 'Asia/Tbilisi')::date+2,null,'{}',gen_random_uuid())).id);
select t.ok((select expires_at=((needed_by+1)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond' from public.requests where id=t.get('fi_r')),'FI short delivery date caps response window at Tbilisi day end');
select t.ok((public.extend_request(t.get('fi_r'))).expires_at=(((now() at time zone 'Asia/Tbilisi')::date+3)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond','FI extension cannot run past delivery day');
select t.put('fi_later',(public.create_request_full('Later delivery','Request with a later delivery','furniture','tbilisi',null,2,'pcs',(now() at time zone 'Asia/Tbilisi')::date+60,null,'{}',gen_random_uuid())).id);
select t.ok((select expires_at between now()+interval '13 days 23 hours' and now()+interval '14 days 1 minute' from public.requests where id=t.get('fi_later')),'FI distant delivery keeps initial 14 day response window');
select public.update_request(t.get('fi_later'),'Earlier delivery','Request with an earlier delivery','furniture','tbilisi',2,'pcs',(now() at time zone 'Asia/Tbilisi')::date+1);
select t.ok((select expires_at=((needed_by+1)::timestamp at time zone 'Asia/Tbilisi')-interval '1 millisecond' from public.requests where id=t.get('fi_later')),'FI editing earlier delivery also caps expiry');
select t.as_super();
update public.requests set needed_by=(now() at time zone 'Asia/Tbilisi')::date-1 where id=t.get('fi_later');
select t.as_user('fi_b');
select t.throws($q$select public.extend_request(t.get('fi_later'))$q$,'MA118','FI elapsed delivery cannot be silently reopened');
select t.throws($q$select public.extend_request(t.get('fi_later'))$q$,'P0001','FI elapsed delivery error uses the HTTP validation error protocol');
select t.ok((select x->'reasons'->'keywords' ? 'მაგიდა' from jsonb_array_elements(public.list_matching(t.get('fi_r'))) x where x->>'id'=t.uid('fi_s')::text),'FI matching uses catalog product names');

select t.as_user('fi_s');
select t.put('fi_o',(public.send_offer(t.get('fi_r'),'Full supplier offer',100,'total',true,1,true)).id);
select t.as_user('fi_x');
select t.put('fi_other',(public.send_offer(t.get('fi_r'),'Other supplier offer',80,'total',false,1,false)).id);
select t.throws($q$select public.choose_offer(t.get('fi_o'))$q$,'MA901','FI legacy selection rejects non-owner');
select t.as_user('fi_b');
select t.throws($q$select public.choose_offer(t.get('fi_o'),'2000-01-01'::timestamptz)$q$,'MA904','FI legacy selection rejects stale offer');
select t.as_super();
update public.offers set valid_until=(now() at time zone 'Asia/Tbilisi')::date-1 where id=t.get('fi_o');
select t.as_user('fi_b');
select t.throws($q$select public.choose_offer(t.get('fi_o'))$q$,'MA903','FI legacy selection rejects expired offer');
select t.as_super();
update public.offers set valid_until=(now() at time zone 'Asia/Tbilisi')::date+1 where id=t.get('fi_o');
select t.as_user('fi_b');
select t.ok((public.choose_offer(t.get('fi_o'))).status='chosen','FI legacy selection chooses offer');
select t.put('fi_d',(public.select_offer_deal(t.get('fi_o'))->>'id')::uuid);
select t.ok((select count(*) from meetany_private.deals where request_id=t.get('fi_r'))=1,'FI both selection paths share one deal');
select t.ok((public.choose_offer(t.get('fi_o'))).id=t.get('fi_o'),'FI legacy selection retry is idempotent');
select t.ok((select status='declined' from public.offers where id=t.get('fi_other')),'FI other offers declined atomically');
select t.throws($q$select public.select_offer_deal(t.get('fi_other'))$q$,'MA903','FI cannot replace selection');
select t.throws($q$select public.advance_deal(t.get('fi_d'),'complete',1)$q$,'MA903','FI cannot skip agreement');
select t.cs_progress('fi_d','fi_b','fi_s');
select t.as_user('fi_s');
select t.throws($q$select public.advance_deal(t.get('fi_d'),'complete',t.cs_rev('fi_d'))$q$,'MA906','FI only buyer confirms receipt');
select t.as_user('fi_b');
select t.ok(public.advance_deal(t.get('fi_d'),'complete',t.cs_rev('fi_d'))->>'stage'='complete','FI buyer can confirm actual receipt without supplier status update');

-- A cancelled agreement retains its history and cannot be resurrected by the legacy API.
select t.put('fi_cancel_r',(public.create_request('Cancellation request','A request for cancellation flow','furniture','tbilisi')).id);
select t.as_user('fi_s');
select t.put('fi_cancel_o',(public.send_offer(t.get('fi_cancel_r'),'Cancellation offer',100,'total',true,1,true)).id);
select t.as_user('fi_b');
select t.put('fi_cancel_d',(public.select_offer_deal(t.get('fi_cancel_o'))->>'id')::uuid);
select public.advance_deal(t.get('fi_cancel_d'),'cancelled',1);
select t.throws($q$select public.choose_offer(t.get('fi_cancel_o'))$q$,'MA903','FI cancelled agreement cannot be revived');
select t.ok(public.get_deal(t.get('fi_cancel_d'))->>'stage'='cancelled','FI cancelled history preserved');
select t.as_super();
\o
select 'flow_integrity_tests passed' as result;
