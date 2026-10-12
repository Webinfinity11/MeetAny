-- Public completed-deal counters for a company profile. Re-runnable; counts only, no deal or party details leave the database.
begin;
set local lock_timeout='5s';
create or replace function public.company_public_stats(p_company_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'completedDeals',count(*) filter(where d.supplier_id=p.id),
  'completedAsBuyer',count(*) filter(where d.buyer_id=p.id))
 from public.profiles p
 left join meetany_private.deals d on d.stage='complete' and p.id in(d.supplier_id,d.buyer_id)
 where p.id=p_company_id and p.role='company' and not p.blocked
 union all select '{"completedDeals":0,"completedAsBuyer":0}'::jsonb
 where not exists(select 1 from public.profiles p where p.id=p_company_id and p.role='company' and not p.blocked)
$$;
revoke all on function public.company_public_stats(uuid) from public,anonymous,authenticated;
grant execute on function public.company_public_stats(uuid) to anonymous,authenticated;
commit;
