\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.signup('oo_b','open-buyer@test.ge','{"role":"client","name":"Open Buyer","phone":"599887001","city":"tbilisi"}');
select t.signup('oo_p','open-personal@test.ge','{"role":"client","name":"Personal Supplier","phone":"599887002","city":"tbilisi"}');
select t.signup('oo_c','open-company@test.ge','{"role":"company","name":"Company Owner","company":"Unverified Supplier","phone":"599887003","city":"tbilisi","industry":"furniture"}');
select t.signup('oo_x','open-outsider@test.ge','{"role":"client","name":"Open Outsider","phone":"599887004","city":"tbilisi"}');
select t.signup('oo_h','open-hidden@test.ge','{"role":"company","name":"Hidden Owner","company":"Hidden Supplier","phone":"599887005","city":"tbilisi","industry":"furniture"}');
select t.signup('oo_o','open-optout@test.ge','{"role":"company","name":"Opt Out Owner","company":"Opt Out Supplier","phone":"599887006","city":"tbilisi","industry":"furniture"}');
update public.profiles set provide_categories=array['furniture'],verified=false where id in(t.uid('oo_c'),t.uid('oo_h'),t.uid('oo_o'));
update public.profiles set catalog_hidden=true where id=t.uid('oo_h');
insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities,email_mode)
 values(t.uid('oo_o'),false,array['furniture'],array['georgia'],'off');

select t.as_anon();
select t.ok(exists(select 1 from public.profiles where id=t.uid('oo_c') and not verified),'OO unverified company profile visible');
select t.ok(exists(select 1 from public.list_companies() where id=t.uid('oo_c') and not verified),'OO unverified company in directory');
select t.ok(not exists(select 1 from public.list_companies() where id=t.uid('oo_p')),'OO personal supplier is not a company listing');
select t.ok(not exists(select 1 from public.profiles where id=t.uid('oo_h')),'OO hidden company stays hidden');
select t.throws($q$select email from public.profiles where id=t.uid('oo_p')$q$,'42501','OO personal email remains private');
select t.throws($q$select phone from public.profiles where id=t.uid('oo_c')$q$,'42501','OO unverified company phone remains private');

select t.as_user('oo_b');
select t.put('oo_r',(public.create_request_full('Open participation','Any registered supplier can respond','furniture','tbilisi',null,4,'pcs',current_date+10,null,'{}',gen_random_uuid())).id);
select t.put('oo_closed',(public.create_request('Closed participation','A request that is already closed','furniture','tbilisi')).id);
select public.close_request(t.get('oo_closed'));
select t.put('oo_hidden',(public.create_request('Hidden participation','A request hidden by moderation','furniture','tbilisi')).id);
select t.throws($q$select public.send_offer(t.get('oo_r'),'An offer on my own request')$q$,'MA202','OO self offer still rejected');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_matching(t.get('oo_r'),null,100,0)) x where x->>'id'=t.uid('oo_c')::text and x->>'verified'='false'),'OO matching includes unverified company');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching(t.get('oo_r'),null,100,0)) x where x->>'id'=t.uid('oo_h')::text),'OO matching excludes hidden company');
select t.throws($q$select public.start_conversation(t.uid('oo_p'))$q$,'MA502','OO no arbitrary personal general chats');
select t.throws($q$select public.start_conversation(t.uid('oo_p'),t.get('oo_r'))$q$,'MA502','OO personal chat needs an actual offer');
select t.as_super();
update public.requests set hidden=true where id=t.get('oo_hidden');
select t.ok(exists(select 1 from meetany_private.notifications where request_id=t.get('oo_r') and user_id=t.uid('oo_c') and kind='request_match'),'OO unverified company receives request notification');
select t.ok(not exists(select 1 from meetany_private.notifications where request_id=t.get('oo_r') and user_id=t.uid('oo_c') and kind='verify_to_respond'),'OO no verification barrier notice');
select t.ok(not exists(select 1 from meetany_private.notifications where request_id=t.get('oo_r') and user_id in(t.uid('oo_h'),t.uid('oo_o'))),'OO hidden and opted-out companies are not alerted');
select t.ok(not exists(select 1 from meetany_private.request_alert_email_items i join meetany_private.notifications n on n.id=i.notification_id where n.request_id=t.get('oo_r') and n.user_id=t.uid('oo_c')),'OO default app notification does not opt user into email');

