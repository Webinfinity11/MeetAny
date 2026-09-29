-- Categories v2: 13 flat keys -> 33 categories in 11 groups (+ "other"). Keys of the old list are mapped
-- in place (requests.category, profiles.industry, request_alert_preferences.categories).
-- Groups are a UI concept (web/app/lib/categories-data.js); the database stores only category keys.
-- Idempotent: an already migrated key maps to itself.
begin;
set local lock_timeout='5s';

create or replace function meetany_private.category_map(p text) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'construction' then 'renovation'
    when 'food' then 'food_fresh'
    when 'logistics' then 'freight'
    when 'technology' then 'software_web'
    when 'marketing' then 'branding_design'
    when 'finance' then 'accounting'
    when 'tourism' then 'tours'
    else p end
$$;

-- The checks call is_category(), so they go first and come back after the list is replaced.
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
    where conrelid in ('public.profiles'::regclass, 'public.requests'::regclass, 'meetany_private.request_alert_preferences'::regclass)
      and contype = 'c' and (pg_get_constraintdef(oid) like '%is_category%' or pg_get_constraintdef(oid) like '%categories()%')
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

update public.profiles set industry = meetany_private.category_map(industry)
 where industry is not null and industry <> meetany_private.category_map(industry);
update public.requests set category = meetany_private.category_map(category)
 where category <> meetany_private.category_map(category);
update meetany_private.request_alert_preferences p
   set categories = (select coalesce(array_agg(distinct meetany_private.category_map(x) order by meetany_private.category_map(x)), '{}') from unnest(p.categories) x)
 where exists (select 1 from unnest(p.categories) x where x <> meetany_private.category_map(x));

-- Demo records whose old key was too coarse (exact match, no effect elsewhere).
update public.profiles set industry = 'wholesale' where role = 'company' and company = 'რეგიონის მომარაგება' and industry = 'furniture';
update public.profiles set industry = 'hotel_services' where role = 'company' and company = 'ზღვის სტუმარი' and industry = 'textiles';
update public.requests set category = 'equipment' where category = 'furniture' and title like '8 ლითონის თარო%';

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

alter table public.profiles add constraint profiles_industry_check
  check (industry is null or meetany_private.is_category(industry));
alter table public.requests add constraint requests_category_check
  check (meetany_private.is_category(category));
alter table meetany_private.request_alert_preferences add constraint request_alert_preferences_categories_check
  check (categories <@ meetany_private.categories() and array_position(categories, null) is null);

-- Same function as before; only the limit follows the list (13 -> 34 categories).
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

commit;
