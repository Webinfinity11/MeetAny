-- Recommendations are readable before verification; sending offers still requires verification.
begin;
set local lock_timeout='5s';
create or replace function public.list_matching(p_request_id uuid default null,p_city text default null,p_limit integer default 25,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); target public.requests; result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 or (p_city is not null and not meetany_private.is_city(p_city)) then perform meetany_private.flow_fail('MA902'); end if;
 if p_request_id is null then
  if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
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
commit;