select t.as_anon();
select t.throws($q$select public.send_offer(t.get('oo_r'),'Anonymous supplier attempt')$q$,'MA001','OO anonymous cannot send');
select t.as_user('admin');
select t.throws($q$select public.send_offer(t.get('oo_r'),'Admin supplier attempt')$q$,'MA201','OO admin cannot send');
select t.as_user('oo_c');
select t.put('oo_co',(public.send_offer(t.get('oo_r'),'Unverified company offer',100,'unit',false,2,false)).id);
select t.ok((public.send_offer(t.get('oo_r'),'Unverified company updated offer',110,'unit',false,2,false)).id=t.get('oo_co'),'OO retries update same offer');
select t.ok((select count(*) from public.offers where request_id=t.get('oo_r') and company_id=t.uid('oo_c'))=1,'OO one offer per supplier remains enforced');
select t.throws($q$select public.send_offer(t.get('oo_closed'),'Unverified closed request offer')$q$,'MA203','OO closed request still rejected');
select t.throws($q$select public.send_offer(t.get('oo_hidden'),'Unverified hidden request offer')$q$,'MA106','OO hidden request still rejected');
select t.as_super();
update public.profiles set blocked=true where id=t.uid('oo_c');
select t.as_user('oo_c');
select t.throws($q$select public.send_offer(t.get('oo_r'),'Blocked company offer attempt')$q$,'MA002','OO blocked company still denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('oo_c');

select t.as_user('oo_p');
select t.put('oo_po',(public.send_offer(t.get('oo_r'),'Personal supplier offer',350,'total',false,3,true)).id);
select t.ok((public.set_offer_terms(t.get('oo_po'),'On completion',current_date+5,'{}',(select updated_at from public.offers where id=t.get('oo_po')))).id=t.get('oo_po'),'OO personal supplier can save offer terms');
select t.ok(not exists(select 1 from public.contact_for_request(t.get('oo_r'))),'OO personal supplier cannot see buyer contact before selection');
select t.put('oo_chat',(public.start_conversation(t.uid('oo_p'),t.get('oo_r'))->>'id')::uuid);
select t.lives($q$select public.send_message(t.get('oo_chat'),'Question about this request')$q$,'OO personal supplier can message request owner');
select t.as_user('oo_x');
select t.throws($q$select public.start_conversation(t.uid('oo_p'),t.get('oo_r'))$q$,'MA504','OO outsider cannot join personal offer chat');
select t.throws($q$select public.list_messages(t.get('oo_chat'))$q$,'MA501','OO outsider cannot read personal supplier chat');
select t.ok(not exists(select 1 from public.offers where id=t.get('oo_po')),'OO personal supplier offer is sealed from outsiders');
select t.as_user('oo_b');
select t.ok(exists(select 1 from jsonb_array_elements(public.compare_offers(t.get('oo_r'))) x where x->>'id'=t.get('oo_po')::text and x->>'supplier_role'='client' and x->>'company'='Personal Supplier'),'OO comparison distinguishes personal supplier identity');
select t.ok(exists(select 1 from jsonb_array_elements(public.compare_offers(t.get('oo_r'))) x where x->>'id'=t.get('oo_co')::text and x->>'supplier_role'='company' and x->>'verified'='false'),'OO comparison shows real unverified company status');
select t.ok((public.start_conversation(t.uid('oo_p'),t.get('oo_r'))->>'id')::uuid=t.get('oo_chat'),'OO buyer joins the same personal supplier thread');
select t.put('oo_d',(public.select_offer_deal(t.get('oo_po'))->>'id')::uuid);
select t.ok(exists(select 1 from jsonb_array_elements(public.get_deal_contact(t.get('oo_d'))) x where x->>'id'=t.uid('oo_p')::text and x->>'phone'='+995 599 887 002'),'OO selected personal supplier contact visible to buyer');
select t.as_user('oo_p');
select t.ok(exists(select 1 from jsonb_array_elements(public.get_deal_contact(t.get('oo_d'))) x where x->>'id'=t.uid('oo_b')::text),'OO personal supplier sees selected buyer contact');
select t.as_user('oo_x');
select t.throws($q$select public.get_deal_contact(t.get('oo_d'))$q$,'MA901','OO outsider cannot see personal supplier contacts');
select t.cs_progress('oo_d','oo_b','oo_p');
select t.as_user('oo_p');
select t.throws($q$select public.advance_deal(t.get('oo_d'),'complete',t.cs_rev('oo_d'))$q$,'MA906','OO personal supplier cannot confirm receipt as buyer');
select t.as_user('oo_b');
select t.ok(public.advance_deal(t.get('oo_d'),'complete',t.cs_rev('oo_d'))->>'stage'='complete','OO personal supplier deal completes normally');
select t.ok(public.rate_deal(t.get('oo_d'),5,'Good service',t.cs_rev('oo_d'))->>'rating'='5','OO personal supplier completed deal can be rated');
select t.as_super();
\o
select 'Open offer participation tests passed';
