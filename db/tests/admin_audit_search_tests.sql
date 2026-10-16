\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.signup('audit_needle','audit-needle@test.ge','{"role":"company","name":"Audit Needle Target","company":"Audit Needle Target","phone":"599886202","city":"tbilisi","industry":"furniture"}');
insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags,created_at)
 select t.uid('admin'),'user',t.uid('op_s'),'user.block','Audit search noise','{}','{}',now() from generate_series(1,30);
insert into meetany_private.moderation_audit(actor_id,target_type,target_id,action,reason,old_flags,new_flags,created_at)
 select t.uid('admin'),'user',t.uid('audit_needle'),'user.block','Audit search needle','{}','{}',now()-n*interval '2 days' from generate_series(0,2) n;
select t.as_user('op_s');
select t.throws($q$select public.admin_search_audit()$q$,'MA003','AS non-admin denied');
select t.as_user('admin');
select t.throws($q$select public.admin_search_audit(p_days=>999)$q$,'22023','AS invalid period rejected');
select t.throws($q$select public.admin_search_audit(p_q=>repeat('a',201))$q$,'22023','AS bounded query');
select t.ok((public.admin_search_audit(p_q=>'Needle Audit',p_limit=>2)->>'filteredTotal')::int=3,'AS searches all pages and all words');
select t.ok(jsonb_array_length(public.admin_search_audit(p_q=>'needle',p_limit=>2)->'items')=2,'AS bounded page');
select t.ok((public.admin_search_audit(p_q=>'needle',p_limit=>2)->>'hasMore')::boolean,'AS search cursor has more');
select t.ok(jsonb_array_length(public.admin_search_audit(p_q=>'needle',p_limit=>2,p_cursor=>public.admin_search_audit(p_q=>'needle',p_limit=>2)->'nextCursor')->'items')=1,'AS next cursor retains global filter');
select t.ok((public.admin_search_audit(p_q=>t.uid('audit_needle')::text)->>'filteredTotal')::int=3,'AS target UUID supported');
select t.ok((public.admin_search_audit(p_q=>'needle',p_days=>1)->>'filteredTotal')::int=1,'AS today filter counts whole matching history');
select t.ok((public.admin_search_audit(p_q=>'needle',p_action=>'user.unblock')->>'filteredTotal')::int=0,'AS action combined with query');
select t.ok((public.admin_search_audit(p_q=>'%')->>'filteredTotal')::int=0,'AS query wildcards are literal');
select t.as_super();
\o
select 'Admin audit search tests passed';
