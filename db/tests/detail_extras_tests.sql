-- Reuse the flow-completion fixtures, including private budget and attached files.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_anon();
select t.ok(public.request_detail_extras(t.get('fc_request'))->'preferences'=public.request_preferences(t.get('fc_request')),'DEX anonymous preferences match filtered legacy RPC');
select t.ok(not (public.request_detail_extras(t.get('fc_request'))->'preferences' ?| array['budgetMin','budgetMax']),'DEX private budget amounts stay private');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'attachments'=public.list_attachments('request',t.get('fc_request')),'DEX public request files match legacy RPC');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'offerAttachments'='{}'::jsonb,'DEX anonymous cannot read sealed offer attachments');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'businessFeatures'=public.company_business_features(),'DEX business features match legacy RPC');
select t.as_user('fc_b');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'preferences'=public.request_preferences(t.get('fc_request')),'DEX owner keeps private preferences');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'offerAttachments'->t.get('fc_offer')::text=public.list_attachments('offer',t.get('fc_offer')),'DEX owner sees offer files');
select t.as_user('fc_s');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'offerAttachments'->t.get('fc_offer')::text=public.list_attachments('offer',t.get('fc_offer')),'DEX supplier sees own offer files');
select t.as_user('fc_x');
select t.ok(not (public.request_detail_extras(t.get('fc_request'))->'offerAttachments' ? t.get('fc_offer')::text),'DEX unrelated supplier cannot read sealed offer files');
select t.as_anon();
select t.ok(public.company_detail_extras(t.uid('fc_s'))->'products'=public.company_products(t.uid('fc_s')),'DEX products match legacy RPC');
select t.ok(public.company_detail_extras(t.uid('fc_s'))->'reviews'=public.company_reviews(t.uid('fc_s')),'DEX reviews match legacy RPC');
select t.ok(public.company_detail_extras(t.uid('fc_s'))->'stats'=public.company_public_stats(t.uid('fc_s')),'DEX public stats match legacy RPC');
select t.throws($q$select public.request_detail_extras('00000000-0000-4000-8000-000000000000')$q$,'MA901','DEX missing request preserves denial');
select t.as_super();
update public.requests set hidden=true where id=t.get('fc_request');
select t.as_anon();
select t.throws($q$select public.request_detail_extras(t.get('fc_request'))$q$,'MA901','DEX hidden request denied anonymously');
select t.as_user('fc_b');
select t.ok(public.request_detail_extras(t.get('fc_request'))->'attachments'=public.list_attachments('request',t.get('fc_request')),'DEX owner retains hidden request access');
select t.as_super();
update public.requests set hidden=false where id=t.get('fc_request');
select t.ok(has_function_privilege('anonymous','public.request_detail_extras(uuid)','EXECUTE'),'DEX anonymous execute granted');
select t.ok(has_function_privilege('authenticated','public.company_detail_extras(uuid)','EXECUTE'),'DEX authenticated execute granted');
select t.ok(not has_function_privilege('public','public.request_detail_extras(uuid)','EXECUTE'),'DEX no PUBLIC request grant');
select t.ok(not has_function_privilege('public','public.company_detail_extras(uuid)','EXECUTE'),'DEX no PUBLIC company grant');
select t.ok(not (select prosecdef from pg_proc where oid='public.request_detail_extras(uuid)'::regprocedure),'DEX request wrapper is invoker');
\o
select format('DETAIL EXTRAS %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'DEX %';
