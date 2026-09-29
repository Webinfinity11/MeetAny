-- MeetAny tests: structured request terms (quantity / unit / needed_by), offer terms
-- (price_type / vat_included / delivery_days / delivery_included) and profiles.verified_at.
-- Run through db/tests/run.sh after profile_tests.sql, in the same database: it reuses the t.*
-- harness and the SQL-promoted 'admin' user.
-- Every assertion aborts the run with "TEST FAILED: <name>" on failure.

\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

select t.as_super();
create table t.fl_start as select count(*) as n from t.passed;
grant select on t.fl_start to public;
-- Tbilisi calendar date, the reference for needed_by
create function t.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Tbilisi')::date $$;
grant execute on function t.today() to public;

select t.signup('fl_c', 'fl.client@example.ge', '{"name":"Fields Client","phone":"+995 533 000 001","city":"tbilisi"}');
select t.signup('fl_d', 'fl.client2@example.ge', '{"name":"Other Client","phone":"+995 533 000 002","city":"tbilisi"}');
select t.signup('fl_f', 'fl.company@example.ge', '{"role":"company","name":"Giorgi Box","company":"Box Factory","phone":"+995 533 000 003","city":"tbilisi","industry":"packaging"}');
select t.signup('fl_g', 'fl.rival@example.ge', '{"role":"company","name":"Rival Box","company":"Rival Box","phone":"+995 533 000 004","city":"rustavi","industry":"packaging"}');

-- ============================================================= F1. create_request: quantity / unit / needed_by
select t.as_user('fl_c');
select t.lives(format($$select t.put('fl_req', (public.create_request('Branded boxes 5000', 'Printed boxes with our logo, 3 colours',
  'packaging', 'tbilisi', null, 5000, 'pcs', %L)).id)$$, t.today() + 20), 'F1 request with quantity, unit and needed_by');
select t.as_anon();
select t.ok((select quantity = 5000 and unit = 'pcs' and needed_by = t.today() + 20 from public.requests where id = t.get('fl_req')),
  'F1 anonymous reads quantity, unit, needed_by');
select t.as_user('fl_c');
select t.lives($$select t.put('fl_old', (public.create_request('Old style request', 'Created with the four argument call', 'packaging', 'tbilisi')).id)$$,
  'F1 four-argument create_request still works');
select t.ok((select quantity is null and unit is null and needed_by is null from public.requests where id = t.get('fl_old')), 'F1 old call stores null terms');
select t.lives($$select public.close_request((public.create_request(p_title => 'Named args request', p_body => 'Named arguments like the Data API',
  p_category => 'packaging', p_city => 'batumi', p_quantity => 12.3456, p_unit => 'kg')).id)$$, 'F1 named-argument call (Data API shape)');
select t.ok((select quantity = 12.346 and unit = 'kg' from public.requests where title = 'Named args request'), 'F1 quantity rounded to 3 decimals');
select t.lives($$select public.close_request((public.create_request('Unit only request', 'Unit given without a quantity', 'packaging', 'tbilisi', null, null, 'm2')).id)$$,
  'F1 unit without quantity accepted');
select t.ok((select quantity is null and unit is null from public.requests where title = 'Unit only request'), 'F1 unit without quantity is dropped');
select t.lives($$select public.close_request((public.create_request('Max quantity', 'Quantity of exactly one billion', 'packaging', 'tbilisi', null, 1000000000, 'service')).id)$$,
  'F1 quantity 1e9 accepted');
select t.lives(format($$select public.close_request((public.create_request('Today needed', 'Needed by today is allowed', 'packaging', 'tbilisi', null, 1, 'hour', %L)).id)$$, t.today()),
  'F1 needed_by today accepted');
select t.lives(format($$select public.close_request((public.create_request('Far needed', 'Needed by in two years is allowed', 'packaging', 'tbilisi', null, null, null, %L)).id)$$, (t.today() + interval '2 years')::date),
  'F1 needed_by today + 2 years accepted');

