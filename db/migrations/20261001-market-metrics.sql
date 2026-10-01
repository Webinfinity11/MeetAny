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
