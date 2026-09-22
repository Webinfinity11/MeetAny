-- MeetAny database tests: RLS, column privileges, RPC rules, complete_profile, photo URLs.
-- Run through db/tests/run.sh (needs stub_neon.sql + schema.sql loaded first).
-- Every assertion aborts the run with "TEST FAILED: <name>" on failure.

\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

-- ============================================================= harness
create schema t;
grant usage on schema t to public;
create table t.passed (n serial primary key, name text not null);
create table t.users (k text primary key, id uuid not null);
create table t.vars (k text primary key, v uuid);
grant select, insert, update on t.passed, t.users, t.vars to public;
grant usage on sequence t.passed_n_seq to public;

create function t.ok(cond boolean, name text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'TEST FAILED: %', name; end if;
  insert into t.passed (name) values (name);
end $$;

-- Runs sql and expects an error whose SQLSTATE equals `expected` or whose message starts with `expected:`.
create function t.throws(sql text, expected text, name text) returns void language plpgsql as $$
declare
  st text; msg text;
begin
  begin
    execute sql;
  exception when others then
    st := sqlstate; msg := sqlerrm;
  end;
  if st is null then
    raise exception 'TEST FAILED: % (expected error %, statement succeeded)', name, expected;
  end if;
  if st <> expected and msg not like expected || ':%' then
    raise exception 'TEST FAILED: % (expected %, got % %)', name, expected, st, msg;
  end if;
  insert into t.passed (name) values (name);
end $$;

-- Runs sql and expects success.
create function t.lives(sql text, name text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise exception 'TEST FAILED: % (unexpected error % %)', name, sqlstate, sqlerrm;
  end;
  insert into t.passed (name) values (name);
end $$;

create function t.uid(k text) returns uuid language sql stable as $$ select id from t.users where t.users.k = $1 $$;
create function t.get(k text) returns uuid language sql stable as $$ select v from t.vars where t.vars.k = $1 $$;
create function t.put(k text, v uuid) returns uuid language sql as $$
  insert into t.vars values ($1, $2) on conflict (k) do update set v = excluded.v returning v $$;

-- Switch identity (like the Data API does): role from the JWT `role` claim + request.jwt.claims.
-- Claims have the Neon Auth shape (sub = id = neon_auth."user".id, iss = aud = Auth URL origin).
-- (security definer: the harness reads neon_auth even while acting as a Data API role)
create function t.claims_for(id uuid, verified boolean default true) returns text language sql stable security definer as $$
  select json_build_object('sub', id, 'id', id, 'role', 'authenticated',
                           'iss', 'https://ep-test.neonauth.us-east-1.aws.neon.tech',
                           'aud', 'https://ep-test.neonauth.us-east-1.aws.neon.tech',
                           'email', (select email from neon_auth."user" u where u.id = $1),
                           'emailVerified', verified, 'banned', false)::text $$;
create function t.as_id(id uuid, verified boolean default true) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', t.claims_for(id, verified), false);
  perform set_config('role', 'authenticated', false);
end $$;
create function t.as_user(k text) returns void language plpgsql as $$
begin
  perform t.as_id(t.uid(k));
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anonymous')::text, false);
  perform set_config('role', 'anonymous', false);
end $$;
create function t.as_super() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
grant execute on all functions in schema t to public;

-- A Neon Auth account (what POST /sign-up/email + the email code create). Runs as the superuser,
-- like the Neon Auth service; the Data API roles have no access to neon_auth.
create function t.auth_user(email text, verified boolean default true, name text default 'Test User') returns uuid
language plpgsql as $$
declare id uuid;
begin
  perform set_config('role', 'none', false);
  insert into neon_auth."user" (name, email, "emailVerified") values (name, email, verified)
  returning neon_auth."user".id into id;
  return id;
end $$;

-- complete_profile with the fields of a sign-up form (the caller's identity must already be set).
create function t.complete(meta jsonb) returns public.profiles language sql as $$
  select public.complete_profile(p_role => meta ->> 'role', p_name => meta ->> 'name', p_company => meta ->> 'company',
                                 p_phone => meta ->> 'phone', p_city => meta ->> 'city', p_industry => meta ->> 'industry') $$;

-- Full sign-up: verified Neon Auth user, then complete_profile as that user.
create function t.signup(k text, email text, meta jsonb) returns uuid language plpgsql as $$
declare id uuid;
begin
  id := t.auth_user(email, true, coalesce(meta ->> 'name', 'Test User'));
  insert into t.users values (k, id);
  perform t.as_id(id);
  perform t.complete(meta);
  perform t.as_super();
  return id;
end $$;
grant execute on all functions in schema t to public;

-- The Vercel Blob store origin that create_request accepts (set once per deployment).
insert into meetany_private.settings (key, value) values ('photo_origin', 'https://abcd1234.public.blob.vercel-storage.com');
create function t.photo(k text, file text default 'photo.jpg') returns text language sql stable as $$
  select 'https://abcd1234.public.blob.vercel-storage.com/' || t.uid(k) || '/' || file $$;

-- ============================================================= 1. schema-level guarantees
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' loop
    perform t.ok((select relrowsecurity from pg_class where oid = ('public.' || r.relname)::regclass),
                 'RLS enabled on public.' || r.relname);
    perform t.ok(not has_table_privilege('anonymous', 'public.' || r.relname, 'INSERT,UPDATE,DELETE,TRUNCATE'),
                 'anonymous has no write privilege on public.' || r.relname);
    perform t.ok(not has_table_privilege('authenticated', 'public.' || r.relname, 'INSERT,UPDATE,DELETE,TRUNCATE'),
                 'authenticated has no write privilege on public.' || r.relname);
  end loop;
  for r in select p.oid::regprocedure::text as sig, p.proconfig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'meetany_private') and p.prosecdef loop
    perform t.ok(exists (select 1 from unnest(r.proconfig) c where c like 'search_path=%'),
                 'security definer ' || r.sig || ' pins search_path');
  end loop;
  perform t.ok(not has_column_privilege('anonymous', 'public.profiles', 'phone', 'SELECT'), 'anonymous cannot read profiles.phone');
  perform t.ok(not has_column_privilege('anonymous', 'public.profiles', 'email', 'SELECT'), 'anonymous cannot read profiles.email');
  perform t.ok(not has_column_privilege('authenticated', 'public.profiles', 'phone', 'SELECT'), 'authenticated cannot read profiles.phone');
  perform t.ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT'), 'authenticated cannot read profiles.email');
  perform t.ok(not has_column_privilege('authenticated', 'public.profiles', 'name', 'SELECT'), 'authenticated cannot read profiles.name');
  perform t.ok(not has_column_privilege('authenticated', 'public.profiles', 'blocked', 'SELECT'), 'authenticated cannot read profiles.blocked');
  perform t.ok(not has_table_privilege('anonymous', 'public.offers', 'SELECT'), 'anonymous has no select on offers');
  perform t.ok(not has_function_privilege('anonymous', 'public.admin_list_users()', 'EXECUTE'), 'anonymous cannot execute admin_list_users');
  perform t.ok(not has_function_privilege('anonymous', 'public.admin_stats()', 'EXECUTE'), 'anonymous cannot execute admin_stats');
  perform t.ok(not has_function_privilege('anonymous', 'public.complete_profile(text,text,text,text,text,text)', 'EXECUTE'), 'anonymous cannot execute complete_profile');
  perform t.ok(has_function_privilege('authenticated', 'public.complete_profile(text,text,text,text,text,text)', 'EXECUTE'), 'authenticated can execute complete_profile');
  perform t.ok(not has_function_privilege('authenticated', 'meetany_private.photo_origin()', 'EXECUTE'), 'authenticated cannot execute private photo_origin()');
  perform t.ok(not has_table_privilege('authenticated', 'meetany_private.settings', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has no access to settings');
  perform t.ok(not has_table_privilege('anonymous', 'meetany_private.settings', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous has no access to settings');
  perform t.ok(not has_table_privilege('authenticated', 'neon_auth."user"', 'SELECT,INSERT,UPDATE,DELETE'), 'schema.sql grants nothing on neon_auth.user');
  perform t.ok(to_regprocedure('public.phone_available(text)') is null, 'phone_available is gone (MA405 comes from complete_profile)');
  perform t.ok((select confrelid = 'neon_auth."user"'::regclass and confdeltype = 'c' from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'f'), 'profiles.id references neon_auth.user on delete cascade');
  perform t.ok(not has_function_privilege('authenticated', 'meetany_private.fail(text)', 'EXECUTE'), 'authenticated cannot execute private fail()');
  perform t.ok(not has_function_privilege('authenticated', 'meetany_private.require_user()', 'EXECUTE'), 'authenticated cannot execute private require_user()');
end $$;

-- ============================================================= 2. complete_profile -> profiles
select t.signup('nino', 'Nino@Example.GE', '{"role":"client","name":"ნინო ბერიძე","company":"სასტუმრო","phone":"+995 555 120 450","city":"tbilisi"}');
select t.signup('giorgi', 'giorgi@example.ge', '{"name":"გიორგი მელაძე","phone":"0577310220","city":"kutaisi"}');
select t.signup('tamar', 'tamar@example.ge', '{"role":"client","name":"თამარ ლომიძე","phone":"599440118","city":"batumi"}');
select t.signup('wood', 'wood@example.ge', '{"role":"company","name":"ლევან ხ","company":"ხის ოსტატი","phone":"995555781900","city":"tbilisi","industry":"furniture"}');
select t.signup('office', 'office@example.ge', '{"role":"company","name":"ანა გ","company":"Office Line","phone":"+995 568 220 017","city":"rustavi","industry":"furniture"}');
select t.signup('axis', 'axis@example.ge', '{"role":"company","name":"დავით ჩ","company":"Axis Build","phone":"+995 599 100 245","city":"tbilisi","industry":"construction"}');
select t.signup('sneaky', 'sneaky@example.ge', '{"role":"admin","name":"Sneaky User","phone":"+995 555 999 111","city":"tbilisi"}');
select t.signup('admin', 'admin@example.ge', '{"name":"MeetAny ადმინი","company":"MeetAny","phone":"+995 555 000 000","city":"tbilisi"}');
select t.signup('bad', 'bad@example.ge', '{"name":"Spammer","phone":"+995 555 666 777","city":"gori"}');
select t.signup('badco', 'badco@example.ge', '{"role":"company","name":"Bad Co","company":"Bad Co","phone":"+995 555 666 778","city":"gori","industry":"other"}');
update public.profiles set role = 'admin' where email = 'admin@example.ge';

do $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = t.uid('nino');
  perform t.ok(p.role = 'client' and p.phone = '+995 555 120 450' and p.email = 'nino@example.ge'
               and p.company = 'სასტუმრო' and p.city = 'tbilisi' and p.industry is null
               and not p.verified and not p.blocked, 'client profile created by complete_profile, email from Neon Auth lowercased');
  select * into p from public.profiles where id = t.uid('giorgi');
  perform t.ok(p.role = 'client' and p.phone = '+995 577 310 220' and p.company = 'გიორგი მელაძე',
               'missing role -> client, 0-prefixed phone normalized, company defaults to name');
  perform t.ok((select phone from public.profiles where id = t.uid('tamar')) = '+995 599 440 118', 'bare 9-digit phone normalized');
  select * into p from public.profiles where id = t.uid('wood');
  perform t.ok(p.role = 'company' and p.industry = 'furniture' and p.phone = '+995 555 781 900', 'company profile with industry, 995-prefixed phone');
  perform t.ok((select role from public.profiles where id = t.uid('sneaky')) = 'client', 'p_role=admin becomes client');
  perform t.ok((select count(*) from public.profiles where role = 'admin') = 1, 'only the SQL-promoted admin is admin');
end $$;

-- validation (each a verified Neon Auth user without a profile yet)
create function t.try_complete(email text, meta jsonb, verified boolean default true) returns void language plpgsql as $$
begin
  perform t.as_id(t.auth_user(email, verified));
  perform t.complete(meta);
end $$;
grant execute on function t.try_complete(text, jsonb, boolean) to public;
select t.throws($$select t.try_complete('x1@example.ge', '{"name":"A","phone":"+995 555 111 001","city":"tbilisi"}')$$, 'MA401', 'complete_profile: short name -> MA401');
select t.throws($$select t.try_complete('x1b@example.ge', '{"name":"   A   ","phone":"+995 555 111 001","city":"tbilisi"}')$$, 'MA401', 'complete_profile: name trimmed before length check -> MA401');
select t.throws($$select t.try_complete('x2@example.ge', '{"role":"company","name":"Anna","phone":"+995 555 111 002","city":"tbilisi","industry":"food"}')$$, 'MA402', 'complete_profile: company without company name -> MA402');
select t.throws($$select t.try_complete('not-an-email', '{"name":"Anna","phone":"+995 555 111 003","city":"tbilisi"}')$$, 'MA403', 'complete_profile: bad Neon Auth email -> MA403');
select t.throws($$select t.try_complete('x4@example.ge', '{"name":"Anna","phone":"+995 455 111 004","city":"tbilisi"}')$$, 'MA404', 'complete_profile: non-mobile phone -> MA404');
select t.throws($$select t.try_complete('x5@example.ge', '{"name":"Anna","city":"tbilisi"}')$$, 'MA404', 'complete_profile: missing phone -> MA404');
select t.throws($$select t.try_complete('x6@example.ge', '{"name":"Anna","phone":"+995 555 111 006","city":"paris"}')$$, 'MA104', 'complete_profile: bad city -> MA104');
select t.throws($$select t.try_complete('x6b@example.ge', '{"name":"Anna","phone":"+995 555 111 006"}')$$, 'MA104', 'complete_profile: missing city -> MA104');
select t.throws($$select t.try_complete('x7@example.ge', '{"role":"company","name":"Anna","company":"Anna LLC","phone":"+995 555 111 007","city":"tbilisi"}')$$, 'MA407', 'complete_profile: company without industry -> MA407');
select t.throws($$select t.try_complete('x8@example.ge', '{"role":"company","name":"Anna","company":"Anna LLC","phone":"+995 555 111 008","city":"tbilisi","industry":"weapons"}')$$, 'MA407', 'complete_profile: company with unknown industry -> MA407');
select t.throws($$select t.try_complete('x9@example.ge', '{"name":"Anna","phone":"555-120-450","city":"tbilisi"}')$$, 'MA405', 'complete_profile: duplicate phone (other formatting) -> MA405');
select t.throws($$select t.try_complete('x10@example.ge', '{"name":"Anna","phone":"+995 555 111 010","city":"tbilisi"}', false)$$, 'MA408', 'complete_profile: unverified email -> MA408');
select t.as_super();
select t.ok((select count(*) from public.profiles where email like 'x%@example.ge' or email = 'not-an-email') = 0, 'failed complete_profile calls leave no profiles');
select t.ok((select count(*) from public.profiles) = 10, 'exactly the 10 completed sign-ups have profiles');

-- the verified flag is read from neon_auth."user", not from the (up to 15 min old) JWT snapshot
select t.put('x11', t.auth_user('x11@example.ge', false));
select t.as_id(t.get('x11'), true);  -- token claims emailVerified=true, but the account is not verified
select t.throws($$select t.complete('{"name":"Anna","phone":"+995 555 111 011","city":"tbilisi"}')$$, 'MA408', 'complete_profile: emailVerified claim alone is not trusted -> MA408');
select t.as_super();
update neon_auth."user" set "emailVerified" = true where id = t.get('x11');
select t.as_id(t.get('x11'), false);  -- stale token from before verification
select t.lives($$select t.complete('{"name":"Anna Late","phone":"+995 555 111 011","city":"tbilisi"}')$$, 'complete_profile: works once Neon Auth marks the email verified');
select t.ok((select email from public.my_profile()) = 'x11@example.ge', 'complete_profile: my_profile returns the new profile');

-- idempotent: a second call returns the existing profile unchanged and reveals nothing
do $$
declare p public.profiles;
begin
  p := t.complete('{"role":"company","name":"Changed Name","company":"Changed","phone":"+995 555 120 450","city":"batumi","industry":"food"}');
  perform t.ok(p.id = t.get('x11') and p.name = 'Anna Late' and p.role = 'client' and p.phone = '+995 555 111 011' and p.city = 'tbilisi',
               'complete_profile again: existing profile returned unchanged (no MA405 oracle, no role change)');
  p := t.complete('{"name":"","city":"nowhere"}');
  perform t.ok(p.id = t.get('x11'), 'complete_profile again with invalid fields: still returns existing profile');
end $$;
select t.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', 'completed user cannot update own profile directly');

-- identity checks
select t.as_id(gen_random_uuid());
select t.throws($$select t.complete('{"name":"Ghost","phone":"+995 555 111 012","city":"tbilisi"}')$$, 'MA001', 'complete_profile: token sub without a Neon Auth user -> MA001');
select set_config('request.jwt.claims', json_build_object('sub', 'not-a-uuid', 'role', 'authenticated')::text, false);
select t.throws($$select t.complete('{"name":"Ghost","phone":"+995 555 111 012","city":"tbilisi"}')$$, 'MA001', 'complete_profile: non-uuid sub -> MA001');
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, false);
select t.throws($$select t.complete('{"name":"Ghost","phone":"+995 555 111 012","city":"tbilisi"}')$$, 'MA001', 'complete_profile: no sub -> MA001');
select t.as_anon();
select t.throws($$select t.complete('{"name":"Ghost","phone":"+995 555 111 012","city":"tbilisi"}')$$, '42501', 'anonymous cannot call complete_profile');
select t.as_super();
delete from public.profiles where id = t.get('x11');
delete from neon_auth."user" where id = t.get('x11');

-- a concurrent sign-up that wins the phone race: the unique constraint maps to MA405
select t.put('x13', t.auth_user('x13@example.ge'));
create function t.race() returns trigger language plpgsql as $$
begin
  -- simulates the other transaction committing the same number between the check and the insert
  if new.email = 'x13@example.ge' then
    insert into neon_auth."user" (id, name, email, "emailVerified") values ('00000000-0000-4000-8000-000000000013', 'R', 'race@example.ge', true);
    insert into public.profiles (id, name, company, phone, email, city)
    values ('00000000-0000-4000-8000-000000000013', 'Racer', 'Racer', new.phone, 'race@example.ge', 'tbilisi');
  end if;
  return new;
end $$;
create trigger t_race before insert on public.profiles for each row execute function t.race();
select t.as_id(t.get('x13'));
select t.throws($$select t.complete('{"name":"Slow Anna","phone":"+995 555 111 013","city":"tbilisi"}')$$, 'MA405', 'complete_profile: phone taken by a concurrent sign-up -> MA405 (not a raw 23505)');
select t.as_super();
drop trigger t_race on public.profiles;
select t.ok((select count(*) from public.profiles where phone = '+995 555 111 013') = 0, 'race: nothing stored after MA405');
delete from neon_auth."user" where id = t.get('x13');

-- deleting the Neon Auth user removes the profile (and, by cascade, its requests and offers)
select t.put('gone', t.auth_user('gone@example.ge'));
select t.as_id(t.get('gone'));
select t.lives($$select t.complete('{"name":"Gone User","phone":"+995 555 111 014","city":"tbilisi"}')$$, 'short-lived user completes profile');
select t.lives($$select public.create_request('დროებითი განცხადება', 'ეს განცხადება წაიშლება მომხმარებელთან ერთად', 'food', 'tbilisi')$$, 'short-lived user creates a request');
select t.as_super();
delete from neon_auth."user" where id = t.get('gone');
select t.ok(not exists (select 1 from public.profiles where id = t.get('gone')) and not exists (select 1 from public.requests where owner_id = t.get('gone')),
            'deleting the Neon Auth user cascades to profile and requests');

-- ============================================================= 3. profiles privacy
select t.as_anon();
select t.lives($$select id, role, company, industry, verified, city from public.profiles$$, 'anon reads public profile columns');
select t.ok((select count(*) from public.profiles) = 10, 'anon sees all profiles (public columns)');
select t.throws($$select phone from public.profiles$$, '42501', 'anon cannot select phone');
select t.throws($$select email from public.profiles$$, '42501', 'anon cannot select email');
select t.throws($$select * from public.profiles$$, '42501', 'anon cannot select *');
select t.ok((select count(*) from public.my_profile()) = 0, 'anon my_profile() is empty');
select t.throws($$update public.profiles set company = 'x'$$, '42501', 'anon cannot update profiles');

select t.as_user('wood');
select t.throws($$select phone from public.profiles where id = auth.uid()$$, '42501', 'user cannot read own phone via table (use my_profile)');
select t.throws($$select email, name from public.profiles where id = '$$ || t.uid('nino') || $$'$$, '42501', 'user cannot read other user email/name');
select t.ok((select phone from public.my_profile()) = '+995 555 781 900', 'my_profile returns own phone');
select t.ok((select count(*) from public.my_profile()) = 1, 'my_profile returns exactly one row');
select t.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', 'user cannot make self admin');
select t.throws($$update public.profiles set verified = true where id = auth.uid()$$, '42501', 'user cannot self-verify');
select t.throws($$update public.profiles set blocked = false where id = auth.uid()$$, '42501', 'user cannot unblock self');
select t.throws($$insert into public.profiles (id, role, name, company, phone, email, city) values (gen_random_uuid(), 'admin', 'Xx', 'Xx', '+995 555 222 333', 'a@b.ge', 'tbilisi')$$, '42501', 'user cannot insert profiles');
select t.throws($$delete from public.profiles$$, '42501', 'user cannot delete profiles');
select t.throws($$select meetany_private.require_user()$$, '42501', 'user cannot call private helpers');
select t.as_super();

-- ============================================================= 4. create_request
select t.as_anon();
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi')$$, 'MA001', 'anon create_request -> MA001');
select t.throws($$insert into public.requests (owner_id, title, body, category, city) values (gen_random_uuid(), 'hello world', 'hello world body', 'food', 'tbilisi')$$, '42501', 'anon direct insert into requests denied');

select t.as_user('nino');
select t.throws($$select public.create_request('abc', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi')$$, 'MA101', 'short title -> MA101');
select t.throws($$select public.create_request('    abcd    ', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi')$$, 'MA101', 'title is trimmed before length check -> MA101');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'მოკლე', 'furniture', 'tbilisi')$$, 'MA102', 'short body -> MA102');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'chairs', 'tbilisi')$$, 'MA103', 'bad category -> MA103');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', null, 'tbilisi')$$, 'MA103', 'null category -> MA103');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'london')$$, 'MA104', 'bad city -> MA104');
select t.throws(format($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi', %L)$$, t.photo('wood')), 'MA109', 'photo in another user folder -> MA109');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi', 'javascript:alert(1)')$$, 'MA109', 'javascript: photo url -> MA109');
select t.throws($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi', 'https://evil.example/x.jpg')$$, 'MA109', 'foreign photo url -> MA109');
select t.throws(format($$select public.create_request('სკამები 1000 ცალი', 'გვჭირდება 1000 სკამი დარბაზისთვის', 'furniture', 'tbilisi', %L)$$, t.photo('nino', 'photo.svg')), 'MA109', 'non-raster photo extension -> MA109');
select t.throws($$insert into public.requests (owner_id, title, body, category, city) values (auth.uid(), 'hello world', 'hello world body', 'food', 'tbilisi')$$, '42501', 'authenticated direct insert into requests denied');

do $$
declare r public.requests;
begin
  r := public.create_request('  მჭირდება 1000 სკამი  ', '  ვხსნით ახალ საბანკეტო დარბაზს, გვჭირდება 1000 სკამი.  ', 'furniture', 'tbilisi', t.photo('nino', 'chairs-1.jpg'));
  perform t.put('chairs', r.id);
  perform t.ok(r.owner_id = t.uid('nino'), 'create_request: owner is the caller');
  perform t.ok(r.title = 'მჭირდება 1000 სკამი' and left(r.body, 5) = 'ვხსნი', 'create_request: title/body trimmed');
  perform t.ok(r.status = 'open' and not r.hidden and r.chosen_offer_id is null, 'create_request: open, visible, nothing chosen');
  perform t.ok(r.expires_at - r.created_at = interval '14 days', 'create_request: expires in 14 days');
  perform t.ok(r.photo_url = t.photo('nino', 'chairs-1.jpg'), 'create_request: own Blob photo accepted');
  r := public.create_request(repeat('ა', 200), 'ტესტური აღწერა ათი სიმბოლოზე მეტი', 'other', 'georgia');
  perform t.ok(char_length(r.title) = 120, 'create_request: title truncated to 120 like the beta');
  perform t.put('long', r.id);
  -- Vercel Blob keeps the case of the uploaded name and appends a random suffix
  r := public.create_request('სასტუმროს თეთრეული 200', 'გვჭირდება 200 კომპლექტი თეთრეული', 'textiles', 'batumi', t.photo('nino', 'linen_2-Ab3dEf9GhJkLmN0pQrStUvWxYz12.PNG'));
  perform t.ok(r.photo_url = t.photo('nino', 'linen_2-Ab3dEf9GhJkLmN0pQrStUvWxYz12.PNG'), 'create_request: Blob name with random suffix accepted, ext case-insensitive');
  perform t.as_user('nino');
  perform t.put('linen', r.id);
  r := public.create_request('ვებსაიტი სასტუმროსთვის', 'სამენოვანი ვებსაიტი ონლაინ ჯავშნით', 'technology', 'batumi');
  perform t.put('website', r.id);
  r := public.create_request('ბეტონი M300 50 მ³', 'ფუნდამენტისთვის 50 მ³ ბეტონი ტუმბოთი', 'construction', 'batumi');
  perform t.put('concrete', r.id);
end $$;

-- max 5 open per user
select t.as_super();
select t.ok(meetany_private.open_count(t.uid('nino')) = 5, 'nino has 5 open requests');
select t.as_user('nino');
select t.throws($$select public.create_request('მეექვსე განცხადება', 'მეექვსე განცხადების აღწერა', 'food', 'tbilisi')$$, 'MA105', '6th open request -> MA105');
select t.lives(format('select public.close_request(%L)', t.get('long')), 'owner closes a request');
select t.lives($$select t.put('sixth', (public.create_request('მეექვსე განცხადება', 'მეექვსე განცხადების აღწერა', 'food', 'tbilisi')).id)$$, 'closing frees a slot for a new request');
select t.as_super();
update public.requests set expires_at = now() - interval '1 minute' where id = t.get('sixth');
select t.as_user('nino');
select t.lives($$select t.put('seventh', (public.create_request('მეშვიდე განცხადება', 'მეშვიდე განცხადების აღწერა', 'food', 'tbilisi')).id)$$, 'expired requests do not count toward the limit');
select t.throws(format('select public.extend_request(%L)', t.get('long')), 'MA105', 'reopening a closed request when 5 are open -> MA105');
select t.lives(format('select public.close_request(%L)', t.get('seventh')), 'owner closes 7th');
select t.as_super();

-- ============================================================= 5. request visibility / direct DML
select t.as_user('tamar');
do $$
declare r public.requests;
begin
  r := public.create_request('ოფისის დასუფთავება 400 მ²', 'სრული დასუფთავება რემონტის შემდეგ', 'cleaning', 'tbilisi');
  perform t.put('cleaning', r.id);
  r := public.create_request('სპამი ტესტისთვის', 'ეს განცხადება ადმინმა უნდა დამალოს', 'other', 'tbilisi');
  perform t.put('spam', r.id);
end $$;
select t.throws(format($$update public.requests set title = 'hacked title' where id = %L$$, t.get('cleaning')), '42501', 'owner cannot update request directly');
select t.throws(format($$update public.requests set chosen_offer_id = null where id = %L$$, t.get('cleaning')), '42501', 'owner cannot touch chosen_offer_id directly');
select t.throws(format($$delete from public.requests where id = %L$$, t.get('cleaning')), '42501', 'owner cannot delete request directly');
select t.as_user('admin');
select t.lives(format('select public.admin_set_hidden(%L, true)', t.get('spam')), 'admin hides spam');
select t.as_anon();
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 0, 'anon cannot see hidden request');
select t.ok((select count(*) from public.requests where id = t.get('cleaning')) = 1, 'anon sees visible request');
select t.ok((select count(*) from public.requests) = (select count(*) from public.requests where not hidden), 'anon sees only non-hidden');
select t.as_user('wood');
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 0, 'other user cannot see hidden request');
select t.as_user('tamar');
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 1, 'owner sees own hidden request');
select t.as_user('admin');
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 1, 'admin sees hidden request');
select t.as_super();

-- ============================================================= 6. close / extend / delete
select t.as_user('wood');
select t.throws(format('select public.close_request(%L)', t.get('cleaning')), 'MA107', 'close foreign request -> MA107');
select t.throws(format('select public.extend_request(%L)', t.get('cleaning')), 'MA107', 'extend foreign request -> MA107');
select t.throws(format('select public.delete_request(%L)', t.get('cleaning')), 'MA107', 'delete foreign request -> MA107');
select t.throws(format('select public.close_request(%L)', t.get('spam')), 'MA106', 'close foreign hidden request -> MA106 (existence not leaked)');
select t.throws(format('select public.close_request(%L)', gen_random_uuid()), 'MA106', 'close unknown request -> MA106');
select t.as_anon();
select t.throws(format('select public.close_request(%L)', t.get('cleaning')), 'MA001', 'anon close -> MA001');
select t.throws(format('select public.extend_request(%L)', t.get('cleaning')), 'MA001', 'anon extend -> MA001');
select t.as_user('tamar');
do $$
declare r public.requests; before timestamptz;
begin
  select expires_at into before from public.requests where id = t.get('cleaning');
  r := public.extend_request(t.get('cleaning'));
  perform t.ok(r.expires_at = before + interval '7 days', 'extend open request: +7 days from current expiry');
  r := public.close_request(t.get('cleaning'));
  perform t.ok(r.status = 'closed', 'close_request sets status closed');
  r := public.extend_request(t.get('cleaning'));
  perform t.ok(r.status = 'open', 'extend reopens a closed request');
end $$;
select t.throws(format('select public.extend_request(%L)', t.get('spam')), 'MA108', 'extend hidden request -> MA108');
select t.as_super();
update public.requests set expires_at = now() - interval '3 days' where id = t.get('cleaning');
select t.ok((select meetany_private.request_state(r) from public.requests r where id = t.get('cleaning')) = 'expired', 'past expires_at -> expired state');
select t.as_user('tamar');
do $$
declare r public.requests;
begin
  r := public.extend_request(t.get('cleaning'));
  perform t.ok(r.expires_at > now() + interval '6 days 23 hours' and r.expires_at <= now() + interval '7 days', 'extend expired request: now + 7 days');
end $$;
select t.as_user('admin');
select t.lives(format('select public.close_request(%L)', t.get('cleaning')), 'admin can close any request');
select t.lives(format('select public.extend_request(%L)', t.get('cleaning')), 'admin can extend any request');
select t.as_super();

-- ============================================================= 7. send_offer
select t.as_anon();
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('chairs')), 'MA001', 'anon send_offer -> MA001');
select t.as_user('giorgi');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('chairs')), 'MA201', 'client send_offer -> MA201');
select t.as_user('admin');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('chairs')), 'MA201', 'admin send_offer -> MA201');
select t.as_user('wood');
select t.lives($$select t.put('woodreq', (public.create_request('ხის მასალა გვჭირდება', 'გვჭირდება მუხის ფიცარი 20 მ³', 'furniture', 'tbilisi')).id)$$, 'company can post its own request');
select t.throws(format($$select public.send_offer(%L, 'საკუთარ განცხადებაზე შეთავაზება', 10)$$, t.get('woodreq')), 'MA202', 'offer on own request -> MA202');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, gen_random_uuid()), 'MA106', 'offer on unknown request -> MA106');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('spam')), 'MA106', 'offer on hidden request -> MA106');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('long')), 'MA203', 'offer on closed request -> MA203');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 45)$$, t.get('sixth')), 'MA203', 'offer on expired request -> MA203');
select t.throws(format($$select public.send_offer(%L, 'მოკლე', 45)$$, t.get('chairs')), 'MA204', 'short offer body -> MA204');
select t.throws(format($$select public.send_offer(%L, '          ', null)$$, t.get('chairs')), 'MA204', 'whitespace offer body -> MA204');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 0)$$, t.get('chairs')), 'MA205', 'price 0 -> MA205');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', -5)$$, t.get('chairs')), 'MA205', 'negative price -> MA205');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 1000000000.01)$$, t.get('chairs')), 'MA205', 'price > 1e9 -> MA205');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 'NaN')$$, t.get('chairs')), 'MA205', 'price NaN -> MA205');
select t.throws(format($$select public.send_offer(%L, 'გთავაზობთ 1000 სკამს', 0.001)$$, t.get('chairs')), 'MA205', 'price rounding to 0 -> MA205');
select t.throws(format($$insert into public.offers (request_id, company_id, body, price) values (%L, auth.uid(), 'direct insert offer', 1)$$, t.get('chairs')), '42501', 'company direct insert into offers denied');
do $$
declare o public.offers; o2 public.offers;
begin
  o := public.send_offer(t.get('chairs'), '  დაგიმზადებთ 1000 დასაწყობ სკამს მუხის ჩარჩოთი  ', 48.345);
  perform t.put('o_wood', o.id);
  perform t.ok(o.company_id = t.uid('wood') and o.status = 'sent' and o.price = 48.35, 'send_offer: created, status sent, price rounded to 2 decimals');
  perform t.ok(o.body = 'დაგიმზადებთ 1000 დასაწყობ სკამს მუხის ჩარჩოთი', 'send_offer: body trimmed');
