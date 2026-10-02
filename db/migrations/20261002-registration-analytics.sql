-- Additive, privacy-minimized registration analytics. No names, email, phone, IP, user agent,
-- passwords, entered values or page URLs are stored. Browser stages are untrusted estimates.
-- Apply only when explicitly enabling REGISTRATION_ANALYTICS_ENABLED in the matching environment.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.registration_sessions (
 id uuid primary key,
 role text not null check(role in ('client','company')),
 source text not null default 'unknown' check(source in ('direct','header','request','company','account','unknown')),
 device text not null default 'unknown' check(device in ('mobile','tablet','desktop','unknown')),
 created_at timestamptz not null default now(),
 last_event_at timestamptz not null default now()
);
alter table meetany_private.registration_sessions add column if not exists source text not null default 'unknown' check(source in ('direct','header','request','company','account','unknown'));
alter table meetany_private.registration_sessions add column if not exists device text not null default 'unknown' check(device in ('mobile','tablet','desktop','unknown'));
create table if not exists meetany_private.registration_events (
 id uuid primary key,
 session_id uuid not null references meetany_private.registration_sessions(id) on delete cascade,
 stage text not null check(stage in ('form_open','form_started','form_submitted','email_pending','profile_created')),
 created_at timestamptz not null default now(),
 profile_id uuid references public.profiles(id) on delete set null,
 unique(session_id,stage),
 check(profile_id is null or stage='profile_created')
);
create unique index if not exists registration_profile_once on meetany_private.registration_events(profile_id) where profile_id is not null;
create index if not exists registration_sessions_created on meetany_private.registration_sessions(created_at);
create index if not exists registration_events_created on meetany_private.registration_events(created_at);
alter table meetany_private.registration_sessions enable row level security;
alter table meetany_private.registration_events enable row level security;
revoke all on meetany_private.registration_sessions,meetany_private.registration_events from public,anonymous,authenticated;
insert into meetany_private.settings(key,value) values('registration_analytics_started_at',now()::text) on conflict(key) do nothing;

-- The six-argument signature retains old four-argument callers through trailing defaults.
drop function if exists public.record_registration_event(uuid,uuid,text,text);
create or replace function public.record_registration_event(p_event_id uuid,p_session_id uuid,p_role text,p_stage text,p_source text default 'unknown',p_device text default 'unknown') returns boolean
language plpgsql security definer set search_path='' as $$
declare session_row meetany_private.registration_sessions; profile_row public.profiles; affected integer;
begin
 if p_event_id is null or p_session_id is null or p_role is null or p_role not in ('client','company')
 or p_stage is null or p_stage not in ('form_open','form_started','form_submitted','email_pending','profile_created')
 or p_source is null or p_source not in('direct','header','request','company','account','unknown')
 or p_device is null or p_device not in('mobile','tablet','desktop','unknown') then
  raise exception using errcode='MA801',message='invalid registration event';
 end if;
 -- Persistent global ceiling limits growth even if a visitor rotates their attempt UUID.
 -- It intentionally stores no network identity; guest telemetry is never billing or audit evidence.
 perform pg_advisory_xact_lock(hashtext('registration_daily_limit'));
 if exists(select 1 from meetany_private.registration_events where id=p_event_id) then return false; end if;
 if (select count(*) from meetany_private.registration_events where created_at>=date_trunc('day',now()))>=20000 then
  raise exception using errcode='MA802',message='registration telemetry daily limit';
 end if;
 if p_stage='form_open' then
  -- Keep only the most recent 90 days of this anonymous funnel, including linked completion IDs.
  delete from meetany_private.registration_sessions where created_at<now()-interval '90 days';
  insert into meetany_private.registration_sessions(id,role,source,device) values(p_session_id,p_role,p_source,p_device) on conflict(id) do nothing;
 end if;
 select * into session_row from meetany_private.registration_sessions where id=p_session_id for update;
 if not found or session_row.role<>p_role or session_row.created_at<now()-interval '24 hours' then
  raise exception using errcode='MA801',message='registration attempt missing or expired';
 end if;
 if p_stage='profile_created' then
  profile_row:=meetany_private.require_user();
  if profile_row.role<>p_role or profile_row.created_at<session_row.created_at-interval '1 minute' then
   raise exception using errcode='MA803',message='registration completion not confirmed';
  end if;
 end if;
 insert into meetany_private.registration_events(id,session_id,stage,profile_id)
 values(p_event_id,p_session_id,p_stage,case when p_stage='profile_created' then profile_row.id end)
 on conflict do nothing;
 get diagnostics affected=row_count;
 if affected>0 then update meetany_private.registration_sessions set last_event_at=now() where id=p_session_id; end if;
 return affected>0;
end $$;

create or replace function public.admin_registration_analytics(p_days integer default 30,p_role text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform meetany_private.require_admin();
 if p_days is null or p_days not in(7,30,90) or p_role is null or p_role not in('all','client','company') then
  raise exception using errcode='MA801',message='invalid analytics filter';
 end if;
 with cohort as (
  select s.*,max(case e.stage when 'form_open' then 1 when 'form_started' then 2 when 'form_submitted' then 3 when 'email_pending' then 4 when 'profile_created' then 5 end) last_stage,
   bool_or(e.stage='form_started') started,bool_or(e.stage='form_submitted') submitted,
   bool_or(e.stage='profile_created') completed
  from meetany_private.registration_sessions s join meetany_private.registration_events e on e.session_id=s.id
  where s.created_at>=now()-make_interval(days=>p_days) and (p_role='all' or s.role=p_role)
  group by s.id
 ), stages as(select * from (values (1,'form_open'),(2,'form_started'),(3,'form_submitted'),(4,'email_pending'),(5,'profile_created')) v(ord,stage))
 select jsonb_build_object(
  'enabled',true,'trackingStartedAt',(select value from meetany_private.settings where key='registration_analytics_started_at'),
  'days',p_days,'role',p_role,'sessions',(select count(*) from cohort),
  'started',(select count(*) from cohort where started),'submitted',(select count(*) from cohort where submitted),
  'completed',(select count(*) from cohort where completed),
  'active',(select count(*) from cohort where not completed and last_event_at>now()-interval '30 minutes'),
  'stalled',(select count(*) from cohort where not completed and last_event_at<=now()-interval '30 minutes'),
  'sources',(select coalesce(jsonb_agg(jsonb_build_object('source',source,'sessions',n,'completed',completed) order by n desc,source),'[]'::jsonb) from(select source,count(*) n,count(*) filter(where completed) completed from cohort group by source) q),
  'devices',(select coalesce(jsonb_agg(jsonb_build_object('device',device,'sessions',n,'completed',completed) order by n desc,device),'[]'::jsonb) from(select device,count(*) n,count(*) filter(where completed) completed from cohort group by device) q),
  'lastStages',(select jsonb_agg(jsonb_build_object('stage',st.stage,'count',(select count(*) from cohort c where c.last_stage=st.ord),'stalled',(select count(*) from cohort c where c.last_stage=st.ord and not c.completed and c.last_event_at<=now()-interval '30 minutes')) order by st.ord) from stages st)
 ) into result;
 return result;
end $$;
revoke all on function public.record_registration_event(uuid,uuid,text,text,text,text),public.admin_registration_analytics(integer,text) from public,anonymous,authenticated;
grant execute on function public.record_registration_event(uuid,uuid,text,text,text,text) to anonymous,authenticated;
grant execute on function public.admin_registration_analytics(integer,text) to authenticated;
commit;
