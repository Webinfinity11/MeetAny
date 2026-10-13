-- Run only through run.sh: matching v2 — group fallback, one rule for preview/list/alerts, ranking, verification nudge.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

-- Groups in the database cover every category exactly once (JS equality: web/qa/unit/category-groups.test.mjs).
select t.ok((select array_agg(category order by category) from meetany_private.category_groups())=(select array_agg(c order by c) from unnest(meetany_private.categories()) c),'MV every category has exactly one group');
select t.ok((select count(distinct group_id) from meetany_private.category_groups())=13,'MV thirteen category groups');
select t.ok(meetany_private.category_group_members('it_support')=array['it_support','software_web'],'MV it_support and software_web share the IT group');
select t.ok(meetany_private.category_group_members('nope')='{}','MV unknown category has no group');
select t.ok(meetany_private.word_hits(meetany_private.match_words('ათი მაგიდა და სკამები, თეთრეულის რეცხვა'),meetany_private.match_words('მაგიდები; სკამი; სასტუმროს თეთრეული'))=array['თეთრეულის','მაგიდა','სკამები'],'MV Georgian word stems match across case endings');
select t.ok(meetany_private.match_words('გვჭირდება მომსახურება კომპანიისთვის')='{}','MV filler words are ignored');

select t.signup('mv_owner','mv-owner@test.ge','{"role":"client","name":"MV Owner","company":"MV Owner Ltd","phone":"599885301","city":"batumi"}');
select t.signup('mv_f1','mv-f1@test.ge','{"role":"company","name":"MV F1","company":"MV F1 Ltd","phone":"599885302","city":"tbilisi","industry":"business_finance"}');
select t.signup('mv_f2','mv-f2@test.ge','{"role":"company","name":"MV F2","company":"MV F2 Ltd","phone":"599885303","city":"batumi","industry":"business_insurance"}');
select t.signup('mv_f3','mv-f3@test.ge','{"role":"company","name":"MV F3","company":"MV F3 Ltd","phone":"599885304","city":"kutaisi","industry":"leasing"}');
select t.signup('mv_f4','mv-f4@test.ge','{"role":"company","name":"MV F4","company":"MV F4 Ltd","phone":"599885305","city":"tbilisi","industry":"leasing"}');
select t.signup('mv_f5','mv-f5@test.ge','{"role":"company","name":"MV F5","company":"MV F5 Ltd","phone":"599885306","city":"tbilisi","industry":"leasing"}');
select t.signup('mv_u1','mv-u1@test.ge','{"role":"company","name":"MV U1","company":"MV U1 Ltd","phone":"599885307","city":"tbilisi","industry":"leasing"}');
select t.signup('mv_u2','mv-u2@test.ge','{"role":"company","name":"MV U2","company":"MV U2 Ltd","phone":"599885308","city":"tbilisi","industry":"leasing"}');
select t.signup('mv_u3','mv-u3@test.ge','{"role":"company","name":"MV U3","company":"MV U3 Ltd","phone":"599885309","city":"tbilisi","industry":"printing"}');
select t.signup('mv_u4','mv-u4@test.ge','{"role":"company","name":"MV U4","company":"MV U4 Ltd","phone":"599885310","city":"tbilisi","industry":"leasing"}');

-- No other test company supplies the finance group; f3-f5 are not suppliers yet.
update public.profiles set verified=false,provide_categories='{}' where role='company' and provide_categories && array['leasing','business_finance','business_insurance'] and id not in (t.uid('mv_f1'),t.uid('mv_f2'));
update public.profiles set verified=true,provide_categories=array['business_finance'],service_cities='{}',offers=array['ავტომობილის ლიზინგი','საბრუნავი სახსრები'] where id=t.uid('mv_f1');
update public.profiles set verified=true,provide_categories=array['business_insurance'],service_cities=array['georgia'],offers=array['ქონების დაზღვევა'] where id=t.uid('mv_f2');
update public.profiles set verified=false,provide_categories='{}' where id in (t.uid('mv_f3'),t.uid('mv_f4'),t.uid('mv_f5'));
-- u1: unverified leasing provider. u2: unverified, opted out. u3: unverified, other group. u4: unverified, industry only.
update public.profiles set verified=false,provide_categories=array['leasing'] where id in (t.uid('mv_u1'),t.uid('mv_u2'));
update public.profiles set verified=false,provide_categories=array['printing'] where id=t.uid('mv_u3');
update public.profiles set verified=false,provide_categories='{}' where id=t.uid('mv_u4');
delete from meetany_private.request_alert_preferences where user_id in (select id from public.profiles where role='company');
insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities) values(t.uid('mv_u2'),false,'{}','{}');