end $$;
select pg_sleep(0.01);
do $$
declare o public.offers; o2 public.offers;
begin
  o2 := public.send_offer(t.get('chairs'), 'განახლებული შეთავაზება, ფასი შეთანხმებით', null);
  perform t.ok(o2.id = t.get('o_wood') and o2.price is null and o2.updated_at > o2.created_at, 'send_offer again updates the same offer (unique per company), price may be null, updated_at bumped');
  o2 := public.send_offer(t.get('chairs'), 'დაგიმზადებთ 1000 სკამს, ფასი ერთეულზე', 1000000000);
  perform t.ok(o2.price = 1000000000, 'price exactly 1e9 accepted');
  o2 := public.send_offer(t.get('chairs'), 'დაგიმზადებთ 1000 სკამს, ფასი ერთეულზე', 48);
  perform t.ok((select count(*) from public.offers where request_id = t.get('chairs') and company_id = auth.uid()) = 1, 'still one offer per company per request');
  o := public.send_offer(t.get('linen'), 'თეთრეულის შეთავაზება ხის ოსტატისგან', 9800);
  perform t.put('o_wood_linen', o.id);
end $$;
select t.throws(format($$update public.offers set price = 1 where id = %L$$, t.get('o_wood')), '42501', 'company cannot update offer directly');
select t.throws(format($$delete from public.offers where id = %L$$, t.get('o_wood')), '42501', 'company cannot delete offer directly');
select t.as_user('office');
select t.lives($$select t.put('o_office', (public.send_offer(t.get('chairs'), 'მზა საბანკეტო სკამები საწყობში, 10 დღეში', 39)).id)$$, 'second company sends offer');
select t.as_user('axis');
select t.lives($$select t.put('o_axis', (public.send_offer(t.get('chairs'), 'შევუკვეთავთ ევროპელ მწარმოებელს, ფასი მოგვიანებით', null)).id)$$, 'third company sends offer without price');
select t.lives($$select t.put('o_axis_web', (public.send_offer(t.get('website'), 'ვებსაიტს გავაკეთებთ 5 კვირაში', 4500)).id)$$, 'third company offers on another request');
select t.as_super();

