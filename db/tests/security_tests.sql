-- MeetAny security regression tests (findings of the adversarial reviews, ported to Neon).
-- Run through db/tests/run.sh AFTER rls_tests.sql, in the same database: it reuses the
-- t.* harness and the users created there ('admin' is the SQL-promoted admin).
-- Every assertion aborts the run with "TEST FAILED: <name>" on failure.

\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

select t.as_super();
create table t.sec_start as select count(*) as n from t.passed;
grant select on t.sec_start to public;

select t.signup('sec_c', 'sec.client@example.ge', '{"name":"Security Client","phone":"+995 511 000 001","city":"tbilisi"}');
select t.signup('sec_f', 'sec.company@example.ge', '{"role":"company","name":"Security Co","company":"Sec Co","phone":"+995 511 000 002","city":"tbilisi","industry":"food"}');
select t.signup('sec_g', 'sec.company2@example.ge', '{"role":"company","name":"Other Co","company":"Other Co","phone":"+995 511 000 003","city":"tbilisi","industry":"food"}');

-- ============================================================= S1. photos of hidden requests stay unlisted
-- (Blob files are public by URL but not listable without the server token; the only place the
--  database publishes a photo URL is requests.photo_url, which RLS hides with the request)
select t.as_user('sec_c');
select t.lives($$select t.put('sofa', (public.create_request('Sofa request', 'Sofa for my private flat', 'furniture', 'tbilisi',
  'https://abcd1234.public.blob.vercel-storage.com/' || auth.uid() || '/hidden-sofa.jpg')).id)$$, 'S1 request with photo');
select t.as_user('admin');
select t.lives(format('select public.admin_set_hidden(%L, true)', t.get('sofa')), 'S1 admin hides request');
select t.as_anon();
select t.ok((select count(*) from public.requests where id = t.get('sofa')) = 0, 'S1 hidden request invisible to anonymous');
select t.ok((select count(*) from public.requests where photo_url like '%hidden-sofa%') = 0, 'S1 hidden photo URL not listed to anonymous');
select t.as_user('sec_f');
select t.ok((select count(*) from public.requests where photo_url like '%hidden-sofa%') = 0, 'S1 hidden photo URL not listed to other users');
select t.ok((select count(*) from public.offer_counts(array[t.get('sofa')])) = 0, 'S1 offer_counts does not confirm a hidden request');
select t.as_user('sec_c');
select t.ok((select count(*) from public.requests where id = t.get('sofa')) = 1, 'S1 owner still sees own hidden request');

-- ============================================================= S2. no phone-number oracle
select t.as_super();
select t.ok(to_regprocedure('public.phone_available(text)') is null, 'S2 no public phone lookup RPC (spoofable IP throttle removed)');
select t.ok(not has_table_privilege('authenticated', 'meetany_private.settings', 'SELECT,INSERT,UPDATE'), 'S2 settings table not accessible to authenticated');
select t.ok(not has_table_privilege('anonymous', 'meetany_private.settings', 'SELECT,INSERT,UPDATE'), 'S2 settings table not accessible to anonymous');
select t.as_anon();
select t.throws($$select public.complete_profile('client', 'Probe', null, '+995 511 000 001', 'tbilisi', null)$$, '42501', 'S2 anonymous cannot probe numbers through complete_profile');
-- a user who already has a profile learns nothing from complete_profile, however often it is called
select t.as_user('sec_f');
do $$
declare i int; p public.profiles; same int := 0;
begin
  for i in 1..40 loop
    p := public.complete_profile('client', 'Probe Name', null, '+995 511 000 ' || lpad(i::text, 3, '0'), 'tbilisi', null);
    if p.id = t.uid('sec_f') and p.phone = '+995 511 000 002' then same := same + 1; end if;
  end loop;
  perform t.ok(same = 40, 'S2 completed user: 40 probes (taken and free numbers) all return the own unchanged profile');
end $$;
-- a user without a profile gets MA405 for a taken number, but the first free number ends the probing
select t.put('prober', t.auth_user('prober@example.ge'));
select t.as_id(t.get('prober'));
select t.throws($$select public.complete_profile('client', 'Prober', null, '+995 511 000 001', 'tbilisi', null)$$, 'MA405', 'S2 profile-less user: taken number -> MA405');
select t.lives($$select public.complete_profile('client', 'Prober', null, '+995 511 000 099', 'tbilisi', null)$$, 'S2 profile-less user: free number creates the profile');
select t.ok((select phone from public.complete_profile('client', 'Prober', null, '+995 511 000 001', 'tbilisi', null)) = '+995 511 000 099', 'S2 after that, taken numbers are no longer reported');

