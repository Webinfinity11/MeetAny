-- MeetAny marketplace database (Neon Postgres + Neon Auth; served by the api/db.js Vercel Function).
-- Run the whole file as the database owner (neondb_owner) AFTER Neon Auth is enabled for this
-- branch/database (see db/CONTRACT.md §8). The Neon Data API is not used.
-- It is re-runnable: tables use IF NOT EXISTS, functions CREATE OR REPLACE,
-- policies are dropped and recreated, grants are reapplied.
--
-- Security model
--   * Every write goes through the SECURITY DEFINER RPCs below; the API roles
--     (anonymous / authenticated) have no INSERT/UPDATE/DELETE privilege on any table.
--   * Reads go through RLS. profiles exposes only public columns via column grants
--     (phone/email are readable only through my_profile(), contact_for_request()
--     and admin_list_users()).
--   * Offers are sealed: RLS lets only the request author, the offer author and
--     admins read them. Everyone else gets numbers only via offer_counts().
--   * Users live in neon_auth."user" (managed by Neon Auth; this file never writes there).
--     A profile is created only by complete_profile(), only for a signed-in user whose email
--     is verified, and only once. Until then the user can read but not act (MA001).
--   * role = 'admin' is never settable by clients. Promote an admin with:
--       update public.profiles set role = 'admin' where email = 'someone@example.ge';
--   * Identity comes from the Neon Auth JWT via pg_session_jwt: meetany_private.uid() (uuid from `sub`).
--   * Every business error is raised as  MESSAGE 'MAxxx: ...'  HINT 'MAxxx'
--     (SQLSTATE P0001). See db/CONTRACT.md for the code -> Georgian text table.

-- ============================================================= preflight
do $$
begin
  if to_regclass('neon_auth."user"') is null then
    raise exception 'neon_auth."user" not found: enable Neon Auth for this branch first (db/CONTRACT.md §8)';
  end if;
  -- The API roles. api/db.js switches to one of them per request (SET LOCAL ROLE), so RLS applies.
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then
    create role anonymous nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- api/db.js connects as the owner and switches role per request, so the owner must be a member.
  if not pg_has_role(current_user, 'anonymous', 'member') then execute format('grant anonymous to %I', current_user); end if;
  if not pg_has_role(current_user, 'authenticated', 'member') then execute format('grant authenticated to %I', current_user); end if;
end $$;

-- ============================================================= private helpers
create schema if not exists meetany_private;
revoke all on schema meetany_private from public;
grant usage on schema meetany_private to anonymous, authenticated;

-- Identity of the caller: the claims of the Neon Auth JWT that api/db.js verified (EdDSA) and put
-- into request.jwt.claims for this transaction only. NULL for anonymous calls.
create or replace function meetany_private.jwt() returns jsonb
language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;
create or replace function meetany_private.uid() returns uuid
language sql stable set search_path = '' as $$
  select case when meetany_private.jwt() ->> 'role' = 'authenticated'
               and meetany_private.jwt() ->> 'sub' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then (meetany_private.jwt() ->> 'sub')::uuid end
$$;

create or replace function meetany_private.categories() returns text[]
language sql immutable set search_path = '' as $$
  select array['furniture','construction','textiles','food','packaging','logistics','cleaning',
               'technology','marketing','finance','legal','tourism','other']::text[]
$$;

create or replace function meetany_private.cities() returns text[]
language sql immutable set search_path = '' as $$
  select array['tbilisi','batumi','kutaisi','rustavi','zugdidi','telavi','gori','georgia']::text[]
$$;

