-- Run only through run.sh, after 20261012-admin-management.sql: admin deals, verification status and
-- reasons, filters, request budget, issue outcomes, reviews list, notices and audit rows.
\set ON_ERROR_STOP 1
\o /dev/null
select t.as_super();

create function t.am_rev(k text) returns integer language sql as $$
  select revision from meetany_private.deals where id=t.get($1) $$;
create function t.am_audit(target uuid, act text) returns bigint language sql security definer as $$
  select count(*) from meetany_private.moderation_audit where target_id=$1 and action=$2 $$;
grant execute on function t.am_rev(text), t.am_audit(uuid,text) to public;

select t.signup('am_admin','am-admin@test.ge','{"role":"client","name":"AM Admin","company":"AM Admin","phone":"599771200","city":"tbilisi"}');
select t.signup('am_b','am-b@test.ge','{"role":"client","name":"AM Buyer","company":"AM Buyer Ltd","phone":"599771201","city":"tbilisi"}');
select t.signup('am_s','am-s@test.ge','{"role":"company","name":"AM Seller","company":"AM Seller Ltd","phone":"599771202","city":"tbilisi","industry":"other"}');
select t.signup('am_c','am-c@test.ge','{"role":"company","name":"AM Docs","company":"AM Docs Ltd","phone":"599771203","city":"tbilisi","industry":"other"}');
update public.profiles set role='admin' where id=t.uid('am_admin');
update public.profiles set verified=true,provide_categories=array['other'],need_categories=array['other'] where id=t.uid('am_s');

