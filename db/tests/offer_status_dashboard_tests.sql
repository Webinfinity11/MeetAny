-- Run only through run.sh: viewed offers, "not selected" notifications and list_my_deals.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

select t.signup('os_b','os-b@test.ge','{"role":"client","name":"Status Buyer","company":"Status Buyer Ltd","phone":"599884201","city":"tbilisi"}');
select t.signup('os_s1','os-s1@test.ge','{"role":"company","name":"Status Seller One","company":"Status Seller One Ltd","phone":"599884202","city":"tbilisi","industry":"other"}');
select t.signup('os_s2','os-s2@test.ge','{"role":"company","name":"Status Seller Two","company":"Status Seller Two Ltd","phone":"599884203","city":"tbilisi","industry":"other"}');
select t.signup('os_x','os-x@test.ge','{"role":"client","name":"Status Outsider","company":"Status Outsider Ltd","phone":"599884204","city":"batumi"}');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id in (t.uid('os_s1'),t.uid('os_s2'));

select t.as_user('os_b');
select t.put('os_r',(public.create_request_full('OS status request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_user('os_s1');
select t.put('os_o1',(public.send_offer(t.get('os_r'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.as_user('os_s2');
select t.put('os_o2',(public.send_offer(t.get('os_r'),'Another complete offer',120,'total',true,6,true)).id);

-- Viewed: author only, sent offers only, idempotent.
select t.as_super();
select t.ok((select viewed_at is null from public.offers where id=t.get('os_o1')),'OS new offer is not viewed');
select t.as_user('os_x');
select t.throws($q$select public.mark_request_offers_viewed(t.get('os_r'))$q$,'MA901','OS non-author cannot mark viewed');
select t.as_user('os_s1');
select t.throws($q$select public.mark_request_offers_viewed(t.get('os_r'))$q$,'MA901','OS offering company cannot mark viewed');
select t.as_user('os_b');
select t.ok(public.mark_request_offers_viewed(t.get('os_r'))=2,'OS author marks both offers viewed');
select t.ok(public.mark_request_offers_viewed(t.get('os_r'))=0,'OS second call changes nothing');
select t.as_super();
select t.ok((select count(*) from public.offers where request_id=t.get('os_r') and viewed_at is not null)=2,'OS both offers carry viewed_at');

-- Editing the content resets the mark of that offer only.
select t.as_user('os_s1');
select public.send_offer(t.get('os_r'),'A complete supplier offer',90,'total',true,5,true);
select t.as_super();
select t.ok((select viewed_at is null from public.offers where id=t.get('os_o1')),'OS edited offer is unviewed again');
select t.as_super();
select t.ok((select viewed_at is not null from public.offers where id=t.get('os_o2')),'OS untouched offer stays viewed');
select t.as_user('os_b');
select t.ok(public.mark_request_offers_viewed(t.get('os_r'))=1,'OS re-marks only the edited offer');

-- Choosing: chosen/declined keep their status; the loser gets one in-app notification and no e-mail.
select t.as_super();
create table t.os_out as select count(*) n from meetany_private.notification_outbox;
select t.as_user('os_b');
select t.put('os_d',(public.select_offer_deal(t.get('os_o1'))->>'id')::uuid);
select t.as_super();
select t.ok((select count(*) from meetany_private.notifications where kind='offer_declined' and request_id=t.get('os_r'))=1,'OS exactly one declined notification');
select t.ok((select user_id from meetany_private.notifications where kind='offer_declined' and request_id=t.get('os_r'))=t.uid('os_s2'),'OS declined notification goes to the losing company');
select t.ok(not exists(select 1 from meetany_private.notifications where kind='offer_declined' and user_id in (t.uid('os_s1'),t.uid('os_b'))),'OS chosen company and buyer get no declined notification');
select t.ok(exists(select 1 from meetany_private.notifications where kind='offer_chosen' and user_id=t.uid('os_s1')),'OS chosen company still gets offer_chosen');
select t.ok((select count(*) from meetany_private.notification_outbox)=(select n from t.os_out),'OS no e-mail queued for any of it');
select t.as_user('os_s2');
select t.ok(public.list_notifications()->'items'->0->>'kind'='offer_declined','OS list_notifications returns the new kind');
select t.ok((public.engagement_state()->>'unread')::int>=1,'OS unread counts the new kind');

-- list_my_deals: both parties, nobody else.
select t.as_user('os_b');
select t.ok(jsonb_array_length(public.list_my_deals())=1 and public.list_my_deals()->0->>'request_title'='OS status request' and public.list_my_deals()->0->>'id'=t.get('os_d')::text,'OS buyer sees the deal with request title');
select t.ok(public.list_my_deals()->0->>'latest_at' is not null,'OS latest_at present');
select t.as_user('os_s1');
select t.ok(jsonb_array_length(public.list_my_deals())=1,'OS supplier sees the deal');
select t.as_user('os_s2');
select t.ok(public.list_my_deals()='[]'::jsonb,'OS losing company sees no deal');
select t.as_user('os_x');
select t.ok(public.list_my_deals()='[]'::jsonb,'OS outsider sees no deal');