-- ============================================================= S3. photo_url origin is pinned to the Blob store
select t.as_user('sec_f');
select t.throws(format($$select public.create_request('Photo test 1', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://attacker.example/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 photo on foreign host -> MA109');
select t.throws(format($$select public.create_request('Photo test 2', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://abcd1234.public.blob.vercel-storage.com@attacker.example/' || t.uid('sec_f') || '/a.png'), 'MA109', 'S3 userinfo trick -> MA109');
select t.throws(format($$select public.create_request('Photo test 3', 'photo body text', 'food', 'tbilisi', %L)$$,
  'http://127.0.0.1:8080/' || t.uid('sec_f') || '/a.gif'), 'MA109', 'S3 plain http other host -> MA109');
select t.throws(format($$select public.create_request('Photo test 4', 'photo body text', 'food', 'tbilisi', %L)$$,
  'http://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 http downgrade of the store -> MA109');
select t.throws(format($$select public.create_request('Photo test 5', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://other1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 another Blob store -> MA109');
select t.throws(format($$select public.create_request('Photo test 5b', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://ep-test.neonauth.us-east-1.aws.neon.tech/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 JWT issuer origin is not a photo origin -> MA109');
select t.lives(format($$select t.put('photo_ok', (public.create_request('Photo test 6', 'photo body text', 'food', 'tbilisi', %L)).id)$$,
  'https://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/a.jpg'), 'S3 configured store photo accepted');
-- no configured origin -> no photo can be attached
select t.as_super();
delete from meetany_private.settings where key = 'photo_origin';
select t.as_user('sec_f');
select t.throws(format($$select public.create_request('Photo test 7', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 unset photo_origin -> MA109');
select t.lives($$select public.close_request((public.create_request('Photo test 7b', 'photo body text', 'food', 'tbilisi')).id)$$, 'S3 unset photo_origin: requests without photo still work');
-- malformed setting (path, userinfo) -> rejected rather than half-matched
select t.as_super();
insert into meetany_private.settings (key, value) values ('photo_origin', 'https://abcd1234.public.blob.vercel-storage.com/sub');
select t.as_user('sec_f');
select t.throws(format($$select public.create_request('Photo test 8', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://abcd1234.public.blob.vercel-storage.com/sub/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 photo_origin with a path is ignored -> MA109');
-- setting is normalized (case, surrounding space, trailing slash); a local http origin works for E2E
select t.as_super();
update meetany_private.settings set value = '  HTTP://127.0.0.1:3999/ ' where key = 'photo_origin';
select t.as_user('sec_f');
select t.lives(format($$select public.close_request((public.create_request('Photo test 9', 'photo body text', 'food', 'tbilisi', %L)).id)$$,
  'http://127.0.0.1:3999/' || t.uid('sec_f') || '/b-XyZ123.webp'), 'S3 configured local http origin accepted (normalized)');
select t.throws(format($$select public.create_request('Photo test 10', 'photo body text', 'food', 'tbilisi', %L)$$,
  'https://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/a.jpg'), 'MA109', 'S3 previous store no longer accepted after the setting changed');
select t.as_super();
update meetany_private.settings set value = 'https://abcd1234.public.blob.vercel-storage.com' where key = 'photo_origin';
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, photo_url) values (%L, 'direct photo', 'direct photo body', 'food', 'tbilisi', %L)$$,
  t.uid('sec_f'), 'https://x.public.blob.vercel-storage.com@attacker.example/' || t.uid('sec_f') || '/a.png'), '23514', 'S3 table CHECK rejects userinfo URLs');

-- ============================================================= S4. choose_offer vs. edited offer
select t.as_user('sec_c');
select t.put('bait', (public.create_request('Bait test', 'bait and switch test', 'food', 'tbilisi')).id);
select t.as_user('sec_f');
select t.put('o_bait', (public.send_offer(t.get('bait'), 'cheap offer ten lari', 10)).id);
select t.as_super();
create table t.seen as select updated_at from public.offers where id = t.get('o_bait');  -- what the author was shown
grant select on t.seen to public;
select t.as_user('sec_f');
select t.lives(format($$select public.send_offer(%L, 'cheap offer ten lari', 999999999)$$, t.get('bait')), 'S4 company edits price after the author looked');
select t.as_user('sec_c');
select t.throws(format($$select public.choose_offer(p_offer_id => %L, p_expected_updated_at => %L)$$, t.get('o_bait'), (select updated_at from t.seen)),
  'MA209', 'S4 choosing a stale offer version -> MA209');
select t.ok((select chosen_offer_id is null from public.requests where id = t.get('bait')), 'S4 nothing chosen after MA209');
select t.ok((select status from public.offers where id = t.get('o_bait')) = 'sent', 'S4 offer untouched after MA209');
select t.lives(format($$select public.choose_offer(p_offer_id => %L, p_expected_updated_at => %L)$$, t.get('o_bait'),
  (select updated_at from public.offers where id = t.get('o_bait'))), 'S4 choosing the version shown succeeds');
select t.ok((select status = 'chosen' and price = 999999999 from public.offers where id = t.get('o_bait')), 'S4 chosen at the price the author saw');
-- the one-argument call keeps working (no expected version = no check)
select t.put('bait2', (public.create_request('Bait test two', 'bait and switch test 2', 'food', 'tbilisi')).id);
select t.as_user('sec_g');
select t.put('o_bait2', (public.send_offer(t.get('bait2'), 'another offer text', 5)).id);
select t.as_user('sec_c');
select t.lives(format('select public.choose_offer(%L)', t.get('o_bait2')), 'S4 choose_offer(p_offer_id) without version still works');

-- ============================================================= S5. extend_request is capped
select t.put('ext', (public.create_request('Extend test', 'extend cap test body', 'food', 'tbilisi')).id);
select t.ok((select (public.extend_request(t.get('ext'))).expires_at - now() > interval '20 days 23 hours'), 'S5 first extension of a fresh request still adds 7 days');
select count(public.extend_request(t.get('ext'))) from generate_series(1, 60);
select t.ok((select expires_at <= now() + interval '21 days' from public.requests where id = t.get('ext')), 'S5 60 extensions stay within now() + 21 days');
select t.lives(format('select public.close_request(%L)', t.get('ext')), 'S5 close extend-test request');

-- ============================================================= S6. unverified sign-ups reserve nothing
-- (replaces the 24h squatting cleanup: a profile, and so a phone number, exists only after the
--  email code was verified)
select t.as_super();
select t.put('squat', t.auth_user('squatter@example.ge', false));
select t.as_id(t.get('squat'), true);  -- even with a forged-looking claim
select t.throws($$select public.complete_profile('client', 'Squat', null, '599123456', 'tbilisi', null)$$, 'MA408', 'S6 unverified account cannot take a number');
select t.as_super();
select t.ok(not exists (select 1 from public.profiles where phone = '+995 599 123 456'), 'S6 no reservation stored');
select t.lives($$select t.signup('real_owner', 'real.owner@example.ge', '{"name":"Real Owner","phone":"+995 599 123 456","city":"tbilisi"}')$$, 'S6 real owner registers the number at once');
select t.ok((select id from public.profiles where phone = '+995 599 123 456') = t.uid('real_owner'), 'S6 number belongs to the real owner');
select t.ok(exists (select 1 from neon_auth."user" where email = 'squatter@example.ge'), 'S6 schema never deletes Neon Auth users');
-- someone registered another person's address and never verified it: they cannot act
select t.as_id(t.get('squat'), true);
select t.throws($$select public.create_request('Squatter request', 'squatter wants to post', 'food', 'tbilisi')$$, 'MA001', 'S6 unverified account cannot create requests');

-- ============================================================= S7. blocked users get no contacts
-- bait2: sec_c's request, sec_g's offer chosen with the one-argument choose_offer
select t.as_user('sec_g');
select t.ok((select count(*) from public.contact_for_request(t.get('bait2'))) = 1, 'S7 chosen company gets author contact');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('sec_g')), 'S7 admin blocks chosen company');
select t.as_user('sec_g');
select t.ok((select count(*) from public.contact_for_request(t.get('bait2'))) = 0, 'S7 blocked company gets no contact');
select t.ok((select blocked from public.complete_profile('company', 'Unblock Me', 'Unblock', '+995 511 000 050', 'tbilisi', 'food')), 'S7 blocked company cannot reset itself via complete_profile');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('sec_c')), 'S7 admin blocks request author');
select t.as_user('sec_c');
select t.ok((select count(*) from public.contact_for_request(t.get('bait2'))) = 0, 'S7 blocked author gets no contact');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('sec_c')), 'S7 admin unblocks author');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('sec_g')), 'S7 admin unblocks company');
select t.as_user('sec_g');
select t.ok((select count(*) from public.contact_for_request(t.get('bait2'))) = 1, 'S7 unblocked company gets contact again');

-- ============================================================= S8. no SVG / markup through photo_url
select t.as_user('sec_f');
do $$
declare ext text;
begin
  foreach ext in array array['svg', 'SVG', 'svgz', 'xml', 'html', 'htm', 'xhtml', 'js', 'pdf', 'bmp', 'tiff', 'avif', 'heic'] loop
    perform t.throws(format($f$select public.create_request('SVG test', 'svg must be rejected', 'food', 'tbilisi', %L)$f$,
      'https://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/image.' || ext), 'MA109', 'S8 .' || ext || ' rejected');
  end loop;
end $$;
select t.throws(format($$select public.create_request('SVG test', 'svg must be rejected', 'food', 'tbilisi', %L)$$,
  'https://abcd1234.public.blob.vercel-storage.com/' || t.uid('sec_f') || '/image.svg.png/x'), 'MA109', 'S8 extension must end the URL');

-- ============================================================= summary
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s SECURITY TESTS PASSED', count(*) - (select n from t.sec_start)) as result from t.passed;