-- 1. No exact supplier: the same group is listed, counted and alerted, marked similar.
select t.as_anon();
select t.ok(public.count_matching_suppliers('leasing')=2,'MV zero exact: preview counts the two group suppliers');
select t.ok(public.count_matching_suppliers('leasing','tbilisi')=public.count_matching_suppliers('leasing'),'MV city does not change the count');
select t.as_super();
select t.ok(public.count_matching_suppliers('other')=(select count(*) from public.profiles where role='company' and verified and not blocked and 'other'=any(provide_categories)),'MV other has no wider group');
select t.as_anon();
select t.as_user('mv_f1');
select t.ok(public.count_matching_suppliers('leasing')=1,'MV own company excluded from the fallback count');
select t.as_user('mv_owner');
select t.put('mv_req1',(public.create_request('სატვირთო მანქანის ლიზინგი','ორი სატვირთო ავტომობილის ლიზინგი ბათუმში, სამი წლით','leasing','batumi')).id);
select t.as_super();
select t.ok((select array_agg(user_id order by user_id) from meetany_private.notifications where request_id=t.get('mv_req1') and kind='request_match')=(select array_agg(id order by id) from meetany_private.matching_suppliers('leasing',t.uid('mv_owner')) where alerted),'MV zero exact: alert recipients are the rule''s alerted suppliers');
select t.ok((select count(*) from meetany_private.notifications where request_id=t.get('mv_req1') and kind='request_match')=2,'MV zero exact: both group suppliers alerted');
select t.as_user('mv_owner');
select t.ok(public.count_matching_suppliers('leasing')=(select count(*) from jsonb_array_elements(public.list_matching(t.get('mv_req1'),null,100,0)) x where (x->>'notified')::boolean),'MV preview count equals the notified suppliers in list_matching');
select t.ok((select bool_and(x->>'match'='similar') and count(*)=2 from jsonb_array_elements(public.list_matching(t.get('mv_req1'),null,100,0)) x),'MV fallback suppliers are marked similar');
-- f2 is in batumi; f1 has the keyword (ლიზინგი) but serves only tbilisi.
select t.ok((public.list_matching(t.get('mv_req1'),null,100,0)->0->>'id')=t.uid('mv_f2')::text,'MV the supplier in the request city ranks first');
select t.ok((select x->'reasons'->>'city'='local' and (x->>'score')::int=130 from jsonb_array_elements(public.list_matching(t.get('mv_req1'),null,100,0)) x where x->>'id'=t.uid('mv_f2')::text),'MV city reason and score for the local supplier');
select t.ok((select x->'reasons'->'keywords' ?& array['ავტომობილის','ლიზინგი'] and x->'reasons'->>'city' is null and (x->>'score')::int=110 from jsonb_array_elements(public.list_matching(t.get('mv_req1'),null,100,0)) x where x->>'id'=t.uid('mv_f1')::text),'MV keyword reason and score');
select t.ok(jsonb_array_length(public.list_matching(t.get('mv_req1'),'kutaisi',100,0))=1 and (public.list_matching(t.get('mv_req1'),'kutaisi',100,0)->0->>'id')=t.uid('mv_f2')::text,'MV city filter keeps companies covering all Georgia');