create or replace function meetany_private.is_category(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and p = any (meetany_private.categories())
$$;

create or replace function meetany_private.is_city(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and p = any (meetany_private.cities())
$$;

-- Same rules as MarketStore.normalizePhone: returns '+995 5XX XXX XXX' or NULL.
create or replace function meetany_private.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  l text;
begin
  if left(d, 3) = '995' then l := substr(d, 4);
  elsif left(d, 1) = '0' then l := substr(d, 2);
  else l := d;
  end if;
  if l !~ '^5[0-9]{8}$' then return null; end if;
  return '+995 ' || substr(l, 1, 3) || ' ' || substr(l, 4, 3) || ' ' || substr(l, 7, 3);
end
$$;

-- Shape of a request photo URL (Vercel Blob): <origin>/<owner uuid>/<file>.
-- The origin is a plain scheme://host[:port] (no userinfo, no path). <file> has no dots except
-- the extension and no '/', '?', '#', '%'. This is the table CHECK; create_request additionally
-- pins the origin to the configured Blob store (meetany_private.photo_origin()).
create or replace function meetany_private.valid_photo_url(p_url text, p_owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select p_url is not null and p_owner is not null and char_length(p_url) <= 400
     and p_url ~ ('^[hH][tT][tT][pP][sS]?://[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(:[0-9]{1,5})?/'
                  || p_owner::text
                  || '/[A-Za-z0-9_-][A-Za-z0-9_-]{0,99}\.([jJ][pP][eE]?[gG]|[pP][nN][gG]|[wW][eE][bB][pP]|[gG][iI][fF])$')
$$;

-- Raises a business error with a stable code. Codes are documented in CONTRACT.md.
create or replace function meetany_private.fail(p_code text) returns void
language plpgsql volatile set search_path = '' as $$
declare
  t text := case p_code
    when 'MA001' then 'not signed in'
    when 'MA002' then 'account is blocked'
    when 'MA003' then 'admin only'
    when 'MA101' then 'title must be at least 5 characters'
    when 'MA102' then 'description must be at least 10 characters'
    when 'MA103' then 'invalid category'
    when 'MA104' then 'invalid city'
    when 'MA105' then 'too many open requests (max 5)'
    when 'MA106' then 'request not found'
    when 'MA107' then 'request belongs to another user'
    when 'MA108' then 'chosen or hidden request cannot be extended'
    when 'MA109' then 'invalid photo url'
    when 'MA110' then 'request cannot be edited once it has offers or is chosen/hidden'
    when 'MA111' then 'quantity must be a positive number up to 1e9'
    when 'MA112' then 'quantity needs a valid unit (pcs, m2, kg, hour, service)'
    when 'MA113' then 'needed-by date must be between today and 2 years ahead'
    when 'MA201' then 'only company accounts can send offers'
    when 'MA202' then 'cannot send an offer on own request'
    when 'MA203' then 'request no longer accepts offers'
    when 'MA204' then 'offer must be at least 10 characters'
    when 'MA205' then 'price must be a positive number up to 1e9'
    when 'MA206' then 'offer not found'
    when 'MA207' then 'chosen offer cannot be withdrawn'
    when 'MA208' then 'request no longer allows choosing'
    when 'MA209' then 'offer was changed, reload before choosing'
    when 'MA210' then 'invalid price type (unit, total, negotiable)'
    when 'MA211' then 'a negotiable offer has no price'
    when 'MA212' then 'unit or total price type needs a price'
    when 'MA213' then 'delivery days must be an integer from 0 to 365'
    when 'MA301' then 'cannot block own account'
    when 'MA302' then 'user not found'
    when 'MA303' then 'only companies can be verified'
    when 'MA304' then 'moderation reason must be 3 to 500 characters'
    when 'MA401' then 'name is required'
    when 'MA402' then 'company name is required'
    when 'MA403' then 'invalid email'
    when 'MA404' then 'invalid phone, expected +995 5XX XXX XXX'
    when 'MA405' then 'phone already registered'
    when 'MA407' then 'invalid industry'
    when 'MA408' then 'email is not verified'
    when 'MA410' then 'about text is longer than 1000 characters'
    when 'MA411' then 'lists allow at most 8 items of up to 120 characters'
    else 'error' end;
begin
  raise exception using errcode = 'P0001', message = p_code || ': ' || t, hint = p_code;
end
$$;

-- ============================================================= tables
create table if not exists public.profiles (
  id uuid primary key references neon_auth."user" (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'company', 'admin')),
  name text not null check (char_length(name) between 2 and 80),
  company text not null check (char_length(company) between 2 and 100),
  phone text not null unique check (phone ~ '^\+995 5[0-9]{2} [0-9]{3} [0-9]{3}$'),
  email text not null,
  city text not null check (meetany_private.is_city(city)),
  industry text check (industry is null or meetany_private.is_category(industry)),
  verified boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_company_industry check (role <> 'company' or industry is not null)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  body text not null check (char_length(body) between 10 and 2000),
  category text not null check (meetany_private.is_category(category)),
  city text not null check (meetany_private.is_city(city)),
  photo_url text,
  status text not null default 'open' check (status in ('open', 'closed')),
  hidden boolean not null default false,
  chosen_offer_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  constraint requests_photo_url_check check (photo_url is null or meetany_private.valid_photo_url(photo_url, owner_id))
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  company_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 10 and 2000),
  price numeric(12, 2) check (price is null or (price > 0 and price <= 1000000000)),
  status text not null default 'sent' check (status in ('sent', 'chosen', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_request_company_key unique (request_id, company_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'requests_chosen_offer_id_fkey') then
    alter table public.requests
      add constraint requests_chosen_offer_id_fkey foreign key (chosen_offer_id)
      references public.offers (id) on delete set null;
  end if;
end $$;

-- Public company profile (shown on /v2/companies/): free text + short lists, edited by the owner
-- through update_my_profile(). Existing databases get the columns added in place.
create or replace function meetany_private.valid_items(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p), 0) <= 8
     and not exists (select 1 from unnest(coalesce(p, '{}'::text[])) x where x is null or char_length(x) not between 1 and 120)
$$;

create or replace function meetany_private.valid_cities(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p), 0) <= 8
     and not exists (select 1 from unnest(coalesce(p, '{}'::text[])) x where not meetany_private.is_city(x))
$$;

alter table public.profiles add column if not exists about text not null default '';
alter table public.profiles add column if not exists offers text[] not null default '{}';
alter table public.profiles add column if not exists seeks text[] not null default '{}';
alter table public.profiles add column if not exists service_cities text[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_public_fields_check') then
    alter table public.profiles add constraint profiles_public_fields_check check (
      char_length(about) <= 1000 and meetany_private.valid_items(offers)
      and meetany_private.valid_items(seeks) and meetany_private.valid_cities(service_cities));
  end if;
end $$;

-- Structured request / offer terms (added in place on existing databases).
--   requests.quantity + unit: both set or both null; 0 < quantity <= 1e9 (3 decimals).
--   requests.needed_by: "needed by" date; create/update_request accept today .. today + 2 years
--     (Tbilisi calendar date); not a table CHECK because it depends on the current date.
--   offers.price_type: 'negotiable' <=> price is null; 'unit' / 'total' need a price.
--   offers.vat_included / delivery_included: flags; delivery_days 0..365 or null.
--   profiles.verified_at: when the company was verified (null when not verified).
create or replace function meetany_private.units() returns text[]
language sql immutable set search_path = '' as $$
  select array['pcs','m2','kg','hour','service']::text[]
$$;

create or replace function meetany_private.is_unit(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and p = any (meetany_private.units())
$$;

-- Today's calendar date in Georgia (the site's users), used for needed_by.
create or replace function meetany_private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Tbilisi')::date
$$;

alter table public.requests add column if not exists quantity numeric(13, 3);
alter table public.requests add column if not exists unit text;
alter table public.requests add column if not exists needed_by date;
alter table public.offers add column if not exists price_type text not null default 'negotiable';
alter table public.offers add column if not exists vat_included boolean not null default false;
alter table public.offers add column if not exists delivery_days integer;
alter table public.offers add column if not exists delivery_included boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz;
-- Existing offers: a price means a total price, no price means "by agreement".
update public.offers set price_type = 'total' where price is not null and price_type = 'negotiable';
-- Existing verified companies: the verification date is unknown, use the sign-up date.
update public.profiles set verified_at = created_at where verified and verified_at is null;
update public.profiles set verified_at = null where not verified and verified_at is not null;

-- Moderation reasons, written by admin_set_hidden / admin_set_blocked and cleared when the request
-- is shown again / the account unblocked. requests.hidden_reason is readable wherever the row is
-- (a hidden row: its owner and admins only); profiles.blocked_reason is not in the public column
-- grant (the user reads it via my_profile, admins via admin_list_users).
alter table public.requests add column if not exists hidden_reason text;
alter table public.profiles add column if not exists blocked_reason text;
update public.requests set hidden_reason = null where not hidden and hidden_reason is not null;
update public.profiles set blocked_reason = null where not blocked and blocked_reason is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'requests_quantity_unit_check') then
    alter table public.requests add constraint requests_quantity_unit_check check (
      (quantity is null or (quantity > 0 and quantity <= 1000000000))
      and (unit is null or meetany_private.is_unit(unit))
      and ((quantity is null) = (unit is null)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offers_terms_check') then
    alter table public.offers add constraint offers_terms_check check (
      price_type in ('unit', 'total', 'negotiable')
      and ((price_type = 'negotiable') = (price is null))
      and (delivery_days is null or delivery_days between 0 and 365));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requests_hidden_reason_check') then
    alter table public.requests add constraint requests_hidden_reason_check check (
      hidden_reason is null or char_length(hidden_reason) between 3 and 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_blocked_reason_check') then
    alter table public.profiles add constraint profiles_blocked_reason_check check (
      blocked_reason is null or char_length(blocked_reason) between 3 and 500);
  end if;
end $$;

-- verified_at follows verified on every write path (admin_set_verified, SQL editor).
create or replace function meetany_private.profiles_verified_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.verified then
    new.verified_at := null;
  elsif new.verified_at is null or (tg_op = 'UPDATE' and not old.verified) then
    new.verified_at := now();
  end if;
  return new;
end
$$;
-- A moderation reason exists only while the request is hidden / the account blocked (every write path).
create or replace function meetany_private.clear_moderation_reason() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'requests' then
    if not new.hidden then new.hidden_reason := null; end if;
  elsif not new.blocked then
    new.blocked_reason := null;
  end if;
  return new;
end
$$;
drop trigger if exists requests_hidden_reason on public.requests;
create trigger requests_hidden_reason before insert or update of hidden, hidden_reason on public.requests
  for each row execute function meetany_private.clear_moderation_reason();
drop trigger if exists profiles_blocked_reason on public.profiles;
create trigger profiles_blocked_reason before insert or update of blocked, blocked_reason on public.profiles
  for each row execute function meetany_private.clear_moderation_reason();
drop trigger if exists profiles_verified_at on public.profiles;
create trigger profiles_verified_at before insert or update of verified, verified_at on public.profiles
  for each row execute function meetany_private.profiles_verified_at();

create index if not exists requests_owner_idx on public.requests (owner_id);
create index if not exists requests_created_idx on public.requests (created_at desc);
create index if not exists offers_request_idx on public.offers (request_id);
create index if not exists offers_company_idx on public.offers (company_id);

-- Deployment settings (not readable by API roles). Keys:
--   photo_origin  the public Vercel Blob store origin, e.g.
--                 'https://abcd1234efgh5678.public.blob.vercel-storage.com'.
--                 Unset -> every photo_url is rejected (MA109).
create table if not exists meetany_private.settings (
  key text primary key,
  value text not null
);

-- ============================================================= helpers that read tables
create or replace function meetany_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = meetany_private.uid() and p.role = 'admin' and not p.blocked)
$$;

create or replace function meetany_private.is_request_owner(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.requests r where r.id = p_request_id and r.owner_id = meetany_private.uid())
$$;

create or replace function meetany_private.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = meetany_private.uid() and not p.blocked)
$$;

-- The only origin whose URLs create_request accepts: settings.photo_origin (the Vercel Blob
-- store). NULL when unset or malformed -> photos are rejected (MA109).
create or replace function meetany_private.photo_origin() returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  select s.value into v from meetany_private.settings s where s.key = 'photo_origin';
  v := lower(rtrim(btrim(coalesce(v, '')), '/'));
  if v !~ '^https?://[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:[0-9]{1,5})?$' then return null; end if;
  return v;
end
$$;

-- Same states as MarketStore.requestState.
create or replace function meetany_private.request_state(r public.requests) returns text
language sql stable set search_path = '' as $$
  select case
    when r.hidden then 'hidden'
    when r.chosen_offer_id is not null then 'chosen'
    when r.status = 'closed' then 'closed'
    when r.expires_at <= now() then 'expired'
    else 'open' end
$$;

create or replace function meetany_private.open_count(p_owner uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.requests r
  where r.owner_id = p_owner and meetany_private.request_state(r) = 'open'
$$;

-- Signed-in, non-blocked caller's profile, or MA001 (signed out / no profile yet) / MA002.
create or replace function meetany_private.require_user() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles;
begin
  if meetany_private.uid() is null then perform meetany_private.fail('MA001'); end if;
  select * into p from public.profiles where id = meetany_private.uid();
  if not found then perform meetany_private.fail('MA001'); end if;
  if p.blocked then perform meetany_private.fail('MA002'); end if;
  return p;
end
$$;

create or replace function meetany_private.require_admin() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles := meetany_private.require_user();
begin
  if p.role <> 'admin' then perform meetany_private.fail('MA003'); end if;
  return p;
end
$$;

-- ============================================================= RLS + grants
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select to anonymous, authenticated using (true);  -- column grants below limit what is readable

drop policy if exists requests_select_visible on public.requests;
create policy requests_select_visible on public.requests
  for select to anonymous, authenticated
  using (not hidden or owner_id = meetany_private.uid() or meetany_private.is_admin());

drop policy if exists offers_select_sealed on public.offers;
create policy offers_select_sealed on public.offers
  for select to authenticated
  using (company_id = meetany_private.uid()
         or meetany_private.is_request_owner(request_id)
         or meetany_private.is_admin());

revoke all on public.profiles, public.requests, public.offers from public, anonymous, authenticated;
grant select (id, role, company, industry, verified, verified_at, city, about, offers, seeks, service_cities, created_at)
  on public.profiles to anonymous, authenticated;
grant select on public.requests to anonymous, authenticated;
grant select on public.offers to authenticated;

-- ============================================================= profile creation (after email verification)
-- Called by the browser right after the email code was verified (and on any later sign-in while
-- my_profile() is still empty). Identity and email come from Neon Auth, never from arguments:
--   * meetany_private.uid() must be a neon_auth."user" row                   -> else MA001
--   * a profile already exists -> it is returned unchanged (idempotent; no field is updated,
--     so repeated calls reveal nothing about other phone numbers)
--   * neon_auth."user"."emailVerified" must be true               -> else MA408
--     (skipped while meetany_private.settings require_email_verification = 'off')
--   * then the beta sign-up checks: MA401, MA402, MA403, MA404, MA104, MA407, MA405.
-- p_role 'company' -> company; anything else (incl. 'admin') -> client.
create or replace function public.complete_profile(
  p_role text, p_name text, p_company text default null, p_phone text default null,
  p_city text default null, p_industry text default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := meetany_private.uid();
  u record;
  p public.profiles;
  v_role text := case when p_role = 'company' then 'company' else 'client' end;  -- never admin
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_company text := left(btrim(coalesce(p_company, '')), 100);
  v_email text;
  v_phone text := meetany_private.normalize_phone(p_phone);
  v_industry text := nullif(p_industry, '');
begin
  if v_uid is null then perform meetany_private.fail('MA001'); end if;
  select nu.email, nu."emailVerified" as verified into u from neon_auth."user" nu where nu.id = v_uid;
  if not found then perform meetany_private.fail('MA001'); end if;
  select * into p from public.profiles where id = v_uid;
  if found then return p; end if;
  -- Email verification is on unless meetany_private.settings has require_email_verification = 'off'.
  if u.verified is not true
     and coalesce((select value from meetany_private.settings where key = 'require_email_verification'), 'on') <> 'off'
  then perform meetany_private.fail('MA408'); end if;
  v_email := lower(btrim(coalesce(u.email, '')));
  if char_length(v_name) < 2 then perform meetany_private.fail('MA401'); end if;
  if v_role = 'company' and char_length(v_company) < 2 then perform meetany_private.fail('MA402'); end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then perform meetany_private.fail('MA403'); end if;
  if v_phone is null then perform meetany_private.fail('MA404'); end if;
  if not meetany_private.is_city(p_city) then perform meetany_private.fail('MA104'); end if;
  if v_role = 'company' and not meetany_private.is_category(v_industry) then perform meetany_private.fail('MA407'); end if;
  if exists (select 1 from public.profiles x where x.phone = v_phone) then perform meetany_private.fail('MA405'); end if;
  begin
    insert into public.profiles (id, role, name, company, phone, email, city, industry)
    values (v_uid, v_role, v_name, case when char_length(v_company) >= 2 then v_company else v_name end,
            v_phone, v_email, p_city, case when v_role = 'company' then v_industry end)
    on conflict (id) do nothing;
  exception when unique_violation then
    perform meetany_private.fail('MA405');  -- concurrent sign-up took the same number
  end;
  select * into p from public.profiles where id = v_uid;
  return p;
end
$$;

-- ============================================================= public RPCs
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = meetany_private.uid()
$$;

create or replace function public.offer_counts(ids uuid[])
returns table (request_id uuid, offers integer)
language sql stable security definer set search_path = '' as $$
  select r.id, (select count(*)::int from public.offers o where o.request_id = r.id)
  from public.requests r
  where r.id = any ((coalesce(ids, '{}'::uuid[]))[1:1000])
    and (not r.hidden or r.owner_id = meetany_private.uid() or meetany_private.is_admin())
$$;

-- Quantity / unit / needed-by rules shared by create_request and update_request.
-- Returns (quantity rounded to 3 decimals, unit) or raises MA111 / MA112 / MA113.
-- Unit without quantity is ignored (both stored null). p_keep_date: a date already stored on the
-- request is accepted unchanged even when it is in the past (editing other fields of an old request).
create or replace function meetany_private.check_terms(
  p_quantity numeric, p_unit text, p_needed_by date, p_keep_date date default null,
  out quantity numeric, out unit text)
language plpgsql stable set search_path = '' as $$
begin
  if p_quantity is not null then
    if p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity > 1000000000 then perform meetany_private.fail('MA111'); end if;
    quantity := round(p_quantity, 3);
    if quantity <= 0 then perform meetany_private.fail('MA111'); end if;
    if not meetany_private.is_unit(p_unit) then perform meetany_private.fail('MA112'); end if;
    unit := p_unit;
  end if;
  if p_needed_by is not null and p_needed_by is distinct from p_keep_date
     and (p_needed_by < meetany_private.today()
          or p_needed_by > (meetany_private.today() + interval '2 years')::date) then
    perform meetany_private.fail('MA113');
  end if;
end
$$;

drop function if exists public.create_request(text, text, text, text, text);
create or replace function public.create_request(
  p_title text, p_body text, p_category text, p_city text, p_photo_url text default null,
  p_quantity numeric default null, p_unit text default null, p_needed_by date default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_title text := rtrim(left(btrim(coalesce(p_title, '')), 120));
  v_body text := rtrim(left(btrim(coalesce(p_body, '')), 2000));
  v_photo text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_origin text := meetany_private.photo_origin();
  v_terms record;
  r public.requests;
begin
  perform 1 from public.profiles where id = me.id for update;  -- serialize per owner
  if meetany_private.open_count(me.id) >= 5 then perform meetany_private.fail('MA105'); end if;
  if char_length(v_title) < 5 then perform meetany_private.fail('MA101'); end if;
  if char_length(v_body) < 10 then perform meetany_private.fail('MA102'); end if;
  if not meetany_private.is_category(p_category) then perform meetany_private.fail('MA103'); end if;
  if not meetany_private.is_city(p_city) then perform meetany_private.fail('MA104'); end if;
  -- Photo: <Blob store origin>/<caller id>/<file>. Only /api/blob-upload can mint an upload
  -- token for '<uid>/…', and only for a caller whose verified JWT has sub = uid.
  if v_photo is not null and (
       v_origin is null
       or not meetany_private.valid_photo_url(v_photo, me.id)
       or lower(left(v_photo, char_length(v_origin) + 1)) <> v_origin || '/'
       or substr(v_photo, char_length(v_origin) + 2, 37) <> me.id::text || '/') then
    perform meetany_private.fail('MA109');
  end if;
  v_terms := meetany_private.check_terms(p_quantity, p_unit, p_needed_by);
  insert into public.requests (owner_id, title, body, category, city, photo_url, quantity, unit, needed_by)
  values (me.id, v_title, v_body, p_category, p_city, v_photo, v_terms.quantity, v_terms.unit, p_needed_by)
  returning * into r;
  return r;
end
$$;

-- Loads a request for an owner/admin action (MA106 / MA107), locked FOR UPDATE.
create or replace function meetany_private.own_request(p_request_id uuid, me public.profiles)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found or (r.hidden and r.owner_id <> me.id and me.role <> 'admin') then
    perform meetany_private.fail('MA106');
  end if;
  if r.owner_id <> me.id and me.role <> 'admin' then perform meetany_private.fail('MA107'); end if;
  return r;
end
$$;

create or replace function public.close_request(p_request_id uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
begin
  update public.requests set status = 'closed' where id = r.id returning * into r;
  return r;
end
$$;

create or replace function public.extend_request(p_request_id uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
  s text := meetany_private.request_state(r);
begin
  if s not in ('open', 'expired', 'closed') then perform meetany_private.fail('MA108'); end if;
  if s <> 'open' then
    perform 1 from public.profiles where id = r.owner_id for update;
    if meetany_private.open_count(r.owner_id) >= 5 then perform meetany_private.fail('MA105'); end if;
  end if;
  update public.requests
     set status = 'open',
         expires_at = least(greatest(now(), expires_at) + interval '7 days', now() + interval '21 days')
   where id = r.id
  returning * into r;
  return r;
end
$$;

-- The author (or an admin) corrects a request while no company has answered it yet.
-- Once an offer exists the terms stay as the companies saw them (MA110).
-- Full replacement: an omitted quantity/unit/needed-by clears it.
drop function if exists public.update_request(uuid, text, text, text, text);
create or replace function public.update_request(
  p_request_id uuid, p_title text, p_body text, p_category text, p_city text,
  p_quantity numeric default null, p_unit text default null, p_needed_by date default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
  v_title text := rtrim(left(btrim(coalesce(p_title, '')), 120));
  v_body text := rtrim(left(btrim(coalesce(p_body, '')), 2000));
  v_terms record;
begin
  if meetany_private.request_state(r) in ('chosen', 'hidden')
     or exists (select 1 from public.offers o where o.request_id = r.id) then
    perform meetany_private.fail('MA110');
  end if;
  if char_length(v_title) < 5 then perform meetany_private.fail('MA101'); end if;
  if char_length(v_body) < 10 then perform meetany_private.fail('MA102'); end if;
  if not meetany_private.is_category(p_category) then perform meetany_private.fail('MA103'); end if;
  if not meetany_private.is_city(p_city) then perform meetany_private.fail('MA104'); end if;
  v_terms := meetany_private.check_terms(p_quantity, p_unit, p_needed_by, r.needed_by);
  update public.requests
     set title = v_title, body = v_body, category = p_category, city = p_city,
         quantity = v_terms.quantity, unit = v_terms.unit, needed_by = p_needed_by
   where id = r.id returning * into r;
  return r;
end
$$;

create or replace function public.delete_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
begin
  delete from public.requests where id = r.id;
end
$$;

-- p_price_type null (old clients): price given -> 'total', no price -> 'negotiable'.
-- 'negotiable' offers carry no price and no VAT flag (vat_included stored false).
drop function if exists public.send_offer(uuid, text, numeric);
create or replace function public.send_offer(
  p_request_id uuid, p_body text, p_price numeric default null, p_price_type text default null,
  p_vat_included boolean default null, p_delivery_days integer default null,
  p_delivery_included boolean default null)
returns public.offers
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests;
  v_body text := rtrim(left(btrim(coalesce(p_body, '')), 2000));
  v_price numeric(12, 2);
  v_type text := coalesce(p_price_type, case when p_price is null then 'negotiable' else 'total' end);
  o public.offers;
begin
  select * into r from public.requests where id = p_request_id for share;
  if not found or (r.hidden and r.owner_id <> me.id and me.role <> 'admin') then
    perform meetany_private.fail('MA106');
  end if;
  if me.role <> 'company' then perform meetany_private.fail('MA201'); end if;
  if r.owner_id = me.id then perform meetany_private.fail('MA202'); end if;
  if meetany_private.request_state(r) <> 'open' then perform meetany_private.fail('MA203'); end if;
  if char_length(v_body) < 10 then perform meetany_private.fail('MA204'); end if;
  if v_type not in ('unit', 'total', 'negotiable') then perform meetany_private.fail('MA210'); end if;
  if v_type = 'negotiable' and p_price is not null then perform meetany_private.fail('MA211'); end if;
  if v_type <> 'negotiable' and p_price is null then perform meetany_private.fail('MA212'); end if;
  if p_price is not null then
    if p_price = 'NaN'::numeric or p_price <= 0 or p_price > 1000000000 then perform meetany_private.fail('MA205'); end if;
    v_price := round(p_price, 2);
    if v_price <= 0 then perform meetany_private.fail('MA205'); end if;
  end if;
  if p_delivery_days is not null and p_delivery_days not between 0 and 365 then perform meetany_private.fail('MA213'); end if;
  insert into public.offers as x (request_id, company_id, body, price, price_type, vat_included,
                                  delivery_days, delivery_included)
  values (r.id, me.id, v_body, v_price, v_type,
          v_type <> 'negotiable' and coalesce(p_vat_included, false),
          p_delivery_days, coalesce(p_delivery_included, false))
  on conflict (request_id, company_id)
  do update set body = excluded.body, price = excluded.price, price_type = excluded.price_type,
                vat_included = excluded.vat_included, delivery_days = excluded.delivery_days,
                delivery_included = excluded.delivery_included, updated_at = now()
  returning * into o;
  return o;
end
$$;

create or replace function public.withdraw_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.company_id <> me.id then perform meetany_private.fail('MA206'); end if;
  if o.status = 'chosen' then perform meetany_private.fail('MA207'); end if;
  delete from public.offers where id = o.id;
end
$$;

drop function if exists public.choose_offer(uuid);
-- p_expected_updated_at: the offers.updated_at the author was shown. If the company edited the
-- offer since then, nothing is chosen (MA209) so the author never accepts a price they did not see.
create or replace function public.choose_offer(p_offer_id uuid, p_expected_updated_at timestamptz default null)
returns public.offers
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  o public.offers;
  r public.requests;
begin
  select * into o from public.offers where id = p_offer_id;
  if not found then perform meetany_private.fail('MA206'); end if;
  select * into r from public.requests where id = o.request_id for update;  -- serializes choices and edits
  if r.owner_id <> me.id then
    if o.company_id = me.id or me.role = 'admin' then perform meetany_private.fail('MA107'); end if;
    perform meetany_private.fail('MA206');  -- a sealed offer the caller cannot see
  end if;
  if meetany_private.request_state(r) <> 'open' then perform meetany_private.fail('MA208'); end if;
  select * into o from public.offers where id = p_offer_id for update;  -- current version, after the lock
  if not found then perform meetany_private.fail('MA206'); end if;
  if p_expected_updated_at is not null and o.updated_at <> p_expected_updated_at then
    perform meetany_private.fail('MA209');
  end if;
  update public.offers
     set status = case when id = o.id then 'chosen' else 'declined' end
   where request_id = r.id;
  update public.requests set chosen_offer_id = o.id where id = r.id;
  select * into o from public.offers where id = p_offer_id;
  return o;
end
$$;

-- The other side's contact, only between the request author and the chosen company.
create or replace function public.contact_for_request(p_request_id uuid)
returns table (name text, company text, phone text, email text)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := meetany_private.uid();
  r public.requests;
  o public.offers;
  other uuid;
begin
  if me is null or not meetany_private.can_write() then return; end if;  -- signed out, no profile, or blocked
  select * into r from public.requests where id = p_request_id;
  if not found or r.chosen_offer_id is null then return; end if;
  select * into o from public.offers where id = r.chosen_offer_id;
  if not found then return; end if;
  if me = r.owner_id then other := o.company_id;
  elsif me = o.company_id then other := r.owner_id;
  else return;
  end if;
  return query select p.name, p.company, p.phone, p.email from public.profiles p where p.id = other;
end
$$;

-- The caller edits their own profile. Phone, email, role, verified and blocked are not editable here.
-- Lists are trimmed, empty items dropped; service cities are de-duplicated in the fixed city order.
create or replace function public.update_my_profile(
  p_name text, p_company text, p_city text, p_industry text default null, p_about text default '',
  p_offers text[] default '{}', p_seeks text[] default '{}', p_service_cities text[] default '{}')
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_company text := left(btrim(coalesce(p_company, '')), 100);
  v_industry text := nullif(p_industry, '');
  v_about text := btrim(coalesce(p_about, ''));
  v_offers text[] := array(select btrim(x) from unnest(coalesce(p_offers, '{}'::text[])) with ordinality u(x, n)
                           where btrim(coalesce(x, '')) <> '' order by n);
  v_seeks text[] := array(select btrim(x) from unnest(coalesce(p_seeks, '{}'::text[])) with ordinality u(x, n)
                          where btrim(coalesce(x, '')) <> '' order by n);
  v_cities text[];
  p public.profiles;
begin
  if char_length(v_name) < 2 then perform meetany_private.fail('MA401'); end if;
  if me.role = 'company' and char_length(v_company) < 2 then perform meetany_private.fail('MA402'); end if;
  if not meetany_private.is_city(p_city) then perform meetany_private.fail('MA104'); end if;
  if me.role = 'company' and not meetany_private.is_category(v_industry) then perform meetany_private.fail('MA407'); end if;
  if char_length(v_about) > 1000 then perform meetany_private.fail('MA410'); end if;
  if not meetany_private.valid_items(v_offers) or not meetany_private.valid_items(v_seeks) then
    perform meetany_private.fail('MA411');
  end if;
  if exists (select 1 from unnest(coalesce(p_service_cities, '{}'::text[])) x where not meetany_private.is_city(x)) then
    perform meetany_private.fail('MA104');
  end if;
  v_cities := array(select c from unnest(meetany_private.cities()) with ordinality a(c, n)
                    where c = any (coalesce(p_service_cities, '{}'::text[])) order by n);
  update public.profiles
     set name = v_name,
         company = case when char_length(v_company) >= 2 then v_company else v_name end,
         city = p_city,
         industry = case when me.role = 'company' then v_industry else industry end,
         about = v_about, offers = v_offers, seeks = v_seeks, service_cities = v_cities
   where id = me.id
  returning * into p;
  return p;
end
$$;

-- Public activity numbers for company profiles: how many offers a company sent and how many
-- were chosen. Numbers only; offer contents stay sealed.
create or replace function public.company_stats(ids uuid[])
returns table (company_id uuid, offers_sent integer, offers_chosen integer)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select count(*)::int from public.offers o where o.company_id = p.id),
         (select count(*)::int from public.offers o where o.company_id = p.id and o.status = 'chosen')
  from public.profiles p
  where p.id = any ((coalesce(ids, '{}'::uuid[]))[1:1000]) and p.role = 'company'
$$;

-- The public company catalog: active (not blocked) companies with their public columns only.
-- Blocked accounts simply leave the list; the blocked flag itself stays private.
do $$
begin
  if to_regprocedure('public.list_companies()') is not null
     and pg_get_function_result(to_regprocedure('public.list_companies()')) not like '%verified_at%' then
    drop function public.list_companies();  -- result columns changed (verified_at added)
  end if;
end $$;
create or replace function public.list_companies()
returns table (id uuid, company text, industry text, verified boolean, verified_at timestamptz, city text,
               about text, offers text[], seeks text[], service_cities text[], created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.company, p.industry, p.verified, p.verified_at, p.city, p.about, p.offers, p.seeks,
         p.service_cities, p.created_at
  from public.profiles p
  where p.role = 'company' and not p.blocked
  order by p.verified desc, p.created_at desc
  limit 1000
$$;

-- ============================================================= admin RPCs
-- Moderation reason (p_reason): optional for the API, trimmed, 3..500 characters when given (MA304);
-- stored while hidden / blocked and cleared on show / unblock. The request page asks for it.
create or replace function meetany_private.moderation_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v is not null and char_length(v) not between 3 and 500 then perform meetany_private.fail('MA304'); end if;
  return v;
end
$$;

drop function if exists public.admin_set_hidden(uuid, boolean);  -- replaced by the 3-argument version
create or replace function public.admin_set_hidden(p_request_id uuid, p_hidden boolean, p_reason text default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  r public.requests;
begin
  update public.requests
     set hidden = coalesce(p_hidden, false),
         hidden_reason = case when coalesce(p_hidden, false) then v_reason end
   where id = p_request_id returning * into r;
  if not found then perform meetany_private.fail('MA106'); end if;
  return r;
end
$$;

create or replace function public.admin_delete_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  delete from public.requests where id = p_request_id;
end
$$;

drop function if exists public.admin_set_blocked(uuid, boolean);  -- replaced by the 3-argument version
create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
begin
  if p_user_id = me.id then perform meetany_private.fail('MA301'); end if;
  update public.profiles
     set blocked = coalesce(p_blocked, false),
         blocked_reason = case when coalesce(p_blocked, false) then v_reason end
   where id = p_user_id;
  if not found then perform meetany_private.fail('MA302'); end if;
end
$$;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  -- verified_at: now() when newly verified, kept when already verified, null when cleared.
  update public.profiles
     set verified = coalesce(p_verified, false),
         verified_at = case when not coalesce(p_verified, false) then null
                            when verified then verified_at else now() end
   where id = p_user_id and role = 'company';
  if not found then perform meetany_private.fail('MA303'); end if;
end
$$;

create or replace function public.admin_list_users() returns setof public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return query select * from public.profiles order by created_at desc;
end
$$;

-- 'users' counts the people using the marketplace: every profile except admins.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return jsonb_build_object(
    'users',     (select count(*) from public.profiles where role <> 'admin'),
    'companies', (select count(*) from public.profiles where role = 'company'),
    'verified',  (select count(*) from public.profiles where role = 'company' and verified),
    'open',      (select count(*) from public.requests r where meetany_private.request_state(r) = 'open'),
    'requests',  (select count(*) from public.requests where not hidden),
    'offers',    (select count(*) from public.offers),
    'chosen',    (select count(*) from public.requests where not hidden and chosen_offer_id is not null));
end
$$;

-- ============================================================= function privileges
revoke all on all functions in schema meetany_private from public, anonymous, authenticated;
revoke all on all tables in schema meetany_private from public, anonymous, authenticated;
-- Needed by RLS policies / check constraints evaluated as the calling role.
grant execute on function
  meetany_private.categories(), meetany_private.cities(),
  meetany_private.is_category(text), meetany_private.is_city(text),
  meetany_private.valid_photo_url(text, uuid),
  meetany_private.valid_items(text[]), meetany_private.valid_cities(text[]),
  meetany_private.units(), meetany_private.is_unit(text),
  meetany_private.is_admin(), meetany_private.is_request_owner(uuid), meetany_private.can_write(),
  meetany_private.jwt(), meetany_private.uid()
  to anonymous, authenticated;

revoke all on function
  public.complete_profile(text, text, text, text, text, text),
  public.my_profile(), public.offer_counts(uuid[]),
  public.create_request(text, text, text, text, text, numeric, text, date), public.close_request(uuid),
  public.extend_request(uuid), public.delete_request(uuid),
  public.send_offer(uuid, text, numeric, text, boolean, integer, boolean), public.withdraw_offer(uuid), public.choose_offer(uuid, timestamptz),
  public.contact_for_request(uuid),
  public.update_request(uuid, text, text, text, text, numeric, text, date),
  public.update_my_profile(text, text, text, text, text, text[], text[], text[]),
  public.company_stats(uuid[]), public.list_companies(),
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_list_users(), public.admin_stats()
  from public, anonymous, authenticated;

grant execute on function
  public.my_profile(), public.offer_counts(uuid[]), public.company_stats(uuid[]), public.list_companies(),
  public.create_request(text, text, text, text, text, numeric, text, date), public.close_request(uuid),
  public.extend_request(uuid), public.delete_request(uuid),
  public.update_request(uuid, text, text, text, text, numeric, text, date),
  public.update_my_profile(text, text, text, text, text, text[], text[], text[]),
  public.send_offer(uuid, text, numeric, text, boolean, integer, boolean), public.withdraw_offer(uuid), public.choose_offer(uuid, timestamptz),
  public.contact_for_request(uuid)
  to anonymous, authenticated;

grant execute on function
  public.complete_profile(text, text, text, text, text, text),
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_list_users(), public.admin_stats()
  to authenticated;