-- ============================================================= 8. sealed offers + counts
select t.as_anon();
select t.throws($$select * from public.offers$$, '42501', 'anon cannot select offers at all');
select t.ok((select offers from public.offer_counts(array[t.get('chairs')])) = 3, 'anon offer_counts: numbers only (3)');
select t.ok((select count(*) from public.offer_counts(array[t.get('spam'), t.get('chairs')])) = 1, 'offer_counts skips hidden requests for anon');
select t.ok((select offers from public.offer_counts(array[t.get('cleaning')])) = 0, 'offer_counts returns 0 for request without offers');
select t.ok((select count(*) from public.offer_counts(null)) = 0, 'offer_counts(null) is empty');
select t.as_user('office');
select t.ok((select count(*) from public.offers where request_id = t.get('chairs')) = 1, 'company sees only its own offer on a request');
select t.ok((select company_id from public.offers where request_id = t.get('chairs')) = t.uid('office'), 'the visible offer is its own');
select t.ok((select count(*) from public.offers where id = t.get('o_wood')) = 0, 'competitor offer invisible by id');
select t.as_user('giorgi');
select t.ok((select count(*) from public.offers) = 0, 'unrelated client sees no offers');
select t.as_user('nino');
select t.ok((select count(*) from public.offers where request_id = t.get('chairs')) = 3, 'request author sees all 3 offers');
select t.ok((select count(*) from public.offers where request_id = t.get('website')) = 1, 'request author sees offers on another own request');
select t.ok((select count(*) from public.offers) = 5, 'author sees exactly the offers on own requests');
select t.as_user('admin');
select t.ok((select count(*) from public.offers) = 5, 'admin sees all offers');
select t.as_user('tamar');
select t.ok((select offers from public.offer_counts(array[t.get('spam')])) = 0, 'owner gets count for own hidden request');
select t.as_super();

