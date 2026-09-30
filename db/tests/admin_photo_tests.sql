-- T12.4c: admin_remove_company_photo (logo or gallery photo, audited, reason required).
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
select t.as_super();
create table t.photo_start as select count(*) n from t.passed;
grant select on t.photo_start to public;
select t.signup('ph_f', 'photo.company@example.ge', '{"role":"company","name":"Photo Owner","company":"Photo Company","phone":"+995 522 881 201","city":"tbilisi","industry":"furniture"}');
select t.signup('ph_c', 'photo.client@example.ge', '{"role":"client","name":"Photo Client","phone":"+995 522 881 202","city":"tbilisi"}');
select t.as_user('ph_f');
select public.update_my_profile('Photo Owner','Photo Company','tbilisi','furniture',p_logo_url=>t.photo('ph_f','logo-a.png'));
select public.set_my_gallery(array[t.photo('ph_f','gallery-1.jpg'), t.photo('ph_f','gallery-2.jpg')]);
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'spam')$$, t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg')), 'MA003', 'P company cannot use the admin function');
select t.as_user('ph_c');
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'spam')$$, t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg')), 'MA003', 'P client cannot use the admin function');
select t.as_anon();
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'spam')$$, t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg')), '42501', 'P anonymous cannot call it');
select t.as_user('admin');
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,null)$$, t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg')), 'MA304', 'P reason is required');
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'x')$$, t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg')), 'MA304', 'P reason shorter than 3 rejected');
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'spam')$$, t.uid('ph_f'), t.photo('ph_f','gallery-9.jpg')), 'MA305', 'P unknown photo rejected');
select t.throws(format($$select public.admin_remove_company_photo(%L,%L,'spam')$$, gen_random_uuid(), t.photo('ph_f','gallery-1.jpg')), 'MA302', 'P unknown user rejected');
select t.ok((public.admin_remove_company_photo(t.uid('ph_f'), t.photo('ph_f','gallery-1.jpg'), 'არასათანადო ფოტო')).gallery = array[t.photo('ph_f','gallery-2.jpg')], 'P gallery photo removed, others kept in order');
select t.ok((select logo_url = t.photo('ph_f','logo-a.png') from public.profiles where id=t.uid('ph_f')), 'P gallery removal keeps the logo');
select t.ok((public.admin_remove_company_photo(t.uid('ph_f'), t.photo('ph_f','logo-a.png'), 'სხვისი ლოგო')).logo_url is null, 'P logo removed');
select t.ok((select cardinality(gallery) = 1 from public.profiles where id=t.uid('ph_f')), 'P logo removal keeps the gallery');
select t.ok((select count(*) = 2 from jsonb_array_elements((public.admin_list_audit_v2(p_action=>'user.photo_remove'))->'items') x where x->>'target_id' = t.uid('ph_f')::text), 'P both removals audited and filterable');
select t.ok((select (x->'old_flags'->>'url') = t.photo('ph_f','logo-a.png') from jsonb_array_elements((public.admin_list_audit_v2(p_action=>'user.photo_remove',p_limit=>1))->'items') x), 'P audit keeps the removed url');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s ADMIN PHOTO TESTS PASSED',count(*)-(select n from t.photo_start)) from t.passed;
