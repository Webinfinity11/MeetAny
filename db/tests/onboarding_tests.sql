\set ON_ERROR_STOP 1
select t.as_user('flow_s');
select t.ok((public.set_onboarding_details('both','8-50',2020,array['GE'],array['ka'],'Seller Legal','405123456','LLC','Director','https://example.ge',array['coffee'],array['ISO'])).account_intent='both','FLOW onboarding saved');
select t.throws($q$select public.set_onboarding_details('admin','8-50',2020,'{}','{}',null,null,null,null,null,'{}','{}')$q$,'MA902','FLOW intent cannot become admin');
select t.throws($q$select public.set_onboarding_details('buy','8-50',2199,'{}','{}',null,null,null,null,null,'{}','{}')$q$,'MA902','FLOW future foundation rejected');
select t.throws($q$select public.admin_set_document_status(t.uid('flow_s'),'approved')$q$,'MA003','FLOW company cannot verify itself');
select t.throws('select registration_code from public.profiles','42501','FLOW legal identity not public');
select t.as_anon();
select t.throws('select verification_documents_status from public.profiles','42501','FLOW documents status private');
select t.as_super();
select t.as_user('flow_a');
select t.ok(public.admin_set_document_status(t.uid('flow_s'),'pending')='pending','FLOW admin records document status');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.business_audit where target_id=t.uid('flow_s') and action='document_status'),'FLOW document moderation audited');
select t.as_user('flow_s');
select t.ok((public.my_profile()).verification_documents_status='pending','FLOW own document status readable');
select t.ok((public.set_onboarding_details('both','8-50',2020,array['GE'],array['ka'],'Changed Legal','405123456','LLC','Director','https://example.ge',array['coffee'],array['ISO'])).verification_documents_status='not_submitted','FLOW identity change resets document review');
select t.as_super();
