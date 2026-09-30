-- T12.4b: optional public company gallery (profiles.gallery, set_my_gallery).
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
select t.as_super();
create table t.gallery_start as select count(*) n from t.passed;
grant select on t.gallery_start to public;
select t.signup('gal_f', 'gallery.company@example.ge', '{"role":"company","name":"Gallery Owner","company":"Gallery Company","phone":"+995 522 881 101","city":"tbilisi","industry":"furniture"}');
select t.signup('gal_g', 'gallery.other@example.ge', '{"role":"company","name":"Gallery Other","company":"Other Gallery","phone":"+995 522 881 102","city":"batumi","industry":"furniture"}');
select t.signup('gal_c', 'gallery.client@example.ge', '{"role":"client","name":"Gallery Client","phone":"+995 522 881 103","city":"tbilisi"}');
select t.as_user('gal_f');
select t.ok((select gallery = '{}' from public.my_profile()), 'G new profile has an empty gallery');
select t.ok((public.set_my_gallery(array[t.photo('gal_f','gallery-a1.jpg'), ' '||t.photo('gal_f','gallery-b2.WEBP')||' ', '', t.photo('gal_f','gallery-a1.jpg')])).gallery
            = array[t.photo('gal_f','gallery-a1.jpg'), t.photo('gal_f','gallery-b2.WEBP')], 'G own photos accepted, trimmed, blanks and duplicates dropped, order kept');
select t.ok((public.set_my_gallery(array[t.photo('gal_f','gallery-b2.WEBP'), t.photo('gal_f','gallery-a1.jpg')])).gallery
            = array[t.photo('gal_f','gallery-b2.WEBP'), t.photo('gal_f','gallery-a1.jpg')], 'G reorder replaces the list');
select t.ok((public.update_my_profile('Gallery Owner','Gallery Company','tbilisi','furniture')).gallery
            = array[t.photo('gal_f','gallery-b2.WEBP'), t.photo('gal_f','gallery-a1.jpg')], 'G update_my_profile keeps the gallery');
select t.throws(format($$select public.set_my_gallery(%L::text[])$$,
  array(select t.photo('gal_f','gallery-'||i||'.jpg') from generate_series(1,9) i)), 'MA116', 'G nine photos rejected');
select t.throws(format($$select public.set_my_gallery(array[%L])$$, 'https://evil.example.com/'||t.uid('gal_f')||'/gallery-1.png'), 'MA116', 'G foreign domain rejected');
select t.throws(format($$select public.set_my_gallery(array[%L])$$, t.photo('gal_g','gallery-1.png')), 'MA116', 'G another user folder rejected');
select t.throws(format($$select public.set_my_gallery(array[%L])$$, t.photo('gal_f','logo-1.png')), 'MA116', 'G file without gallery- prefix rejected');
select t.throws(format($$select public.set_my_gallery(array[%L])$$, t.photo('gal_f','gallery-1.svg')), 'MA116', 'G non-raster file rejected');
select t.throws(format($$select public.set_my_gallery(array[%L])$$, t.photo('gal_f','gallery-1.png')||'?x=1'), 'MA116', 'G query string rejected');
select t.ok((select cardinality(gallery) = 2 from public.my_profile()), 'G rejected lists leave the current gallery');
select t.as_user('gal_c');
select t.throws($$select public.set_my_gallery(array[]::text[])$$, 'MA116', 'G clients cannot set a gallery');
select t.as_anon();
select t.throws($$select public.set_my_gallery(array[]::text[])$$, 'MA001', 'G anonymous cannot set a gallery');
select t.ok((select cardinality(gallery) = 2 from public.profiles where id=t.uid('gal_f')), 'G anonymous reads the public gallery');
select t.ok((select gallery[1] = t.photo('gal_f','gallery-b2.WEBP') from public.list_companies() where id=t.uid('gal_f')), 'G company catalog includes gallery');
select t.throws($$update public.profiles set gallery='{}'$$, '42501', 'G anonymous cannot write gallery');
select t.as_user('gal_g');
select t.throws($$update public.profiles set gallery='{}' where id=t.uid('gal_f')$$, '42501', 'G signed-in user cannot write gallery directly');
select t.as_user('admin');
select t.ok((select cardinality(gallery) = 2 from public.admin_list_users() where id=t.uid('gal_f')), 'G admin_list_users includes gallery');
select t.as_user('gal_f');
select t.ok((public.set_my_gallery(null)).gallery = '{}', 'G null clears the gallery');
select t.as_super();
select t.throws(format($$update public.profiles set gallery=array[%L] where id=t.uid('gal_f')$$, t.photo('gal_g','gallery-1.png')), '23514', 'G CHECK blocks another user folder');
select t.throws(format($$update public.profiles set gallery=%L::text[] where id=t.uid('gal_f')$$,
  array(select t.photo('gal_f','gallery-'||i||'.jpg') from generate_series(1,9) i)), '23514', 'G CHECK blocks more than 8 photos');
select t.throws($$update public.profiles set gallery=null where id=t.uid('gal_f')$$, '23502', 'G gallery is never null');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s GALLERY TESTS PASSED',count(*)-(select n from t.gallery_start)) from t.passed;
