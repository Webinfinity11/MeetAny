\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.contact_start as select count(*) n from t.passed;
select t.signup('contact_actor','contact-actor@example.test','{"role":"client","name":"Contact Actor","phone":"+995 591 973 001","city":"tbilisi"}');
select t.signup('contact_company','contact-company@example.test','{"role":"company","name":"Contact Supplier","company":"Contact Company","industry":"furniture","phone":"+995 591 973 002","city":"tbilisi"}');
select t.as_user('contact_actor');
select t.put('contact_request',(public.create_request('Contact test request','Detailed contact test request','furniture','tbilisi')).id);
select t.as_anon();
select t.ok((public.log_contact_event('company',t.uid('contact_company'),'reveal','company-list')->>'recorded')::boolean,'C anonymous reveal recorded');
select t.ok(not (public.log_contact_event('company',t.uid('contact_company'),'reveal','company-profile')->>'recorded')::boolean,'C dedupe across sources');
select t.ok((public.log_contact_event('company',t.uid('contact_company'),'call','company-list')->>'recorded')::boolean,'C call separate from reveal');
select t.throws($$select * from meetany_private.contact_events$$,'42501','C anon cannot read table');
select t.throws($$select public.admin_contact_stats()$$,'42501','C anon cannot read stats');
select t.throws($$select public.admin_contact_events()$$,'42501','C anon cannot read events');
select t.throws($$select public.log_contact_event('company',t.uid('contact_company'),'bad','company-list')$$,'22023','C invalid kind');
select t.throws($$select public.log_contact_event('company',t.uid('contact_company'),'call','bad')$$,'22023','C invalid source');
select t.throws($$select public.log_contact_event('company',t.uid('contact_company'),'call','request-owner')$$,'22023','C source target mismatch');
select t.throws($$select public.log_contact_event('request',gen_random_uuid(),'call','request-owner')$$,'22023','C missing request');
select t.throws($$select public.log_contact_event('company',t.uid('contact_actor'),'call','company-list')$$,'22023','C client not company target');
select t.throws($$select public.log_contact_event(null,t.uid('contact_company'),'call','company-list')$$,'22023','C null target kind');
select t.as_user('contact_actor');
select t.ok((public.log_contact_event('company',t.uid('contact_company'),'reveal','company-profile')->>'recorded')::boolean,'C signed in independent of anon');
select t.ok(not (public.log_contact_event('company',t.uid('contact_company'),'reveal','company-profile')->>'recorded')::boolean,'C signed in duplicate suppressed');
select t.ok((public.log_contact_event('request',t.get('contact_request'),'call','request-owner')->>'recorded')::boolean,'C request recorded');
select t.throws($$select public.admin_contact_events()$$,'MA003','C nonadmin events denied');
select t.throws($$select public.admin_contact_stats()$$,'MA003','C nonadmin stats denied');
select t.throws($$select * from meetany_private.contact_events$$,'42501','C signed in table read denied');
select t.as_super();
select t.ok((select actor_role='client' from meetany_private.contact_events where actor_id=t.uid('contact_actor') and kind='reveal'),'C actor role derived');
select t.ok((select actor_id is null and actor_role='anonymous' from meetany_private.contact_events where actor_id is null and kind='reveal'),'C anonymous has no identity');
update public.profiles set blocked=true where id=t.uid('contact_actor');
select t.as_user('contact_actor');
select t.throws($$select public.log_contact_event('company',t.uid('contact_company'),'call','company-list')$$,'MA002','C blocked actor denied');
select t.as_super();
update public.profiles set blocked=false where id=t.uid('contact_actor');
update meetany_private.contact_events set created_at=now()-interval '61 seconds';
select t.as_anon();
select t.ok((public.log_contact_event('company',t.uid('contact_company'),'reveal','company-list')->>'recorded')::boolean,'C rate window expires');
select t.as_super();
insert into meetany_private.contact_events(actor_role,target_kind,target_id,kind,source)
select 'anonymous','company',t.uid('contact_company'),'call','company-list' from generate_series(1,119);
select t.as_anon();
select t.ok(not (public.log_contact_event('request',t.get('contact_request'),'reveal','request-owner')->>'recorded')::boolean,'C anonymous global cap');
select t.as_user('contact_actor');
select t.ok((public.log_contact_event('request',t.get('contact_request'),'reveal','request-owner')->>'recorded')::boolean,'C anonymous cap does not block signed in');
select t.as_user('admin');
select t.ok((public.admin_contact_events()->>'filteredTotal')::int=125,'C admin sees total');
select t.ok(jsonb_array_length(public.admin_contact_events()->'items')=25,'C default page size');
select t.ok((public.admin_contact_events()->>'hasMore')::boolean,'C more pages');
select t.ok((public.admin_contact_events(p_kind=>'reveal')->>'filteredTotal')::int=4,'C kind filter');
select t.ok((public.admin_contact_events(p_target_kind=>'request')->>'filteredTotal')::int=2,'C target filter');
select t.ok((public.admin_contact_events(p_from=>now()+interval '1 hour')->>'filteredTotal')::int=0,'C date filter');
select t.ok((public.admin_contact_stats()->'totals'->'month'->>'calls')::int=121,'C stats call totals');
select t.ok(jsonb_array_length(public.admin_contact_stats()->'companies')=1,'C top companies');
select t.ok(jsonb_array_length(public.admin_contact_stats()->'requests')=1,'C top requests');
select t.throws($$select public.admin_contact_stats('bad')$$,'22023','C invalid period');
select t.throws($$select public.admin_contact_events(p_kind=>'bad')$$,'22023','C invalid filter');
select t.throws($$select public.admin_contact_events(p_cursor=>'{}')$$,'22023','C invalid cursor');
select t.throws($$select public.admin_contact_events(p_from=>now(),p_to=>now()-interval '1 day')$$,'22023','C inverted dates');
do $$ declare page jsonb; cur jsonb; seen uuid[]:='{}'; item jsonb; begin
 loop
  page:=public.admin_contact_events(p_cursor=>cur,p_limit=>17);
  for item in select * from jsonb_array_elements(page->'items') loop
   perform t.ok(not (item->>'id')::uuid=any(seen),'C cursor never repeats');
   seen:=array_append(seen,(item->>'id')::uuid);
  end loop;
  exit when not (page->>'hasMore')::boolean;
  cur:=page->'nextCursor';
 end loop;
 perform t.ok(cardinality(seen)=125,'C complete traversal');
end $$;
select t.as_super();
delete from public.requests where id=t.get('contact_request');
select t.as_user('admin');
select t.ok((public.admin_contact_events(p_target_kind=>'request')->'items'->0->>'target_exists')::boolean=false,'C deleted target history retained');
select t.as_super();
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s CONTACT EVENT TESTS PASSED',count(*)-(select n from t.contact_start)) from t.passed;
select format('TOTAL %s SQL ASSERTIONS PASSED',count(*)) from t.passed;
