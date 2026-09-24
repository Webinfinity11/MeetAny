-- MeetAny tests: public company profiles (update_my_profile, company_stats) and request editing
-- (update_request). Run through db/tests/run.sh after rls_tests.sql and security_tests.sql, in the
-- same database: it reuses the t.* harness and the SQL-promoted 'admin' user.
-- Every assertion aborts the run with "TEST FAILED: <name>" on failure.

\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

select t.as_super();
create table t.pf_start as select count(*) as n from t.passed;
grant select on t.pf_start to public;

select t.signup('pf_c', 'pf.client@example.ge', '{"name":"Profile Client","phone":"+995 522 000 001","city":"batumi"}');
select t.signup('pf_f', 'pf.company@example.ge', '{"role":"company","name":"Levan Wood","company":"Wood Master","phone":"+995 522 000 002","city":"tbilisi","industry":"furniture"}');
select t.signup('pf_g', 'pf.rival@example.ge', '{"role":"company","name":"Rival Owner","company":"Rival Co","phone":"+995 522 000 003","city":"tbilisi","industry":"furniture"}');

-- ============================================================= P1. public profile columns
select t.as_anon();
select t.lives($$select id, role, company, industry, verified, city, about, offers, seeks, service_cities, created_at from public.profiles$$,
  'P1 anonymous reads the public profile columns');
select t.ok((select phone from public.profiles where id = t.uid('pf_f')) = '+995 522 000 002', 'P1 anonymous reads company phone');
select t.throws($$select email from public.profiles$$, '42501', 'P1 anonymous still cannot read email');
select t.throws($$select name from public.profiles$$, '42501', 'P1 anonymous cannot read the personal name');
select t.as_user('pf_g');
select t.ok((select phone from public.profiles where id = t.uid('pf_c')) = '+995 522 000 001', 'P1 other users read client phone');
select t.throws($$select email from public.profiles$$, '42501', 'P1 other users cannot read email');
select t.throws(format($$update public.profiles set about = 'hacked' where id = %L$$, t.uid('pf_f')), '42501', 'P1 no direct UPDATE on profiles');
select t.throws(format($$update public.profiles set verified = true where id = %L$$, t.uid('pf_g')), '42501', 'P1 cannot verify self with direct UPDATE');

-- ============================================================= P2. update_my_profile
select t.as_anon();
select t.throws($$select public.update_my_profile('Name', 'Co', 'tbilisi')$$, 'MA001', 'P2 anonymous -> MA001');

select t.as_user('pf_f');
select t.lives($$select public.update_my_profile('Levan Wood', '  Wood Master LLC ', 'tbilisi', 'furniture',
  '  We make hotel and restaurant furniture.  ',
  array['  Banquet chairs ', '', 'Tables to order', null],
  array['Timber supplier'],
  array['kutaisi', 'tbilisi', 'batumi', 'tbilisi'])$$, 'P2 company updates its profile');
select t.as_anon();
select t.ok((select company from public.profiles where id = t.uid('pf_f')) = 'Wood Master LLC', 'P2 company name trimmed');
select t.ok((select about from public.profiles where id = t.uid('pf_f')) = 'We make hotel and restaurant furniture.', 'P2 about trimmed');
select t.ok((select offers from public.profiles where id = t.uid('pf_f')) = array['Banquet chairs', 'Tables to order'], 'P2 empty list items dropped, order kept');
select t.ok((select seeks from public.profiles where id = t.uid('pf_f')) = array['Timber supplier'], 'P2 seeks stored');
select t.ok((select service_cities from public.profiles where id = t.uid('pf_f')) = array['tbilisi', 'batumi', 'kutaisi'], 'P2 service cities de-duplicated in fixed order');
select t.as_super();
select t.ok((select phone from public.profiles where id = t.uid('pf_f')) = '+995 522 000 002', 'P2 phone unchanged');
select t.ok((select role from public.profiles where id = t.uid('pf_f')) = 'company', 'P2 role unchanged');
select t.ok((select verified from public.profiles where id = t.uid('pf_f')) = false, 'P2 verified unchanged');

