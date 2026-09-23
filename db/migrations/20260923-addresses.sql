-- T10.8: additive, rerunnable public address fields and backward-compatible RPC defaults.
begin;
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
drop function if exists public.create_request(text, text, text, text, text, numeric, text, date);
drop function if exists public.update_request(uuid, text, text, text, text, numeric, text, date);
drop function if exists public.update_my_profile(text, text, text, text, text, text[], text[], text[]);
drop function if exists public.list_companies();
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
create or replace function public.update_my_profile(
  p_name text, p_company text, p_city text, p_industry text default null, p_about text default '',
  p_offers text[] default '{}', p_seeks text[] default '{}', p_service_cities text[] default '{}',
  p_address text default null, p_lat double precision default null, p_lng double precision default null)
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
  p public.profiles;
begin
  if char_length(v_name) < 2 then perform meetany_private.fail('MA401'); end if;
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
         about = v_about, offers = v_offers, seeks = v_seeks, service_cities = v_cities, address = v_address, lat = p_lat, lng = p_lng
   where id = me.id
  returning * into p;
  return p;
end
$$;
create or replace function public.list_companies()
returns table (id uuid, company text, industry text, verified boolean, verified_at timestamptz, city text,
               about text, offers text[], seeks text[], service_cities text[], created_at timestamptz,
               address text, lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select p.id, p.company, p.industry, p.verified, p.verified_at, p.city, p.about, p.offers, p.seeks,
         p.service_cities, p.created_at, p.address, p.lat, p.lng
  from public.profiles p
  where p.role = 'company' and not p.blocked
  order by p.verified desc, p.created_at desc
  limit 1000
$$;
grant select (address, lat, lng) on public.profiles to anonymous, authenticated;
revoke all on function public.create_request(text, text, text, text, text, numeric, text, date, text) from public, anonymous, authenticated;
grant execute on function public.create_request(text, text, text, text, text, numeric, text, date, text) to anonymous, authenticated;
revoke all on function public.update_request(uuid, text, text, text, text, numeric, text, date, text) from public, anonymous, authenticated;
grant execute on function public.update_request(uuid, text, text, text, text, numeric, text, date, text) to anonymous, authenticated;
revoke all on function public.update_my_profile(text, text, text, text, text, text[], text[], text[], text, double precision, double precision) from public, anonymous, authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text, text[], text[], text[], text, double precision, double precision) to anonymous, authenticated;
revoke all on function public.list_companies() from public, anonymous, authenticated;
grant execute on function public.list_companies() to anonymous, authenticated;
commit;
