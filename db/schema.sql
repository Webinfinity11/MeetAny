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
--     (phone is public for non-blocked profiles; email is readable only through my_profile(), contact_for_request()
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
  select array['food_fresh','food_processed','beverages','catering',
               'building_materials','renovation','engineering',
               'furniture','equipment','textiles',
               'packaging','printing',
               'freight','warehouse','customs',
               'wholesale','office_household',
               'cleaning','laundry','technical_service','security',
               'software_web','it_support',
               'branding_design','advertising','photo_video','events',
               'accounting','legal','consulting','hr_training',
               'hotel_services','tours',
               'other']::text[]
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

-- A company gallery: at most 8 photo URLs, each in the owner's own folder.
create or replace function meetany_private.valid_gallery(p_urls text[], p_owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select p_urls is not null and coalesce(array_length(p_urls, 1), 0) <= 8 and coalesce(array_ndims(p_urls), 1) = 1
     and not exists (select 1 from unnest(p_urls) u where not meetany_private.valid_photo_url(u, p_owner))
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
    when 'MA114' then 'address note is longer than 120 characters'
    when 'MA115' then 'invalid logo url'
    when 'MA116' then 'gallery allows at most 8 own gallery photos'
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
    when 'MA305' then 'photo not found on this profile'
    when 'MA401' then 'name is required'
    when 'MA402' then 'company name is required'
    when 'MA403' then 'invalid email'
    when 'MA404' then 'invalid phone, expected +995 5XX XXX XXX'
    when 'MA405' then 'phone already registered'
    when 'MA407' then 'invalid industry'
    when 'MA408' then 'email is not verified'
    when 'MA410' then 'about text is longer than 1000 characters'
    when 'MA411' then 'lists allow at most 8 items of up to 120 characters'
    when 'MA412' then 'address is longer than 200 characters'
    when 'MA413' then 'coordinates must be a valid latitude and longitude pair'
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

-- Optional public addresses. Coordinates are a pair; empty text is stored as NULL by RPCs.
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists lat double precision;
alter table public.profiles add column if not exists lng double precision;
alter table public.requests add column if not exists address_note text;
alter table public.profiles drop constraint if exists profiles_address_check;
alter table public.profiles add constraint profiles_address_check check
  (address is null or (address = btrim(address) and char_length(address) between 1 and 200));
alter table public.profiles drop constraint if exists profiles_coordinates_check;
alter table public.profiles add constraint profiles_coordinates_check check
  ((lat is null and lng is null) or
   (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180));
alter table public.requests drop constraint if exists requests_address_note_check;
alter table public.requests add constraint requests_address_note_check check
  (address_note is null or (address_note = btrim(address_note) and char_length(address_note) between 1 and 120));

-- Optional public company logo (Vercel Blob, same URL shape as a request photo, in the owner's
-- folder). update_my_profile additionally pins the Blob origin and a 'logo-' file name (MA115).
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles drop constraint if exists profiles_logo_url_check;
alter table public.profiles add constraint profiles_logo_url_check check
  (logo_url is null or meetany_private.valid_photo_url(logo_url, id));

-- Optional public company gallery; set_my_gallery additionally pins the Blob origin and a
-- 'gallery-' file name (MA116).
alter table public.profiles add column if not exists gallery text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_gallery_check;
alter table public.profiles add constraint profiles_gallery_check check
  (meetany_private.valid_gallery(gallery, id));

-- ============================================================= RLS + grants
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select to anonymous, authenticated using (not blocked);  -- blocked profiles are not public

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
grant select (id, role, company, phone, industry, verified, verified_at, city, about, offers, seeks, service_cities, created_at, address, lat, lng, logo_url, gallery)
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
drop function if exists public.create_request(text, text, text, text, text, numeric, text, date);
create or replace function public.create_request(
  p_title text, p_body text, p_category text, p_city text, p_photo_url text default null,
  p_quantity numeric default null, p_unit text default null, p_needed_by date default null, p_address_note text default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_title text := rtrim(left(btrim(coalesce(p_title, '')), 120));
  v_body text := rtrim(left(btrim(coalesce(p_body, '')), 2000));
  v_photo text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_origin text := meetany_private.photo_origin();
  v_address_note text := nullif(btrim(p_address_note), '');
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
  if char_length(v_address_note) > 120 then perform meetany_private.fail('MA114'); end if;
  v_terms := meetany_private.check_terms(p_quantity, p_unit, p_needed_by);
  insert into public.requests (owner_id, title, body, category, city, photo_url, quantity, unit, needed_by, address_note)
  values (me.id, v_title, v_body, p_category, p_city, v_photo, v_terms.quantity, v_terms.unit, p_needed_by, v_address_note)
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
drop function if exists public.update_request(uuid, text, text, text, text, numeric, text, date);
create or replace function public.update_request(
  p_request_id uuid, p_title text, p_body text, p_category text, p_city text,
  p_quantity numeric default null, p_unit text default null, p_needed_by date default null, p_address_note text default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  r public.requests := meetany_private.own_request(p_request_id, me);
  v_title text := rtrim(left(btrim(coalesce(p_title, '')), 120));
  v_body text := rtrim(left(btrim(coalesce(p_body, '')), 2000));
  v_address_note text := nullif(btrim(p_address_note), '');
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
  if char_length(v_address_note) > 120 then perform meetany_private.fail('MA114'); end if;
  v_terms := meetany_private.check_terms(p_quantity, p_unit, p_needed_by, r.needed_by);
  update public.requests
     set title = v_title, body = v_body, category = p_category, city = p_city,
         quantity = v_terms.quantity, unit = v_terms.unit, needed_by = p_needed_by, address_note = v_address_note
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
-- p_logo_url: null = keep the current logo, '' = remove it, otherwise
-- <Blob store origin>/<caller id>/logo-<name>.<ext> (MA115).
drop function if exists public.update_my_profile(text, text, text, text, text, text[], text[], text[]);
drop function if exists public.update_my_profile(text, text, text, text, text, text[], text[], text[], text, double precision, double precision);
create or replace function public.update_my_profile(
  p_name text, p_company text, p_city text, p_industry text default null, p_about text default '',
  p_offers text[] default '{}', p_seeks text[] default '{}', p_service_cities text[] default '{}',
  p_address text default null, p_lat double precision default null, p_lng double precision default null,
  p_logo_url text default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_company text := left(btrim(coalesce(p_company, '')), 100);
  v_industry text := nullif(p_industry, '');
  v_about text := btrim(coalesce(p_about, ''));
  v_address text := nullif(btrim(p_address), '');
  v_offers text[] := array(select btrim(x) from unnest(coalesce(p_offers, '{}'::text[])) with ordinality u(x, n)
                           where btrim(coalesce(x, '')) <> '' order by n);
  v_seeks text[] := array(select btrim(x) from unnest(coalesce(p_seeks, '{}'::text[])) with ordinality u(x, n)
                          where btrim(coalesce(x, '')) <> '' order by n);
  v_cities text[];
  v_logo text := btrim(p_logo_url);
  v_origin text := meetany_private.photo_origin();
  p public.profiles;
begin
  if char_length(v_name) < 2 then perform meetany_private.fail('MA401'); end if;
  if v_logo <> '' and (
       v_origin is null
       or not meetany_private.valid_photo_url(v_logo, me.id)
       or lower(left(v_logo, char_length(v_origin) + 1)) <> v_origin || '/'
       or substr(v_logo, char_length(v_origin) + 2, 42) <> me.id::text || '/logo-') then
    perform meetany_private.fail('MA115');
  end if;
  if me.role = 'company' and char_length(v_company) < 2 then perform meetany_private.fail('MA402'); end if;
  if not meetany_private.is_city(p_city) then perform meetany_private.fail('MA104'); end if;
  if me.role = 'company' and not meetany_private.is_category(v_industry) then perform meetany_private.fail('MA407'); end if;
  if char_length(v_address) > 200 then perform meetany_private.fail('MA412'); end if;
  if not ((p_lat is null and p_lng is null) or
          (p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180)) then
    perform meetany_private.fail('MA413');
  end if;
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
         about = v_about, offers = v_offers, seeks = v_seeks, service_cities = v_cities, address = v_address, lat = p_lat, lng = p_lng,
         logo_url = case when v_logo is null then logo_url else nullif(v_logo, '') end
   where id = me.id
  returning * into p;
  return p;
end
$$;

-- Company gallery: replaces the whole list (order kept, blanks and duplicates dropped); companies
-- only. Each URL: <Blob store origin>/<caller id>/gallery-<name>.<ext>, at most 8 (MA116).
create or replace function public.set_my_gallery(p_urls text[])
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_origin text := meetany_private.photo_origin();
  v_urls text[] := array(select u from (select btrim(x) u, min(n) n from unnest(coalesce(p_urls, '{}'::text[])) with ordinality a(x, n)
                                       where btrim(coalesce(x, '')) <> '' group by 1) d order by n);
  p public.profiles;
begin
  if me.role <> 'company' then perform meetany_private.fail('MA116'); end if;
  if cardinality(v_urls) > 8 or (cardinality(v_urls) > 0 and v_origin is null) or exists (
       select 1 from unnest(v_urls) u
       where not meetany_private.valid_photo_url(u, me.id)
          or lower(left(u, char_length(v_origin) + 1)) <> v_origin || '/'
          or substr(u, char_length(v_origin) + 2, 45) <> me.id::text || '/gallery-') then
    perform meetany_private.fail('MA116');
  end if;
  update public.profiles set gallery = v_urls where id = me.id returning * into p;
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
     and pg_get_function_result(to_regprocedure('public.list_companies()')) not like '%gallery%' then
    drop function public.list_companies();  -- result columns changed (address fields, logo_url, gallery added)
  end if;
end $$;
create or replace function public.list_companies()
returns table (id uuid, company text, industry text, verified boolean, verified_at timestamptz, city text,
               about text, offers text[], seeks text[], service_cities text[], created_at timestamptz,
               address text, lat double precision, lng double precision, logo_url text, gallery text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.company, p.industry, p.verified, p.verified_at, p.city, p.about, p.offers, p.seeks,
         p.service_cities, p.created_at, p.address, p.lat, p.lng, p.logo_url, p.gallery
  from public.profiles p
  where p.role = 'company' and not p.blocked
  order by p.verified desc, p.created_at desc
  limit 1000
$$;

-- Durable moderation history: identifiers deliberately have no cascading foreign keys.
create table if not exists meetany_private.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  actor_id uuid not null,
  target_type text not null check (target_type in ('request', 'user', 'offer')),
  target_id uuid not null,
  action text not null check (action in ('request.hide', 'request.show', 'request.delete', 'user.block', 'user.unblock', 'company.verify', 'company.unverify', 'offer.delete', 'user.photo_remove')),
  reason text check (reason is null or char_length(reason) between 3 and 500),
  old_flags jsonb not null,
  new_flags jsonb not null
);
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_target_type_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_target_type_check
  check (target_type in ('request','user','offer'));
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check
  check (action in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove'));

alter table meetany_private.moderation_audit enable row level security;
create index if not exists moderation_audit_page_idx on meetany_private.moderation_audit (created_at desc, id desc);
create index if not exists requests_admin_page_idx on public.requests (created_at desc, id desc);
create index if not exists profiles_admin_page_idx on public.profiles (created_at desc, id desc);
create or replace function meetany_private.reject_audit_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'moderation audit is append-only';
end $$;
drop trigger if exists moderation_audit_immutable on meetany_private.moderation_audit;
create trigger moderation_audit_immutable before update or delete or truncate on meetany_private.moderation_audit
for each statement execute function meetany_private.reject_audit_mutation();

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
  previous public.requests;
begin
  select * into previous from public.requests where id = p_request_id for update;
  if not found then perform meetany_private.fail('MA106'); end if;
  update public.requests
     set hidden = coalesce(p_hidden, false),
         hidden_reason = case when coalesce(p_hidden, false) then v_reason end
   where id = p_request_id returning * into r;
  if not found then perform meetany_private.fail('MA106'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'request',r.id,case when r.hidden then 'request.hide' else 'request.show' end,v_reason,
          jsonb_build_object('hidden',previous.hidden),jsonb_build_object('hidden',r.hidden));
  return r;
end
$$;

create or replace function public.admin_delete_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  previous public.requests;
begin
  delete from public.requests where id = p_request_id returning * into previous;
  if found then
    insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,old_flags,new_flags)
    values (me.id,'request',p_request_id,'request.delete',jsonb_build_object('hidden',previous.hidden,'deleted',false),jsonb_build_object('deleted',true));
  end if;
end
$$;

drop function if exists public.admin_set_blocked(uuid, boolean);  -- replaced by the 3-argument version
create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.profiles;
begin
  if p_user_id = me.id then perform meetany_private.fail('MA301'); end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if not found then perform meetany_private.fail('MA302'); end if;
  update public.profiles
     set blocked = coalesce(p_blocked, false),
         blocked_reason = case when coalesce(p_blocked, false) then v_reason end
   where id = p_user_id;
  if not found then perform meetany_private.fail('MA302'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p_user_id,case when coalesce(p_blocked,false) then 'user.block' else 'user.unblock' end,v_reason,
          jsonb_build_object('blocked',previous.blocked),jsonb_build_object('blocked',coalesce(p_blocked,false)));
end
$$;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  previous public.profiles;
begin
  select * into previous from public.profiles where id = p_user_id and role = 'company' for update;
  if not found then perform meetany_private.fail('MA303'); end if;
  -- verified_at: now() when newly verified, kept when already verified, null when cleared.
  update public.profiles
     set verified = coalesce(p_verified, false),
         verified_at = case when not coalesce(p_verified, false) then null
                            when verified then verified_at else now() end
   where id = p_user_id and role = 'company';
  if not found then perform meetany_private.fail('MA303'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,old_flags,new_flags)
  values (me.id,'user',p_user_id,case when coalesce(p_verified,false) then 'company.verify' else 'company.unverify' end,
          jsonb_build_object('verified',previous.verified),jsonb_build_object('verified',coalesce(p_verified,false)));
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

-- Validate cursors centrally. asOf bounds inserts, not a long-lived MVCC snapshot:
-- edits/deletes between pages remain visible and require refreshing the list.
create or replace function meetany_private.admin_page_cursor(p_cursor jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_time timestamptz;
  v_id uuid;
  v_asof timestamptz := statement_timestamp();
begin
  if p_cursor is null then return jsonb_build_object('asOf',v_asof); end if;
  if jsonb_typeof(p_cursor) <> 'object' or not (p_cursor ?& array['created_at','id','asOf']) then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end if;
  begin
    v_time := (p_cursor->>'created_at')::timestamptz;
    v_id := (p_cursor->>'id')::uuid;
    v_asof := (p_cursor->>'asOf')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end;
  if v_time is null or v_id is null or v_asof is null or not isfinite(v_time) or not isfinite(v_asof)
     or v_time > v_asof or v_asof > statement_timestamp() then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end if;
  return jsonb_build_object('created_at',v_time,'id',v_id,'asOf',v_asof);
end $$;

create or replace function public.admin_search_requests(p_q text default null, p_state text default null, p_category text default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_q),'');
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_state is not null and p_state not in ('open','closed','expired','chosen','hidden') then
    raise exception using errcode = '22023', message = 'invalid request state'; end if;
  if p_category is not null and not meetany_private.is_category(p_category) then
    raise exception using errcode = '22023', message = 'invalid category'; end if;
  with source as (select r.*, case when r.hidden then 'hidden' when r.chosen_offer_id is not null then 'chosen'
              when r.status = 'closed' then 'closed' when r.expires_at <= v_asof then 'expired' else 'open' end as state,
              p.name as owner_name, p.company as owner_company
       from public.requests r join public.profiles p on p.id=r.owner_id),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.title || ' ' || x.body || ' ' || x.owner_company || ' ' || x.owner_name)) > 0)
       and (p_state is null or x.state=p_state) and (p_category is null or x.category=p_category)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('offer_count',(select count(*) from public.offers o where o.request_id=p.id)) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_search_users(p_q text default null, p_role text default null, p_blocked boolean default null, p_verified boolean default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_q),'');
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_role is not null and p_role not in ('client','company','admin') then
    raise exception using errcode = '22023', message = 'invalid user role'; end if;
  with source as (select p.* from public.profiles p),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.name || ' ' || x.company || ' ' || x.email || ' ' || x.phone)) > 0)
       and (p_role is null or x.role=p_role) and (p_blocked is null or x.blocked=p_blocked)
       and (p_verified is null or x.verified=p_verified)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_list_audit(p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  with source as (select a.* from meetany_private.moderation_audit a),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and true
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_search_offers(p_q text default null, p_status text default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  v_q text := nullif(btrim(p_q),'');
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if char_length(v_q) > 200 then raise exception using errcode = '22023', message = 'search is too long'; end if;
  if p_status is not null and p_status not in ('sent','chosen','declined') then
    raise exception using errcode = '22023', message = 'invalid offer status'; end if;
  with source as (
    select o.*, coalesce(nullif(p.company,''),p.name) as company_name,
           r.title as request_title, r.hidden as request_hidden, p.name as search_name
    from public.offers o join public.profiles p on p.id=o.company_id
    join public.requests r on r.id=o.request_id
  ), filtered as materialized (
    select * from source x where x.created_at <= v_asof
      and (v_q is null or position(lower(v_q) in lower(concat_ws(' ',x.id::text,x.body,x.company_name,x.search_name,x.request_title))) > 0)
      and (p_status is null or x.status=p_status)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) - 'search_name' order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_delete_offer(p_offer_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.offers;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  select * into previous from public.offers where id=p_offer_id for update;
  if not found then perform meetany_private.fail('MA206'); end if;
  if previous.status='chosen' then perform meetany_private.fail('MA207'); end if;
  delete from public.offers where id=p_offer_id;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'offer',p_offer_id,'offer.delete',v_reason,
    jsonb_build_object('deleted',false,'status',previous.status,'request_id',previous.request_id,'company_id',previous.company_id),
    jsonb_build_object('deleted',true));
end $$;

create or replace function public.admin_delete_request_v2(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.requests;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  delete from public.requests where id=p_request_id returning * into previous;
  if not found then perform meetany_private.fail('MA106'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'request',p_request_id,'request.delete',v_reason,
    jsonb_build_object('hidden',previous.hidden,'deleted',false),jsonb_build_object('deleted',true));
end $$;

create or replace function public.admin_list_audit_v2(p_cursor jsonb default null, p_limit integer default 25, p_action text default null, p_target_type text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if p_action is not null and p_action not in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove') then
    raise exception using errcode = '22023', message = 'invalid audit action'; end if;
  if p_target_type is not null and p_target_type not in ('request','user','offer') then
    raise exception using errcode = '22023', message = 'invalid audit target type'; end if;
  with source as (select a.* from meetany_private.moderation_audit a),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (p_action is null or x.action=p_action) and (p_target_type is null or x.target_type=p_target_type)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'actor_name',coalesce(nullif(actor.company,''),actor.name),'actor_email',actor.email,
      'target_name',case p.target_type when 'user' then coalesce(nullif(u.company,''),u.name)
        when 'request' then r.title when 'offer' then case when o.id is not null then coalesce(nullif(company.company,''),company.name) end end,
      'target_exists',case p.target_type when 'user' then u.id is not null when 'request' then r.id is not null when 'offer' then o.id is not null end,
      'target_context',context.title,'target_context_id',case when p.target_type='offer' then (p.old_flags->>'request_id')::uuid end
    ) order by p.created_at desc,p.id desc) from page p
    left join public.profiles actor on actor.id=p.actor_id
    left join public.profiles u on p.target_type='user' and u.id=p.target_id
    left join public.requests r on p.target_type='request' and r.id=p.target_id
    left join public.offers o on p.target_type='offer' and o.id=p.target_id
    left join public.profiles company on p.target_type='offer' and company.id=(p.old_flags->>'company_id')::uuid
    left join public.requests context on p.target_type='offer' and context.id=(p.old_flags->>'request_id')::uuid),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

-- Removes one uploaded company photo (logo or gallery) with a reason; audited as user.photo_remove.
create or replace function public.admin_remove_company_photo(p_user_id uuid, p_url text, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  v_url text := btrim(coalesce(p_url, ''));
  previous public.profiles;
  v_field text;
  p public.profiles;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if not found then perform meetany_private.fail('MA302'); end if;
  if v_url <> '' and previous.logo_url = v_url then v_field := 'logo';
  elsif v_url <> '' and v_url = any (previous.gallery) then v_field := 'gallery';
  else perform meetany_private.fail('MA305'); end if;
  update public.profiles
     set logo_url = case when v_field = 'logo' then null else logo_url end,
         gallery = case when v_field = 'gallery' then array_remove(gallery, v_url) else gallery end
   where id = p_user_id
  returning * into p;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p_user_id,'user.photo_remove',v_reason,
    jsonb_build_object('field',v_field,'url',v_url),jsonb_build_object('field',v_field,'removed',true));
  return p;
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return jsonb_build_object(
    'adminApiVersion', 2,
    'hidden',    (select count(*) from public.requests where hidden),
    'blocked',   (select count(*) from public.profiles where blocked and role <> 'admin'),
    'users',     (select count(*) from public.profiles where role <> 'admin'),
    'companies', (select count(*) from public.profiles where role = 'company'),
    'verified',  (select count(*) from public.profiles where role = 'company' and verified),
    'open',      (select count(*) from public.requests r where meetany_private.request_state(r) = 'open'),
    'requests',  (select count(*) from public.requests where not hidden),
    'offers',    (select count(*) from public.offers),
    'chosen',    (select count(*) from public.requests where not hidden and chosen_offer_id is not null));
end
$$;

-- ============================================================= saved companies and offer notifications
create table if not exists meetany_private.saved_companies (
 user_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,company_id)
);
create index if not exists saved_companies_page_idx on meetany_private.saved_companies(user_id,created_at desc,company_id desc);
create table if not exists meetany_private.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email_offers boolean not null default false
);
create table if not exists meetany_private.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.requests(id) on delete cascade,
 offer_id uuid not null references public.offers(id) on delete cascade,
 kind text not null check(kind in ('offer_received','offer_chosen')),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(user_id,offer_id,kind)
);
create index if not exists notifications_page_idx on meetany_private.notifications(user_id,created_at desc,id desc);
create index if not exists notifications_unread_idx on meetany_private.notifications(user_id) where read_at is null;
create table if not exists meetany_private.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references meetany_private.notifications(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_id uuid, locked_until timestamptz, sent_at timestamptz, last_error text
);
create index if not exists notification_outbox_pending_idx on meetany_private.notification_outbox(available_at) where status in ('pending','processing');
alter table meetany_private.saved_companies enable row level security;
alter table meetany_private.notification_preferences enable row level security;
alter table meetany_private.notifications enable row level security;
alter table meetany_private.notification_outbox enable row level security;