select t.throws($$select public.create_request('Bad quantity', 'Zero quantity must fail', 'packaging', 'tbilisi', null, 0, 'pcs')$$, 'MA111', 'F1 quantity 0 -> MA111');
select t.throws($$select public.create_request('Bad quantity', 'Negative quantity must fail', 'packaging', 'tbilisi', null, -3, 'pcs')$$, 'MA111', 'F1 negative quantity -> MA111');
select t.throws($$select public.create_request('Bad quantity', 'Huge quantity must fail', 'packaging', 'tbilisi', null, 1000000000.001, 'pcs')$$, 'MA111', 'F1 quantity > 1e9 -> MA111');
select t.throws($$select public.create_request('Bad quantity', 'NaN quantity must fail', 'packaging', 'tbilisi', null, 'NaN', 'pcs')$$, 'MA111', 'F1 quantity NaN -> MA111');
select t.throws($$select public.create_request('Bad quantity', 'Tiny quantity must fail', 'packaging', 'tbilisi', null, 0.0001, 'pcs')$$, 'MA111', 'F1 quantity rounding to 0 -> MA111');
select t.throws($$select public.create_request('Bad unit', 'Quantity without a unit', 'packaging', 'tbilisi', null, 10)$$, 'MA112', 'F1 quantity without unit -> MA112');
select t.throws($$select public.create_request('Bad unit', 'Unknown unit must fail', 'packaging', 'tbilisi', null, 10, 'ton')$$, 'MA112', 'F1 unknown unit -> MA112');
select t.throws($$select public.create_request('Bad unit', 'Georgian label is not a key', 'packaging', 'tbilisi', null, 10, 'ცალი')$$, 'MA112', 'F1 unit label instead of key -> MA112');
select t.throws(format($$select public.create_request('Bad date', 'Needed by yesterday must fail', 'packaging', 'tbilisi', null, null, null, %L)$$, t.today() - 1), 'MA113', 'F1 needed_by yesterday -> MA113');
select t.throws(format($$select public.create_request('Bad date', 'Needed by too far must fail', 'packaging', 'tbilisi', null, null, null, %L)$$, (t.today() + interval '2 years 1 day')::date), 'MA113', 'F1 needed_by beyond 2 years -> MA113');
select t.throws($$select public.create_request('Hi', 'Short title checked first', 'packaging', 'tbilisi', null, 0, 'pcs')$$, 'MA101', 'F1 existing checks come first (MA101 before MA111)');
select t.as_anon();
select t.throws($$select public.create_request('Anon request', 'Anonymous with quantity', 'packaging', 'tbilisi', null, 5, 'pcs')$$, 'MA001', 'F1 anonymous -> MA001');

-- table CHECK holds even for SQL-editor writes
select t.as_super();
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, quantity) values (%L, 'direct qty', 'direct quantity body', 'food_fresh', 'tbilisi', 5)$$, t.uid('fl_c')),
  '23514', 'F1 table CHECK: quantity needs unit');
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, unit) values (%L, 'direct unit', 'direct unit only body', 'food_fresh', 'tbilisi', 'pcs')$$, t.uid('fl_c')),
  '23514', 'F1 table CHECK: unit needs quantity');
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, quantity, unit) values (%L, 'direct unit', 'direct bad unit body', 'food_fresh', 'tbilisi', 5, 'ton')$$, t.uid('fl_c')),
  '23514', 'F1 table CHECK: unknown unit');
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, quantity, unit) values (%L, 'direct unit', 'direct zero qty body', 'food_fresh', 'tbilisi', 0, 'pcs')$$, t.uid('fl_c')),
  '23514', 'F1 table CHECK: quantity > 0');
select t.as_user('fl_c');
select t.throws(format($$update public.requests set quantity = 1 where id = %L$$, t.get('fl_req')), '42501', 'F1 no direct UPDATE of quantity');

-- ============================================================= F2. update_request terms
select t.lives(format($$select public.update_request(%L, 'Branded boxes 6000', 'Printed boxes with our logo, 3 colours', 'packaging', 'tbilisi', 6000, 'pcs', %L)$$,
  t.get('fl_req'), t.today() + 30), 'F2 author changes quantity and date');
