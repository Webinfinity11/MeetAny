-- Authenticated setup progress. No entered field values, documents or contact data.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.onboarding_progress (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 first_seen_at timestamptz not null default now(),
 last_activity_at timestamptz not null default now(),
 last_step text not null check(last_step in ('type','details','profile','provide','need','verify','review')),
 disposition text not null default 'active' check(disposition in ('active','deferred','complete')),
 resume_count integer not null default 0,
 steps jsonb not null default '{}'::jsonb
);
alter table meetany_private.onboarding_progress enable row level security;
revoke all on meetany_private.onboarding_progress from public,anonymous,authenticated;

create or replace function public.record_onboarding_activity(p_step text,p_event text) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); old meetany_private.onboarding_progress; state text;
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if p_step is null or p_step not in ('type','details','profile','provide','need','verify','review')
 or p_event is null or p_event not in ('view','saved','deferred','completed','validation_error') then
  perform meetany_private.flow_fail('MA902');
 end if;
 if p_event='completed' and me.onboarding_completed_at is null then perform meetany_private.flow_fail('MA902'); end if;
 -- Serialize one profile's events; duplicate mounts cannot count two returns.
 perform 1 from public.profiles where id=me.id for update;
 select * into old from meetany_private.onboarding_progress where profile_id=me.id;
 state:=case when me.onboarding_completed_at is not null then 'complete' when p_event='deferred' then 'deferred' else 'active' end;
 insert into meetany_private.onboarding_progress(profile_id,last_step,disposition,steps)
 values(me.id,p_step,state,jsonb_build_object(p_step,jsonb_build_object('event',p_event,'at',now())))
 on conflict(profile_id) do update set
 last_step=excluded.last_step,last_activity_at=now(),disposition=state,
 resume_count=old.resume_count+case when p_event='view' and old.disposition<>'complete'
  and (old.disposition='deferred' or old.last_activity_at<now()-interval '30 minutes') then 1 else 0 end,
 steps=old.steps||excluded.steps;
 return true;
end $$;

create or replace function public.my_onboarding_activity() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return (select jsonb_build_object('step',last_step,'disposition',disposition,'steps',steps,'lastActivityAt',last_activity_at)
 from meetany_private.onboarding_progress where profile_id=me.id);
end $$;

create or replace function public.admin_onboarding_analytics(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform meetany_private.require_admin();
 if p_days is null or p_days not in(7,30,90) then perform meetany_private.flow_fail('MA902'); end if;
 with cohort as (
  select p.id,p.company,p.onboarding_completed_at,a.last_step,a.last_activity_at,a.resume_count,a.steps,
   case when p.onboarding_completed_at is not null then 'complete'
    when a.profile_id is null then 'unobserved'
    when a.disposition='deferred' then 'deferred'
    when a.last_activity_at<now()-interval '30 minutes' then 'inactive' else 'active' end state,
   exists(select 1 from public.requests r where r.owner_id=p.id) has_request,
   exists(select 1 from public.offers o where o.company_id=p.id) has_offer,
   exists(select 1 from meetany_private.deals d where d.buyer_id=p.id or d.supplier_id=p.id) has_deal
  from public.profiles p left join meetany_private.onboarding_progress a on a.profile_id=p.id
  where p.role='company' and (p.created_at>=now()-make_interval(days=>p_days) or a.last_activity_at>=now()-make_interval(days=>p_days))
 ), stages as(select * from (values('type',1),('details',2),('profile',3),('provide',4),('need',5),('verify',6),('review',7)) s(step,ord))
 select jsonb_build_object(
  'total',(select count(*) from cohort),
  'completed',(select count(*) from cohort where state='complete'),
  'deferred',(select count(*) from cohort where state='deferred'),
  'inactive',(select count(*) from cohort where state='inactive'),
  'active',(select count(*) from cohort where state='active'),
  'unobserved',(select count(*) from cohort where state='unobserved'),
  'resumed',(select count(*) from cohort where resume_count>0),
  'requests',(select count(*) from cohort where has_request),
  'offers',(select count(*) from cohort where has_offer),
  'deals',(select count(*) from cohort where has_deal),
  'stages',(select jsonb_agg(jsonb_build_object('step',s.step,'count',(select count(*) from cohort c where c.last_step=s.step),'deferred',(select count(*) from cohort c where c.steps->s.step->>'event'='deferred')) order by ord) from stages s),
  'recent',(select coalesce(jsonb_agg(to_jsonb(r) order by r.last_activity_at desc),'[]'::jsonb) from
   (select id,company,last_step,last_activity_at,state,resume_count from cohort where last_activity_at is not null order by last_activity_at desc,id limit 30) r)
 ) into result;
 return result;
end $$;
revoke all on function public.record_onboarding_activity(text,text),public.my_onboarding_activity(),public.admin_onboarding_analytics(integer) from public,anonymous,authenticated;
grant execute on function public.record_onboarding_activity(text,text),public.my_onboarding_activity(),public.admin_onboarding_analytics(integer) to authenticated;

-- Reopening starts a fresh seven-day window; extending an open request adds seven.
create or replace function public.extend_request(p_request_id uuid) returns public.requests
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); r public.requests:=meetany_private.own_request(p_request_id,me); s text:=meetany_private.request_state(r);
begin
 if r.needed_by<meetany_private.today() then raise exception using errcode='P0001',message='MA118: delivery date has passed',hint='MA118'; end if;
 if s not in ('open','expired','closed') then perform meetany_private.fail('MA108'); end if;
 if s<>'open' then
  perform 1 from public.profiles where id=r.owner_id for update;
  if meetany_private.open_count(r.owner_id)>=5 then perform meetany_private.fail('MA105'); end if;
 end if;
 update public.requests set status='open',expires_at=case when s='open'
  then least(greatest(now(),expires_at)+interval '7 days',now()+interval '21 days')
  else now()+interval '7 days' end where id=r.id returning * into r;
 return r;
end $$;
commit;