select t.as_user('pf_f');
select t.throws(format('select public.update_my_profile(%L, %L, %L, %L, %L)', 'Levan', 'Wood', 'tbilisi', 'furniture', repeat('x', 1001)), 'MA410', 'P2 about over 1000 -> MA410');
select t.lives(format('select public.update_my_profile(%L, %L, %L, %L, %L)', 'Levan Wood', 'Wood Master LLC', 'tbilisi', 'furniture', repeat('x', 1000)), 'P2 about of exactly 1000 accepted');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', 'furniture', '', array['1','2','3','4','5','6','7','8','9'])$$, 'MA411', 'P2 nine offers -> MA411');
select t.throws(format($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', 'furniture', '', array[%L])$$, repeat('y', 121)), 'MA411', 'P2 item over 120 -> MA411');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', 'furniture', '', '{}', array['1','2','3','4','5','6','7','8','9'])$$, 'MA411', 'P2 nine seeks -> MA411');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', 'furniture', '', '{}', '{}', array['tbilisi','paris'])$$, 'MA104', 'P2 unknown service city -> MA104');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'london', 'furniture')$$, 'MA104', 'P2 unknown city -> MA104');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', null)$$, 'MA407', 'P2 company without industry -> MA407');
select t.throws($$select public.update_my_profile('Levan', 'Wood', 'tbilisi', 'weapons')$$, 'MA407', 'P2 company unknown industry -> MA407');
select t.throws($$select public.update_my_profile('Levan', 'W', 'tbilisi', 'furniture')$$, 'MA402', 'P2 company name too short -> MA402');
select t.throws($$select public.update_my_profile('L', 'Wood', 'tbilisi', 'furniture')$$, 'MA401', 'P2 name too short -> MA401');

select t.as_user('pf_c');
select t.lives($$select public.update_my_profile('Profile Client', '', 'kutaisi', 'furniture')$$, 'P2 client updates with empty company');
select t.as_super();
select t.ok((select company from public.profiles where id = t.uid('pf_c')) = 'Profile Client', 'P2 client empty company falls back to name');
select t.ok((select industry from public.profiles where id = t.uid('pf_c')) is null, 'P2 client cannot set an industry');
select t.ok((select city from public.profiles where id = t.uid('pf_c')) = 'kutaisi', 'P2 client city updated');

select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('pf_g')), 'P2 admin blocks rival');
select t.as_user('pf_g');
select t.throws($$select public.update_my_profile('Rival Owner', 'Rival Co', 'tbilisi', 'furniture', 'spam')$$, 'MA002', 'P2 blocked user -> MA002');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('pf_g')), 'P2 admin unblocks rival');
-- a profile-less (verified, not completed) user cannot edit anything
select t.put('pf_nop', t.auth_user('pf.noprofile@example.ge'));
select t.as_id(t.get('pf_nop'));
select t.throws($$select public.update_my_profile('Nobody', 'Nobody', 'tbilisi')$$, 'MA001', 'P2 user without profile -> MA001');

