-- Run via run.sh in its disposable database.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
create table t.qa_round_start as select count(*) n from t.passed;
grant select on t.qa_round_start to public;
select t.signup('qa_company','qa-company@test.ge','{"role":"company","name":"QA Company","company":"QA Company","phone":"599882081","city":"tbilisi","industry":"other"}');
select t.as_user('qa_company');
select t.ok(jsonb_array_length(public.set_my_products((select jsonb_agg(jsonb_build_object('name','Product '||n)) from generate_series(1,100) n)))=100,'QA 100 products saved without photos');
select t.throws($q$select public.set_my_products((select jsonb_agg(jsonb_build_object('name','Product '||n)) from generate_series(1,101) n))$q$,'MA622','QA 101 products rejected');
select t.ok(jsonb_array_length(public.company_products(t.uid('qa_company')))=100,'QA rejected write preserves all 100 products');
select t.ok(public.set_my_products('[{"name":" Chair ","photoUrl":null},{"name":"Table","photoUrl":""}]')->0 = '{"name":"Chair","photoUrl":null,"note":""}'::jsonb,'QA optional null photo and trimmed name');
select t.ok(public.company_products(t.uid('qa_company'))->1->>'photoUrl'='','QA empty photo preserved and publicly visible');
select t.ok(public.set_my_products('[{"name":"Chair","code":"001-ABC","unit":"pcs","price":12.50,"note":" Note "}]')->0 = '{"name":"Chair","code":"001-ABC","unit":"pcs","price":12.50,"photoUrl":null,"note":"Note"}'::jsonb,'QA import fields preserve code and numeric price');
select t.as_anon();
select t.ok(public.company_products(t.uid('qa_company'))->0->>'code'='001-ABC' and public.company_products(t.uid('qa_company'))->0->'price'='12.50'::jsonb,'QA guest sees import fields without photo');
select t.throws('select public.verification_requirements()','42501','QA anonymous requirements denied');
select t.as_user('qa_company');
select t.ok(jsonb_array_length(public.set_my_products((select jsonb_agg(jsonb_build_object('name','Product','unit',u)) from unnest(array['pcs','m2','kg','hour','service','m','l','set','pack']) u)))=9,'QA all import units accepted');
select t.ok(public.set_my_products(jsonb_build_array(jsonb_build_object('name',repeat('n',80),'code',repeat('c',40),'note',repeat('x',200),'price',1000000000)))->0->>'price'='1000000000','QA maximum field lengths and price accepted');
select t.ok(public.set_my_products('[{"name":"OK","price":0}]')->0->'price'='0'::jsonb,'QA zero price accepted');
-- Each malformed value must use the product error, including bad numeric types.
do $$
declare bad jsonb;
begin
 for bad in select value from jsonb_array_elements('[null,1,{}, {"name":"x"},{"name":null},{"name":12},{"name":"OK","photoUrl":false},{"name":"OK","photoUrl":"https://example.com/photo.png"},{"name":"OK","code":1},{"name":"OK","code":null},{"name":"OK","unit":"invalid"},{"name":"OK","unit":1},{"name":"OK","unit":null},{"name":"OK","price":"12"},{"name":"OK","price":null},{"name":"OK","price":true},{"name":"OK","price":-1},{"name":"OK","price":1000000001},{"name":"OK","note":null}]'::jsonb) loop
  perform t.throws(format('select public.set_my_products(%L::jsonb)',jsonb_build_array(bad)::text),'MA622','QA malformed product '||bad::text);
 end loop;
end $$;
select t.throws($q$select public.set_my_products(null)$q$,'MA622','QA null array rejected');
select t.throws($q$select public.set_my_products(jsonb_build_array(jsonb_build_object('name',repeat('n',81))))$q$,'MA622','QA long name rejected');
select t.throws($q$select public.set_my_products(jsonb_build_array(jsonb_build_object('name','OK','code',repeat('c',41))))$q$,'MA622','QA long code rejected');
select t.throws($q$select public.set_my_products(jsonb_build_array(jsonb_build_object('name','OK','note',repeat('n',201))))$q$,'MA622','QA long note rejected');
select public.set_my_gallery(array[t.photo('qa_company','gallery-qa.jpg')]);
select public.set_my_products(jsonb_build_array(jsonb_build_object('name','With photo','photoUrl',t.photo('qa_company','gallery-qa.jpg')),jsonb_build_object('name','No photo')));
select public.set_my_gallery('{}');
select t.ok(public.company_products(t.uid('qa_company'))='[{"name":"No photo","photoUrl":null,"note":""}]'::jsonb,'QA removed gallery photo hidden while photoless product remains');

