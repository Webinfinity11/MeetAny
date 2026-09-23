-- T10.8: public optional addresses and coordinate pairs.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null
select t.as_super();
create table t.address_start as select count(*) n from t.passed;
grant select on t.address_start to public;
select t.signup('addr_c', 'addr.client@example.ge', '{"name":"Address Client","phone":"+995 522 880 001","city":"tbilisi"}');
select t.signup('addr_f', 'addr.company@example.ge', '{"role":"company","name":"Address Owner","company":"Address Company","phone":"+995 522 880 002","city":"batumi","industry":"furniture"}');
select t.as_user('addr_f');
select t.lives($$select public.update_my_profile('Address Owner','Address Company','batumi','furniture',p_address=>'  ქუჩა 12  ',p_lat=>41.6,p_lng=>41.7)$$, 'A company writes address');
select t.as_anon();
select t.ok((select address='ქუჩა 12' and lat=41.6 and lng=41.7 from public.profiles where id=t.uid('addr_f')), 'A anonymous reads trimmed address and coordinates');
select t.ok((select address='ქუჩა 12' and lat=41.6 and lng=41.7 from public.list_companies() where id=t.uid('addr_f')), 'A company catalog includes address');
select t.throws($$select email from public.profiles$$,'42501','A private email remains private');
select t.as_user('addr_c');
select t.lives($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_address=>repeat('ა',200),p_lat=>-90,p_lng=>180)$$,'A client address and global coordinate boundaries accepted');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_address=>repeat('ა',201))$$,'MA412','A profile address length rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>1)$$,'MA413','A missing longitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lng=>1)$$,'MA413','A missing latitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>90.1,p_lng=>0)$$,'MA413','A high latitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>-90.1,p_lng=>0)$$,'MA413','A low latitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>0,p_lng=>180.1)$$,'MA413','A high longitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>0,p_lng=>-180.1)$$,'MA413','A low longitude rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>'NaN',p_lng=>0)$$,'MA413','A NaN rejected');
select t.throws($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>0,p_lng=>'Infinity')$$,'MA413','A infinity rejected');
select t.ok((public.update_my_profile('Address Client','Address Client','tbilisi',p_address=>'   ')).address is null,'A empty address becomes null');
select t.lives($$select public.update_my_profile('Address Client','Address Client','tbilisi',p_lat=>90,p_lng=>-180)$$,'A opposite coordinate boundaries accepted');
select t.ok((public.update_my_profile('Address Client','Address Client','tbilisi',p_address=>null,p_lat=>null,p_lng=>null)).lat is null,'A explicit null clears coordinates');
select t.lives($$select public.update_my_profile('Address Client','Address Client','tbilisi')$$,'A old profile invocation works');
select t.ok((select address is null and lat is null and lng is null from public.my_profile()),'A omitted optional fields cleared');
select t.put('addr_req',(public.create_request('Address request','Address request description','furniture','tbilisi',p_address_note=>'  ვაკე  ')).id);
select t.ok((select address_note from public.requests where id=t.get('addr_req'))='ვაკე','A request create trims address note');
select t.throws($$select public.create_request('Address request','Address request description','furniture','tbilisi',p_address_note=>repeat('ა',121))$$,'MA114','A create rejects long address note');
select t.ok((public.update_request(t.get('addr_req'),'Address request','Address request description','furniture','tbilisi',p_address_note=>repeat('ა',120))).address_note=repeat('ა',120),'A edit accepts 120 characters');
select t.throws($$select public.update_request(t.get('addr_req'),'Address request','Address request description','furniture','tbilisi',p_address_note=>repeat('ა',121))$$,'MA114','A edit rejects long address note');
select t.ok((public.update_request(t.get('addr_req'),'Address request','Address request description','furniture','tbilisi')).address_note is null,'A old edit works and clears note');
select t.ok((public.create_request('Old address request','Address request description','furniture','tbilisi')).address_note is null,'A old create works');
select t.ok((public.update_request(t.get('addr_req'),'Address request','Address request description','furniture','tbilisi',p_address_note=>'  ')).address_note is null,'A empty request note becomes null');
select t.as_super();
select t.throws($$update public.profiles set lat=1,lng=null where id=t.uid('addr_c')$$,'23514','A owner cannot bypass coordinate pair constraint');
select t.throws($$update public.profiles set address=repeat('a',201) where id=t.uid('addr_c')$$,'23514','A owner cannot bypass address length');
select t.throws($$update public.requests set address_note=repeat('a',121) where id=t.get('addr_req')$$,'23514','A owner cannot bypass note length');
select t.throws($$update public.profiles set lat=91,lng=0 where id=t.uid('addr_c')$$,'23514','A owner cannot bypass coordinate range');
select t.throws($$update public.profiles set address=' untrimmed ' where id=t.uid('addr_c')$$,'23514','A owner cannot store untrimmed address');
select t.as_user('admin');
select public.admin_set_blocked(t.uid('addr_f'),true);
select t.as_anon();
select t.ok(not exists(select address,lat,lng from public.profiles where id=t.uid('addr_f')),'A blocked address hidden by RLS');
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s ADDRESS TESTS PASSED',count(*)-(select n from t.address_start)) from t.passed;