-- ============================================================= P3. update_request
select t.as_user('pf_c');
select t.lives($$select t.put('pf_req', (public.create_request('Need 200 chairs', 'Stackable chairs for a hall', 'furniture', 'batumi')).id)$$, 'P3 client creates request');
select t.lives(format($$select public.update_request(%L, '  Need 300 chairs ', 'Stackable chairs for a bigger hall', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'P3 author edits request without offers');
select t.as_anon();
select t.ok((select title from public.requests where id = t.get('pf_req')) = 'Need 300 chairs', 'P3 edited title stored trimmed');
select t.ok((select city from public.requests where id = t.get('pf_req')) = 'tbilisi', 'P3 edited city stored');
select t.throws(format($$select public.update_request(%L, 'Anon edit', 'Anonymous edit attempt', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA001', 'P3 anonymous -> MA001');
select t.as_user('pf_g');
select t.throws(format($$select public.update_request(%L, 'Rival edit', 'Rival changes the request', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA107', 'P3 other user -> MA107');
select t.as_user('pf_c');
select t.throws(format($$select public.update_request(%L, 'Hi', 'Stackable chairs for a hall', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA101', 'P3 short title -> MA101');
select t.throws(format($$select public.update_request(%L, 'Need chairs', 'short', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA102', 'P3 short body -> MA102');
select t.throws(format($$select public.update_request(%L, 'Need chairs', 'Stackable chairs for a hall', 'weapons', 'tbilisi')$$, t.get('pf_req')), 'MA103', 'P3 bad category -> MA103');
select t.throws(format($$select public.update_request(%L, 'Need chairs', 'Stackable chairs for a hall', 'furniture', 'paris')$$, t.get('pf_req')), 'MA104', 'P3 bad city -> MA104');
select t.throws($$select public.update_request(gen_random_uuid(), 'Need chairs', 'Stackable chairs for a hall', 'furniture', 'tbilisi')$$, 'MA106', 'P3 unknown request -> MA106');

select t.as_user('pf_f');
select t.lives(format($$select t.put('pf_offer', (public.send_offer(%L, 'We can deliver 300 chairs in 10 days', 45)).id)$$, t.get('pf_req')), 'P3 company sends offer');
select t.as_user('pf_c');
select t.throws(format($$select public.update_request(%L, 'Need 900 chairs', 'Changed after the offer arrived', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA110', 'P3 request with an offer -> MA110');
select t.as_anon();
select t.ok((select title from public.requests where id = t.get('pf_req')) = 'Need 300 chairs', 'P3 terms unchanged after refused edit');

-- ============================================================= P4. company_stats
select t.as_user('pf_c');
select t.lives(format('select public.choose_offer(%L)', t.get('pf_offer')), 'P4 client chooses the offer');
select t.throws(format($$select public.update_request(%L, 'Need 900 chairs', 'Changed after choosing', 'furniture', 'tbilisi')$$, t.get('pf_req')), 'MA110', 'P4 chosen request -> MA110');
select t.as_anon();
select t.ok((select offers_sent from public.company_stats(array[t.uid('pf_f')])) = 1, 'P4 anonymous sees offers_sent');
select t.ok((select offers_chosen from public.company_stats(array[t.uid('pf_f')])) = 1, 'P4 anonymous sees offers_chosen');
select t.ok((select count(*) from public.company_stats(array[t.uid('pf_c')])) = 0, 'P4 client accounts have no company stats');
select t.ok((select count(*) from public.company_stats(null)) = 0, 'P4 null ids -> no rows');
select t.ok((select count(*) from public.company_stats(array[t.uid('pf_f'), t.uid('pf_g')])) = 2, 'P4 one row per company');
select t.ok((select offers_sent from public.company_stats(array[t.uid('pf_g')])) = 0, 'P4 company without offers -> 0');
select t.throws($$select body from public.offers$$, '42501', 'P4 offers stay sealed for anonymous');

-- ============================================================= P4b. blocked companies leave the catalog
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('pf_g')), 'P4b admin blocks rival company');
select t.as_anon();
select t.ok((select count(*) from public.list_companies() where id = t.uid('pf_g')) = 0, 'P4b blocked company left list_companies');
select t.throws($$select blocked from public.profiles$$, '42501', 'P4b blocked flag stays private');
select t.ok((select count(*) from public.list_companies() where id = t.uid('pf_f')) = 1, 'P4b active company stays in list_companies');
select t.ok((select count(*) from public.list_companies() where id = t.uid('pf_c')) = 0, 'P4b clients are not listed');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('pf_g')), 'P4b admin unblocks rival company');
select t.as_anon();
select t.ok((select count(*) from public.list_companies() where id = t.uid('pf_g')) = 1, 'P4b unblocked company is listed again');

-- ============================================================= P5. privileges on the new functions
select t.as_super();
select t.ok((select prosecdef from pg_proc where oid = 'public.update_my_profile(text,text,text,text,text,text[],text[],text[],text,double precision,double precision,text)'::regprocedure), 'P5 update_my_profile is security definer');
select t.ok((select 'search_path=""' = any (proconfig) from pg_proc where oid = 'public.update_my_profile(text,text,text,text,text,text[],text[],text[],text,double precision,double precision,text)'::regprocedure), 'P5 update_my_profile pins search_path');
select t.ok((select 'search_path=""' = any (proconfig) from pg_proc where oid = 'public.update_request(uuid,text,text,text,text,numeric,text,date,text)'::regprocedure), 'P5 update_request pins search_path');
select t.ok((select 'search_path=""' = any (proconfig) from pg_proc where oid = 'public.company_stats(uuid[])'::regprocedure), 'P5 company_stats pins search_path');
select t.ok(not has_function_privilege('public', 'public.update_my_profile(text,text,text,text,text,text[],text[],text[],text,double precision,double precision,text)', 'EXECUTE'), 'P5 PUBLIC cannot execute update_my_profile');

-- ============================================================= summary
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s PROFILE TESTS PASSED', count(*) - (select n from t.pf_start)) as result from t.passed;
