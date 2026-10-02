begin;
set local lock_timeout='5s';
-- Invalidate cached admin pages when an audited edit changes fields without changing totals.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform meetany_private.require_admin();
 return jsonb_build_object(
  'adminApiVersion',2,
  'adminRevision',md5(coalesce((select a.created_at::text||':'||a.id::text from meetany_private.moderation_audit a order by a.created_at desc,a.id desc limit 1),'')||'/'||coalesce((select b.id::text from meetany_private.business_audit b order by b.id desc limit 1),'')),
  'hidden',(select count(*) from public.requests where hidden),
  'blocked',(select count(*) from public.profiles where blocked and role<>'admin'),
  'users',(select count(*) from public.profiles where role<>'admin'),
  'companies',(select count(*) from public.profiles where role='company'),
  'verified',(select count(*) from public.profiles where role='company' and verified),
  'open',(select count(*) from public.requests r where meetany_private.request_state(r)='open'),
  'requests',(select count(*) from public.requests where not hidden),
  'offers',(select count(*) from public.offers),
  'chosen',(select count(*) from public.requests where not hidden and chosen_offer_id is not null)
 );
end $$;
-- Return one bounded admin snapshot; totals count all matching rows without sending every profile.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Tbilisi')::date; cutoff timestamptz:=((today-59)::timestamp at time zone 'Asia/Tbilisi');
begin
 perform meetany_private.require_admin();
 return jsonb_build_object(
  'generatedAt',now(),
  'stats',public.admin_stats(),
  'activity',(
   with request_days as (
    select (r.created_at at time zone 'Asia/Tbilisi')::date as day_key,count(*) n from public.requests r
    where r.created_at>=cutoff and r.created_at<=now() and not r.hidden group by 1
   ), registration_days as (
    select (p.created_at at time zone 'Asia/Tbilisi')::date as day_key,count(*) n from public.profiles p
    where p.created_at>=cutoff and p.created_at<=now() and p.role<>'admin' group by 1
   )
   select jsonb_agg(jsonb_build_object('day',to_char(today-(59-s.i),'YYYY-MM-DD'),'requests',coalesce(r.n,0),'registrations',coalesce(p.n,0)) order by s.i)
   from generate_series(0,59) s(i) left join request_days r on r.day_key=today-(59-s.i) left join registration_days p on p.day_key=today-(59-s.i)
  ),
  'pending',jsonb_build_object(
   'total',(select count(*) from public.profiles where role='company' and not verified and not blocked),
   'items',(select coalesce(jsonb_agg(to_jsonb(q)-'created_at' order by q.created_at,q.id),'[]'::jsonb) from (
    select id,name,company,industry,created_at from public.profiles where role='company' and not verified and not blocked order by created_at,id limit 6
   ) q)
  ),
  'unanswered',jsonb_build_object(
   'total',(select count(*) from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.created_at<now()-interval '3 days' and not exists(select 1 from public.offers o where o.request_id=r.id)),
   'items',(select coalesce(jsonb_agg(to_jsonb(q) order by q."createdAt",q.id),'[]'::jsonb) from (
    select r.id,r.title,r.category,r.created_at "createdAt",0 "offerCount",ceil(greatest(0,extract(epoch from r.expires_at-now()))/86400)::integer "daysLeft"
    from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.created_at<now()-interval '3 days' and not exists(select 1 from public.offers o where o.request_id=r.id)
    order by r.created_at,r.id limit 6
   ) q)
  ),
  'expiring',jsonb_build_object(
   'total',(select count(*) from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.expires_at<=now()+interval '2 days'),
   'items',(select coalesce(jsonb_agg(to_jsonb(q) order by q."expiresAt",q.id),'[]'::jsonb) from (
    select r.id,r.title,r.category,r.created_at "createdAt",r.expires_at "expiresAt",(select count(*)::integer from public.offers o where o.request_id=r.id) "offerCount",ceil(greatest(0,extract(epoch from r.expires_at-now()))/86400)::integer "daysLeft"
    from public.requests r where not r.hidden and r.status='open' and r.chosen_offer_id is null and r.expires_at>now() and r.expires_at<=now()+interval '2 days'
    order by r.expires_at,r.id limit 6
   ) q)
  )
 );
end $$;
revoke all on function public.admin_overview() from public,anonymous,authenticated;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.admin_stats() from public,anonymous,authenticated;
grant execute on function public.admin_stats() to authenticated;
commit;