-- Created with the business event in the same transaction; edits do not send new-offer alerts.
create or replace function meetany_private.notify_offer() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; target_offer uuid; target_request uuid; event_kind text; event_id uuid;
begin
 if tg_table_name='offers' then
  select owner_id into recipient from public.requests where id=new.request_id;
  target_offer:=new.id; target_request:=new.request_id; event_kind:='offer_received';
 else
  if new.chosen_offer_id is null or new.chosen_offer_id is not distinct from old.chosen_offer_id then return new; end if;
  select company_id into recipient from public.offers where id=new.chosen_offer_id;
  target_offer:=new.chosen_offer_id; target_request:=new.id; event_kind:='offer_chosen';
 end if;
 if recipient is null or not exists(select 1 from public.profiles where id=recipient and not blocked) then return new; end if;
 insert into meetany_private.notifications(user_id,request_id,offer_id,kind)
 values(recipient,target_request,target_offer,event_kind) on conflict do nothing returning id into event_id;
 if event_id is not null and exists(select 1 from meetany_private.notification_preferences where user_id=recipient and email_offers) then
  insert into meetany_private.notification_outbox(notification_id) values(event_id) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists notify_new_offer on public.offers;
create trigger notify_new_offer after insert on public.offers for each row execute function meetany_private.notify_offer();
drop trigger if exists notify_chosen_offer on public.requests;
create trigger notify_chosen_offer after update of chosen_offer_id on public.requests for each row execute function meetany_private.notify_offer();