select t.ok((select quantity = 6000 and needed_by = t.today() + 30 from public.requests where id = t.get('fl_req')), 'F2 new terms stored');
select t.throws(format($$select public.update_request(%L, 'Branded boxes 6000', 'Printed boxes with our logo, 3 colours', 'packaging', 'tbilisi', -1, 'pcs')$$, t.get('fl_req')), 'MA111', 'F2 update: bad quantity -> MA111');
select t.throws(format($$select public.update_request(%L, 'Branded boxes 6000', 'Printed boxes with our logo, 3 colours', 'packaging', 'tbilisi', 5, null)$$, t.get('fl_req')), 'MA112', 'F2 update: quantity without unit -> MA112');
select t.throws(format($$select public.update_request(%L, 'Branded boxes 6000', 'Printed boxes with our logo, 3 colours', 'packaging', 'tbilisi', 5, 'pcs', %L)$$, t.get('fl_req'), t.today() - 3), 'MA113', 'F2 update: past date -> MA113');
select t.ok((select quantity = 6000 from public.requests where id = t.get('fl_req')), 'F2 refused update changed nothing');
select t.lives(format($$select public.update_request(%L, 'Old style request', 'Created with the four argument call', 'packaging', 'tbilisi', 2, 'm2', %L)$$, t.get('fl_old'), t.today() + 1), 'F2 terms added to an old request');
select t.lives(format($$select public.update_request(%L, 'Old style request', 'Edited with the five argument call', 'packaging', 'tbilisi')$$, t.get('fl_old')), 'F2 five-argument update_request still works');
select t.ok((select quantity is null and unit is null and needed_by is null from public.requests where id = t.get('fl_old')), 'F2 omitted terms are cleared (full replacement)');
-- a needed_by date that has passed since it was set may be kept while editing other fields
select t.as_super();
update public.requests set needed_by = t.today() - 5 where id = t.get('fl_old');
select t.as_user('fl_c');
select t.lives(format($$select public.update_request(%L, 'Old style request!', 'Edited with the stored past date', 'packaging', 'tbilisi', null, null, %L)$$, t.get('fl_old'), t.today() - 5), 'F2 unchanged past needed_by accepted');
select t.throws(format($$select public.update_request(%L, 'Old style request!', 'Moved to another past date', 'packaging', 'tbilisi', null, null, %L)$$, t.get('fl_old'), t.today() - 4), 'MA113', 'F2 different past needed_by -> MA113');
select t.as_user('fl_d');
select t.throws(format($$select public.update_request(%L, 'Hijack boxes', 'Other user changes terms', 'packaging', 'tbilisi', 1, 'pcs')$$, t.get('fl_req')), 'MA107', 'F2 other user -> MA107');

-- ============================================================= F3. send_offer terms
select t.as_user('fl_f');
select t.lives(format($$select t.put('fl_of', (public.send_offer(p_request_id => %L, p_body => 'Printed boxes, 3 colours, own design team',
  p_price => 1.85, p_price_type => 'unit', p_vat_included => true, p_delivery_days => 12, p_delivery_included => true)).id)$$, t.get('fl_req')),
  'F3 company sends a unit-price offer with VAT and delivery');
select t.ok((select price = 1.85 and price_type = 'unit' and vat_included and delivery_days = 12 and delivery_included
             from public.offers where id = t.get('fl_of')), 'F3 offer terms stored');
select t.throws(format($$select public.send_offer(%L, 'Negotiable but with a price', 100, 'negotiable')$$, t.get('fl_req')), 'MA211', 'F3 negotiable with price -> MA211');
select t.throws(format($$select public.send_offer(%L, 'Unit price without amount', null, 'unit')$$, t.get('fl_req')), 'MA212', 'F3 unit without price -> MA212');
select t.throws(format($$select public.send_offer(%L, 'Total price without amount', null, 'total')$$, t.get('fl_req')), 'MA212', 'F3 total without price -> MA212');
select t.throws(format($$select public.send_offer(%L, 'Unknown price type here', 10, 'free')$$, t.get('fl_req')), 'MA210', 'F3 unknown price type -> MA210');
select t.throws(format($$select public.send_offer(%L, 'Empty price type string', 10, '')$$, t.get('fl_req')), 'MA210', 'F3 empty price type -> MA210');
select t.throws(format($$select public.send_offer(%L, 'Negative delivery days', 10, 'total', false, -1)$$, t.get('fl_req')), 'MA213', 'F3 delivery days -1 -> MA213');
select t.throws(format($$select public.send_offer(%L, 'Too many delivery days', 10, 'total', false, 366)$$, t.get('fl_req')), 'MA213', 'F3 delivery days 366 -> MA213');
select t.throws(format($$select public.send_offer(%L, 'Zero unit price offer', 0, 'unit')$$, t.get('fl_req')), 'MA205', 'F3 unit price 0 -> MA205');
select t.throws(format($$select public.send_offer(%L, 'short', 10, 'free')$$, t.get('fl_req')), 'MA204', 'F3 body checked before price type');
select t.ok((select price = 1.85 and price_type = 'unit' and delivery_days = 12 from public.offers where id = t.get('fl_of')), 'F3 refused edits changed nothing');
select t.lives(format($$select public.send_offer(%L, 'Boxes by agreement after a call', null, 'negotiable', true, 0, false)$$, t.get('fl_req')), 'F3 edit to negotiable, 0 delivery days');
select t.ok((select id = t.get('fl_of') and price is null and price_type = 'negotiable' and not vat_included and delivery_days = 0 and not delivery_included
             and updated_at > created_at from public.offers where id = t.get('fl_of')), 'F3 upsert replaced all terms; negotiable stores no VAT flag');
