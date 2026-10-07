\set ON_ERROR_STOP 1
select t.as_user('flow_s');
select public.set_matching_categories(array['other'],array['other']);
select t.throws($q$select public.set_matching_categories(array['invalid'],'{}')$q$,'MA902','FLOW unknown category rejected');
select t.throws($q$select public.set_matching_categories(null,'{}')$q$,'MA902','FLOW null category list rejected');
select t.as_user('flow_b');
select t.ok(jsonb_array_length(public.list_matching(t.get('flow_r')))=1,'FLOW request finds matching supplier');
select t.ok((public.list_matching(t.get('flow_r'))->0->>'score')::integer=100,'FLOW category plus city scores 100');
select t.throws($q$select public.set_matching_categories('{}','{}')$q$,'MA901','FLOW client cannot set company categories');
select t.as_super();
insert into public.requests(id,owner_id,title,body,category,city) values(t.put('flow_match_r',gen_random_uuid()),t.uid('flow_b'),'Matching request','Matching request body','other','batumi');
select t.as_user('flow_s');
select t.ok((public.list_matching()->0->>'score')::integer=70,'FLOW other city scores 70');
select t.ok(public.list_matching(null,'tbilisi')='[]','FLOW city filter excludes mismatch and chosen requests');
select t.as_user('flow_x');
select t.throws($q$select public.list_matching(t.get('flow_r'))$q$,'MA901','FLOW other owner matching denied');
select t.as_anon();
select t.throws('select public.list_matching()','42501','FLOW guest matching denied');
select t.as_super();