create or replace function public.set_saved_company(p_company_id uuid,p_saved boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_saved is null then raise exception using errcode='22023',message='saved is required'; end if;
 if not p_saved then delete from meetany_private.saved_companies where user_id=me.id and company_id=p_company_id; return false; end if;
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 insert into meetany_private.saved_companies(user_id,company_id) values(me.id,p_company_id) on conflict do nothing;
 return true;
end $$;

create or replace function public.list_saved_companies(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select s.created_at,s.company_id,p.company,p.industry,p.city,p.about from meetany_private.saved_companies s
  join public.profiles p on p.id=s.company_id and p.role='company' and not p.blocked
  where s.user_id=me.id and s.created_at<=(c->>'asOf')::timestamptz
  and (p_cursor is null or (s.created_at,s.company_id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by s.created_at desc,s.company_id desc limit 26
 ), page as(select * from candidates order by created_at desc,company_id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.company_id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',company_id,'asOf',c->>'asOf') from page order by created_at,company_id limit 1) end) into result;
 return result;
end $$;

create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.request_id,n.created_at,n.read_at,r.title from meetany_private.notifications n
  join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
  and (p_cursor is null or (n.created_at,n.id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), page as(select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.engagement_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return jsonb_build_object('version',1,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id) where n.user_id=me.id and n.read_at is null),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false));
end $$;
create or replace function public.mark_notification_read(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 update meetany_private.notifications set read_at=coalesce(read_at,now()) where user_id=me.id and id=p_id;
end $$;
create or replace function public.set_notification_email(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_enabled is null then raise exception using errcode='22023',message='enabled is required'; end if;
 insert into meetany_private.notification_preferences(user_id,email_offers) values(me.id,p_enabled)
 on conflict(user_id) do update set email_offers=excluded.email_offers;
 if not p_enabled then
  update meetany_private.notification_outbox set status='cancelled',lease_id=null,locked_until=null
  where status in ('pending','processing') and notification_id in(select id from meetany_private.notifications where user_id=me.id);
 end if;
 return p_enabled;
end $$;

-- Worker-only delivery leases: no grants to application roles.
alter table meetany_private.notification_outbox add column if not exists first_attempt_at timestamptz;
alter table meetany_private.notification_outbox add column if not exists payload jsonb;
create or replace function meetany_private.claim_notification_email(p_from text,p_origin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job meetany_private.notification_outbox; event meetany_private.notifications; recipient public.profiles; message text;
begin
 if p_origin !~ '^https://[^/]+$' or p_from is null or length(p_from)<5 then raise exception using errcode='22023',message='invalid email configuration'; end if;
 -- Re-check consent, visibility and verified identity before every attempt.
 update meetany_private.notification_outbox o set status='cancelled',lease_id=null,locked_until=null
 where o.status in ('pending','processing') and not exists (
  select 1 from meetany_private.notifications n join public.profiles p on p.id=n.user_id and not p.blocked
  join neon_auth."user" u on u.id=p.id and u."emailVerified"=true
  join public.requests r on r.id=n.request_id and not r.hidden
  join meetany_private.notification_preferences pref on pref.user_id=p.id and pref.email_offers
  where n.id=o.notification_id
 );
 update meetany_private.notification_outbox set status='failed',last_error='retry_limit',lease_id=null,locked_until=null
 where status in ('pending','processing') and (attempts>=8 or first_attempt_at<now()-interval '23 hours')
 and (locked_until is null or locked_until<=now());
 select * into job from meetany_private.notification_outbox
 where ((status='pending' and available_at<=now()) or (status='processing' and locked_until<=now()))
 and attempts<8 order by available_at,id for update skip locked limit 1;
 if not found then return null; end if;
 select * into event from meetany_private.notifications where id=job.notification_id;
 select * into recipient from public.profiles where id=event.user_id;
 message:=case when event.kind='offer_chosen' then 'შენი შეთავაზება აირჩიეს' else 'ახალი შეთავაზება მიიღე' end;
 update meetany_private.notification_outbox set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',
 first_attempt_at=coalesce(first_attempt_at,now()),
 payload=coalesce(payload,jsonb_build_object('from',p_from,'to',jsonb_build_array(recipient.email),'subject','MeetAny · '||message,
 'text',message||E'\n\n'||p_origin||'/requests/view/?id='||event.request_id::text||E'\n\nშეტყობინებების პარამეტრები: '||p_origin||'/account/?tab=notifications'))
 where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'lease',job.lease_id,'payload',job.payload);
end $$;
create or replace function meetany_private.finish_notification_email(p_id uuid,p_lease uuid,p_success boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 update meetany_private.notification_outbox set
 status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when p_success then now() end,
 available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),
 locked_until=null,lease_id=null,last_error=case when p_success then null else left(coalesce(p_error,'delivery_error'),80) end
 where id=p_id and lease_id=p_lease and status='processing';
 get diagnostics affected=row_count;
 return affected=1;
end $$;

-- ============================================================= function privileges
revoke all on all functions in schema meetany_private from public, anonymous, authenticated;
revoke all on all tables in schema meetany_private from public, anonymous, authenticated;
-- Needed by RLS policies / check constraints evaluated as the calling role.
grant execute on function
  meetany_private.categories(), meetany_private.cities(),
  meetany_private.is_category(text), meetany_private.is_city(text),
  meetany_private.valid_photo_url(text, uuid), meetany_private.valid_gallery(text[], uuid),
  meetany_private.valid_items(text[]), meetany_private.valid_cities(text[]),
  meetany_private.units(), meetany_private.is_unit(text),
  meetany_private.is_admin(), meetany_private.is_request_owner(uuid), meetany_private.can_write(),
  meetany_private.jwt(), meetany_private.uid()
  to anonymous, authenticated;

revoke all on function
  public.complete_profile(text, text, text, text, text, text),
  public.my_profile(), public.offer_counts(uuid[]),
  public.create_request(text, text, text, text, text, numeric, text, date, text), public.close_request(uuid),
  public.extend_request(uuid), public.delete_request(uuid),
  public.send_offer(uuid, text, numeric, text, boolean, integer, boolean), public.withdraw_offer(uuid), public.choose_offer(uuid, timestamptz),
  public.contact_for_request(uuid),
  public.update_request(uuid, text, text, text, text, numeric, text, date, text),
  public.update_my_profile(text, text, text, text, text, text[], text[], text[], text, double precision, double precision, text),
  public.set_my_gallery(text[]),
  public.company_stats(uuid[]), public.list_companies(),
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_search_requests(text, text, text, jsonb, integer),
  public.admin_search_users(text, text, boolean, boolean, jsonb, integer),
  public.admin_list_audit(jsonb, integer),
  public.admin_search_offers(text,text,jsonb,integer), public.admin_delete_offer(uuid,text),
  public.admin_delete_request_v2(uuid,text), public.admin_list_audit_v2(jsonb,integer,text,text),
  public.admin_remove_company_photo(uuid, text, text),
  public.admin_list_users(), public.admin_stats()
  from public, anonymous, authenticated;

grant execute on function
  public.my_profile(), public.offer_counts(uuid[]), public.company_stats(uuid[]), public.list_companies(),
  public.create_request(text, text, text, text, text, numeric, text, date, text), public.close_request(uuid),
  public.extend_request(uuid), public.delete_request(uuid),
  public.update_request(uuid, text, text, text, text, numeric, text, date, text),
  public.update_my_profile(text, text, text, text, text, text[], text[], text[], text, double precision, double precision, text),
  public.set_my_gallery(text[]),
  public.send_offer(uuid, text, numeric, text, boolean, integer, boolean), public.withdraw_offer(uuid), public.choose_offer(uuid, timestamptz),
  public.contact_for_request(uuid)
  to anonymous, authenticated;

grant execute on function
  public.complete_profile(text, text, text, text, text, text),
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_search_requests(text, text, text, jsonb, integer),
  public.admin_search_users(text, text, boolean, boolean, jsonb, integer),
  public.admin_list_audit(jsonb, integer),
  public.admin_search_offers(text,text,jsonb,integer), public.admin_delete_offer(uuid,text),
  public.admin_delete_request_v2(uuid,text), public.admin_list_audit_v2(jsonb,integer,text,text),
  public.admin_remove_company_photo(uuid, text, text),
  public.admin_list_users(), public.admin_stats()
  to authenticated;

revoke all on function public.engagement_state(), public.set_saved_company(uuid,boolean), public.list_saved_companies(jsonb), public.list_notifications(jsonb), public.mark_notification_read(uuid), public.set_notification_email(boolean) from public, anonymous, authenticated;
grant execute on function public.engagement_state(), public.set_saved_company(uuid,boolean), public.list_saved_companies(jsonb), public.list_notifications(jsonb), public.mark_notification_read(uuid), public.set_notification_email(boolean) to authenticated;

-- Matching request alerts. Additive; does not configure a sender or schedule a worker.
begin;
set local lock_timeout='5s';

create table if not exists meetany_private.request_alert_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 enabled boolean not null default false, generation uuid not null default gen_random_uuid(),
 categories text[] not null default '{}', cities text[] not null default '{}',
 email_mode text not null default 'off' check(email_mode in ('off','instant','daily')),
 check(categories <@ meetany_private.categories() and array_position(categories,null) is null),
 check(cities <@ meetany_private.cities() and array_position(cities,null) is null),
 check(not enabled or (cardinality(categories)>0 and cardinality(cities)>0))
);
alter table meetany_private.request_alert_preferences enable row level security;
alter table meetany_private.notifications alter column offer_id drop not null;
alter table meetany_private.notifications drop constraint if exists notifications_kind_check;
alter table meetany_private.notifications add constraint notifications_kind_check check(kind in ('offer_received','offer_chosen','request_match'));
alter table meetany_private.notifications drop constraint if exists notifications_offer_kind_check;
alter table meetany_private.notifications add constraint notifications_offer_kind_check check((kind='request_match' and offer_id is null) or (kind<>'request_match' and offer_id is not null));
create unique index if not exists notifications_request_match_idx on meetany_private.notifications(user_id,request_id) where kind='request_match';

-- Separate email jobs preserve the existing offer outbox. A daily job has many items.
create table if not exists meetany_private.request_alert_emails (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 bucket text not null, mode text not null check(mode in ('instant','daily')),
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 available_at timestamptz not null, attempts integer not null default 0,
 lease_id uuid, locked_until timestamptz, first_attempt_at timestamptz, sent_at timestamptz,
 payload jsonb, frozen_ids uuid[], last_error text,
 unique(user_id,bucket)
);
create table if not exists meetany_private.request_alert_email_items (
 notification_id uuid primary key references meetany_private.notifications(id) on delete cascade,
 job_id uuid not null references meetany_private.request_alert_emails(id) on delete cascade
);
create index if not exists request_alert_emails_due_idx on meetany_private.request_alert_emails(available_at) where status in ('pending','processing');
create index if not exists request_alert_email_items_job_idx on meetany_private.request_alert_email_items(job_id);
alter table meetany_private.request_alert_emails enable row level security;
alter table meetany_private.request_alert_email_items enable row level security;

-- Missing preference rows follow the current company profile; saved rows always win.
create or replace function meetany_private.default_request_alert_preferences(p public.profiles)
returns table(enabled boolean,categories text[],cities text[],email_mode text)
language sql stable set search_path='' as $$
 with defaults as (
  select case when p.industry is not null then array[p.industry] else '{}'::text[] end cats,
   case when cardinality(p.service_cities)>0 then p.service_cities
    when p.city is not null then array[p.city] else '{}'::text[] end towns
 )
 select p.role='company' and cardinality(cats)>0 and cardinality(towns)>0,cats,
  case when 'georgia'=any(towns) then array['georgia'] else towns end,'off'::text
 from defaults
$$;
revoke all on function meetany_private.default_request_alert_preferences(public.profiles) from public, anonymous, authenticated;

create or replace function public.request_alert_preferences() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 select jsonb_build_object('enabled',enabled,'categories',categories,'cities',cities,'emailMode',email_mode)
 into result from meetany_private.request_alert_preferences where user_id=me.id;
 if result is null then
  select jsonb_build_object('enabled',enabled,'categories',categories,'cities',cities,'emailMode',email_mode)
  into result from meetany_private.default_request_alert_preferences(me);
 end if;
 return result;
end $$;

-- The marker and updates commit together; later explicit opt-outs survive every rerun.
do $$
begin
 insert into meetany_private.settings(key,value) values('request_alerts_default_on','on') on conflict(key) do nothing;
 if found then
  update meetany_private.request_alert_preferences set enabled=true
   where not enabled and cardinality(categories)>0 and cardinality(cities)>0;
  delete from meetany_private.request_alert_preferences
   where not enabled and (cardinality(categories)=0 or cardinality(cities)=0);
 end if;
end $$;

create or replace function public.set_request_alert_preferences(p_enabled boolean,p_categories text[],p_cities text[],p_email_mode text default 'off') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); cats text[]; towns text[]; changed boolean;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_enabled is null or p_email_mode is null or p_email_mode not in ('off','instant','daily')
 or p_categories is null or p_cities is null or cardinality(p_categories)>34 or cardinality(p_cities)>8
 or array_position(p_categories,null) is not null or array_position(p_cities,null) is not null
 or not p_categories <@ meetany_private.categories() or not p_cities <@ meetany_private.cities() then
  raise exception using errcode='22023',message='invalid request alert preferences';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into cats from unnest(p_categories) x;
 select coalesce(array_agg(distinct x order by x),'{}') into towns from unnest(p_cities) x;
 if 'georgia'=any(towns) then towns:=array['georgia']; end if;
 if p_enabled and (cardinality(cats)=0 or cardinality(towns)=0) then raise exception using errcode='22023',message='select categories and cities'; end if;
 insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities,email_mode)
 values(me.id,p_enabled,cats,towns,p_email_mode)
 on conflict(user_id) do update set enabled=excluded.enabled,categories=excluded.categories,cities=excluded.cities,email_mode=excluded.email_mode,generation=gen_random_uuid()
 where (request_alert_preferences.enabled,request_alert_preferences.categories,request_alert_preferences.cities,request_alert_preferences.email_mode)
 is distinct from (excluded.enabled,excluded.categories,excluded.cities,excluded.email_mode)
 returning true into changed;
 -- A preference change cancels queued delivery, not existing inbox history. No backfill.
 update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null
 where changed and user_id=me.id and status in ('pending','processing');
 return public.request_alert_preferences();
end $$;

create or replace function meetany_private.notify_matching_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare n meetany_private.notifications; mode text; due timestamptz; bucket_key text; job uuid; generation_id uuid;
begin
 if new.hidden or new.status<>'open' or new.expires_at<=now() or new.chosen_offer_id is not null
 or not exists(select 1 from public.profiles where id=new.owner_id and not blocked) then return new; end if;
 for n in
  insert into meetany_private.notifications(user_id,request_id,kind)
  select p.id,new.id,'request_match'
  from public.profiles p
  left join meetany_private.request_alert_preferences saved on saved.user_id=p.id
  cross join lateral meetany_private.default_request_alert_preferences(p) defaults
  cross join lateral (select
   case when saved.user_id is null then defaults.enabled else saved.enabled end enabled,
   case when saved.user_id is null then defaults.categories else saved.categories end categories,
   case when saved.user_id is null then defaults.cities else saved.cities end cities) pref
  where pref.enabled and p.role='company' and not p.blocked and p.id<>new.owner_id
    and new.category=any(pref.categories)
    and (new.city='georgia' or 'georgia'=any(pref.cities) or new.city=any(pref.cities))
  on conflict do nothing returning *
 loop
  select email_mode,generation into mode,generation_id from meetany_private.request_alert_preferences where user_id=n.user_id;
  if mode is null or mode='off' then continue; end if;
  if mode='daily' then
   due:=((now() at time zone 'Asia/Tbilisi')::date+time '20:00') at time zone 'Asia/Tbilisi';
   if due<=now() then due:=due+interval '1 day'; end if;
   bucket_key:='daily/'||generation_id::text||'/'||to_char(due at time zone 'UTC','YYYY-MM-DD HH24:MI');
  else due:=now(); bucket_key:='instant/'||n.id::text; end if;
  -- Cancelled buckets must never be revived (including after an opt-out/opt-in).
  insert into meetany_private.request_alert_emails(user_id,bucket,mode,available_at)
  values(n.user_id,bucket_key,mode,due)
  on conflict(user_id,bucket) do update set bucket=excluded.bucket
  returning id into job;
  insert into meetany_private.request_alert_email_items(notification_id,job_id) values(n.id,job) on conflict do nothing;
 end loop;
 return new;
end $$;
drop trigger if exists notify_matching_request on public.requests;
create trigger notify_matching_request after insert on public.requests for each row execute function meetany_private.notify_matching_request();

create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.request_id,n.created_at,n.read_at,r.title,r.category,r.city,r.needed_by
  from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
  and (n.kind<>'request_match' or (meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked)))
  and (p_cursor is null or (n.created_at,n.id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), page as(select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;
create or replace function public.engagement_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return jsonb_build_object('version',2,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.read_at is null and (n.kind<>'request_match' or (meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked)))),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false),
 'requestAlerts',case when me.role='company' then public.request_alert_preferences() else null end);
