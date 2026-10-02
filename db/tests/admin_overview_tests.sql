\set ON_ERROR_STOP 1
\o /dev/null
begin;
select t.as_super();
create table t.overview_start as select count(*) n from t.passed;
-- More than one page in every queue; tie-breaks and timezone boundaries are intentional.
do $$
declare i integer;
begin
 for i in 1..8 loop
  perform t.signup('ov_company_'||i,'ov-company-'||i||'@example.ge',jsonb_build_object('role','company','name','Overview owner '||i,'company','Overview company '||i,'phone','+995 523 880 '||lpad(i::text,3,'0'),'city','tbilisi','industry','furniture'));
 end loop;
end $$;
update public.profiles set created_at=now()-interval '90 days' where id in (select id from t.users where k like 'ov_company_%');
update public.profiles set verified=true where id=t.uid('ov_company_7');
update public.profiles set blocked=true where id=t.uid('ov_company_8');
-- Six initial pending companies plus two more prove totals are not the truncated page length.
select t.signup('ov_company_9','ov-company-9@example.ge','{"role":"company","name":"Ninth owner","company":"Ninth pending company","phone":"+995 523 880 009","city":"tbilisi","industry":"furniture"}');
select t.signup('ov_company_10','ov-company-10@example.ge','{"role":"company","name":"Tenth owner","company":"Tenth pending company","phone":"+995 523 880 010","city":"tbilisi","industry":"furniture"}');
insert into public.requests(owner_id,title,body,category,city,created_at,expires_at)
 select t.uid('bx_client'),'Overview unanswered '||i,'Test request with a meaningful description','furniture','tbilisi',now()-interval '4 days',now()+interval '1 day' from generate_series(1,8) i;
select t.put('ov_offered',gen_random_uuid());
select t.put('ov_hidden',gen_random_uuid());
select t.put('ov_closed',gen_random_uuid());
select t.put('ov_expired',gen_random_uuid());
select t.put('ov_chosen',gen_random_uuid());
insert into public.requests(id,owner_id,title,body,category,city,created_at,expires_at,hidden,status)
 select t.get('ov_'||k),t.uid('bx_client'),'Overview excluded '||k,'Test excluded request description','furniture','tbilisi',now()-interval '4 days',case when k='expired' then now() else now()+interval '1 day' end,k='hidden',case when k='closed' then 'closed' else 'open' end
 from unnest(array['offered','hidden','closed','expired','chosen']) k;
insert into public.offers(request_id,company_id,body) values(t.get('ov_offered'),t.uid('ov_company_7'),'A meaningful supplier offer'),(t.get('ov_chosen'),t.uid('ov_company_7'),'A meaningful chosen offer');
update public.requests set expires_at=now()+interval '1 hour' where id=t.get('ov_offered');
update public.requests set chosen_offer_id=(select id from public.offers where request_id=t.get('ov_chosen')) where id=t.get('ov_chosen');
-- UTC date differs from the Tbilisi calendar day. Include day 59, exclude day 60 and future.
insert into public.requests(owner_id,title,body,category,city,created_at,expires_at)
 select t.uid('bx_client'),'Overview calendar day '||d,'Calendar boundary regression request','furniture','tbilisi',(((now() at time zone 'Asia/Tbilisi')::date-d)::timestamp at time zone 'Asia/Tbilisi')+interval '30 minutes',now()-interval '1 day'
 from unnest(array[10,40,59,60,-1]) d;
update public.profiles set created_at=(((now() at time zone 'Asia/Tbilisi')::date-40)::timestamp at time zone 'Asia/Tbilisi')+interval '30 minutes' where id=t.uid('ov_company_9');
update public.profiles set created_at=(((now() at time zone 'Asia/Tbilisi')::date-10)::timestamp at time zone 'Asia/Tbilisi')+interval '30 minutes' where id=t.uid('ov_company_10');
create table t.overview_expected as select
 (select count(*) from public.profiles where role='company' and not verified and not blocked) pending,
 (select jsonb_agg(id order by created_at,id) from (select id,created_at from public.profiles where role='company' and not verified and not blocked order by created_at,id limit 6) p) pending_ids,
 (select count(*) from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.created_at<now()-interval '3 days' and not exists(select 1 from public.offers o where o.request_id=r.id)) unanswered,
 (select count(*) from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.expires_at<=now()+interval '2 days') expiring;
create table t.overview_daily_expected as
 select (now() at time zone 'Asia/Tbilisi')::date-i day_key,
  (select count(*) from public.requests r where not hidden and (r.created_at at time zone 'Asia/Tbilisi')::date=(now() at time zone 'Asia/Tbilisi')::date-i and r.created_at<=now()) requests,
  (select count(*) from public.profiles p where role<>'admin' and (p.created_at at time zone 'Asia/Tbilisi')::date=(now() at time zone 'Asia/Tbilisi')::date-i and p.created_at<=now()) registrations
 from generate_series(0,59) i;
