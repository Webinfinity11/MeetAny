-- Requires the deals migrations. Read-only projection change; no request/deal rows are rewritten.
begin;
set local lock_timeout = '5s';

create or replace function public.admin_search_requests(
 p_q text default null, p_state text default null, p_category text default null,
 p_cursor jsonb default null, p_limit integer default 25
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
 if p_state is not null and p_state not in ('open','closed','expired','chosen','hidden','cancelled','complete') then
  raise exception using errcode = '22023', message = 'invalid request state'; end if;
 if p_category is not null and not meetany_private.is_category(p_category) then
  raise exception using errcode = '22023', message = 'invalid category'; end if;
 -- request_id is UNIQUE on deals: this join cannot duplicate requests or inflate counts.
 -- Keep the historical chosen_offer_id, but show the terminal agreement outcome first.
 with source as (
  select r.*, case when r.hidden then 'hidden'
    when d.stage in ('cancelled','complete') then d.stage
    when r.chosen_offer_id is not null then 'chosen'
    when r.status = 'closed' then 'closed'
    when r.expires_at <= v_asof then 'expired' else 'open' end as state,
   p.name as owner_name, p.company as owner_company, d.id as deal_id, d.stage as deal_stage
  from public.requests r join public.profiles p on p.id=r.owner_id
  left join meetany_private.deals d on d.request_id=r.id
 ), filtered as materialized (
  select * from source x where x.created_at <= v_asof
   and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.title || ' ' || x.body || ' ' || x.owner_company || ' ' || x.owner_name)) > 0)
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
revoke all on function public.admin_search_requests(text,text,text,jsonb,integer) from public,anonymous;
grant execute on function public.admin_search_requests(text,text,text,jsonb,integer) to authenticated;
commit;