select t.ok(public.verification_requirements()='{"legal_name":false,"registration_code":false,"registration_document":false,"tax_document":false}'::jsonb,'QA requirements start missing');
select t.ok((public.set_onboarding_details('both',null,null,'{}','{}',null,null,null,null,null,'{}','{}')).legal_name is null,'QA onboarding details accepts null legal fields');
select t.ok((public.update_my_profile('QA Company','QA Company','tbilisi','other',repeat('a',1000))).about=repeat('a',1000),'QA about 1000 characters accepted');
select t.throws($q$select public.update_my_profile('QA Company','QA Company','tbilisi','other',repeat('a',1001))$q$,'MA410','QA about 1001 characters rejected');
select public.update_my_profile('QA Company','QA Company','tbilisi','other','');
select t.ok((public.complete_onboarding()).onboarding_completed_at is not null and (select about='' from public.my_profile()),'QA onboarding completes with empty about and without any legal fields');
select t.ok((select legal_name is null and registration_code is null and legal_form is null and employee_band is null and founded_year is null and not verified from public.my_profile()),'QA optional fields stay null and completion does not verify');
select t.throws('select public.submit_verification()','MA902','QA legal fields still required for verification');
select public.set_onboarding_details('both',null,null,'{}','{}','QA Legal',null,null,null,null,'{}','{}');
select t.ok(public.verification_requirements()='{"legal_name":true,"registration_code":false,"registration_document":false,"tax_document":false}'::jsonb,'QA requirements identify missing registration code');
select public.set_onboarding_details('both',null,null,'{}','{}','QA Legal','405882081',null,null,null,'{}','{}');
select t.ok(public.verification_requirements()='{"legal_name":true,"registration_code":true,"registration_document":false,"tax_document":false}'::jsonb,'QA requirements identify both missing documents');
select t.throws('select public.submit_verification()','MA902','QA missing registration document rejected');
select t.fc_file('verification',t.uid('qa_company'),'application/pdf',convert_to('%PDF-test','UTF8'),'registration');
select t.ok(public.verification_requirements()='{"legal_name":true,"registration_code":true,"registration_document":true,"tax_document":false}'::jsonb,'QA requirements identify missing tax document');
select t.throws('select public.submit_verification()','MA902','QA missing tax document rejected');
select t.fc_file('verification',t.uid('qa_company'),'application/pdf',convert_to('%PDF-test','UTF8'),'tax');
select t.ok(public.verification_requirements()='{"legal_name":true,"registration_code":true,"registration_document":true,"tax_document":true}'::jsonb,'QA all four requirements satisfied');
select t.ok((public.submit_verification()).verification_documents_status='pending' and (select logo_url is null and not verified from public.my_profile()),'QA verification submitted without logo');
select t.as_user('fc_c');
select t.throws('select public.verification_requirements()','MA901','QA client requirements denied');
select t.throws('select public.complete_onboarding()','MA901','QA client onboarding completion denied');
select t.as_user('fc_x');
select t.ok(public.verification_requirements()->'registration_document'='false'::jsonb and public.verification_requirements()->'tax_document'='false'::jsonb,'QA requirements never expose another company documents');
select t.as_super();
update public.profiles set blocked=true where id=t.uid('qa_company');
select t.as_anon();
select t.ok(public.company_products(t.uid('qa_company'))='[]'::jsonb,'QA blocked photoless products hidden');
select t.as_super();
select t.throws($q$update meetany_private.company_products set items=(select jsonb_agg(jsonb_build_object('name','Product')) from generate_series(1,101)) where company_id=t.uid('qa_company')$q$,'23514','QA table constraint rejects 101 products');
\o
select 'QA round tests: '||(count(*)-(select n from t.qa_round_start))||' passed' from t.passed;
