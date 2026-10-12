-- Run only through run.sh: one matching rule for the preview count, list_matching and default request alerts; account intent upgrade.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.mi_n(k text primary key, n bigint not null);
grant select,insert,update on t.mi_n to public;

select t.signup('mi_owner','mi-owner@test.ge','{"role":"client","name":"MI Owner","company":"MI Owner Ltd","phone":"599884301","city":"tbilisi"}');
select t.signup('mi_a','mi-a@test.ge','{"role":"company","name":"MI A","company":"MI A Ltd","phone":"599884302","city":"tbilisi","industry":"laundry"}');
select t.signup('mi_b','mi-b@test.ge','{"role":"company","name":"MI B","company":"MI B Ltd","phone":"599884303","city":"batumi","industry":"laundry"}');
select t.signup('mi_c','mi-c@test.ge','{"role":"company","name":"MI C","company":"MI C Ltd","phone":"599884304","city":"kutaisi","industry":"laundry"}');
select t.signup('mi_d','mi-d@test.ge','{"role":"company","name":"MI D","company":"MI D Ltd","phone":"599884305","city":"tbilisi","industry":"printing"}');
select t.signup('mi_e','mi-e@test.ge','{"role":"company","name":"MI E","company":"MI E Ltd","phone":"599884306","city":"tbilisi","industry":"laundry"}');
select t.signup('mi_up','mi-up@test.ge','{"role":"client","name":"MI Up","company":"MI Up Ltd","phone":"599884307","city":"tbilisi"}');
select t.signup('mi_up2','mi-up2@test.ge','{"role":"client","name":"MI Up2","company":"MI Up2 Ltd","phone":"599884308","city":"tbilisi"}');

insert into t.mi_n select 'before',count(*) from public.profiles where role='company' and verified and not blocked and 'laundry'=any(provide_categories);
-- a: verified, laundry. b: unverified. c: verified but blocked. d: verified, printing+laundry. e: unverified, no provide_categories (industry only; a verified one would be notified through the industry fallback but is not in list_matching).
update public.profiles set verified=true,provide_categories=array['laundry'] where id=t.uid('mi_a');
update public.profiles set verified=false,provide_categories=array['laundry'] where id=t.uid('mi_b');
update public.profiles set verified=true,provide_categories=array['laundry'] where id=t.uid('mi_c');
update public.profiles set blocked=true where id=t.uid('mi_c');
update public.profiles set verified=true,provide_categories=array['laundry','printing'] where id=t.uid('mi_d');
update public.profiles set verified=false,provide_categories='{}' where id=t.uid('mi_e');

-- Preview count: verified, unblocked, category in provide_categories only.
select t.as_anon();
select t.ok(public.count_matching_suppliers('laundry')=(select n from t.mi_n where k='before')+2,'MI count includes only verified unblocked providers of the category');
select t.ok(public.count_matching_suppliers('laundry','tbilisi')=public.count_matching_suppliers('laundry'),'MI city does not change the count');
select t.ok(public.count_matching_suppliers('printing')>=1,'MI count follows provide_categories, not industry');
select t.throws($q$select public.count_matching_suppliers('not_a_category')$q$,'MA902','MI invalid category rejected');
select t.throws($q$select public.count_matching_suppliers(null)$q$,'MA902','MI null category rejected');
select t.as_user('mi_owner');
select t.ok(public.count_matching_suppliers('laundry')=(select n from t.mi_n where k='before')+2,'MI client sees the same count');
select t.as_user('mi_a');
select t.ok(public.count_matching_suppliers('laundry')=(select n from t.mi_n where k='before')+1,'MI own company excluded from the count');

-- The count equals what list_matching returns after publishing.
select t.as_user('mi_owner');
select t.put('mi_req',(public.create_request('Laundry service request','Detailed laundry service request','laundry','tbilisi')).id);
select t.ok(jsonb_array_length(public.list_matching(t.get('mi_req'),null,100,0))=public.count_matching_suppliers('laundry'),'MI preview count equals list_matching after publishing');
select t.ok(not exists(select 1 from jsonb_array_elements(public.list_matching(t.get('mi_req'),null,100,0)) x where x->>'id' in (t.uid('mi_b')::text,t.uid('mi_c')::text,t.uid('mi_e')::text)),'MI list_matching excludes unverified, blocked and unconfigured companies');