-- ============================================================= 9. withdraw_offer
select t.as_user('office');
select t.throws(format('select public.withdraw_offer(%L)', t.get('o_wood')), 'MA206', 'withdraw competitor offer -> MA206');
select t.as_user('nino');
select t.throws(format('select public.withdraw_offer(%L)', t.get('o_wood')), 'MA206', 'request author cannot withdraw an offer -> MA206');
select t.as_anon();
select t.throws(format('select public.withdraw_offer(%L)', t.get('o_wood')), 'MA001', 'anon withdraw -> MA001');
select t.as_user('axis');
select t.lives(format('select public.withdraw_offer(%L)', t.get('o_axis')), 'company withdraws own sent offer');
select t.ok((select count(*) from public.offers where id = t.get('o_axis')) = 0, 'withdrawn offer is gone');
select t.lives($$select t.put('o_axis', (public.send_offer(t.get('chairs'), 'ხელახლა გამოგზავნილი შეთავაზება', 50)).id)$$, 'company can send again after withdrawing');
select t.as_super();

-- ============================================================= 10. choose_offer + contacts
select t.as_user('nino');
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'no contact before choosing');
select t.as_user('wood');
select t.throws(format('select public.choose_offer(%L)', t.get('o_wood')), 'MA107', 'offer author cannot choose own offer -> MA107');
select t.as_user('office');
select t.throws(format('select public.choose_offer(%L)', t.get('o_wood')), 'MA206', 'other company choosing a sealed offer -> MA206');
select t.as_user('giorgi');
select t.throws(format('select public.choose_offer(%L)', t.get('o_wood')), 'MA206', 'unrelated client choosing -> MA206');
select t.as_user('admin');
select t.throws(format('select public.choose_offer(%L)', t.get('o_wood')), 'MA107', 'admin cannot choose (author only) -> MA107');
select t.as_anon();
select t.throws(format('select public.choose_offer(%L)', t.get('o_wood')), 'MA001', 'anon choose -> MA001');
select t.as_user('nino');
select t.throws(format('select public.choose_offer(%L)', gen_random_uuid()), 'MA206', 'choose unknown offer -> MA206');
do $$
declare o public.offers;
begin
  o := public.choose_offer(t.get('o_wood'));
  perform t.ok(o.id = t.get('o_wood') and o.status = 'chosen', 'choose_offer returns chosen offer');
  perform t.ok((select chosen_offer_id from public.requests where id = t.get('chairs')) = t.get('o_wood'), 'request.chosen_offer_id set');
  perform t.ok((select count(*) from public.offers where request_id = t.get('chairs') and status = 'declined') = 2, 'other offers declined atomically');
  perform t.ok((select status = 'open' and not hidden and chosen_offer_id is not null from public.requests where id = t.get('chairs')), 'request is now in chosen state (open + chosen_offer_id)');
