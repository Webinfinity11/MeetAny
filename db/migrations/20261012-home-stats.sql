-- Public counters for the home page: open requests, verified companies, offers sent, completed deals.
-- Re-runnable; counts only, nothing about a request, offer, deal or party leaves the database.
-- Visibility follows the public catalog: hidden requests, blocked companies and internal test
-- accounts/requests (lib/catalog-visibility.js) are not counted.
begin;
set local lock_timeout='5s';
create or replace function meetany_private.is_test_profile(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id
  and concat_ws(' ',p.name,p.company,p.email) ~* '(\me2e\M|e2e[:-]|@meetany\.local\M|სატესტო|\mtest\M)')
$$;
revoke all on function meetany_private.is_test_profile(uuid) from public,anonymous,authenticated;

create or replace function public.home_stats() returns jsonb
language sql stable security definer set search_path='' as $$
 with live as (
  select r.id,r.status,r.chosen_offer_id,r.expires_at from public.requests r
  where not r.hidden and not meetany_private.is_test_profile(r.owner_id)
   and btrim(r.title) !~* '^\[(strict-qa|qa|e2e)\]'
   and btrim(r.title) !~* '^(ტესტრექ|test( request)?|e2e([: -].*)?)$')
 select jsonb_build_object(
  'openRequests',(select count(*) from live where status='open' and chosen_offer_id is null and expires_at>now()),
  'verifiedCompanies',(select count(*) from public.profiles p where p.role='company' and p.verified and not p.blocked
    and not meetany_private.is_test_profile(p.id)),
  'offersSent',(select count(*) from public.offers o join live on live.id=o.request_id
    where not meetany_private.is_test_profile(o.company_id)),
  'completedDeals',(select count(*) from meetany_private.deals d join live on live.id=d.request_id where d.stage='complete'))
$$;
revoke all on function public.home_stats() from public,anonymous,authenticated;
grant execute on function public.home_stats() to anonymous,authenticated;
commit;