end $$;

-- Worker-only, leased and idempotent email batches. Do not call from the browser.
create or replace function meetany_private.claim_request_alert_email(p_from text,p_origin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job meetany_private.request_alert_emails; ids uuid[]; body text; recipient_email text; title text;
begin
 if p_origin !~ '^https://[^/]+$' or p_from is null or length(p_from)<5 then raise exception using errcode='22023',message='invalid email configuration'; end if;
 update meetany_private.request_alert_emails j set status='cancelled',lease_id=null,locked_until=null
 where j.status in ('pending','processing') and not exists (
  select 1 from meetany_private.request_alert_preferences pref join public.profiles p on p.id=pref.user_id and p.role='company' and not p.blocked
  join neon_auth."user" u on u.id=p.id and u."emailVerified"=true
  where pref.user_id=j.user_id and pref.enabled and pref.email_mode=j.mode
 );
 update meetany_private.request_alert_emails set status='failed',last_error='retry_limit',lease_id=null,locked_until=null
 where status in ('pending','processing') and (attempts>=8 or first_attempt_at<now()-interval '23 hours') and (locked_until is null or locked_until<=now());
 for job in select * from meetany_private.request_alert_emails
  where (status='pending' and available_at<=now()) or (status='processing' and locked_until<=now())
  order by available_at,id for update skip locked limit 50
 loop
  select array_agg(n.id order by n.id),string_agg(
   r.title||E'\n'||coalesce('{"tbilisi":"თბილისი","batumi":"ბათუმი","kutaisi":"ქუთაისი","rustavi":"რუსთავი","zugdidi":"ზუგდიდი","telavi":"თელავი","gori":"გორი","georgia":"მთელი საქართველო"}'::jsonb->>r.city,r.city)
   ||case when r.needed_by is not null then ' · საჭიროა '||to_char(r.needed_by,'DD.MM.YYYY') else '' end
   ||E'\n'||p_origin||'/requests/view/?id='||r.id::text,E'\n\n' order by n.created_at,n.id)
  into ids,body
  from meetany_private.request_alert_email_items i join meetany_private.notifications n on n.id=i.notification_id
  join public.requests r on r.id=n.request_id
  join public.profiles owner on owner.id=r.owner_id and not owner.blocked
  join meetany_private.request_alert_preferences pref on pref.user_id=n.user_id
  where i.job_id=job.id and meetany_private.request_state(r)='open'
   and r.category=any(pref.categories) and (r.city='georgia' or 'georgia'=any(pref.cities) or r.city=any(pref.cities));
  -- A retry cannot change provider content. If a request disappeared, cancel the frozen batch.
  if ids is null or (job.payload is not null and ids is distinct from job.frozen_ids) then
   update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null where id=job.id;
   continue;
  end if;
  select email into recipient_email from public.profiles where id=job.user_id;
  title:=case when job.mode='daily' then 'ახალი მოთხოვნების დღის შეჯამება ('||cardinality(ids)||')' else 'შენთვის ახალი მოთხოვნა გამოქვეყნდა' end;
  update meetany_private.request_alert_emails set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),
   frozen_ids=coalesce(frozen_ids,ids),payload=coalesce(payload,jsonb_build_object('from',p_from,'to',jsonb_build_array(recipient_email),'subject','MeetAny · '||title,
   'text',title||E'\n\n'||body||E'\n\nშეტყობინებების გამორთვა ან შეცვლა: '||p_origin||'/account/?tab=notifications'))
  where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'lease',job.lease_id,'payload',job.payload);
 end loop;
 return null;
end $$;
create or replace function meetany_private.finish_request_alert_email(p_id uuid,p_lease uuid,p_success boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 update meetany_private.request_alert_emails set status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when p_success then now() end,available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),
 lease_id=null,locked_until=null,last_error=case when p_success then null else left(coalesce(p_error,'delivery_error'),80) end
 where id=p_id and lease_id=p_lease and status='processing';
 get diagnostics affected=row_count; return affected=1;
end $$;
revoke all on meetany_private.request_alert_preferences,meetany_private.request_alert_emails,meetany_private.request_alert_email_items from public,anonymous,authenticated;
revoke all on function meetany_private.notify_matching_request(),meetany_private.claim_request_alert_email(text,text),meetany_private.finish_request_alert_email(uuid,uuid,boolean,text) from public,anonymous,authenticated;
revoke all on function public.request_alert_preferences(),public.set_request_alert_preferences(boolean,text[],text[],text) from public,anonymous,authenticated;
grant execute on function public.request_alert_preferences(),public.set_request_alert_preferences(boolean,text[],text[],text) to authenticated;
commit;
-- Contact disclosure/call-link activity, not completed telephone calls.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.contact_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid, actor_role text not null check(actor_role in ('anonymous','client','company','admin')),
 target_kind text not null check(target_kind in ('company','request')), target_id uuid not null,
 kind text not null check(kind in ('reveal','call')),
 source text not null check(source in ('company-list','company-profile','company-partnership','request-owner','chosen-offer')),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists contact_events_page_idx on meetany_private.contact_events(created_at desc,id desc);
create index if not exists contact_events_actor_idx on meetany_private.contact_events(target_kind,target_id,kind,actor_id,created_at desc);
alter table meetany_private.contact_events enable row level security;
revoke all on meetany_private.contact_events from public,anonymous,authenticated;

create or replace function public.log_contact_event(p_target_kind text,p_target_id uuid,p_kind text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles; actor uuid:=meetany_private.uid(); at_time timestamptz; event_id uuid;
begin
 if actor is not null then me:=meetany_private.require_user(); end if;
 if p_target_kind is null or p_target_kind not in ('company','request') or p_target_id is null
 or p_kind is null or p_kind not in ('reveal','call') or p_source is null
 or (p_target_kind='company' and p_source not in ('company-list','company-profile','company-partnership'))
 or (p_target_kind='request' and p_source not in ('request-owner','chosen-offer')) then
  raise exception using errcode='22023',message='invalid contact event';
 end if;
 if p_target_kind='company' then
  if not exists(select 1 from public.profiles where id=p_target_id and role='company' and not blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 else
  if not exists(select 1 from public.requests r join public.profiles p on p.id=r.owner_id where r.id=p_target_id and not r.hidden and not p.blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 end if;
 -- Serialize the anonymous global cap, and each signed-in actor's writes.
 perform pg_advisory_xact_lock(hashtextextended('meetany-contact:'||coalesce(actor::text,'anonymous'),0));
 at_time:=clock_timestamp();
 if exists(select 1 from meetany_private.contact_events where actor_id is not distinct from actor
  and target_kind=p_target_kind and target_id=p_target_id and kind=p_kind and created_at>at_time-interval '1 minute')
 or (actor is null and (select count(*) from meetany_private.contact_events where actor_id is null and created_at>at_time-interval '1 minute')>=120) then
  return jsonb_build_object('recorded',false);
 end if;
 insert into meetany_private.contact_events(actor_id,actor_role,target_kind,target_id,kind,source,created_at)
 values(actor,coalesce(me.role,'anonymous'),p_target_kind,p_target_id,p_kind,p_source,at_time) returning id into event_id;
 return jsonb_build_object('recorded',true,'id',event_id);
end $$;

create or replace function public.admin_contact_events(p_cursor jsonb default null,p_kind text default null,p_target_kind text default null,p_from timestamptz default null,p_to timestamptz default null,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor);
 lim integer:=least(coalesce(p_limit,25),100); result jsonb;
begin
 if lim<1 or (p_kind is not null and p_kind not in ('reveal','call'))
 or (p_target_kind is not null and p_target_kind not in ('company','request'))
 or (p_from is not null and not isfinite(p_from)) or (p_to is not null and not isfinite(p_to)) or p_from>p_to then
 raise exception using errcode='22023',message='invalid contact filters'; end if;
 with filtered as materialized (
  select e.* from meetany_private.contact_events e where created_at<=(c->>'asOf')::timestamptz
  and (p_kind is null or kind=p_kind) and (p_target_kind is null or target_kind=p_target_kind)
  and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)
 ), candidates as (
  select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid)
  order by created_at desc,id desc limit lim+1
 ), page as (select * from candidates order by created_at desc,id desc limit lim), enriched as (
  select e.*,a.name actor_name,a.company actor_company,
   case when e.target_kind='company' then coalesce(nullif(p.company,''),p.name) else r.title end target_name,
   case when e.target_kind='company' then p.id is not null else r.id is not null end target_exists
  from page e left join public.profiles a on a.id=e.actor_id
  left join public.profiles p on e.target_kind='company' and p.id=e.target_id
  left join public.requests r on e.target_kind='request' and r.id=e.target_id
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc,id desc) from enriched e),'[]'::jsonb),
 'hasMore',(select count(*)>lim from candidates),
 'nextCursor',case when (select count(*)>lim from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end,
 'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf') into result;
 return result;