end $$;
select t.throws(format('select public.choose_offer(%L)', t.get('o_office')), 'MA208', 'second choice on same request -> MA208');
select t.throws(format('select public.extend_request(%L)', t.get('chairs')), 'MA108', 'extend chosen request -> MA108');
select t.ok((select name || '|' || company || '|' || phone || '|' || email from public.contact_for_request(t.get('chairs'))) = 'ლევან ხ|ხის ოსტატი|+995 555 781 900|wood@example.ge', 'author gets chosen company contact');
select t.as_user('wood');
select t.ok((select phone || '|' || email from public.contact_for_request(t.get('chairs'))) = '+995 555 120 450|nino@example.ge', 'chosen company gets author contact');
select t.throws(format('select public.withdraw_offer(%L)', t.get('o_wood')), 'MA207', 'withdraw chosen offer -> MA207');
select t.throws(format($$select public.send_offer(%L, 'ცდილობს შეცვალოს არჩეული შეთავაზება', 1)$$, t.get('chairs')), 'MA203', 'cannot edit offer after choice -> MA203');
select t.as_user('office');
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'declined company gets no contact');
select t.ok((select status from public.offers where id = t.get('o_office')) = 'declined', 'declined company sees its status');
select t.lives(format('select public.withdraw_offer(%L)', t.get('o_office')), 'declined (not chosen) offer can be withdrawn');
select t.as_user('giorgi');
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'unrelated user gets no contact');
select t.as_user('admin');
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'admin gets no contact via contact_for_request');
select t.as_anon();
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'anon gets no contact');
select t.as_super();