select t.lives(format($$select public.send_offer(%L, 'Boxes, total for the batch', 9800, 'total', false, 365)$$, t.get('fl_req')), 'F3 total price, 365 delivery days');
select t.ok((select price = 9800 and price_type = 'total' and delivery_days = 365 from public.offers where id = t.get('fl_of')), 'F3 total offer stored');
-- old three-argument clients
select t.as_user('fl_g');
select t.lives(format($$select t.put('fl_og', (public.send_offer(%L, 'Rival boxes, price per batch', 7500)).id)$$, t.get('fl_req')), 'F3 three-argument send_offer with price');
select t.ok((select price_type = 'total' and not vat_included and delivery_days is null and not delivery_included from public.offers where id = t.get('fl_og')), 'F3 old call with price -> total, defaults');
select t.lives(format($$select public.send_offer(%L, 'Rival boxes, price after a call', null)$$, t.get('fl_req')), 'F3 three-argument send_offer without price');
select t.ok((select price is null and price_type = 'negotiable' from public.offers where id = t.get('fl_og')), 'F3 old call without price -> negotiable');
select t.lives(format($$select public.send_offer(p_request_id => %L, p_body => 'Rival boxes, contact us for details')$$, t.get('fl_req')), 'F3 UI can omit both price arguments');
select t.ok((select price is null and price_type = 'negotiable' from public.offers where id = t.get('fl_og')), 'F3 omitted price arguments store negotiable');
select t.lives(format($$select public.send_offer(%L, 'Rival boxes, per box price', 1.5, 'unit', true, 7)$$, t.get('fl_req')), 'F3 rival unit offer');
select t.as_super();
select t.throws(format($$insert into public.offers (request_id, company_id, body, price, price_type) values (%L, %L, 'direct negotiable offer', 5, 'negotiable')$$,
  t.get('fl_old'), t.uid('fl_f')), '23514', 'F3 table CHECK: negotiable has no price');
select t.throws(format($$insert into public.offers (request_id, company_id, body, price, price_type) values (%L, %L, 'direct total offer', null, 'total')$$,
  t.get('fl_old'), t.uid('fl_f')), '23514', 'F3 table CHECK: total needs a price');
select t.throws(format($$insert into public.offers (request_id, company_id, body, price, price_type, delivery_days) values (%L, %L, 'direct delivery offer', 5, 'total', 400)$$,
  t.get('fl_old'), t.uid('fl_f')), '23514', 'F3 table CHECK: delivery days range');