end $$;

create or replace function public.admin_contact_stats(p_period text default 'month') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); since_time timestamptz; result jsonb;
begin
 if p_period is null or p_period not in ('day','week','month') then raise exception using errcode='22023',message='invalid contact period'; end if;
 since_time:=case p_period when 'day' then date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi' when 'week' then now()-interval '7 days' else now()-interval '30 days' end;
 with periods as (
  select label,starts from (values ('day',date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi'),('week',now()-interval '7 days'),('month',now()-interval '30 days')) p(label,starts)
 ), totals as (
  select label,count(e.id) filter(where e.kind='reveal') reveals,count(e.id) filter(where e.kind='call') calls
  from periods p left join meetany_private.contact_events e on e.created_at>=p.starts and e.created_at<=now() group by label
 ), ranked as (
  select target_kind,target_id,count(*) filter(where kind='reveal') reveals,count(*) filter(where kind='call') calls,count(*) total
  from meetany_private.contact_events where created_at>=since_time and created_at<=now() group by target_kind,target_id
 ), companies as (
  select x.*,coalesce(nullif(p.company,''),p.name,'წაშლილი კომპანია') target_name,p.id is not null target_exists
  from ranked x left join public.profiles p on p.id=x.target_id where target_kind='company' order by total desc,target_id limit 10
 ), requests as (
  select x.*,coalesce(r.title,'წაშლილი მოთხოვნა') target_name,r.id is not null target_exists
  from ranked x left join public.requests r on r.id=x.target_id where target_kind='request' order by total desc,target_id limit 10
 ) select jsonb_build_object('period',p_period,'totals',(select jsonb_object_agg(label,jsonb_build_object('reveals',reveals,'calls',calls)) from totals),
 'companies',coalesce((select jsonb_agg(to_jsonb(x) order by total desc,target_id) from companies x),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(x) order by total desc,target_id) from requests x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.log_contact_event(text,uuid,text,text),public.admin_contact_events(jsonb,text,text,timestamptz,timestamptz,integer),public.admin_contact_stats(text) from public,anonymous,authenticated;
grant execute on function public.log_contact_event(text,uuid,text,text) to anonymous,authenticated;
grant execute on function public.admin_contact_events(jsonb,text,text,timestamptz,timestamptz,integer),public.admin_contact_stats(text) to authenticated;
commit;

-- Private participant messaging; additive and rerunnable. No realtime service or UI.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.conversations (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid references public.requests(id) on delete set null,
 context_key text not null,
 created_at timestamptz not null default clock_timestamp(),
 last_message_at timestamptz,
 client_last_read_at timestamptz, company_last_read_at timestamptz,
 check(client_id<>company_id),
 check(context_key='general' or context_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 check(request_id is null or context_key=request_id::text),
 unique(client_id,company_id,context_key)
);
create table if not exists meetany_private.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references meetany_private.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000 and body=regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')),
 created_at timestamptz not null default clock_timestamp(), read_at timestamptz
);
create index if not exists conversations_client_idx on meetany_private.conversations(client_id,last_message_at desc);
create index if not exists conversations_company_idx on meetany_private.conversations(company_id,last_message_at desc);
create index if not exists conversations_request_idx on meetany_private.conversations(request_id) where request_id is not null;
create index if not exists conversations_page_idx on meetany_private.conversations(created_at desc,id desc);
create index if not exists messages_conversation_idx on meetany_private.messages(conversation_id,created_at,id);
create index if not exists messages_sender_idx on meetany_private.messages(sender_id,created_at desc);
create index if not exists messages_unread_idx on meetany_private.messages(conversation_id,sender_id) where read_at is null;
alter table meetany_private.conversations enable row level security;
alter table meetany_private.messages enable row level security;
revoke all on meetany_private.conversations,meetany_private.messages from public,anonymous,authenticated;

-- A deleted request must not merge its conversation with the general thread.
create or replace function meetany_private.messaging_context_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.client_id,new.company_id,new.context_key) is distinct from (old.client_id,old.company_id,old.context_key)
 or (new.request_id is distinct from old.request_id and new.request_id is not null) then
  perform meetany_private.fail('MA507');
 end if;
 return new;
end $$;
drop trigger if exists messaging_context_guard on meetany_private.conversations;
create trigger messaging_context_guard before update on meetany_private.conversations
for each row execute function meetany_private.messaging_context_guard();

create or replace function meetany_private.require_conversation(p_id uuid,p_user_id uuid) returns meetany_private.conversations
language plpgsql stable security definer set search_path='' as $$
declare c meetany_private.conversations;
begin
 select * into c from meetany_private.conversations where id=p_id and p_user_id in (client_id,company_id);
 if not found then perform meetany_private.fail('MA501'); end if;
 return c;
end $$;

create or replace function public.start_conversation(p_company_id uuid,p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); client uuid:=me.id; context text:=coalesce(p_request_id::text,'general'); c meetany_private.conversations;
begin
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then
  perform meetany_private.fail('MA502'); end if;
 if p_request_id is not null then
  select owner_id into client from public.requests where id=p_request_id and not hidden;
  if not found then perform meetany_private.fail('MA504'); end if;
  if me.id<>client and me.id<>p_company_id then perform meetany_private.fail('MA504'); end if;
  if not exists(select 1 from public.profiles where id=client and not blocked) then perform meetany_private.fail('MA504'); end if;
 end if;
 if client=p_company_id then perform meetany_private.fail('MA503'); end if;
 insert into meetany_private.conversations(client_id,company_id,request_id,context_key)
 values(client,p_company_id,p_request_id,context)
 on conflict(client_id,company_id,context_key) do nothing;
 select * into c from meetany_private.conversations where client_id=client and company_id=p_company_id and context_key=context;
 return to_jsonb(c);
end $$;

create or replace function public.send_message(p_conversation_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c meetany_private.conversations;
 text_body text:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g'); at_time timestamptz; m meetany_private.messages;
begin
 c:=meetany_private.require_conversation(p_conversation_id,me.id);
 if text_body is null or char_length(text_body) not between 1 and 2000 then perform meetany_private.fail('MA505'); end if;
 -- Sender lock protects the global sliding-minute cap across all conversations.
 perform pg_advisory_xact_lock(hashtextextended('meetany-message:'||me.id::text,0));
 -- Sending and marking read serialize per conversation; timestamps follow commit order.
 select * into c from meetany_private.conversations where id=c.id for update;
 if not found then perform meetany_private.fail('MA501'); end if;
 at_time:=clock_timestamp();
 if (select count(*) from meetany_private.messages where sender_id=me.id and created_at>at_time-interval '1 minute')>=20
 or exists(select 1 from meetany_private.messages where sender_id=me.id and conversation_id=c.id and created_at>at_time-interval '2 seconds') then
  perform meetany_private.fail('MA506'); end if;
 at_time:=greatest(at_time,c.last_message_at+interval '1 microsecond');
 insert into meetany_private.messages(conversation_id,sender_id,body,created_at)
 values(c.id,me.id,text_body,at_time) returning * into m;
 update meetany_private.conversations set last_message_at=at_time where id=c.id;
 return to_jsonb(m);
end $$;

create or replace function public.list_my_conversations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last,x.created_at desc,x.id desc),'[]'::jsonb) into result from (
  select c.*,p.id other_id,p.name other_name,p.company other_company,
   (select to_jsonb(m) from meetany_private.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) last_message,
   (select count(*) from meetany_private.messages m where m.conversation_id=c.id and m.sender_id<>me.id and m.read_at is null) unread_count
  from meetany_private.conversations c join public.profiles p on p.id=case when c.client_id=me.id then c.company_id else c.client_id end
  where me.id in (c.client_id,c.company_id)
 ) x;
 return result;
end $$;

create or replace function public.list_messages(p_conversation_id uuid,p_after timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 perform meetany_private.require_conversation(p_conversation_id,me.id);
 if p_after is not null and not isfinite(p_after) then raise exception using errcode='22023',message='invalid message timestamp'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by created_at,id),'[]'::jsonb) into result
 from meetany_private.messages m where conversation_id=p_conversation_id and (p_after is null or created_at>p_after);
 return result;
end $$;

create or replace function public.mark_read(p_conversation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c meetany_private.conversations; at_time timestamptz; marked integer;
begin
 c:=meetany_private.require_conversation(p_conversation_id,me.id);
 select * into c from meetany_private.conversations where id=c.id for update;
 if not found then perform meetany_private.fail('MA501'); end if;
 at_time:=clock_timestamp();
 update meetany_private.messages set read_at=at_time where conversation_id=c.id and sender_id<>me.id and read_at is null;
 get diagnostics marked=row_count;
 update meetany_private.conversations set
 client_last_read_at=case when client_id=me.id then at_time else client_last_read_at end,
 company_last_read_at=case when company_id=me.id then at_time else company_last_read_at end where id=c.id;
 return jsonb_build_object('marked',marked,'read_at',at_time);
end $$;

create or replace function public.unread_message_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result bigint;
begin
 select count(*) into result from meetany_private.messages m join meetany_private.conversations c on c.id=m.conversation_id
 where me.id in (c.client_id,c.company_id) and m.sender_id<>me.id and m.read_at is null;
 return result;
end $$;

create or replace function public.admin_list_conversations(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with filtered as materialized (select * from meetany_private.conversations where created_at<=(c->>'asOf')::timestamptz),
 candidates as (select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid) order by created_at desc,id desc limit 26),
 page as (select * from candidates order by created_at desc,id desc limit 25),
 enriched as (select x.*,a.name client_name,a.company client_company,b.name company_name,b.company company,
 (select to_jsonb(m) from meetany_private.messages m where conversation_id=x.id order by created_at desc,id desc limit 1) last_message
 from page x join public.profiles a on a.id=x.client_id join public.profiles b on b.id=x.company_id)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from enriched x),'[]'::jsonb),
 'hasMore',(select count(*)>25 from candidates),'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf',
 'nextCursor',case when (select count(*)>25 from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.admin_conversation_messages(p_conversation_id uuid,p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 if not exists(select 1 from meetany_private.conversations where id=p_conversation_id) then perform meetany_private.fail('MA501'); end if;
 with filtered as materialized (select * from meetany_private.messages where conversation_id=p_conversation_id and created_at<=(c->>'asOf')::timestamptz),
 candidates as (select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid) order by created_at desc,id desc limit 26),
 page as (select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from page x),'[]'::jsonb),
 'hasMore',(select count(*)>25 from candidates),'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf',
 'nextCursor',case when (select count(*)>25 from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.admin_message_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); result jsonb;