create table t.overview_response(value jsonb);
create table t.overview_revision(value jsonb);
grant select on t.overview_expected,t.overview_daily_expected,t.overview_start to public;
grant select,insert,update on t.overview_response,t.overview_revision to public;
select t.as_anon();
select t.throws($q$select public.admin_overview()$q$,'42501','OV guest cannot read overview');
select t.as_user('bx_client');
select t.throws($q$select public.admin_overview()$q$,'MA003','OV client cannot read admin snapshot');
select t.as_user('ov_company_7');
select t.throws($q$select public.admin_overview()$q$,'MA003','OV approved company cannot read snapshot');
select t.as_user('ov_company_8');
select t.throws($q$select public.admin_overview()$q$,'MA002','OV blocked company cannot read snapshot');
select t.as_user('bx_admin');
insert into t.overview_response select public.admin_overview();
select t.ok(value->'stats'=public.admin_stats(),'OV aggregate preserves stats contract') from t.overview_response;
select t.ok((value->>'generatedAt')::timestamptz=now(),'OV snapshot has consistent generated timestamp') from t.overview_response;
select t.ok(jsonb_array_length(value->'activity')=60,'OV sixty padded daily rows') from t.overview_response;
select t.ok(value->'activity'->0->>'day'=((now() at time zone 'Asia/Tbilisi')::date-59)::text and value->'activity'->59->>'day'=(now() at time zone 'Asia/Tbilisi')::date::text,'OV exact calendar bounds ordered oldest first') from t.overview_response;
select t.ok(not exists(select 1 from t.overview_daily_expected e join jsonb_array_elements(value->'activity') a on (a->>'day')::date=e.day_key where (a->>'requests')::bigint<>e.requests or (a->>'registrations')::bigint<>e.registrations),'OV every day matches Tbilisi visible requests and non-admin registrations') from t.overview_response;
select t.ok(exists(select 1 from jsonb_array_elements(value->'activity') a where (a->>'day')::date=(now() at time zone 'Asia/Tbilisi')::date-40 and (a->>'requests')::int>0 and (a->>'registrations')::int>0),'OV previous thirty-day comparison is populated') from t.overview_response;
select t.ok(exists(select 1 from jsonb_array_elements(value->'activity') a where (a->>'requests')::int=0 and (a->>'registrations')::int=0),'OV missing days are explicit zeroes') from t.overview_response;
select t.ok((value->'pending'->>'total')::bigint=e.pending and e.pending>6 and jsonb_array_length(value->'pending'->'items')=6,'OV pending total includes more than bounded six rows') from t.overview_response cross join t.overview_expected e;
select t.ok((select jsonb_agg(a->'id' order by ord) from jsonb_array_elements(value->'pending'->'items') with ordinality x(a,ord))=e.pending_ids,'OV pending oldest-first deterministic tie break') from t.overview_response cross join t.overview_expected e;
select t.ok(not exists(select 1 from jsonb_array_elements(value->'pending'->'items') a,jsonb_object_keys(a) k where k<>all(array['id','name','company','industry'])),'OV pending payload exposes no email phone or audit details') from t.overview_response;
select t.ok((value->'unanswered'->>'total')::bigint=e.unanswered and e.unanswered>=8 and jsonb_array_length(value->'unanswered'->'items')=6,'OV unanswered count is complete while items are bounded') from t.overview_response cross join t.overview_expected e;
select t.ok((value->'expiring'->>'total')::bigint=e.expiring and e.expiring>=8 and jsonb_array_length(value->'expiring'->'items')=6,'OV expiring count is complete while items are bounded') from t.overview_response cross join t.overview_expected e;
select t.ok(not exists(select 1 from jsonb_array_elements(value->'unanswered'->'items') a where (a->>'id')::uuid in (t.get('ov_offered'),t.get('ov_hidden'),t.get('ov_closed'),t.get('ov_expired'),t.get('ov_chosen'))),'OV unanswered excludes offered hidden closed expired and chosen requests') from t.overview_response;
select t.ok(not exists(select 1 from jsonb_array_elements(value->'expiring'->'items') a where (a->>'id')::uuid in (t.get('ov_hidden'),t.get('ov_closed'),t.get('ov_expired'),t.get('ov_chosen'))),'OV expiring excludes non-open request states') from t.overview_response;
select t.ok(not exists(select 1 from jsonb_array_elements(value->'unanswered'->'items') a where (a->>'offerCount')::int<>0 or (a->>'daysLeft')::int<1),'OV request item display fields are correct') from t.overview_response;
select t.ok(exists(select 1 from jsonb_array_elements(value->'expiring'->'items') a where (a->>'id')::uuid=t.get('ov_offered') and (a->>'offerCount')::int=1 and (a->>'daysLeft')::int=1),'OV expiring item includes actual offer count and partial day') from t.overview_response;
select t.ok(value=public.admin_overview(),'OV tied queue ordering and snapshot are stable across reads') from t.overview_response;
insert into t.overview_revision select public.admin_stats();
select t.ok(public.admin_stats()->>'adminRevision'=value->>'adminRevision','OV unchanged audit does not invalidate cache') from t.overview_revision;
select public.admin_edit_profile(t.uid('ov_company_1'),'{"about":"Edited old company with stable counts"}');
select t.ok(public.admin_stats()->>'adminRevision'<>value->>'adminRevision' and public.admin_stats()-'adminRevision'=value-'adminRevision','OV old-row edit changes revision without changing counts') from t.overview_revision;
update t.overview_revision set value=public.admin_stats();
select public.admin_save_site_content('{"heroSubtitle":"Changed CMS with stable counts"}');
select t.ok(public.admin_stats()->>'adminRevision'<>value->>'adminRevision' and public.admin_stats()-'adminRevision'=value-'adminRevision','OV business audit changes revision without changing counts') from t.overview_revision;
select t.as_super();
-- Force a digit boundary: textual ORDER BY id::text would incorrectly retain 999 over 1000.
select setval(pg_get_serial_sequence('meetany_private.business_audit','id'),998,true);
select t.as_user('bx_admin');
select public.admin_save_site_content('{"heroSubtitle":"Revision 999 boundary"}');
update t.overview_revision set value=public.admin_stats();
select public.admin_save_site_content('{"heroSubtitle":"Revision 1000 boundary"}');
select t.ok(public.admin_stats()->>'adminRevision'<>value->>'adminRevision','OV numeric audit revision crosses digit boundary correctly') from t.overview_revision;
select t.as_super();
\o
select 'Admin overview tests: '||(count(*)-(select n from t.overview_start))||' passed' from t.passed;
commit;