-- choosing on closed / expired requests
select t.as_user('nino');
select t.lives(format('select public.close_request(%L)', t.get('website')), 'close website request');
select t.throws(format('select public.choose_offer(%L)', t.get('o_axis_web')), 'MA208', 'choose on closed request -> MA208');
select t.lives(format('select public.extend_request(%L)', t.get('website')), 'reopen website request');
select t.as_super();
update public.requests set expires_at = now() - interval '1 second' where id = t.get('website');
select t.as_user('nino');
select t.throws(format('select public.choose_offer(%L)', t.get('o_axis_web')), 'MA208', 'choose on expired request -> MA208');
select t.as_super();

-- ============================================================= 11. admin RPCs
select t.as_user('nino');
select t.throws($$select public.admin_list_users()$$, 'MA003', 'client admin_list_users -> MA003');
select t.throws($$select public.admin_stats()$$, 'MA003', 'client admin_stats -> MA003');
select t.throws(format('select public.admin_set_hidden(%L, true)', t.get('cleaning')), 'MA003', 'client admin_set_hidden -> MA003');
select t.throws(format('select public.admin_delete_request(%L)', t.get('cleaning')), 'MA003', 'client admin_delete_request -> MA003');
select t.throws(format('select public.admin_set_blocked(%L, true)', t.uid('bad')), 'MA003', 'client admin_set_blocked -> MA003');
select t.throws(format('select public.admin_set_verified(%L, true)', t.uid('office')), 'MA003', 'client admin_set_verified -> MA003');
select t.as_user('sneaky');
select t.throws($$select public.admin_list_users()$$, 'MA003', 'metadata-admin is not admin -> MA003');
select t.as_anon();
select t.throws($$select public.admin_list_users()$$, '42501', 'anon cannot execute admin RPCs');
select t.as_user('admin');
select t.ok((select count(*) from public.admin_list_users()) = 10, 'admin_list_users returns all users');
select t.ok((select phone from public.admin_list_users() where id = t.uid('bad')) = '+995 555 666 777', 'admin_list_users includes phone');
select t.throws(format('select public.admin_set_blocked(%L, true)', t.uid('admin')), 'MA301', 'admin cannot block self -> MA301');
select t.throws(format('select public.admin_set_blocked(%L, true)', gen_random_uuid()), 'MA302', 'block unknown user -> MA302');
select t.throws(format('select public.admin_set_verified(%L, true)', t.uid('nino')), 'MA303', 'verify a client -> MA303');
select t.throws(format('select public.admin_set_verified(%L, true)', gen_random_uuid()), 'MA303', 'verify unknown user -> MA303');
select t.throws(format('select public.admin_set_hidden(%L, true)', gen_random_uuid()), 'MA106', 'hide unknown request -> MA106');
select t.lives(format('select public.admin_set_verified(%L, true)', t.uid('office')), 'admin verifies company');
select t.as_anon();
select t.ok((select verified from public.profiles where id = t.uid('office')), 'verified flag is public');
select t.as_user('admin');
select t.lives(format('select public.admin_set_verified(%L, false)', t.uid('office')), 'admin removes verification');
do $$
declare s jsonb := public.admin_stats();
begin
  perform t.ok(s ?& array['users','companies','verified','open','requests','offers','chosen'], 'admin_stats has all keys');
  perform t.ok((s->>'users')::int = 9 and (s->>'companies')::int = 4 and (s->>'verified')::int = 0, 'admin_stats user numbers (admins not counted)');
  perform t.ok((s->>'users')::int = (select count(*) from public.admin_list_users() u where u.role <> 'admin'), 'admin_stats users equals non-admin admin_list_users rows');
  perform t.ok((s->>'chosen')::int = 1 and (s->>'offers')::int = (select count(*) from public.offers), 'admin_stats chosen/offers');
  perform t.ok((s->>'requests')::int = (select count(*) from public.requests where not hidden), 'admin_stats requests excludes hidden');
