-- Contact disclosure/call-link activity, not completed telephone calls.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.contact_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid, actor_role text not null check(actor_role in ('anonymous','client','company','admin')),
 target_kind text not null check(target_kind in ('company','request')), target_id uuid not null,
 kind text not null check(kind in ('reveal','call')),
 source text not null check(source in ('company-list','company-profile','company-partnership','request-owner','chosen-offer')),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists contact_events_page_idx on meetany_private.contact_events(created_at desc,id desc);
create index if not exists contact_events_actor_idx on meetany_private.contact_events(target_kind,target_id,kind,actor_id,created_at desc);
alter table meetany_private.contact_events enable row level security;
revoke all on meetany_private.contact_events from public,anonymous,authenticated;

create or replace function public.log_contact_event(p_target_kind text,p_target_id uuid,p_kind text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles; actor uuid:=meetany_private.uid(); at_time timestamptz; event_id uuid;
begin
 if actor is not null then me:=meetany_private.require_user(); end if;
 if p_target_kind is null or p_target_kind not in ('company','request') or p_target_id is null
 or p_kind is null or p_kind not in ('reveal','call') or p_source is null
 or (p_target_kind='company' and p_source not in ('company-list','company-profile','company-partnership'))
 or (p_target_kind='request' and p_source not in ('request-owner','chosen-offer')) then
  raise exception using errcode='22023',message='invalid contact event';
 end if;
 if p_target_kind='company' then
  if not exists(select 1 from public.profiles where id=p_target_id and role='company' and not blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 else
  if not exists(select 1 from public.requests r join public.profiles p on p.id=r.owner_id where r.id=p_target_id and not r.hidden and not p.blocked) then
   raise exception using errcode='22023',message='contact target unavailable'; end if;
 end if;
 -- Serialize the anonymous global cap, and each signed-in actor's writes.
 perform pg_advisory_xact_lock(hashtextextended('meetany-contact:'||coalesce(actor::text,'anonymous'),0));
 at_time:=clock_timestamp();
 if exists(select 1 from meetany_private.contact_events where actor_id is not distinct from actor
  and target_kind=p_target_kind and target_id=p_target_id and kind=p_kind and created_at>at_time-interval '1 minute')
 or (actor is null and (select count(*) from meetany_private.contact_events where actor_id is null and created_at>at_time-interval '1 minute')>=120) then
  return jsonb_build_object('recorded',false);
 end if;
 insert into meetany_private.contact_events(actor_id,actor_role,target_kind,target_id,kind,source,created_at)
 values(actor,coalesce(me.role,'anonymous'),p_target_kind,p_target_id,p_kind,p_source,at_time) returning id into event_id;
 return jsonb_build_object('recorded',true,'id',event_id);
end $$;

create or replace function public.admin_contact_events(p_cursor jsonb default null,p_kind text default null,p_target_kind text default null,p_from timestamptz default null,p_to timestamptz default null,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor);
 lim integer:=least(coalesce(p_limit,25),100); result jsonb;
begin
 if lim<1 or (p_kind is not null and p_kind not in ('reveal','call'))
 or (p_target_kind is not null and p_target_kind not in ('company','request'))
 or (p_from is not null and not isfinite(p_from)) or (p_to is not null and not isfinite(p_to)) or p_from>p_to then
 raise exception using errcode='22023',message='invalid contact filters'; end if;
 with filtered as materialized (
  select e.* from meetany_private.contact_events e where created_at<=(c->>'asOf')::timestamptz
  and (p_kind is null or kind=p_kind) and (p_target_kind is null or target_kind=p_target_kind)
  and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)
 ), candidates as (
  select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid)
  order by created_at desc,id desc limit lim+1
 ), page as (select * from candidates order by created_at desc,id desc limit lim), enriched as (
  select e.*,a.name actor_name,a.company actor_company,
   case when e.target_kind='company' then coalesce(nullif(p.company,''),p.name) else r.title end target_name,
   case when e.target_kind='company' then p.id is not null else r.id is not null end target_exists
  from page e left join public.profiles a on a.id=e.actor_id
  left join public.profiles p on e.target_kind='company' and p.id=e.target_id
  left join public.requests r on e.target_kind='request' and r.id=e.target_id
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc,id desc) from enriched e),'[]'::jsonb),
 'hasMore',(select count(*)>lim from candidates),
 'nextCursor',case when (select count(*)>lim from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end,
 'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf') into result;
 return result;
end $$;

create or replace function public.admin_contact_stats(p_period text default 'month') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); since_time timestamptz; result jsonb;
begin
 if p_period is null or p_period not in ('day','week','month') then raise exception using errcode='22023',message='invalid contact period'; end if;
 since_time:=case p_period when 'day' then date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi' when 'week' then now()-interval '7 days' else now()-interval '30 days' end;
 with periods as (
  select label,starts from (values ('day',date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi'),('week',now()-interval '7 days'),('month',now()-interval '30 days')) p(label,starts)
 ), totals as (
  select label,count(e.id) filter(where e.kind='reveal') reveals,count(e.id) filter(where e.kind='call') calls
  from periods p left join meetany_private.contact_events e on e.created_at>=p.starts and e.created_at<=now() group by label
 ), ranked as (
  select target_kind,target_id,count(*) filter(where kind='reveal') reveals,count(*) filter(where kind='call') calls,count(*) total
  from meetany_private.contact_events where created_at>=since_time and created_at<=now() group by target_kind,target_id
 ), companies as (
  select x.*,coalesce(nullif(p.company,''),p.name,'წაშლილი კომპანია') target_name,p.id is not null target_exists
  from ranked x left join public.profiles p on p.id=x.target_id where target_kind='company' order by total desc,target_id limit 10
 ), requests as (
  select x.*,coalesce(r.title,'წაშლილი მოთხოვნა') target_name,r.id is not null target_exists
  from ranked x left join public.requests r on r.id=x.target_id where target_kind='request' order by total desc,target_id limit 10
 ) select jsonb_build_object('period',p_period,'totals',(select jsonb_object_agg(label,jsonb_build_object('reveals',reveals,'calls',calls)) from totals),
 'companies',coalesce((select jsonb_agg(to_jsonb(x) order by total desc,target_id) from companies x),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(x) order by total desc,target_id) from requests x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.log_contact_event(text,uuid,text,text),public.admin_contact_events(jsonb,text,text,timestamptz,timestamptz,integer),public.admin_contact_stats(text) from public,anonymous,authenticated;
grant execute on function public.log_contact_event(text,uuid,text,text) to anonymous,authenticated;
grant execute on function public.admin_contact_events(jsonb,text,text,timestamptz,timestamptz,integer),public.admin_contact_stats(text) to authenticated;
commit;
