-- T12.4a: optional public company logo (profiles.logo_url, update_my_profile p_logo_url).
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
select t.as_super();
create table t.logo_start as select count(*) n from t.passed;
grant select on t.logo_start to public;
select t.signup('logo_f', 'logo.company@example.ge', '{"role":"company","name":"Logo Owner","company":"Logo Company","phone":"+995 522 881 001","city":"tbilisi","industry":"furniture"}');
select t.signup('logo_g', 'logo.other@example.ge', '{"role":"company","name":"Logo Other","company":"Other Company","phone":"+995 522 881 002","city":"batumi","industry":"furniture"}');
select t.as_user('logo_f');
select t.ok((select logo_url is null from public.my_profile()), 'L new profile has no logo');
select t.ok((public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>t.photo('logo_f','logo-m1a2b3-Xy9Zq.png'))).logo_url
            = t.photo('logo_f','logo-m1a2b3-Xy9Zq.png'), 'L own Blob logo accepted');
select t.ok((public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>'  '||t.photo('logo_f','logo-2.WEBP')||'  ')).logo_url
            = t.photo('logo_f','logo-2.WEBP'), 'L logo trimmed, webp accepted');
select t.ok((public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture')).logo_url = t.photo('logo_f','logo-2.WEBP'), 'L omitted logo keeps the current one');
select t.ok((public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>null)).logo_url = t.photo('logo_f','logo-2.WEBP'), 'L null logo keeps the current one');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  'https://evil.example.com/'||t.uid('logo_f')||'/logo-1.png'), 'MA115', 'L foreign domain rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  'https://abcd1234.public.blob.vercel-storage.com.evil.com/'||t.uid('logo_f')||'/logo-1.png'), 'MA115', 'L look-alike domain rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  t.photo('logo_g','logo-1.png')), 'MA115', 'L another user folder rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  t.photo('logo_f','photo-1.png')), 'MA115', 'L file without logo- prefix rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  t.photo('logo_f','logo-1.svg')), 'MA115', 'L non-raster logo rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  t.photo('logo_f','logo-1.png')||'?x=1'), 'MA115', 'L query string rejected');
select t.throws(format($$select public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>%L)$$,
  t.photo('logo_f','sub/logo-1.png')), 'MA115', 'L nested folder rejected');
select t.ok((select logo_url = t.photo('logo_f','logo-2.WEBP') from public.my_profile()), 'L rejected logos leave the current one');
select t.as_anon();
select t.ok((select logo_url = t.photo('logo_f','logo-2.WEBP') from public.profiles where id=t.uid('logo_f')), 'L anonymous reads the public logo');
select t.ok((select logo_url = t.photo('logo_f','logo-2.WEBP') from public.list_companies() where id=t.uid('logo_f')), 'L company catalog includes logo_url');
select t.throws($$update public.profiles set logo_url=null$$, '42501', 'L anonymous cannot write logo_url');
select t.as_user('logo_g');
select t.throws($$update public.profiles set logo_url=null where id=t.uid('logo_f')$$, '42501', 'L signed-in user cannot write logo_url directly');
select t.as_user('admin');
select t.ok((select logo_url = t.photo('logo_f','logo-2.WEBP') from public.admin_list_users() where id=t.uid('logo_f')), 'L admin_list_users includes logo_url');
select t.ok((select (x->>'logo_url') = t.photo('logo_f','logo-2.WEBP') from jsonb_array_elements((public.admin_search_users(p_q=>'logo.company@example.ge'))->'items') x), 'L admin_search_users includes logo_url');
select t.as_user('logo_f');
select t.ok((public.update_my_profile('Logo Owner','Logo Company','tbilisi','furniture',p_logo_url=>'')).logo_url is null, 'L empty string removes the logo');
select t.ok((select logo_url is null from public.list_companies() where id=t.uid('logo_f')), 'L removed logo is null in the catalog');
select t.as_super();
select t.throws(format($$update public.profiles set logo_url=%L where id=t.uid('logo_f')$$, t.photo('logo_g','logo-1.png')), '23514', 'L CHECK blocks another user folder');
select t.throws($$update public.profiles set logo_url='https://abcd1234.public.blob.vercel-storage.com/x/logo.png' where id=t.uid('logo_f')$$, '23514', 'L CHECK blocks a folder that is not a uuid');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s LOGO TESTS PASSED',count(*)-(select n from t.logo_start)) from t.passed;