-- 2. One exact supplier: it is alone in the alerts and count, the group is listed after it, not notified.
select t.as_super();
update public.profiles set verified=true,provide_categories=array['leasing'],service_cities=array['kutaisi'] where id=t.uid('mv_f3');
select t.as_anon();
select t.ok(public.count_matching_suppliers('leasing')=1,'MV one exact: count is the exact supplier only');
select t.as_user('mv_owner');
select t.put('mv_req2',(public.create_request('ლიზინგი საწყობის ტექნიკისთვის','ჩანგლიანი დამტვირთველის ლიზინგი ქუთაისში','leasing','kutaisi')).id);
select t.as_super();
select t.ok((select array_agg(user_id) from meetany_private.notifications where request_id=t.get('mv_req2') and kind='request_match')=array[t.uid('mv_f3')],'MV one exact: only the exact supplier is alerted');
select t.as_user('mv_owner');
select t.ok((select array_agg(x->>'match' order by ord) from jsonb_array_elements(public.list_matching(t.get('mv_req2'),null,100,0)) with ordinality e(x,ord))=array['exact','similar','similar'],'MV one exact: exact first, then two similar');
select t.ok((select array_agg((x->>'notified')::boolean order by ord) from jsonb_array_elements(public.list_matching(t.get('mv_req2'),null,100,0)) with ordinality e(x,ord))=array[true,false,false],'MV similar suppliers are listed but not notified');
select t.ok(public.count_matching_suppliers('leasing')=(select count(*) from jsonb_array_elements(public.list_matching(t.get('mv_req2'),null,100,0)) x where (x->>'notified')::boolean),'MV one exact: preview equals notified');
select t.ok((select min((x->>'score')::int) from jsonb_array_elements(public.list_matching(t.get('mv_req2'),null,100,0)) x where x->>'match'='exact')>(select max((x->>'score')::int) from jsonb_array_elements(public.list_matching(t.get('mv_req2'),null,100,0)) x where x->>'match'='similar'),'MV every exact score is above every similar score');

-- 3. Three exact suppliers: no fallback at all.
select t.as_super();
update public.profiles set verified=true,provide_categories=array['leasing'] where id in (t.uid('mv_f4'),t.uid('mv_f5'));
select t.as_user('mv_owner');
select t.put('mv_req3',(public.create_request('ლიზინგი სამი ავტომობილისთვის','სამი მსუბუქი ავტომობილის ლიზინგი თბილისში','leasing','tbilisi')).id);
select t.ok((select bool_and(x->>'match'='exact') and count(*)=3 from jsonb_array_elements(public.list_matching(t.get('mv_req3'),null,100,0)) x),'MV three exact: no similar suppliers listed');
select t.ok(public.count_matching_suppliers('leasing')=3 and jsonb_array_length(public.list_matching(t.get('mv_req3'),null,100,0))=3,'MV three exact: count equals list');
select t.as_super();
select t.ok((select array_agg(user_id order by user_id) from meetany_private.notifications where request_id=t.get('mv_req3') and kind='request_match')=(select array_agg(id order by id) from meetany_private.matching_suppliers('leasing',t.uid('mv_owner')) where alerted),'MV three exact: recipients equal the rule');

-- 4. Completed deals and published rating add to the score; ranking is deterministic.
insert into public.offers(request_id,company_id,body) values(t.get('mv_req3'),t.uid('mv_f5'),'Offer for the leasing request');
insert into meetany_private.deals(request_id,offer_id,buyer_id,supplier_id,stage,complete_at,buyer_confirmed_at,supplier_confirmed_at)
 select t.get('mv_req3'),o.id,t.uid('mv_owner'),t.uid('mv_f5'),'complete',now(),now(),now() from public.offers o where o.request_id=t.get('mv_req3') and o.company_id=t.uid('mv_f5');
insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body,status) values(t.get('mv_req3'),t.uid('mv_owner'),t.uid('mv_f5'),5,'Fast and careful leasing partner.','published');
select t.as_user('mv_owner');
select t.ok((select (x->'reasons'->>'deals')::int=1 and (x->'reasons'->>'rating')::numeric=5 and (x->>'score')::int=200+30+3+10 from jsonb_array_elements(public.list_matching(t.get('mv_req3'),null,100,0)) x where x->>'id'=t.uid('mv_f5')::text),'MV deals and rating are reasons and points');
select t.ok((public.list_matching(t.get('mv_req3'),null,100,0)->0->>'id')=t.uid('mv_f5')::text,'MV the rated supplier with a deal ranks first among equals');
select t.ok(public.list_matching(t.get('mv_req3'),null,100,0)=public.list_matching(t.get('mv_req3'),null,100,0),'MV ranking is deterministic');
select t.ok(jsonb_array_length(public.list_matching(t.get('mv_req3'),null,1,1))=1 and (public.list_matching(t.get('mv_req3'),null,1,1)->0)=(public.list_matching(t.get('mv_req3'),null,100,0)->1),'MV paging follows the rank');