begin
 with periods as (select label,starts from (values
 ('day',date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi'),
 ('week',now()-interval '7 days'),('month',now()-interval '30 days')) p(label,starts))
 select jsonb_build_object('totals',jsonb_object_agg(label,jsonb_build_object(
 'conversations',(select count(*) from meetany_private.conversations where created_at>=p.starts and created_at<=now()),
 'messages',(select count(*) from meetany_private.messages where created_at>=p.starts and created_at<=now())))) into result from periods p;
 return result;
end $$;

revoke all on function meetany_private.require_conversation(uuid,uuid),meetany_private.messaging_context_guard() from public,anonymous,authenticated;
revoke all on function public.start_conversation(uuid,uuid),public.send_message(uuid,text),public.list_my_conversations(),public.list_messages(uuid,timestamptz),public.mark_read(uuid),public.unread_message_count(),public.admin_list_conversations(jsonb),public.admin_conversation_messages(uuid,jsonb),public.admin_message_stats() from public,anonymous,authenticated;
grant execute on function public.start_conversation(uuid,uuid),public.send_message(uuid,text),public.list_my_conversations(),public.list_messages(uuid,timestamptz),public.mark_read(uuid),public.unread_message_count(),public.admin_list_conversations(jsonb),public.admin_conversation_messages(uuid,jsonb),public.admin_message_stats() to authenticated;
commit;

-- Conversation hygiene (T12.3b); additive and rerunnable. Apply after 20260923-messaging.sql.
-- 1. list_my_conversations hides an empty conversation (no message yet) from everyone except
--    the participant who started it (new column started_by; legacy rows with null are hidden
--    until the first message).
-- 2. Deleting a request (delete_request, admin_delete_request, owner SQL, profile cascade)
--    deletes that request's conversations and their messages. A request conversation has no
--    other link: its context_key is the request UUID and it never merges with 'general'.
--    General conversations are untouched.
-- 3. Removes conversations already orphaned by earlier request deletions
--    (request_id null, context_key not 'general').
begin;
set local lock_timeout='5s';

alter table meetany_private.conversations
 add column if not exists started_by uuid references public.profiles(id) on delete cascade;

create or replace function meetany_private.delete_request_conversations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from meetany_private.conversations where request_id=old.id;
 return old;
end $$;
drop trigger if exists requests_delete_conversations on public.requests;
create trigger requests_delete_conversations before delete on public.requests
for each row execute function meetany_private.delete_request_conversations();

delete from meetany_private.conversations where request_id is null and context_key<>'general';

create or replace function public.start_conversation(p_company_id uuid,p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); client uuid:=me.id; context text:=coalesce(p_request_id::text,'general'); c meetany_private.conversations;
begin
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then
  perform meetany_private.fail('MA502'); end if;
 if p_request_id is not null then
  select owner_id into client from public.requests where id=p_request_id and not hidden;
  if not found then perform meetany_private.fail('MA504'); end if;
  if me.id<>client and me.id<>p_company_id then perform meetany_private.fail('MA504'); end if;
  if not exists(select 1 from public.profiles where id=client and not blocked) then perform meetany_private.fail('MA504'); end if;
 end if;
 if client=p_company_id then perform meetany_private.fail('MA503'); end if;
 insert into meetany_private.conversations(client_id,company_id,request_id,context_key,started_by)
 values(client,p_company_id,p_request_id,context,me.id)
 on conflict(client_id,company_id,context_key) do nothing;
 select * into c from meetany_private.conversations where client_id=client and company_id=p_company_id and context_key=context;
 return to_jsonb(c);
end $$;

create or replace function public.list_my_conversations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last,x.created_at desc,x.id desc),'[]'::jsonb) into result from (
  select c.*,p.id other_id,p.name other_name,p.company other_company,
   (select to_jsonb(m) from meetany_private.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) last_message,
   (select count(*) from meetany_private.messages m where m.conversation_id=c.id and m.sender_id<>me.id and m.read_at is null) unread_count
  from meetany_private.conversations c join public.profiles p on p.id=case when c.client_id=me.id then c.company_id else c.client_id end
  where me.id in (c.client_id,c.company_id) and (c.last_message_at is not null or c.started_by=me.id)
 ) x;
 return result;
end $$;

revoke all on function meetany_private.delete_request_conversations() from public,anonymous,authenticated;
revoke all on function public.start_conversation(uuid,uuid),public.list_my_conversations() from public,anonymous,authenticated;
grant execute on function public.start_conversation(uuid,uuid),public.list_my_conversations() to authenticated;
commit;

-- Additive marketplace features (canonical bootstrap; migrations remain independently rerunnable).

-- 20260930-business-features.sql
-- Additive: no existing RPC signatures or profile rows are changed.
-- Requires categories v2, company gallery and admin migrations.
begin;
set local lock_timeout='5s';

-- Expanded financial-services taxonomy; existing stored keys remain valid.
create or replace function meetany_private.categories() returns text[]
language sql immutable set search_path='' as $$
 select array['food_fresh','food_processed','beverages','catering','building_materials','renovation','engineering',
 'furniture','equipment','textiles','packaging','printing','freight','warehouse','customs','wholesale','office_household',
 'cleaning','laundry','technical_service','security','software_web','it_support','branding_design','advertising','photo_video','events',
 'accounting','legal','consulting','hr_training','hotel_services','tours','leasing','business_finance','business_insurance','other']::text[]
$$;

create table if not exists meetany_private.company_business (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 distributor boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.company_plans (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 plan text not null check(plan in ('premium','vip')),
 expires_at timestamptz not null,
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.plan_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.profiles(id) on delete cascade,
 plan text not null check(plan in ('premium','vip')),
 status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')),
 note text not null default '' check(length(note)<=500),
 updated_at timestamptz not null default now()
);
create table if not exists meetany_private.company_reviews (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.requests(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 body text not null check(length(btrim(body)) between 20 and 1500),
 status text not null default 'pending' check(status in ('pending','published','hidden')),
 reason text not null default '' check(length(reason)<=500),
 updated_at timestamptz not null default now(),
 check(author_id<>company_id)
);
create index if not exists company_reviews_company on meetany_private.company_reviews(company_id,status,updated_at desc);
create table if not exists meetany_private.business_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null, target_id uuid not null, action text not null, detail jsonb not null,
 created_at timestamptz not null default now()
);
-- Tables are not directly exposed to either API role, including self-upgrades and self-moderation.
alter table meetany_private.company_business enable row level security;
alter table meetany_private.company_plans enable row level security;
alter table meetany_private.plan_requests enable row level security;
alter table meetany_private.company_reviews enable row level security;
alter table meetany_private.business_audit enable row level security;
revoke all on meetany_private.company_business,meetany_private.company_plans,meetany_private.plan_requests,meetany_private.company_reviews,meetany_private.business_audit from public,anonymous,authenticated;

create or replace function public.company_business_features() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'distributor',coalesce(b.distributor,false),
 'plan',case when m.expires_at>now() then m.plan else null end,
 'rating',r.rating,'reviewCount',coalesce(r.n,0))),'[]'::jsonb)
 from public.profiles p
 left join meetany_private.company_business b on b.company_id=p.id
 left join meetany_private.company_plans m on m.company_id=p.id
 left join lateral (select round(avg(v.rating),1) rating,count(*) n from meetany_private.company_reviews v
   join public.profiles a on a.id=v.author_id and not a.blocked
   where v.company_id=p.id and v.status='published') r on true
 where p.role='company' and not p.blocked
$$;

create or replace function public.my_business_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 return jsonb_build_object('distributor',coalesce((select distributor from meetany_private.company_business where company_id=me.id),false),
 'membership',(select to_jsonb(p)-'company_id' from meetany_private.company_plans p where p.company_id=me.id and expires_at>now()),
 'application',(select to_jsonb(a)-'company_id' from meetany_private.plan_requests a where a.company_id=me.id));
end $$;
create or replace function public.set_company_distributor(p_distributor boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_distributor is null then raise exception using errcode='22023',message='invalid distributor'; end if;
 insert into meetany_private.company_business(company_id,distributor) values(me.id,p_distributor)
 on conflict(company_id) do update set distributor=excluded.distributor,updated_at=now();
 return public.my_business_settings();
end $$;
create or replace function public.request_company_plan(p_plan text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_plan is null or p_plan not in ('premium','vip') then raise exception using errcode='22023',message='invalid plan'; end if;
 insert into meetany_private.plan_requests(company_id,plan) values(me.id,p_plan)
 on conflict(company_id) do update set plan=excluded.plan,status='pending',note='',updated_at=now();
 return public.my_business_settings();
end $$;
create or replace function public.cancel_company_plan_request() returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 update meetany_private.plan_requests set status='cancelled',updated_at=now() where company_id=me.id and status='pending';
 return public.my_business_settings();
end $$;

create or replace function public.company_reviews(p_company_id uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 then raise exception using errcode='22023',message='invalid offset'; end if;
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 select jsonb_build_object('total',count(*),'rating',round(avg(v.rating),1)) into result
 from meetany_private.company_reviews v join public.profiles a on a.id=v.author_id and not a.blocked
 where v.company_id=p_company_id and v.status='published';
 return result || jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.id,v.rating,v.body,v.updated_at,coalesce(nullif(a.company,''),a.name) author
 from meetany_private.company_reviews v join public.profiles a on a.id=v.author_id and not a.blocked
 where v.company_id=p_company_id and v.status='published' order by v.updated_at desc,v.id limit 10 offset p_offset) t));
end $$;
create or replace function public.my_company_review_targets(p_company_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select r.id,r.title,v.rating,v.body,v.status,v.reason
 from public.requests r join public.offers o on o.id=r.chosen_offer_id and o.company_id=p_company_id
 left join meetany_private.company_reviews v on v.request_id=r.id and v.author_id=me.id and v.company_id=p_company_id
 where r.owner_id=me.id and not r.hidden and me.id<>p_company_id order by r.created_at desc,r.id) t);
end $$;
create or replace function public.save_company_review(p_request_id uuid,p_rating integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); company uuid; v meetany_private.company_reviews;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_body is null or length(btrim(p_body)) not between 20 and 1500 then
 raise exception using errcode='22023',message='MA601: invalid review'; end if;
 select o.company_id into company from public.requests r join public.offers o on o.id=r.chosen_offer_id
 join public.profiles c on c.id=o.company_id and not c.blocked and c.role='company'
 where r.id=p_request_id and r.owner_id=me.id and not r.hidden and o.company_id<>me.id for share of r;
 if company is null then raise exception using errcode='42501',message='MA602: review requires your chosen offer'; end if;
 insert into meetany_private.company_reviews(request_id,author_id,company_id,rating,body)
 values(p_request_id,me.id,company,p_rating,btrim(p_body))
 on conflict(request_id) do update set company_id=excluded.company_id,rating=excluded.rating,body=excluded.body,status='pending',reason='',updated_at=now()
 where company_reviews.author_id=me.id returning * into v;
 if v.id is null then raise exception using errcode='42501',message='MA602: review is not yours'; end if;
 return to_jsonb(v);
end $$;

create or replace function public.admin_business_queue(p_kind text,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 if p_offset is null or p_offset<0 or p_kind is null or p_kind not in ('reviews','plans') then raise exception using errcode='22023',message='invalid queue'; end if;
 if p_kind='reviews' then
 return jsonb_build_object('total',(select count(*) from meetany_private.company_reviews),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.*,p.company,a.name author from meetany_private.company_reviews v join public.profiles p on p.id=v.company_id join public.profiles a on a.id=v.author_id
 order by (v.status='pending') desc,v.updated_at desc,v.id limit 20 offset p_offset) t));
 end if;
 return jsonb_build_object('total',(select count(*) from meetany_private.plan_requests),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select v.*,p.company,p.email,p.phone,m.plan active_plan,m.expires_at from meetany_private.plan_requests v join public.profiles p on p.id=v.company_id
 left join meetany_private.company_plans m on m.company_id=p.id
 order by (v.status='pending') desc,v.updated_at desc,v.id limit 20 offset p_offset) t));
end $$;
create or replace function public.admin_moderate_review(p_id uuid,p_status text,p_reason text default '') returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_status is null or p_status not in ('published','hidden') or length(coalesce(p_reason,''))>500 or (p_status='hidden' and length(btrim(coalesce(p_reason,'')))<3) then
 raise exception using errcode='22023',message='MA603: add moderation reason'; end if;
 update meetany_private.company_reviews set status=p_status,reason=btrim(coalesce(p_reason,'')),updated_at=now() where id=p_id;
 if not found then perform meetany_private.fail('MA302'); end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_id,'review_'||p_status,jsonb_build_object('reason',p_reason));
