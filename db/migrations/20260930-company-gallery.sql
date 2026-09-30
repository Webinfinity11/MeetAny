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
