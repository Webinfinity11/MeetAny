-- Requires offer-terms for shared flow errors. Existing free-text offers/seeks are not category IDs.
begin;
set local lock_timeout='5s';
create or replace function meetany_private.valid_flow_categories(p_values text[]) returns boolean
language sql immutable set search_path='' as $$
 select p_values is not null and cardinality(p_values)<=34 and not exists(select 1 from unnest(p_values) v where v is null or not meetany_private.is_category(v))
$$;
revoke all on function meetany_private.valid_flow_categories(text[]) from public,anonymous,authenticated;
alter table public.profiles add column if not exists provide_categories text[] not null default '{}' check(meetany_private.valid_flow_categories(provide_categories));
alter table public.profiles add column if not exists need_categories text[] not null default '{}' check(meetany_private.valid_flow_categories(need_categories));
-- Deliberately no public column grants: needs are private procurement intent.
create or replace function public.set_matching_categories(p_provide text[],p_need text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if not meetany_private.valid_flow_categories(p_provide) or not meetany_private.valid_flow_categories(p_need) then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set provide_categories=array(select distinct v from unnest(p_provide) v order by v),need_categories=array(select distinct v from unnest(p_need) v order by v) where id=me.id;
 return jsonb_build_object('provide',p_provide,'need',p_need);
end $$;
create or replace function public.list_matching(p_request_id uuid default null,p_city text default null,p_limit integer default 25,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); target public.requests; result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 or (p_city is not null and not meetany_private.is_city(p_city)) then perform meetany_private.flow_fail('MA902'); end if;
 if p_request_id is null then
  if me.role<>'company' or not me.verified then perform meetany_private.flow_fail('MA901'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by score desc,created_at desc,id),'[]') into result from (
   select r.id,r.title,r.category,r.city,r.created_at,70+case when r.city=me.city or r.city=any(me.service_cities) then 30 else 0 end score
   from public.requests r join public.profiles p on p.id=r.owner_id
   where r.owner_id<>me.id and not r.hidden and not p.blocked and meetany_private.request_state(r)='open'
   and r.category=any(me.provide_categories) and (p_city is null or r.city=p_city)
   order by score desc,r.created_at desc,r.id limit p_limit offset p_offset
  ) x;
 else
  select * into target from public.requests where id=p_request_id and owner_id=me.id;
  if not found then perform meetany_private.flow_fail('MA901'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by score desc,id),'[]') into result from (
   select p.id,p.company,p.city,p.industry,p.verified,70+case when p.city=target.city or target.city=any(p.service_cities) then 30 else 0 end score
   from public.profiles p where p.role='company' and p.verified and not p.blocked and p.id<>me.id and target.category=any(p.provide_categories)
   and (p_city is null or p.city=p_city or p_city=any(p.service_cities))
   order by score desc,p.id limit p_limit offset p_offset
  ) x;
 end if;
 return result;
end $$;
revoke all on function public.set_matching_categories(text[],text[]),public.list_matching(uuid,text,integer,integer) from public,anonymous,authenticated;
grant execute on function public.set_matching_categories(text[],text[]),public.list_matching(uuid,text,integer,integer) to authenticated;
commit;