end $$;
create or replace function public.admin_resolve_plan(p_id uuid,p_approve boolean,p_days integer default 30,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); v meetany_private.plan_requests;
begin
 if p_approve is null or p_days is null or p_days not between 1 and 366 or length(coalesce(p_note,''))>500 then raise exception using errcode='22023',message='invalid plan resolution'; end if;
 select * into v from meetany_private.plan_requests where id=p_id for update;
 if v.id is null or v.status<>'pending' then raise exception using errcode='22023',message='MA604: application already processed'; end if;
 if not exists(select 1 from public.profiles where id=v.company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 update meetany_private.plan_requests set status=case when p_approve then 'approved' else 'declined' end,note=coalesce(p_note,''),updated_at=now() where id=p_id;
 if p_approve then
 insert into meetany_private.company_plans(company_id,plan,expires_at) values(v.company_id,v.plan,now()+make_interval(days=>p_days))
 on conflict(company_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,updated_at=now();
 end if;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail) values(me.id,p_id,'plan_resolved',jsonb_build_object('approved',p_approve,'days',p_days,'plan',v.plan,'note',p_note));
end $$;
-- Explicit grants, including revoking PostgreSQL's default PUBLIC execution.
do $$
declare f record;
begin
 for f in select oid::regprocedure sig,proname from pg_proc where pronamespace='public'::regnamespace and proname=any(array[
 'company_business_features','company_reviews','my_company_review_targets','save_company_review','my_business_settings','set_company_distributor',
 'request_company_plan','cancel_company_plan_request','admin_business_queue','admin_moderate_review','admin_resolve_plan']) loop
 execute format('revoke all on function %s from public, anonymous, authenticated',f.sig);
 execute format('grant execute on function %s to authenticated',f.sig);
 if f.proname in ('company_business_features','company_reviews') then execute format('grant execute on function %s to anonymous',f.sig); end if;
 end loop;
end $$;
create or replace function public.set_request_alert_preferences(p_enabled boolean,p_categories text[],p_cities text[],p_email_mode text default 'off') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); cats text[]; towns text[]; changed boolean;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_enabled is null or p_email_mode is null or p_email_mode not in ('off','instant','daily')
 or p_categories is null or p_cities is null or cardinality(p_categories)>cardinality(meetany_private.categories()) or cardinality(p_cities)>8
 or array_position(p_categories,null) is not null or array_position(p_cities,null) is not null
 or not p_categories <@ meetany_private.categories() or not p_cities <@ meetany_private.cities() then
  raise exception using errcode='22023',message='invalid request alert preferences';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into cats from unnest(p_categories) x;
 select coalesce(array_agg(distinct x order by x),'{}') into towns from unnest(p_cities) x;
 if 'georgia'=any(towns) then towns:=array['georgia']; end if;
 if p_enabled and (cardinality(cats)=0 or cardinality(towns)=0) then raise exception using errcode='22023',message='select categories and cities'; end if;
 insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities,email_mode)
 values(me.id,p_enabled,cats,towns,p_email_mode)
 on conflict(user_id) do update set enabled=excluded.enabled,categories=excluded.categories,cities=excluded.cities,email_mode=excluded.email_mode,generation=gen_random_uuid()
 where (request_alert_preferences.enabled,request_alert_preferences.categories,request_alert_preferences.cities,request_alert_preferences.email_mode)
 is distinct from (excluded.enabled,excluded.categories,excluded.cities,excluded.email_mode)
 returning true into changed;
 -- A preference change cancels queued delivery, not existing inbox history. No backfill.
 update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null
 where changed and user_id=me.id and status in ('pending','processing');
 return public.request_alert_preferences();
end $$;


commit;

-- 20261001-reports.sql
-- T15.9: content reports („შეატყობინე“) and the admin reports queue. Additive and rerunnable.
-- Apply after 20260929-admin-v2.sql (admin_delete_offer) and 20260930-business-features.sql (business_audit).
-- 1. meetany_private.reports: one active ('new') report per (reporter, target); RLS on, no API-role access.
-- 2. report_content(p_kind, p_target_id, p_reason, p_text): signed-in users only; request (not own, visible),
--    company (not own, not blocked), offer (only the author of the request it answers). Max 10 per user per day.
-- 3. admin_list_reports(p_status, p_offset), admin_resolve_report(p_id, p_action, p_reason): admin only (MA003).
--    'hide' uses the existing audited moderation functions (request hide / offer delete / company block) and
--    closes every new report on that target; 'reject' closes this report. Each resolution writes business_audit.
-- Error codes: MA701 invalid reason/text, MA702 content not found, MA703 own content, MA704 already reported,
--              MA705 daily limit, MA706 report already handled.
begin;
set local lock_timeout='5s';

create table if not exists meetany_private.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 target_kind text not null check(target_kind in ('request','company','offer')),
 -- No foreign key: the report (and its history) outlives a deleted target.
 target_id uuid not null,
 target_owner_id uuid,
 target_label text not null default '' check(length(target_label)<=300),
 context_id uuid,
 reason text not null check(reason in ('spam','fake','offensive','other')),
 body text not null default '' check(length(body)<=500),
 status text not null default 'new' check(status in ('new','handled')),
 resolution text check(resolution in ('hidden','rejected')),
 resolution_reason text check(resolution_reason is null or length(resolution_reason)<=500),
 handled_by uuid,
 handled_at timestamptz,
 created_at timestamptz not null default now(),
 check(reason<>'other' or length(btrim(body))>=3),
 check((status='new')=(resolution is null))
);
create unique index if not exists reports_one_active on meetany_private.reports(reporter_id,target_kind,target_id) where status='new';
create index if not exists reports_queue on meetany_private.reports(status,created_at desc,id);
create index if not exists reports_target on meetany_private.reports(target_kind,target_id);
create index if not exists reports_reporter_day on meetany_private.reports(reporter_id,created_at desc);
alter table meetany_private.reports enable row level security;
revoke all on meetany_private.reports from public,anonymous,authenticated;

create or replace function meetany_private.report_fail(p_code text) returns void
language plpgsql volatile set search_path='' as $$
declare t text := case p_code
 when 'MA701' then 'choose a reason; other needs 3 to 500 characters'
 when 'MA702' then 'content not found'
 when 'MA703' then 'cannot report own content'
 when 'MA704' then 'already reported'
 when 'MA705' then 'daily report limit reached (10)'
 when 'MA706' then 'report already handled'
 else 'error' end;
begin
 raise exception using errcode='P0001',message=p_code||': '||t,hint=p_code;
end $$;
revoke all on function meetany_private.report_fail(text) from public,anonymous,authenticated;

create or replace function public.report_content(p_kind text,p_target_id uuid,p_reason text,p_text text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_user();
 v_text text:=btrim(coalesce(p_text,''));
 v_owner uuid; v_label text; v_context uuid; v meetany_private.reports;
begin
 if p_kind is null or p_kind not in ('request','company','offer') or p_target_id is null then perform meetany_private.report_fail('MA702'); end if;
 if p_reason is null or p_reason not in ('spam','fake','offensive','other') or length(v_text)>500 or (p_reason='other' and length(v_text)<3) then
  perform meetany_private.report_fail('MA701'); end if;
 if p_kind='request' then
  select r.owner_id,r.title into v_owner,v_label from public.requests r where r.id=p_target_id and not r.hidden;
 elsif p_kind='company' then
  select p.id,coalesce(nullif(p.company,''),p.name) into v_owner,v_label from public.profiles p where p.id=p_target_id and p.role='company' and not p.blocked;
 else
  -- Offers are sealed: only the author of the request they answer can see, and so report, them.
  select o.company_id,coalesce(nullif(c.company,''),c.name),r.id into v_owner,v_label,v_context
  from public.offers o join public.requests r on r.id=o.request_id join public.profiles c on c.id=o.company_id
  where o.id=p_target_id and r.owner_id=me.id;
 end if;
 if v_owner is null then perform meetany_private.report_fail('MA702'); end if;
 if v_owner=me.id then perform meetany_private.report_fail('MA703'); end if;
 -- Serialise one reporter's submissions so the daily limit and the duplicate check cannot race.
 perform pg_advisory_xact_lock(hashtextextended('meetany.report:'||me.id::text,0));
 if exists(select 1 from meetany_private.reports where reporter_id=me.id and target_kind=p_kind and target_id=p_target_id and status='new') then
  perform meetany_private.report_fail('MA704'); end if;
 if (select count(*) from meetany_private.reports where reporter_id=me.id and created_at>now()-interval '1 day')>=10 then
  perform meetany_private.report_fail('MA705'); end if;
 insert into meetany_private.reports(reporter_id,target_kind,target_id,target_owner_id,target_label,context_id,reason,body)
 values(me.id,p_kind,p_target_id,v_owner,left(coalesce(v_label,''),300),v_context,p_reason,v_text)
 returning * into v;
 return jsonb_build_object('id',v.id,'status',v.status,'created_at',v.created_at);
end $$;

create or replace function public.admin_list_reports(p_status text default 'new',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_offset is null or p_offset<0 or (p_status is not null and p_status not in ('new','handled')) then
  raise exception using errcode='22023',message='invalid report queue'; end if;
 return jsonb_build_object(
 'total',(select count(*) from meetany_private.reports where p_status is null or status=p_status),
 'newCount',(select count(*) from meetany_private.reports where status='new'),
 'items',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]'::jsonb) from (
  select x.id,x.target_kind,x.target_id,x.context_id,x.reason,x.body,x.status,x.resolution,x.resolution_reason,x.created_at,x.handled_at,
   x.reporter_id,coalesce(nullif(rp.company,''),rp.name) reporter_name,rp.email reporter_email,
   coalesce(case x.target_kind when 'request' then rq.title when 'company' then coalesce(nullif(co.company,''),co.name)
     else coalesce(nullif(oc.company,''),oc.name) end,nullif(x.target_label,'')) target_label,
   case x.target_kind when 'request' then rq.id is not null when 'company' then co.id is not null else o.id is not null end target_exists,
   case x.target_kind when 'request' then coalesce(rq.hidden,false) when 'company' then coalesce(co.blocked,false) else false end target_removed,
   coalesce(case when x.target_kind='offer' then oq.title end,'') context_label,
   coalesce(case when x.target_kind='offer' then o.status end,'') offer_status,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id) target_reports,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id and s.status='new') target_new,
   coalesce(nullif(h.company,''),h.name) handler_name
  from meetany_private.reports x
  left join public.profiles rp on rp.id=x.reporter_id
  left join public.requests rq on x.target_kind='request' and rq.id=x.target_id
  left join public.profiles co on x.target_kind='company' and co.id=x.target_id
  left join public.offers o on x.target_kind='offer' and o.id=x.target_id
  left join public.profiles oc on x.target_kind='offer' and oc.id=x.target_owner_id
  left join public.requests oq on x.target_kind='offer' and oq.id=x.context_id
  left join public.profiles h on h.id=x.handled_by
  where p_status is null or x.status=p_status
  order by x.created_at desc,x.id limit 20 offset p_offset) t));
end $$;

create or replace function public.admin_resolve_report(p_id uuid,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_admin();
 v_reason text:=meetany_private.moderation_reason(p_reason);
 v meetany_private.reports; v_effect text:='none'; v_closed integer;
begin
 if v_reason is null then perform meetany_private.fail('MA304'); end if;
 if p_action is null or p_action not in ('hide','reject') then raise exception using errcode='22023',message='invalid report action'; end if;
 select * into v from meetany_private.reports where id=p_id for update;
 if v.id is null or v.status<>'new' then perform meetany_private.report_fail('MA706'); end if;
 if p_action='hide' then
  -- Reuse the audited moderation functions; a target that is already gone or hidden needs no change.
  if v.target_kind='request' then
   if exists(select 1 from public.requests where id=v.target_id and not hidden) then
    perform public.admin_set_hidden(v.target_id,true,v_reason); v_effect:='request.hide'; end if;
  elsif v.target_kind='offer' then
   if exists(select 1 from public.offers where id=v.target_id) then
    perform public.admin_delete_offer(v.target_id,v_reason); v_effect:='offer.delete'; end if;
  else
   if exists(select 1 from public.profiles where id=v.target_id and not blocked and role<>'admin') then
    perform public.admin_set_blocked(v.target_id,true,v_reason); v_effect:='user.block'; end if;
  end if;
  update meetany_private.reports set status='handled',resolution='hidden',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where target_kind=v.target_kind and target_id=v.target_id and status='new';
 else
  update meetany_private.reports set status='handled',resolution='rejected',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where id=v.id;
 end if;
 get diagnostics v_closed=row_count;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)
 values(me.id,v.id,'report_'||case when p_action='hide' then 'hidden' else 'rejected' end,
  jsonb_build_object('kind',v.target_kind,'target_id',v.target_id,'reason',v_reason,'effect',v_effect,'closed',v_closed));
 return jsonb_build_object('id',v.id,'action',p_action,'effect',v_effect,'closed',v_closed);
end $$;

do $$
declare f record;
begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace
  and proname=any(array['report_content','admin_list_reports','admin_resolve_report']) loop
  execute format('revoke all on function %s from public, anonymous, authenticated',f.sig);
  execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
end $$;

commit;

