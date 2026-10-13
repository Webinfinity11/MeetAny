\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();
select t.signup('cc_admin','cc-admin@test.ge','{"role":"client","name":"CC Admin","phone":"599882100","city":"tbilisi"}');
select t.signup('cc_user','cc-user@test.ge','{"role":"company","name":"CC User","company":"CC Company","phone":"599882101","city":"tbilisi","industry":"other"}');
select t.signup('cc_other','cc-other@test.ge','{"role":"client","name":"CC Other","phone":"599882102","city":"tbilisi"}');
update public.profiles set role='admin' where id=t.uid('cc_admin');
select t.as_anon();
select t.throws($q$select public.admin_apply_contact_change(gen_random_uuid())$q$,'42501','CC anonymous cannot execute apply');
select t.as_user('cc_user');
select t.throws($q$select public.request_contact_change('abc',null,'')$q$,'MA711','CC invalid phone rejected');
select t.throws($q$select public.request_contact_change(null,'bad','')$q$,'MA711','CC invalid email rejected');
select t.throws($q$select public.request_contact_change(null,null,'')$q$,'MA711','CC empty change rejected');
select t.put('cc_report',(public.request_contact_change('599882103','NEW-CONTACT@test.ge','[qa] new contact')->>'id')::uuid);
select t.throws($q$select public.request_contact_change('599882104',null,'')$q$,'MA710','CC duplicate open request rejected');
select t.throws($q$select public.admin_apply_contact_change(t.get('cc_report'))$q$,'MA003','CC requester cannot approve own request');
-- Exercise upgrade of an already-filed request from the body-only RPC.
select t.as_super();
update meetany_private.reports set payload=null where id=t.get('cc_report');
\ir ../migrations/20261013-contact-change-admin.sql
select t.ok((select payload->>'phone'='+995 599 882 103' and payload->>'note'='[qa] new contact' from meetany_private.reports where id=t.get('cc_report')),'CC legacy pending payload backfilled');
select t.as_user('cc_admin');
select t.ok(exists(select 1 from jsonb_array_elements(public.admin_list_reports()->'items') i where i->>'id'=t.get('cc_report')::text and (i->>'target_exists')::boolean and i->>'target_label'='CC Company' and i->'payload'->>'phone'='+995 599 882 103' and i->'payload'->>'email'='new-contact@test.ge' and i->>'current_phone'='+995 599 882 101'),'CC admin list exposes structured intent and existing profile');
select t.throws($q$select public.admin_resolve_report(t.get('cc_report'),'hide','Do not hide')$q$,'22023','CC contact request cannot block profile');
select t.ok(public.admin_apply_contact_change(t.get('cc_report'),'[qa] checked')->>'resolution'='applied','CC admin applies change');
select t.throws($q$select public.admin_apply_contact_change(t.get('cc_report'))$q$,'MA706','CC replay rejected');
select t.as_super();
select t.ok((select phone='+995 599 882 103' and email='new-contact@test.ge' from public.profiles where id=t.uid('cc_user')),'CC profile contact changed');
select t.ok((select email='cc-user@test.ge' from neon_auth."user" where id=t.uid('cc_user')),'CC auth login email unchanged');
select t.ok((select status='handled' and resolution='applied' from meetany_private.reports where id=t.get('cc_report')),'CC request handled');
select t.ok(exists(select 1 from meetany_private.moderation_audit where target_id=t.uid('cc_user') and action='edit_profile' and old_flags->>'phone'='+995 599 882 101' and new_flags->>'phone'='+995 599 882 103'),'CC old and new contacts audited');
select t.ok(exists(select 1 from meetany_private.notifications where user_id=t.uid('cc_user') and detail->>'report_id'=t.get('cc_report')::text),'CC requester notified on apply');
select t.as_user('cc_user');
select t.put('cc_conflict',(public.request_contact_change('599882102',null,'[qa] conflict')->>'id')::uuid);
select t.as_user('cc_admin');
select t.throws($q$select public.admin_apply_contact_change(t.get('cc_conflict'))$q$,'MA405','CC duplicate phone fails atomically');
select t.as_super();
select t.ok((select status='new' from meetany_private.reports where id=t.get('cc_conflict')),'CC failed apply leaves request open');
select t.ok((select phone='+995 599 882 103' from public.profiles where id=t.uid('cc_user')),'CC failed apply preserves profile');
select t.as_user('cc_admin');
select public.admin_resolve_report(t.get('cc_conflict'),'reject','[qa] ნომერი უკვე გამოყენებულია');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.notifications where user_id=t.uid('cc_user') and detail->>'report_id'=t.get('cc_conflict')::text and detail->>'resolution_reason'='[qa] ნომერი უკვე გამოყენებულია' and detail->>'resolution' like '%ნომერი უკვე გამოყენებულია%'),'CC rejection notice includes visible reason');
select t.as_user('cc_user');
select t.put('cc_email',(public.request_contact_change(null,'email-only@test.ge','[qa] email only')->>'id')::uuid);
select t.as_user('cc_admin');
select public.admin_apply_contact_change(t.get('cc_email'));
select t.as_super();
select t.ok((select phone='+995 599 882 103' and email='email-only@test.ge' from public.profiles where id=t.uid('cc_user')),'CC null phone preserves current phone');
\o
\echo 'contact change admin tests passed'