-- ============================================================= F4. offer terms stay sealed
select t.as_anon();
select t.throws($$select price_type from public.offers$$, '42501', 'F4 anonymous cannot read price_type');
select t.throws($$select vat_included, delivery_days, delivery_included from public.offers$$, '42501', 'F4 anonymous cannot read offer terms');
select t.ok((select offers from public.offer_counts(array[t.get('fl_req')])) = 2, 'F4 anonymous still gets the count only');
select t.as_user('fl_d');
select t.ok((select count(*) from public.offers where request_id = t.get('fl_req')) = 0, 'F4 other client sees no offer rows');
select t.ok((select count(*) from public.offers where price_type is not null and request_id = t.get('fl_req')) = 0, 'F4 other client cannot filter by price_type');
select t.as_user('fl_g');
select t.ok((select count(*) from public.offers where request_id = t.get('fl_req')) = 1, 'F4 rival company sees only its own offer');
select t.ok((select count(*) from public.offers where id = t.get('fl_of')) = 0, 'F4 rival company cannot read the other offer terms');
select t.ok((select count(*) from public.offers where request_id = t.get('fl_req') and price_type = 'total') = 0, 'F4 rival cannot probe price_type of other offers');
select t.as_user('fl_c');
select t.ok((select count(*) from public.offers where request_id = t.get('fl_req')) = 2, 'F4 request author sees both offers');
select t.ok((select price_type = 'unit' and vat_included and delivery_days = 7 from public.offers where id = t.get('fl_og')), 'F4 author reads the terms');
select t.as_user('admin');
select t.ok((select count(*) from public.offers where request_id = t.get('fl_req')) = 2, 'F4 admin sees offers');

-- ============================================================= F5. choose after a terms edit
select t.as_super();
create table t.fl_seen as select updated_at from public.offers where id = t.get('fl_og');
grant select on t.fl_seen to public;
select t.as_user('fl_g');
select t.lives(format($$select public.send_offer(%L, 'Rival boxes, per box price', 1.5, 'unit', false, 7)$$, t.get('fl_req')), 'F5 rival changes only the VAT flag');
select t.as_user('fl_c');
select t.throws(format($$select public.choose_offer(%L, %L)$$, t.get('fl_og'), (select updated_at from t.fl_seen)), 'MA209', 'F5 VAT change after the author looked -> MA209');
select t.lives(format($$select public.choose_offer(%L, %L)$$, t.get('fl_og'), (select updated_at from public.offers where id = t.get('fl_og'))), 'F5 choosing the shown version');
select t.throws(format($$select public.update_request(%L, 'Branded boxes 9000', 'Printed boxes with our logo, 3 colours', 'packaging', 'tbilisi', 9000, 'pcs')$$, t.get('fl_req')), 'MA110', 'F5 terms of an answered request stay (MA110)');
select t.as_user('fl_f');
select t.throws(format($$select public.send_offer(%L, 'Late edit of the offer terms', 5, 'total')$$, t.get('fl_req')), 'MA203', 'F5 no offer edits after choosing');

-- ============================================================= F6. verified_at
select t.as_anon();
select t.lives($$select id, verified, verified_at from public.profiles$$, 'F6 anonymous reads verified_at');
select t.ok((select verified_at is null from public.profiles where id = t.uid('fl_f')), 'F6 new company has no verified_at');
select t.as_user('fl_f');
select t.throws(format($$update public.profiles set verified_at = now() where id = %L$$, t.uid('fl_f')), '42501', 'F6 no direct UPDATE of verified_at');
select t.throws(format('select public.admin_set_verified(%L, true)', t.uid('fl_f')), 'MA003', 'F6 company cannot verify itself');
select t.as_user('admin');
select t.lives(format('select public.admin_set_verified(%L, true)', t.uid('fl_f')), 'F6 admin verifies company');
select t.as_anon();
select t.ok((select verified and verified_at between now() - interval '1 minute' and now() + interval '1 minute' from public.profiles where id = t.uid('fl_f')), 'F6 verified_at set to now');
select t.ok((select verified_at is not null from public.list_companies() where id = t.uid('fl_f')), 'F6 list_companies returns verified_at');
select t.ok((select verified_at is null from public.list_companies() where id = t.uid('fl_g')), 'F6 list_companies: unverified -> null');
select t.as_super();
update public.profiles set verified_at = '2026-01-15T10:00:00Z' where id = t.uid('fl_f');
select t.as_user('admin');
select t.lives(format('select public.admin_set_verified(%L, true)', t.uid('fl_f')), 'F6 admin verifies again');
select t.as_anon();
select t.ok((select verified_at = '2026-01-15T10:00:00Z'::timestamptz from public.profiles where id = t.uid('fl_f')), 'F6 re-verifying keeps the original date');
select t.as_user('fl_f');
select t.ok((select verified_at is not null from public.my_profile()), 'F6 my_profile returns verified_at');
select t.as_user('admin');
select t.lives(format('select public.admin_set_verified(%L, false)', t.uid('fl_f')), 'F6 admin removes verification');
select t.as_anon();
select t.ok((select not verified and verified_at is null from public.profiles where id = t.uid('fl_f')), 'F6 unverify clears verified_at');
select t.as_user('admin');
select t.throws(format('select public.admin_set_verified(%L, true)', t.uid('fl_c')), 'MA303', 'F6 client cannot be verified');
select t.as_anon();
select t.ok((select verified_at is null from public.profiles where id = t.uid('fl_c')), 'F6 client verified_at stays null');
-- SQL-editor path keeps the pair consistent (trigger)
select t.as_super();
update public.profiles set verified = true where id = t.uid('fl_g');
select t.ok((select verified_at is not null from public.profiles where id = t.uid('fl_g')), 'F6 direct verify sets verified_at');
update public.profiles set verified = false where id = t.uid('fl_g');
select t.ok((select verified_at is null from public.profiles where id = t.uid('fl_g')), 'F6 direct unverify clears verified_at');
update public.profiles set verified_at = now() where id = t.uid('fl_g');
select t.ok((select verified_at is null from public.profiles where id = t.uid('fl_g')), 'F6 verified_at cannot exist without verified');
select t.as_anon();
select t.ok((select phone from public.profiles where id = t.uid('fl_c')) = '+995 533 000 001', 'F6 phone is public');