-- 5. Unverified providers get one verification nudge per day, never a request alert.
select t.as_super();
select t.ok(exists(select 1 from meetany_private.notifications where user_id=t.uid('mv_u1') and kind='verify_to_respond' and request_id=t.get('mv_req1') and detail->>'day'=((now() at time zone 'Asia/Tbilisi')::date)::text and detail->>'title'='სატვირთო მანქანის ლიზინგი'),'MV unverified provider gets the verification nudge');
select t.ok((select count(*) from meetany_private.notifications where user_id=t.uid('mv_u1') and kind='verify_to_respond')=1,'MV at most one nudge per company per day');
select t.ok(not exists(select 1 from meetany_private.notifications where user_id=t.uid('mv_u1') and kind='request_match'),'MV unverified provider gets no request alert');
select t.ok(not exists(select 1 from meetany_private.notifications where user_id=t.uid('mv_u2')),'MV opted-out unverified company gets no nudge');
select t.ok(not exists(select 1 from meetany_private.notifications where user_id=t.uid('mv_u3')),'MV unverified company of another category gets no nudge');
select t.ok(exists(select 1 from meetany_private.notifications where user_id=t.uid('mv_u4') and kind='verify_to_respond'),'MV unverified company without directions is nudged by its industry');
select t.ok(not exists(select 1 from meetany_private.notifications where kind='verify_to_respond' and user_id in (t.uid('mv_f1'),t.uid('mv_f2'))),'MV verified companies never get the nudge');
-- Next Tbilisi day: a new nudge is allowed.
update meetany_private.notifications set detail=jsonb_set(detail,'{day}','"2000-01-01"') where user_id=t.uid('mv_u1') and kind='verify_to_respond';
select t.as_user('mv_owner');
select t.put('mv_req4',(public.create_request('ლიზინგი ოფისის ტექნიკისთვის','ოფისის ტექნიკის ლიზინგი თბილისში','leasing','tbilisi')).id);
select t.as_super();
select t.ok((select count(*) from meetany_private.notifications where user_id=t.uid('mv_u1') and kind='verify_to_respond')=2,'MV a new day allows a new nudge');
select t.as_user('mv_u1');
select t.ok((select x->>'title'='ლიზინგი ოფისის ტექნიკისთვის' and x->>'request_id'=t.get('mv_req4')::text from jsonb_array_elements(public.list_notifications()->'items') x where x->>'kind'='verify_to_respond' order by x->>'created_at' desc limit 1),'MV the nudge is listed with the request title');
select t.ok((public.engagement_state()->>'unread')::int>=2,'MV nudges count as unread');
select t.throws($q$insert into meetany_private.notifications(user_id,request_id,kind,offer_id) select t.uid('mv_u1'),t.get('mv_req4'),'verify_to_respond',id from public.offers limit 1$q$,'42501','MV clients cannot write notifications');
select t.as_super();
select t.throws($q$insert into meetany_private.notifications(user_id,request_id,kind,offer_id) select t.uid('mv_u1'),t.get('mv_req4'),'verify_to_respond',id from public.offers limit 1$q$,'23514','MV a nudge never carries an offer');

-- 6. The three places agree for every category with default preferences.
select t.ok(not exists(
 select 1 from unnest(meetany_private.categories()) c
 where (select count(*) from meetany_private.matching_suppliers(c,null) where alerted)<>
  (select count(*) from public.profiles p cross join lateral meetany_private.default_request_alert_preferences(p) d
   left join meetany_private.matching_suppliers(c,null) m on m.id=p.id and m.alerted and not m.exact
   where d.enabled and not p.blocked and (c=any(d.categories) or m.id is not null) and cardinality(p.provide_categories)>0)),'MV for every category the preview count equals the default alert recipients');

-- Privileges: the rule and helpers stay private; the two RPCs keep their grants.
select t.ok(not has_function_privilege('anonymous','meetany_private.matching_suppliers(text,uuid)','EXECUTE') and not has_function_privilege('authenticated','meetany_private.matching_suppliers(text,uuid)','EXECUTE'),'MV the rule is not callable by clients');
select t.ok(has_function_privilege('anonymous','public.count_matching_suppliers(text,text)','EXECUTE') and has_function_privilege('authenticated','public.list_matching(uuid,text,integer,integer)','EXECUTE') and not has_function_privilege('anonymous','public.list_matching(uuid,text,integer,integer)','EXECUTE'),'MV RPC grants unchanged');
\o
select format('MATCHING V2 %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'MV %';