end $$;
select t.lives(format('select public.admin_set_hidden(%L, false)', t.get('spam')), 'admin unhides request');
select t.as_anon();
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 1, 'unhidden request visible again');
select t.as_user('admin');
select t.lives(format('select public.admin_delete_request(%L)', t.get('spam')), 'admin deletes request');
select t.ok((select count(*) from public.requests where id = t.get('spam')) = 0, 'deleted request gone');

-- blocking
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('bad')), 'admin blocks client');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('badco')), 'admin blocks company');
select t.as_user('bad');
select t.throws($$select public.create_request('დაბლოკილის განცხადება', 'დაბლოკილი ვერ უნდა დადოს', 'food', 'gori')$$, 'MA002', 'blocked user create_request -> MA002');
select t.ok((select blocked from public.my_profile()), 'blocked user sees own blocked flag via my_profile');
select t.as_user('badco');
select t.throws(format($$select public.send_offer(%L, 'დაბლოკილი კომპანიის შეთავაზება', 5)$$, t.get('cleaning')), 'MA002', 'blocked company send_offer -> MA002');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('badco')), 'admin unblocks company');
select t.as_user('badco');
select t.lives($$select t.put('o_badco', (public.send_offer(t.get('cleaning'), 'განბლოკილი კომპანიის შეთავაზება', 5)).id)$$, 'unblocked company can send again');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('badco')), 'admin re-blocks company');
select t.as_user('badco');
select t.throws(format('select public.withdraw_offer(%L)', t.get('o_badco')), 'MA002', 'blocked company withdraw -> MA002');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, true)', t.uid('tamar')), 'admin blocks request owner');
select t.as_user('tamar');
select t.throws(format('select public.close_request(%L)', t.get('cleaning')), 'MA002', 'blocked owner close -> MA002');
select t.throws(format('select public.extend_request(%L)', t.get('cleaning')), 'MA002', 'blocked owner extend -> MA002');
select t.throws(format('select public.delete_request(%L)', t.get('cleaning')), 'MA002', 'blocked owner delete -> MA002');
select t.throws(format('select public.choose_offer(%L)', t.get('o_badco')), 'MA002', 'blocked owner choose -> MA002');
select t.ok((select count(*) from public.offers where request_id = t.get('cleaning')) = 1, 'blocked owner can still read own offers');
select t.as_user('admin');
select t.lives(format('select public.admin_set_blocked(%L, false)', t.uid('tamar')), 'admin unblocks owner');
select t.as_super();

-- ============================================================= 12. delete_request (owner)
select t.as_user('nino');
select t.ok((select count(*) from public.offers where request_id = t.get('linen')) = 1, 'linen has one offer before delete');
select t.lives(format('select public.delete_request(%L)', t.get('linen')), 'owner deletes own request');
select t.as_super();
select t.ok((select count(*) from public.offers where request_id = t.get('linen')) = 0, 'offers cascade-deleted with request');
select t.ok((select count(*) from public.requests where id = t.get('linen')) = 0, 'request deleted');

-- ============================================================= 13. photo_url: Vercel Blob URLs of the caller only
-- (upload itself is authorized by /api/blob-upload; the database only accepts URLs under
--  <photo_origin>/<caller id>/ with a raster-image file name)
create function t.try_photo(url text) returns void language plpgsql as $$
begin
  perform public.close_request((public.create_request('ფოტოს ტესტი', 'ფოტოს მისამართის შემოწმება', 'food', 'tbilisi', url)).id);