-- Default alert preferences follow provide_categories and cover all cities.
select t.as_super();
select t.ok((select enabled and categories@>array['laundry','printing'] and cardinality(categories)=2 and cities=array['georgia'] and email_mode='off' from meetany_private.default_request_alert_preferences((select p from public.profiles p where id=t.uid('mi_d')))),'MI default alerts use provide_categories and every city');
select t.ok((select not enabled from meetany_private.default_request_alert_preferences((select p from public.profiles p where id=t.uid('mi_b')))),'MI default alerts off for unverified company');
select t.ok((select categories=array['laundry'] from meetany_private.default_request_alert_preferences((select p from public.profiles p where id=t.uid('mi_e')))),'MI default alerts fall back to industry without provide_categories');
select t.ok((select not enabled from meetany_private.default_request_alert_preferences((select p from public.profiles p where id=t.uid('mi_owner')))),'MI default alerts off for clients');
select t.as_user('mi_d');
select t.ok(public.request_alert_preferences()->'categories' @> '["printing","laundry"]'::jsonb and public.request_alert_preferences()->'cities'='["georgia"]'::jsonb,'MI request_alert_preferences exposes the matching default');

-- notify_matching_request reaches exactly the list_matching set (no saved preferences, mi_e/legacy rows aside).
select t.as_super();
delete from meetany_private.request_alert_preferences where user_id in (select id from public.profiles where role='company');
select t.as_user('mi_owner');
select t.put('mi_req2',(public.create_request('Second laundry request','Detailed second laundry request','laundry','batumi')).id);
select t.as_super();
select t.ok((select coalesce(array_agg(user_id order by user_id),'{}') from meetany_private.notifications where request_id=t.get('mi_req2') and kind='request_match' and user_id in (t.uid('mi_a'),t.uid('mi_b'),t.uid('mi_c'),t.uid('mi_d'),t.uid('mi_e'))) = array(select unnest(array[t.uid('mi_a'),t.uid('mi_d')]) order by 1),'MI alert recipients are the verified unblocked providers');
select t.as_user('mi_owner');
select t.ok((select array_agg((x->>'id')::uuid order by (x->>'id')::uuid) from jsonb_array_elements(public.list_matching(t.get('mi_req2'),null,100,0)) x where x->>'id' in (t.uid('mi_a')::text,t.uid('mi_b')::text,t.uid('mi_c')::text,t.uid('mi_d')::text,t.uid('mi_e')::text)) = array(select unnest(array[t.uid('mi_a'),t.uid('mi_d')]) order by 1),'MI list_matching returns the same companies');
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.notifications n where n.request_id=t.get('mi_req2') and n.kind='request_match' and not exists(select 1 from public.profiles p where p.id=n.user_id and p.verified and not p.blocked and 'laundry'=any(p.provide_categories))),'MI every alert recipient is a list_matching supplier');
select t.ok(not exists(select 1 from public.profiles p where p.role='company' and p.verified and not p.blocked and p.id<>t.uid('mi_owner') and 'laundry'=any(p.provide_categories) and not exists(select 1 from meetany_private.notifications n where n.request_id=t.get('mi_req2') and n.user_id=p.id and n.kind='request_match')),'MI every list_matching supplier is notified');

-- Saved preferences still win over the default.
select t.as_user('mi_a');
select public.set_request_alert_preferences(true,'{printing}','{tbilisi}','off');
select t.as_user('mi_owner');
select t.put('mi_req3',(public.create_request('Third laundry request','Detailed third laundry request','laundry','tbilisi')).id);
select t.as_super();
select t.ok(not exists(select 1 from meetany_private.notifications where request_id=t.get('mi_req3') and user_id=t.uid('mi_a')),'MI saved preferences override the matching default');

-- become_company with an account intent.
select t.as_user('mi_up');
select t.throws($q$select public.become_company('MI Up Co','laundry','everyone')$q$,'MA902','MI invalid intent rejected');
select t.throws($q$select public.become_company('MI Up Co','laundry',null)$q$,'MA902','MI null intent rejected');
select t.throws($q$select public.become_company('x','laundry','buy')$q$,'MA902','MI invalid company still rejected');
select t.ok((public.become_company('MI Up Co','laundry','buy')).id=t.uid('mi_up'),'MI upgrade with buy keeps profile ID');
select t.ok((select role='company' and not verified and account_intent='buy' and provide_categories=array['laundry'] from public.my_profile()),'MI upgrade stores the buy intent');
select t.ok((public.become_company('Other name','printing','sell')).account_intent='buy' and (select company='MI Up Co' from public.my_profile()),'MI second run changes nothing');
select t.as_user('mi_up2');
select t.ok((public.become_company('MI Up2 Co','printing','sell')).account_intent='sell','MI upgrade with sell stores the sell intent');
select t.as_anon();
select t.throws($q$select public.become_company('MI Anon','laundry','both')$q$,'42501','MI anonymous cannot upgrade');