-- ============================================================= F7. privileges on the new signatures
select t.as_super();
select t.ok(to_regprocedure('public.create_request(text,text,text,text,text)') is null, 'F7 old create_request signature dropped');
select t.ok(to_regprocedure('public.update_request(uuid,text,text,text,text)') is null, 'F7 old update_request signature dropped');
select t.ok(to_regprocedure('public.send_offer(uuid,text,numeric)') is null, 'F7 old send_offer signature dropped');
select t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('create_request', 'update_request', 'send_offer', 'list_companies')) = 4, 'F7 exactly one overload each');
do $$
declare sig text;
begin
  foreach sig in array array['public.create_request(text,text,text,text,text,numeric,text,date,text)',
                             'public.update_request(uuid,text,text,text,text,numeric,text,date,text)',
                             'public.send_offer(uuid,text,numeric,text,boolean,integer,boolean)',
                             'public.list_companies()', 'public.admin_set_verified(uuid,boolean)'] loop
    perform t.ok((select prosecdef and 'search_path=""' = any (proconfig) from pg_proc where oid = sig::regprocedure), 'F7 ' || sig || ' definer + pinned search_path');
    perform t.ok(not has_function_privilege('public', sig, 'EXECUTE'), 'F7 PUBLIC cannot execute ' || sig);
  end loop;
end $$;
select t.ok(has_function_privilege('anonymous', 'public.send_offer(uuid,text,numeric,text,boolean,integer,boolean)', 'EXECUTE'), 'F7 send_offer executable by the API roles');
select t.ok(has_function_privilege('authenticated', 'public.create_request(text,text,text,text,text,numeric,text,date,text)', 'EXECUTE'), 'F7 create_request executable by authenticated');
select t.ok(not has_function_privilege('anonymous', 'meetany_private.check_terms(numeric,text,date,date)', 'EXECUTE'), 'F7 check_terms private');
select t.ok(not has_function_privilege('authenticated', 'meetany_private.profiles_verified_at()', 'EXECUTE'), 'F7 trigger function private');
select t.ok(not has_function_privilege('anonymous', 'public.admin_set_verified(uuid,boolean)', 'EXECUTE'), 'F7 admin_set_verified not for anonymous');
select t.as_anon();
select t.throws(format($$select public.send_offer(%L, 'Anonymous offer text', 5, 'total')$$, t.get('fl_old')), 'MA001', 'F7 anonymous send_offer -> MA001');