end $$;
grant execute on function t.try_photo(text) to public;
select t.as_user('nino');
select t.lives(format('select t.try_photo(%L)', t.photo('nino', 'chairs-1.jpg')), 'photo: own folder jpg accepted');
select t.lives(format('select t.try_photo(%L)', t.photo('nino', 'Photo_2.WEBP')), 'photo: webp, case-insensitive ext accepted');
select t.lives(format('select t.try_photo(%L)', t.photo('nino', 'a.jpeg')), 'photo: jpeg accepted');
select t.lives(format('select t.try_photo(%L)', t.photo('nino', 'anim.gif')), 'photo: gif accepted');
select t.lives(format('select t.try_photo(%L)', t.photo('nino', 'x.png')), 'photo: png accepted');
select t.lives(format('select t.try_photo(%L)', replace(t.photo('nino'), 'https://abcd1234.', 'https://ABCD1234.')), 'photo: host compared case-insensitively');
select t.lives(format('select t.try_photo(%L)', '   '), 'photo: blank url = no photo');
select t.throws(format('select t.try_photo(%L)', t.photo('wood', 'evil.jpg')), 'MA109', 'photo: another user folder -> MA109');
select t.throws(format('select t.try_photo(%L)', 'https://abcd1234.public.blob.vercel-storage.com/loose.jpg'), 'MA109', 'photo: outside any folder -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'sub/deep.jpg')), 'MA109', 'photo: nested folder -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'page.html')), 'MA109', 'photo: html -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'x.svg')), 'MA109', 'photo: svg -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'x.jpg.html')), 'MA109', 'photo: double extension -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'x.jpg?download=1')), 'MA109', 'photo: query string -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'x.jpg#frag')), 'MA109', 'photo: fragment -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', '..%2Fx.jpg')), 'MA109', 'photo: encoded traversal -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', '../' || t.uid('nino') || '/x.jpg')), 'MA109', 'photo: dot-dot segment -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'my photo.jpg')), 'MA109', 'photo: space in name -> MA109');
select t.throws(format('select t.try_photo(%L)', t.photo('nino', repeat('a', 101) || '.jpg')), 'MA109', 'photo: name longer than 100 -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), t.uid('nino')::text, upper(t.uid('nino')::text))), 'MA109', 'photo: upper-cased owner id is another path -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), 'abcd1234.', 'zzzz9999.')), 'MA109', 'photo: another Blob store -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), 'https://', 'http://')), 'MA109', 'photo: http downgrade -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), 'https://abcd1234.public.blob.vercel-storage.com/', 'https://abcd1234.public.blob.vercel-storage.com@evil.example/')), 'MA109', 'photo: userinfo trick -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), '.vercel-storage.com/', '.vercel-storage.com.evil.example/')), 'MA109', 'photo: origin as a prefix of another host -> MA109');
select t.throws(format('select t.try_photo(%L)', replace(t.photo('nino'), '.vercel-storage.com/', '.vercel-storage.com:8443/')), 'MA109', 'photo: other port -> MA109');
select t.throws(format('select t.try_photo(%L)', 'https://abcd1234.public.blob.vercel-storage.com/x/' || t.uid('nino') || '/a.jpg'), 'MA109', 'photo: owner folder not at the root -> MA109');
select t.throws(format('select t.try_photo(%L)', 'data:image/png;base64,AAAA'), 'MA109', 'photo: data: url -> MA109');
select t.as_user('bad');
select t.throws(format('select t.try_photo(%L)', t.photo('bad', 'spam.jpg')), 'MA002', 'photo: blocked user -> MA002');
select t.as_anon();
select t.throws(format('select t.try_photo(%L)', t.photo('nino', 'anon.jpg')), 'MA001', 'photo: anonymous -> MA001');
select t.as_super();
select t.throws(format($$insert into public.requests (owner_id, title, body, category, city, photo_url) values (%L, 'direct photo', 'direct photo body', 'food', 'tbilisi', %L)$$,
  t.uid('nino'), t.photo('wood')), '23514', 'photo: table CHECK ties the folder to the owner');

-- ============================================================= 14. signed in, email verified, no profile yet: read-only
select t.put('np', t.auth_user('noprofile@example.ge'));
select t.put('np_req', (select id from public.requests where not hidden and chosen_offer_id is null and owner_id = t.uid('nino') limit 1));
select t.put('np_offer', t.get('o_axis'));
select t.as_id(t.get('np'));
select t.ok((select count(*) from public.my_profile()) = 0, 'no-profile: my_profile() is empty');
select t.ok((select count(*) from public.requests) > 0, 'no-profile: can read requests');
select t.lives($$select id, role, company, industry, verified, city from public.profiles$$, 'no-profile: can read public profile columns');
select t.ok((select count(*) from public.offer_counts(array[t.get('chairs')])) = 1, 'no-profile: offer_counts works');
select t.ok((select count(*) from public.offers) = 0, 'no-profile: sees no offers');
select t.ok((select count(*) from public.contact_for_request(t.get('chairs'))) = 0, 'no-profile: gets no contact');
select t.throws($$select public.create_request('პროფილის გარეშე', 'პროფილის გარეშე განცხადება', 'food', 'tbilisi')$$, 'MA001', 'no-profile: create_request -> MA001');
select t.throws(format($$select public.send_offer(%L, 'პროფილის გარეშე შეთავაზება', 5)$$, t.get('np_req')), 'MA001', 'no-profile: send_offer -> MA001');
select t.throws(format('select public.close_request(%L)', t.get('np_req')), 'MA001', 'no-profile: close_request -> MA001');
select t.throws(format('select public.extend_request(%L)', t.get('np_req')), 'MA001', 'no-profile: extend_request -> MA001');
select t.throws(format('select public.delete_request(%L)', t.get('np_req')), 'MA001', 'no-profile: delete_request -> MA001');
select t.throws(format('select public.withdraw_offer(%L)', t.get('np_offer')), 'MA001', 'no-profile: withdraw_offer -> MA001');
select t.throws(format('select public.choose_offer(%L)', t.get('np_offer')), 'MA001', 'no-profile: choose_offer -> MA001');
select t.throws($$select public.admin_list_users()$$, 'MA001', 'no-profile: admin_list_users -> MA001');
select t.throws($$select public.admin_stats()$$, 'MA001', 'no-profile: admin_stats -> MA001');
select t.throws(format('select public.admin_set_hidden(%L, true)', t.get('np_req')), 'MA001', 'no-profile: admin_set_hidden -> MA001');
select t.throws(format('select public.admin_set_blocked(%L, true)', t.uid('bad')), 'MA001', 'no-profile: admin_set_blocked -> MA001');
select t.throws($$select phone from public.profiles$$, '42501', 'no-profile: cannot read phones');
select t.throws($$insert into public.profiles (id, name, company, phone, email, city) values (auth.uid(), 'Self Made', 'Self Made', '+995 555 222 444', 'noprofile@example.ge', 'tbilisi')$$, '42501', 'no-profile: cannot insert own profile directly');
select t.as_super();
select t.ok((select count(*) from public.requests where id = t.get('np_req')) = 1, 'no-profile: nothing was changed');

-- ============================================================= 15. the database owner (SQL editor) sees everything
select t.as_super();
select t.ok((select count(*) from public.offers) > 0 and (select count(*) from public.profiles where phone is not null) = 10, 'owner reads everything (admin tooling via SQL editor)');

-- ============================================================= summary
\o
\pset tuples_only on
\pset format unaligned
select format('ALL %s TESTS PASSED', count(*)) as result from t.passed;