-- A deal in progress (with an issue later), one in discussion, and a request without a deal.
select t.as_user('am_b');
select t.put('am_r1',(public.create_request_full('AM progress request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('am_r2',(public.create_request_full('AM discuss request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.put('am_r3',(public.create_request_full('AM plain request','A meaningful request body','other','tbilisi',null,10,'pcs',current_date+7,'Warehouse','{}',gen_random_uuid())).id);
select t.as_user('am_s');
select t.put('am_o1',(public.send_offer(t.get('am_r1'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.put('am_o2',(public.send_offer(t.get('am_r2'),'A complete supplier offer',100,'total',true,5,true)).id);
select t.as_user('am_b');
select t.put('am_d1',(public.select_offer_deal(t.get('am_o1'))->>'id')::uuid);
select t.put('am_d2',(public.select_offer_deal(t.get('am_o2'))->>'id')::uuid);
select public.advance_deal(t.get('am_d1'),'discuss',t.am_rev('am_d1'));
select public.advance_deal(t.get('am_d2'),'discuss',t.am_rev('am_d2'));
select public.propose_deal_terms(t.get('am_d1'),t.am_rev('am_d1'),100,10,'pcs',5,current_date+5,'Tbilisi','50/50',array['VAT']);
select public.confirm_deal_terms(t.get('am_d1'),t.am_rev('am_d1'));
select t.as_user('am_s');
select public.confirm_deal_terms(t.get('am_d1'),t.am_rev('am_d1'));
select t.as_user('am_b');
select public.advance_deal(t.get('am_d1'),'progress',t.am_rev('am_d1'));

-- ============================================================= permissions: every new RPC is admin-only
select t.as_user('am_b');
select t.throws($q$select public.admin_list_deals()$q$,'MA003','AM list deals denied to non-admin');
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d2'),'cancelled','Not allowed here')$q$,'MA003','AM set deal stage denied to non-admin');
select t.throws($q$select public.admin_set_verified(t.uid('am_s'),false,'Not allowed here')$q$,'MA003','AM reasoned unverify denied to non-admin');
select t.throws($q$select public.review_verification(t.uid('am_c'),'rejected','Not allowed here')$q$,'MA003','AM review verification denied to non-admin');
select t.throws($q$select public.admin_search_users(p_doc_status=>'pending')$q$,'MA003','AM users search denied to non-admin');
select t.throws($q$select public.admin_set_request_preferences(t.get('am_r3'),'{}'::jsonb)$q$,'MA003','AM request preferences denied to non-admin');
select t.throws($q$select public.admin_search_offers(p_expired=>true)$q$,'MA003','AM offers search denied to non-admin');
select t.throws($q$select public.admin_resolve_deal_issue(gen_random_uuid(),'Not allowed here','rejected')$q$,'MA003','AM issue outcome denied to non-admin');
select t.throws($q$select public.admin_list_reviews()$q$,'MA003','AM reviews list denied to non-admin');
select t.throws($q$select public.admin_edit_profile(t.uid('am_c'),'{"legal_name":"Hijack Ltd"}')$q$,'MA003','AM profile edit denied to non-admin');
select t.as_anon();
select t.throws($q$select public.admin_list_deals()$q$,'42501','AM list deals not executable by anonymous');

-- ============================================================= deals list
select t.as_user('am_admin');
select t.ok((public.admin_list_deals()->>'filteredTotal')::int>=2,'AM admin lists every deal');
select t.ok((public.admin_list_deals(p_stage=>'progress',p_query=>'AM progress')->>'filteredTotal')::int=1,'AM stage and text filters combine');
select t.ok(public.admin_list_deals(p_query=>t.get('am_r2')::text)->'items'->0->>'id'=t.get('am_d2')::text,'AM deal found by request id');
select t.ok((public.admin_list_deals(p_query=>'AM progress')->'stageCounts'->>'progress')::int=1,'AM stage counts follow the text search');
select t.ok(public.admin_list_deals(p_query=>'AM Seller Ltd')->'items'->0->>'supplier_name'='AM Seller Ltd','AM rows carry party names');
select t.throws($q$select public.admin_list_deals(p_stage=>'paid')$q$,'22023','AM unknown stage rejected');

-- ============================================================= forced stage / cancel
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d2'),'cancelled','')$q$,'MA304','AM stage change needs a reason');
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d2'),'progress','Both parties agreed by phone')$q$,'MA905','AM progress still needs both confirmations');
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d2'),'discuss','Same stage again')$q$,'MA903','AM same stage rejected');
select t.ok(public.admin_set_deal_stage(t.get('am_d2'),'cancelled','Buyer asked support to cancel')->>'stage'='cancelled','AM admin cancels a deal');
select t.as_super();
select t.ok((select cancelled_at is not null from meetany_private.deals where id=t.get('am_d2')),'AM cancellation time set');
select t.as_user('am_admin');
select t.ok(t.am_audit(t.get('am_d2'),'deal.stage')=1,'AM stage change audited');
select t.as_super();
select t.ok((select reason='Buyer asked support to cancel' and old_flags->>'stage'='discuss' and new_flags->>'stage'='cancelled' from meetany_private.moderation_audit where target_id=t.get('am_d2') and action='deal.stage'),'AM audit row keeps reason and stages');
select t.as_user('am_admin');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.deal_events where deal_id=t.get('am_d2') and action='cancelled'),'AM cancellation is a deal event');
select t.as_user('am_admin');
select t.as_super();
select t.ok((select count(*) from meetany_private.notifications where deal_id=t.get('am_d2') and deal_action='cancelled' and user_id in (t.uid('am_b'),t.uid('am_s')))=2,'AM both parties notified');
select t.as_user('am_admin');
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d2'),'discuss','Reopen a cancelled deal')$q$,'MA903','AM finished deal stays finished');

-- ============================================================= issue outcomes
select t.as_user('am_b');
select public.open_deal_issue(t.get('am_d1'),t.am_rev('am_d1'),'late','Delivery is two weeks late');
select t.as_user('am_admin');
select t.throws($q$select public.admin_set_deal_stage(t.get('am_d1'),'cancelled','Cancel while an issue is open')$q$,'MA308','AM open issue must be resolved first');
select t.ok(exists(select 1 from jsonb_array_elements(public.admin_deal_issues()) x where x->>'deal_id'=t.get('am_d1')::text and x->>'actor_side'='buyer' and x->>'actor_name'='AM Buyer Ltd'),'AM issues carry author and side');
select t.put('am_i1',(select (x->>'id')::uuid from jsonb_array_elements(public.admin_deal_issues()) x where x->>'deal_id'=t.get('am_d1')::text and x->>'status'='open'));
select t.throws($q$select public.admin_resolve_deal_issue(t.get('am_i1'),'Looked into it','refunded')$q$,'MA902','AM unknown outcome rejected');
select public.admin_resolve_deal_issue(t.get('am_i1'),'Supplier confirmed the delay, deal cancelled','cancelled');
select t.as_super();
select t.ok((select status='resolved' and outcome='cancelled' from meetany_private.deal_issues where id=t.get('am_i1')),'AM issue closed with its outcome');
select t.as_user('am_admin');
select t.as_super();
select t.ok((select stage='cancelled' from meetany_private.deals where id=t.get('am_d1')),'AM cancelled outcome cancels the deal');
select t.as_user('am_admin');
select t.ok(t.am_audit(t.get('am_d1'),'deal.issue_resolve')=1,'AM issue resolution audited');
select t.as_super();
select t.ok((select new_flags->>'outcome'='cancelled' and new_flags->>'issue_id'=t.get('am_i1')::text from meetany_private.moderation_audit where target_id=t.get('am_d1') and action='deal.issue_resolve'),'AM audit row keeps the outcome');
select t.as_user('am_admin');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.deal_events where deal_id=t.get('am_d1') and action='issue_resolved')
  and exists(select 1 from meetany_private.deal_events where deal_id=t.get('am_d1') and action='cancelled'),'AM both deal events recorded');
select t.as_user('am_admin');
select t.ok((public.admin_list_audit_v2(p_target_type=>'deal')->>'filteredTotal')::int=2,'AM audit list filters deal targets');
select t.ok(public.admin_list_audit_v2(p_action=>'deal.issue_resolve')->'items'->0->>'target_name'='AM progress request','AM deal audit row named by its request');

-- ============================================================= delete guard
select t.throws($q$select public.admin_delete_request_v2(t.get('am_r1'),'Spam request')$q$,'MA305','AM request with a deal cannot be deleted');
select t.as_super();
select t.ok(exists(select 1 from public.requests where id=t.get('am_r1')),'AM guarded request still exists');
select t.as_user('am_admin');

-- ============================================================= budget and preferences
select t.throws($q$select public.admin_set_request_preferences(t.get('am_r3'),'{"budgetType":"range","budgetMin":500,"budgetMax":100}')$q$,'MA902','AM invalid budget range rejected');
select t.throws($q$select public.admin_set_request_preferences(t.get('am_r3'),'{"budgetMin":"cheap","budgetType":"exact"}')$q$,'MA902','AM non-numeric budget rejected');
select public.admin_set_request_preferences(t.get('am_r3'),'{"budgetType":"range","budgetMin":100,"budgetMax":500,"specification":"Oak"}');
select t.as_super();
select t.ok((select budget_type='range' and budget_min=100 and budget_max=500 from public.requests where id=t.get('am_r3')),'AM public budget synced');
select t.as_user('am_admin');
select t.ok(public.request_preferences(t.get('am_r3'))->>'specification'='Oak','AM preferences stored');
select public.admin_set_request_preferences(t.get('am_r3'),'{"budgetType":"exact","budgetMin":300,"budgetPrivate":true}');
select t.as_super();
select t.ok((select budget_type is null and budget_min is null from public.requests where id=t.get('am_r3')),'AM private budget leaves the public columns empty');
select t.as_user('am_admin');
select t.ok(t.am_audit(t.get('am_r3'),'request.preferences')=2,'AM preferences changes audited');

-- ============================================================= offers: expired filter
select t.as_super();
update public.offers set valid_until=current_date-1 where id=t.get('am_o2');
select t.as_user('am_admin');
select t.ok(exists(select 1 from jsonb_array_elements(public.admin_search_offers(p_expired=>true,p_limit=>100)->'items') x where x->>'id'=t.get('am_o2')::text),'AM expired offer listed as expired');
select t.ok(not exists(select 1 from jsonb_array_elements(public.admin_search_offers(p_expired=>false,p_limit=>100)->'items') x where x->>'id'=t.get('am_o2')::text),'AM expired offer excluded from current');
select t.ok(public.admin_search_offers(p_q=>t.get('am_o1')::text)->'items'->0->>'deal_id'=t.get('am_d1')::text,'AM offer row links its deal');

-- ============================================================= verification
select t.ok((public.admin_search_users(p_doc_status=>'pending')->>'filteredTotal')::int=0,'AM no pending documents yet');
select t.as_super();
update public.profiles set verification_documents_status='pending',legal_name='AM Docs LLC',registration_code='123456789' where id=t.uid('am_c');
select t.as_user('am_admin');
select t.ok(public.admin_search_users(p_doc_status=>'pending')->'items'->0->>'id'=t.uid('am_c')::text,'AM documents filter finds the pending company');
select t.throws($q$select public.admin_search_users(p_doc_status=>'lost')$q$,'22023','AM unknown documents status rejected');
select t.throws($q$select public.review_verification(t.uid('am_c'),'rejected','')$q$,'MA304','AM return needs a reason');
select public.review_verification(t.uid('am_c'),'rejected','Tax document is unreadable');
select t.as_super();
select t.ok((select not verified and verification_documents_status='rejected' and verification_note='Tax document is unreadable' from public.profiles where id=t.uid('am_c')),'AM returned documents keep the reason');
select t.as_user('am_admin');
select t.ok(t.am_audit(t.uid('am_c'),'company.verification_review')=1,'AM review has its own audit row');
select t.ok(public.verification_record(t.uid('am_c'))->>'note'='Tax document is unreadable','AM verification record shows the reason');
select t.as_super();
select t.ok((select count(*) from meetany_private.notifications where user_id=t.uid('am_c') and kind='verification_reviewed' and detail->>'status'='rejected' and detail->>'note'='Tax document is unreadable')=1,'AM company notified of the return');
select t.as_user('am_admin');
select t.as_user('am_c');
select t.ok(exists(select 1 from jsonb_array_elements(public.list_notifications()->'items') x where x->>'kind'='verification_reviewed' and x->>'title'='ვერიფიკაციის დოკუმენტები დაბრუნდა' and x->>'request_id' is null),'AM notice listed without a request');
select t.ok((public.engagement_state()->>'unread')::int>=1,'AM notice counts as unread');
select t.as_super();
update public.profiles set verification_documents_status='pending' where id=t.uid('am_c');
select t.as_user('am_admin');
select public.review_verification(t.uid('am_c'),'approved',null);
select t.as_super();
select t.ok((select verified and verified_at is not null and verification_documents_status='approved' and verification_note is null from public.profiles where id=t.uid('am_c')),'AM approval verifies and clears the reason');
select t.as_user('am_admin');
select t.ok(t.am_audit(t.uid('am_c'),'company.verify')=1,'AM approval audited as verify');
select t.throws($q$select public.admin_set_verified(t.uid('am_c'),false,'')$q$,'MA304','AM unverify needs a reason');
select public.admin_set_verified(t.uid('am_c'),false,'Registration was revoked');
select t.as_super();
select t.ok((select not verified and verification_documents_status='rejected' and verification_note='Registration was revoked' from public.profiles where id=t.uid('am_c')),'AM unverify returns the documents with the reason');
select t.as_user('am_admin');
select t.as_super();
select t.ok(exists(select 1 from meetany_private.moderation_audit where target_id=t.uid('am_c') and action='company.unverify' and reason='Registration was revoked'),'AM unverify reason audited');
select t.as_user('am_admin');
select public.admin_set_verified(t.uid('am_c'),true);
select t.as_super();
select t.ok((select verified and verification_documents_status='approved' from public.profiles where id=t.uid('am_c')),'AM legacy verify syncs the documents status');
select t.as_user('am_admin');

-- ============================================================= profile legal fields
select public.admin_edit_profile(t.uid('am_c'),'{"legal_name":"AM Docs Limited","registration_code":"987654321","legal_form":"შპს","website":"https://amdocs.ge","founded_year":2010,"employee_band":"8-50"}');
select t.as_super();
select t.ok((select legal_name='AM Docs Limited' and registration_code='987654321' and website='https://amdocs.ge' and founded_year=2010 and employee_band='8-50' from public.profiles where id=t.uid('am_c')),'AM legal fields editable by admin');
select t.as_user('am_admin');
select t.throws($q$select public.admin_edit_profile(t.uid('am_c'),'{"website":"amdocs"}')$q$,'23514','AM invalid website rejected by the column check');
select t.throws($q$select public.admin_edit_profile(t.uid('am_c'),'{"verified":true}')$q$,'22023','AM verification flag still not editable');

-- ============================================================= reviews list
select t.ok((public.admin_list_reviews()->>'total')::int>=0,'AM reviews list reads');
select t.throws($q$select public.admin_list_reviews(p_source=>'robot')$q$,'22023','AM unknown review source rejected');

-- ============================================================= report decisions notify the reporter
select t.as_user('am_s');
select t.put('am_rep',(public.report_content('request',t.get('am_r3'),'spam','Looks like advertising')->>'id')::uuid);
select t.as_user('am_admin');
select public.admin_resolve_report(t.get('am_rep'),'reject','Not spam after review');
select t.as_super();
select t.ok((select count(*) from meetany_private.notifications where user_id=t.uid('am_s') and kind='report_resolved' and detail->>'resolution'='rejected')=1,'AM reporter told the report was rejected');
select t.as_user('am_admin');
\o
select format('ADMIN MANAGEMENT V2 %s ASSERTIONS PASSED',count(*)) from t.passed where name like 'AM %';