-- ============================================================= F8. moderation reasons (admin_set_hidden / admin_set_blocked)
select t.as_user('fl_c');
select t.lives($$select t.put('fl_mod', (public.create_request('Moderated request', 'A request the admin will hide', 'packaging', 'tbilisi')).id)$$, 'F8 request to moderate');
select t.as_user('admin');
select t.throws(format($$select public.admin_set_hidden(%L, true, 'ab')$$, t.get('fl_mod')), 'MA304', 'F8 reason shorter than 3 -> MA304');
select t.throws(format($$select public.admin_set_hidden(%L, true, %L)$$, t.get('fl_mod'), repeat('x', 501)), 'MA304', 'F8 reason longer than 500 -> MA304');
select t.ok((select not hidden from public.requests where id = t.get('fl_mod')), 'F8 rejected reason leaves the request visible');
select t.lives(format($$select public.admin_set_hidden(p_request_id => %L, p_hidden => true, p_reason => '  სპამი: ერთი და იგივე ტექსტი  ')$$, t.get('fl_mod')), 'F8 admin hides with a reason (named args)');
select t.ok((select hidden and hidden_reason = 'სპამი: ერთი და იგივე ტექსტი' from public.requests where id = t.get('fl_mod')), 'F8 reason stored trimmed');
select t.as_user('fl_c');
select t.ok((select hidden_reason from public.requests where id = t.get('fl_mod')) = 'სპამი: ერთი და იგივე ტექსტი', 'F8 owner reads the hide reason');
select t.as_user('fl_d');
select t.ok((select count(*) from public.requests where id = t.get('fl_mod')) = 0, 'F8 other users do not see the hidden request or its reason');
select t.as_user('admin');
select t.lives(format('select public.admin_set_hidden(%L, false, %L)', t.get('fl_mod'), 'ignored when showing'), 'F8 admin shows the request again');
select t.ok((select not hidden and hidden_reason is null from public.requests where id = t.get('fl_mod')), 'F8 showing clears the reason');
select t.lives(format('select public.admin_set_hidden(%L, true)', t.get('fl_mod')), 'F8 reason stays optional for the API');
select t.ok((select hidden and hidden_reason is null from public.requests where id = t.get('fl_mod')), 'F8 hidden without a reason');
select t.lives(format($$select public.admin_set_blocked(%L, true, 'ყალბი შეთავაზებები')$$, t.uid('fl_g')), 'F8 admin blocks with a reason');
select t.as_super();
select t.ok((select blocked and blocked_reason = 'ყალბი შეთავაზებები' from public.profiles where id = t.uid('fl_g')), 'F8 block reason stored');
select t.as_user('admin');
select t.ok((select blocked_reason from public.admin_list_users() where id = t.uid('fl_g')) = 'ყალბი შეთავაზებები', 'F8 admin_list_users returns the block reason');
select t.throws(format($$select public.admin_set_blocked(%L, true, ' x ')$$, t.uid('fl_g')), 'MA304', 'F8 blank-ish block reason -> MA304');
select t.as_anon();
select t.throws($$select blocked_reason from public.profiles$$, '42501', 'F8 block reason is not public');
select t.as_user('fl_f');
select t.throws($$select blocked_reason from public.profiles$$, '42501', 'F8 block reason hidden from other users');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('fl_g')), 'F8 admin unblocks');
select t.as_super();
select t.ok((select not blocked and blocked_reason is null from public.profiles where id = t.uid('fl_g')), 'F8 unblock clears the reason');
update public.requests set hidden = false where id = t.get('fl_mod');
update public.requests set hidden = true, hidden_reason = 'set in the SQL editor' where id = t.get('fl_mod');
update public.requests set hidden = false where id = t.get('fl_mod');
select t.ok((select hidden_reason is null from public.requests where id = t.get('fl_mod')), 'F8 direct unhide clears the reason (trigger)');
select t.ok(to_regprocedure('public.admin_set_hidden(uuid,boolean)') is null and to_regprocedure('public.admin_set_blocked(uuid,boolean)') is null, 'F8 old 2-argument admin signatures dropped');
select t.ok(not has_function_privilege('authenticated', 'meetany_private.moderation_reason(text)', 'EXECUTE'), 'F8 moderation_reason private');
select t.ok(not has_function_privilege('anonymous', 'public.admin_set_hidden(uuid,boolean,text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.admin_set_blocked(uuid,boolean,text)', 'EXECUTE'), 'F8 admin RPC privileges');

-- ============================================================= summary
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s FIELDS TESTS PASSED', count(*) - (select n from t.fl_start)) as result from t.passed;
