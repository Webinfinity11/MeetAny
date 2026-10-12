-- Run only through run.sh, after flow_completion_tests.sql (reuses its fc_* fixtures).
-- list_attachments_many must return exactly what list_attachments returns per readable target.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.put('pab_missing',gen_random_uuid());

-- Offer files: only the request owner and the offering company.
select t.as_user('fc_b');
select t.ok(public.list_attachments_many('offer',array[t.get('fc_offer'),t.get('pab_missing')])
  =jsonb_build_object(t.get('fc_offer')::text,public.list_attachments('offer',t.get('fc_offer'))),'PAB owner batch equals single offer list; unknown target omitted');
select t.ok(jsonb_array_length(public.list_attachments_many('offer',array[t.get('fc_offer')])->t.get('fc_offer')::text)=1,'PAB owner sees the offer file');
select t.ok(not (public.list_attachments_many('offer',array[t.get('fc_offer')])->t.get('fc_offer')::text->0 ? 'content'),'PAB batch returns metadata only');
select t.ok(public.list_attachments_many('offer',array[t.get('fc_offer'),t.get('fc_offer')])
  =public.list_attachments_many('offer',array[t.get('fc_offer')]),'PAB duplicate targets collapse');
select t.as_user('fc_s');
select t.ok(public.list_attachments_many('offer',array[t.get('fc_offer')]) ? t.get('fc_offer')::text,'PAB offering company sees its offer files');
select t.as_user('fc_x');
select t.ok(public.list_attachments_many('offer',array[t.get('fc_offer')])='{}'::jsonb,'PAB unrelated company gets no offer files');
select t.as_anon();
select t.ok(public.list_attachments_many('offer',array[t.get('fc_offer')])='{}'::jsonb,'PAB anonymous gets no offer files');

-- Public request files and hidden requests.
select t.ok(public.list_attachments_many('request',array[t.get('fc_request')])
  =jsonb_build_object(t.get('fc_request')::text,public.list_attachments('request',t.get('fc_request'))),'PAB anonymous batch equals public request list');
select t.as_super();
update public.requests set hidden=true where id=t.get('fc_request');
select t.as_anon();
select t.ok(public.list_attachments_many('request',array[t.get('fc_request')])='{}'::jsonb,'PAB hidden request files not public');
select t.as_user('fc_b');
select t.ok(jsonb_array_length(public.list_attachments_many('request',array[t.get('fc_request')])->t.get('fc_request')::text)=5,'PAB owner keeps hidden request files');
select t.as_super();
update public.requests set hidden=false where id=t.get('fc_request');

-- Drafts stay owner-only, exactly like list_attachments.
select t.as_user('fc_x');
select t.ok(public.list_attachments_many('request_draft',array[t.get('fc_limit_draft')])->t.get('fc_limit_draft')::text='[]'::jsonb,'PAB other user sees no draft files');
select t.as_user('fc_c');
select t.ok(jsonb_array_length(public.list_attachments_many('request_draft',array[t.get('fc_limit_draft')])->t.get('fc_limit_draft')::text)=10,'PAB draft owner sees own draft files');

-- Bounds and grants.
select t.throws($q$select public.list_attachments_many('offer',(select array_agg(gen_random_uuid()) from generate_series(1,51)))$q$,'MA902','PAB more than 50 targets rejected');
select t.throws($q$select public.list_attachments_many('offer',null)$q$,'MA902','PAB null target list rejected');
select t.ok(public.list_attachments_many('offer','{}')='{}'::jsonb,'PAB empty target list returns empty object');
select t.as_super();
select t.ok(has_function_privilege('anonymous','public.list_attachments_many(text,uuid[])','EXECUTE'),'PAB anonymous may call batch list');
select t.ok(not has_function_privilege('public','public.list_attachments_many(text,uuid[])','EXECUTE'),'PAB no PUBLIC execute grant');
\o
select format('PERF ATTACHMENTS BATCH %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'PAB %';