-- 20261001-distribution.sql
begin;
set local lock_timeout='5s';
alter table meetany_private.company_business
 add column if not exists dist_categories text[] not null default '{}',
 add column if not exists dist_channels text[] not null default '{}',
 add column if not exists dist_brands text[] not null default '{}',
 add column if not exists dist_warehouse text not null default 'none',
 add column if not exists dist_transport text not null default 'none',
 add column if not exists dist_cold_chain boolean not null default false,
 add column if not exists dist_min_order text not null default '',
 add column if not exists dist_exclusive boolean not null default false;
create or replace function public.company_distribution_profiles() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'regions',p.service_cities,
 'categories',b.dist_categories,'channels',b.dist_channels,'brands',b.dist_brands,
 'warehouse',b.dist_warehouse,'transport',b.dist_transport,'coldChain',b.dist_cold_chain,
 'minOrder',b.dist_min_order,'exclusive',b.dist_exclusive) order by p.id),'[]'::jsonb)
 from meetany_private.company_business b join public.profiles p on p.id=b.company_id
 where b.distributor and p.role='company' and not p.blocked
$$;
create or replace function public.my_business_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 return jsonb_build_object('distributor',coalesce((select distributor from meetany_private.company_business where company_id=me.id),false),
 'distribution',(select jsonb_build_object('categories',dist_categories,'channels',dist_channels,'brands',dist_brands,
 'warehouse',dist_warehouse,'transport',dist_transport,'coldChain',dist_cold_chain,'minOrder',dist_min_order,'exclusive',dist_exclusive,
 'regions',me.service_cities) from meetany_private.company_business where company_id=me.id),
 'membership',(select to_jsonb(p)-'company_id' from meetany_private.company_plans p where p.company_id=me.id and expires_at>now()),
 'application',(select to_jsonb(a)-'company_id' from meetany_private.plan_requests a where a.company_id=me.id));
end $$;
-- Regions update the existing profile field atomically with distribution settings.
create or replace function public.set_my_distribution(p_categories text[],p_channels text[],p_brands text[],p_warehouse text,p_transport text,p_cold_chain boolean,p_min_order text,p_exclusive boolean,p_regions text[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); v text; regions text[]:=coalesce(p_regions,me.service_cities);
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if coalesce(cardinality(regions),0)<1 or cardinality(regions)>40 then perform meetany_private.fail('MA621'); end if;
 foreach v in array regions loop if v is null or not meetany_private.is_city(v) then perform meetany_private.fail('MA621'); end if; end loop;
 if p_categories is null or cardinality(p_categories)>6 or p_channels is null or cardinality(p_channels) not between 1 and 8
  or array_position(p_channels,null) is not null or not (p_channels <@ array['horeca','retail_chain','retail_small','pharmacy','subdistributors','online','institutions','export'])
  then perform meetany_private.fail('MA621'); end if;
 foreach v in array p_categories loop if v is null or not meetany_private.is_category(v) then perform meetany_private.fail('MA621'); end if; end loop;
 if p_brands is null or cardinality(p_brands)>20 then perform meetany_private.fail('MA621'); end if;
 foreach v in array p_brands loop if v is null or length(trim(v)) not between 1 and 80 then perform meetany_private.fail('MA621'); end if; end loop;
 if p_warehouse is null or p_warehouse not in ('none','own','rented') or p_transport is null or p_transport not in ('none','own','contracted')
  or p_cold_chain is null or p_exclusive is null or p_min_order is null or length(trim(p_min_order))>80 then perform meetany_private.fail('MA621'); end if;
 update public.profiles set service_cities=regions where id=me.id;
 insert into meetany_private.company_business(company_id,distributor,dist_categories,dist_channels,dist_brands,dist_warehouse,dist_transport,dist_cold_chain,dist_min_order,dist_exclusive)
 values(me.id,true,p_categories,p_channels,p_brands,p_warehouse,p_transport,p_cold_chain,trim(p_min_order),p_exclusive)
 on conflict(company_id) do update set distributor=true,dist_categories=excluded.dist_categories,dist_channels=excluded.dist_channels,dist_brands=excluded.dist_brands,
 dist_warehouse=excluded.dist_warehouse,dist_transport=excluded.dist_transport,dist_cold_chain=excluded.dist_cold_chain,dist_min_order=excluded.dist_min_order,dist_exclusive=excluded.dist_exclusive,updated_at=now();
 return public.my_business_settings();
end $$;
revoke all on function public.company_distribution_profiles(),public.set_my_distribution(text[],text[],text[],text,text,boolean,text,boolean,text[]) from public,anonymous,authenticated;
grant execute on function public.company_distribution_profiles() to anonymous,authenticated;
grant execute on function public.set_my_distribution(text[],text[],text[],text,text,boolean,text,boolean,text[]) to authenticated;
commit;

-- 20261001-market-metrics.sql
begin;
set local lock_timeout='5s';
-- Demand is visible open requests; supply matches exact product category and
-- either office city, service city or national coverage. All metrics use the
-- same visible, unblocked population. Closed share excludes still-open requests.
create or replace function public.admin_market_metrics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 return (
 with eligible as (
  select r.*, meetany_private.request_state(r) state from public.requests r
  join public.profiles p on p.id=r.owner_id where not r.hidden and not p.blocked
 ), first_offers as (
  select r.id,min(o.created_at) first_at from eligible r join public.offers o on o.request_id=r.id
  where o.status<>'withdrawn' group by r.id
 ), demand as (
  select category,city,count(*) requests from eligible where state='open' group by category,city
 ), gaps as (
  select d.*, (select count(*) from public.profiles p where p.role='company' and not p.blocked
   and p.industry=d.category and (p.city=d.city or p.city='georgia' or d.city='georgia'
     or d.city=any(p.service_cities) or 'georgia'=any(p.service_cities))) companies from demand d
 )
 select jsonb_build_object(
  'withoutOffers',(select count(*) from eligible r where state='open' and not exists(select 1 from first_offers f where f.id=r.id)),
  'averageFirstOfferHours',(select round(avg(greatest(0,extract(epoch from f.first_at-r.created_at)/3600))::numeric,1) from eligible r join first_offers f on f.id=r.id),
  'completed',(select count(*) from eligible where state<>'open'),
  'chosen',(select count(*) from eligible where chosen_offer_id is not null),
  'chosenShare',(select round(100.0*count(*) filter(where chosen_offer_id is not null)/nullif(count(*) filter(where state<>'open'),0),1) from eligible),
  'gaps',coalesce((select jsonb_agg(to_jsonb(g) order by companies,requests desc,category,city) from gaps g),'[]'::jsonb))
 );
end $$;
revoke all on function public.admin_market_metrics() from public,anonymous,authenticated;
grant execute on function public.admin_market_metrics() to authenticated;
commit;

-- Gallery and product bootstrap.
-- T12.4b: optional public company gallery (Vercel Blob); additive and rerunnable.
-- Apply after 20260924-company-logo.sql. RLS unchanged; the public column grant gains gallery.
-- 1. profiles.gallery text[] (default empty) + CHECK: at most 8 URLs, each valid_photo_url in the
--    owner's own folder (direct table writes cannot point at another user's file).
-- 2. set_my_gallery(p_urls text[]): companies only; replaces the whole list (order kept, blanks
--    and duplicates dropped). Every URL must be <Blob store origin>/<caller id>/gallery-<name>.<ext>,
--    else MA116. update_my_profile is unchanged, so the running site keeps working.
-- 3. list_companies() returns gallery; my_profile / admin_list_users / admin_search_users return
--    whole profile rows and pick the column up by themselves.
begin;
set local lock_timeout='5s';

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
    when 'MA114' then 'address note is longer than 120 characters'
    when 'MA115' then 'invalid logo url'
    when 'MA116' then 'gallery allows at most 8 own gallery photos'
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
    when 'MA412' then 'address is longer than 200 characters'
    when 'MA413' then 'coordinates must be a valid latitude and longitude pair'
    else 'error' end;
begin
  raise exception using errcode = 'P0001', message = p_code || ': ' || t, hint = p_code;
end
$$;

create or replace function meetany_private.valid_gallery(p_urls text[], p_owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select p_urls is not null and coalesce(array_length(p_urls, 1), 0) <= 8 and coalesce(array_ndims(p_urls), 1) = 1
     and not exists (select 1 from unnest(p_urls) u where not meetany_private.valid_photo_url(u, p_owner))
$$;

alter table public.profiles add column if not exists gallery text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_gallery_check;
alter table public.profiles add constraint profiles_gallery_check check
  (meetany_private.valid_gallery(gallery, id));

create or replace function public.set_my_gallery(p_urls text[])
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_user();
  v_origin text := meetany_private.photo_origin();
  v_urls text[] := array(select u from (select btrim(x) u, min(n) n from unnest(coalesce(p_urls, '{}'::text[])) with ordinality a(x, n)
                                       where btrim(coalesce(x, '')) <> '' group by 1) d order by n);
  p public.profiles;
begin
  if me.role <> 'company' then perform meetany_private.fail('MA116'); end if;
  if cardinality(v_urls) > 8 or (cardinality(v_urls) > 0 and v_origin is null) or exists (
       select 1 from unnest(v_urls) u
       where not meetany_private.valid_photo_url(u, me.id)
          or lower(left(u, char_length(v_origin) + 1)) <> v_origin || '/'
          or substr(u, char_length(v_origin) + 2, 45) <> me.id::text || '/gallery-') then
    perform meetany_private.fail('MA116');
  end if;
  update public.profiles set gallery = v_urls where id = me.id returning * into p;
  return p;
end
$$;

drop function if exists public.list_companies();
create or replace function public.list_companies()
returns table (id uuid, company text, industry text, verified boolean, verified_at timestamptz, city text,
               about text, offers text[], seeks text[], service_cities text[], created_at timestamptz,
               address text, lat double precision, lng double precision, logo_url text, gallery text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.company, p.industry, p.verified, p.verified_at, p.city, p.about, p.offers, p.seeks,
         p.service_cities, p.created_at, p.address, p.lat, p.lng, p.logo_url, p.gallery
  from public.profiles p
  where p.role = 'company' and not p.blocked
  order by p.verified desc, p.created_at desc
  limit 1000
$$;

grant select (gallery) on public.profiles to anonymous, authenticated;
-- Evaluated by the CHECK as the writing role (same as valid_photo_url).
grant execute on function meetany_private.valid_gallery(text[], uuid) to anonymous, authenticated;
revoke all on function public.set_my_gallery(text[]) from public, anonymous, authenticated;
grant execute on function public.set_my_gallery(text[]) to anonymous, authenticated;
revoke all on function public.list_companies() from public, anonymous, authenticated;
grant execute on function public.list_companies() to anonymous, authenticated;
commit;

begin;
set local lock_timeout='5s';
create table if not exists meetany_private.company_products (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=12)
);
alter table meetany_private.company_products enable row level security;
revoke all on meetany_private.company_products from public,anonymous,authenticated;
create or replace function public.company_products(p_company_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(item order by ord) from meetany_private.company_products b
 join public.profiles p on p.id=b.company_id cross join lateral jsonb_array_elements(b.items) with ordinality a(item,ord)
 where p.id=p_company_id and p.role='company' and not p.blocked and item->>'photoUrl'=any(p.gallery)),'[]'::jsonb)
$$;
create or replace function public.set_my_products(p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); item jsonb; cleaned jsonb:='[]';
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then perform meetany_private.fail('MA622'); end if;
 if jsonb_array_length(p_items)>12 then perform meetany_private.fail('MA622'); end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 2 and 80
   or jsonb_typeof(item->'photoUrl') is distinct from 'string' or not coalesce(meetany_private.valid_photo_url(item->>'photoUrl',me.id),false)
   or not coalesce(item->>'photoUrl'=any(me.gallery),false)
   or (item ? 'note' and jsonb_typeof(item->'note')<>'string') or length(coalesce(item->>'note',''))>200
  then perform meetany_private.fail('MA622'); end if;
  cleaned:=cleaned||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'photoUrl',item->>'photoUrl','note',trim(coalesce(item->>'note',''))));
 end loop;
 insert into meetany_private.company_products(company_id,items) values(me.id,cleaned) on conflict(company_id) do update set items=excluded.items;
 return cleaned;
end $$;
revoke all on function public.company_products(uuid),public.set_my_products(jsonb) from public,anonymous,authenticated;
grant execute on function public.company_products(uuid) to anonymous,authenticated;
grant execute on function public.set_my_products(jsonb) to authenticated;
commit;
