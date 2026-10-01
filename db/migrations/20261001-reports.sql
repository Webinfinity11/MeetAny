-- T15.9: content reports („შეატყობინე“) and the admin reports queue. Additive and rerunnable.
-- Apply after 20260929-admin-v2.sql (admin_delete_offer) and 20260930-business-features.sql (business_audit).
-- 1. meetany_private.reports: one active ('new') report per (reporter, target); RLS on, no API-role access.
-- 2. report_content(p_kind, p_target_id, p_reason, p_text): signed-in users only; request (not own, visible),
--    company (not own, not blocked), offer (only the author of the request it answers). Max 10 per user per day.
-- 3. admin_list_reports(p_status, p_offset), admin_resolve_report(p_id, p_action, p_reason): admin only (MA003).
--    'hide' uses the existing audited moderation functions (request hide / offer delete / company block) and
--    closes every new report on that target; 'reject' closes this report. Each resolution writes business_audit.
-- Error codes: MA701 invalid reason/text, MA702 content not found, MA703 own content, MA704 already reported,
--              MA705 daily limit, MA706 report already handled.
begin;
set local lock_timeout='5s';

create table if not exists meetany_private.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 target_kind text not null check(target_kind in ('request','company','offer')),
 -- No foreign key: the report (and its history) outlives a deleted target.
 target_id uuid not null,
 target_owner_id uuid,
 target_label text not null default '' check(length(target_label)<=300),
 context_id uuid,
 reason text not null check(reason in ('spam','fake','offensive','other')),
 body text not null default '' check(length(body)<=500),
 status text not null default 'new' check(status in ('new','handled')),
 resolution text check(resolution in ('hidden','rejected')),
 resolution_reason text check(resolution_reason is null or length(resolution_reason)<=500),
 handled_by uuid,
 handled_at timestamptz,
 created_at timestamptz not null default now(),
 check(reason<>'other' or length(btrim(body))>=3),
 check((status='new')=(resolution is null))
);
create unique index if not exists reports_one_active on meetany_private.reports(reporter_id,target_kind,target_id) where status='new';
create index if not exists reports_queue on meetany_private.reports(status,created_at desc,id);
create index if not exists reports_target on meetany_private.reports(target_kind,target_id);
create index if not exists reports_reporter_day on meetany_private.reports(reporter_id,created_at desc);
alter table meetany_private.reports enable row level security;
revoke all on meetany_private.reports from public,anonymous,authenticated;

create or replace function meetany_private.report_fail(p_code text) returns void
language plpgsql volatile set search_path='' as $$
declare t text := case p_code
 when 'MA701' then 'choose a reason; other needs 3 to 500 characters'
 when 'MA702' then 'content not found'
 when 'MA703' then 'cannot report own content'
 when 'MA704' then 'already reported'
 when 'MA705' then 'daily report limit reached (10)'
 when 'MA706' then 'report already handled'
 else 'error' end;
begin
 raise exception using errcode='P0001',message=p_code||': '||t,hint=p_code;
end $$;
revoke all on function meetany_private.report_fail(text) from public,anonymous,authenticated;

create or replace function public.report_content(p_kind text,p_target_id uuid,p_reason text,p_text text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_user();
 v_text text:=btrim(coalesce(p_text,''));
 v_owner uuid; v_label text; v_context uuid; v meetany_private.reports;
begin
 if p_kind is null or p_kind not in ('request','company','offer') or p_target_id is null then perform meetany_private.report_fail('MA702'); end if;
 if p_reason is null or p_reason not in ('spam','fake','offensive','other') or length(v_text)>500 or (p_reason='other' and length(v_text)<3) then
  perform meetany_private.report_fail('MA701'); end if;
 if p_kind='request' then
  select r.owner_id,r.title into v_owner,v_label from public.requests r where r.id=p_target_id and not r.hidden;
 elsif p_kind='company' then
  select p.id,coalesce(nullif(p.company,''),p.name) into v_owner,v_label from public.profiles p where p.id=p_target_id and p.role='company' and not p.blocked;
 else
  -- Offers are sealed: only the author of the request they answer can see, and so report, them.
  select o.company_id,coalesce(nullif(c.company,''),c.name),r.id into v_owner,v_label,v_context
  from public.offers o join public.requests r on r.id=o.request_id join public.profiles c on c.id=o.company_id
  where o.id=p_target_id and r.owner_id=me.id;
 end if;
 if v_owner is null then perform meetany_private.report_fail('MA702'); end if;
 if v_owner=me.id then perform meetany_private.report_fail('MA703'); end if;
 -- Serialise one reporter's submissions so the daily limit and the duplicate check cannot race.
 perform pg_advisory_xact_lock(hashtextextended('meetany.report:'||me.id::text,0));
 if exists(select 1 from meetany_private.reports where reporter_id=me.id and target_kind=p_kind and target_id=p_target_id and status='new') then
  perform meetany_private.report_fail('MA704'); end if;
 if (select count(*) from meetany_private.reports where reporter_id=me.id and created_at>now()-interval '1 day')>=10 then
  perform meetany_private.report_fail('MA705'); end if;
 insert into meetany_private.reports(reporter_id,target_kind,target_id,target_owner_id,target_label,context_id,reason,body)
 values(me.id,p_kind,p_target_id,v_owner,left(coalesce(v_label,''),300),v_context,p_reason,v_text)
 returning * into v;
 return jsonb_build_object('id',v.id,'status',v.status,'created_at',v.created_at);
end $$;

create or replace function public.admin_list_reports(p_status text default 'new',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin();
begin
 if p_offset is null or p_offset<0 or (p_status is not null and p_status not in ('new','handled')) then
  raise exception using errcode='22023',message='invalid report queue'; end if;
 return jsonb_build_object(
 'total',(select count(*) from meetany_private.reports where p_status is null or status=p_status),
 'newCount',(select count(*) from meetany_private.reports where status='new'),
 'items',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]'::jsonb) from (
  select x.id,x.target_kind,x.target_id,x.context_id,x.reason,x.body,x.status,x.resolution,x.resolution_reason,x.created_at,x.handled_at,
   x.reporter_id,coalesce(nullif(rp.company,''),rp.name) reporter_name,rp.email reporter_email,
   coalesce(case x.target_kind when 'request' then rq.title when 'company' then coalesce(nullif(co.company,''),co.name)
     else coalesce(nullif(oc.company,''),oc.name) end,nullif(x.target_label,'')) target_label,
   case x.target_kind when 'request' then rq.id is not null when 'company' then co.id is not null else o.id is not null end target_exists,
   case x.target_kind when 'request' then coalesce(rq.hidden,false) when 'company' then coalesce(co.blocked,false) else false end target_removed,
   coalesce(case when x.target_kind='offer' then oq.title end,'') context_label,
   coalesce(case when x.target_kind='offer' then o.status end,'') offer_status,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id) target_reports,
   (select count(*) from meetany_private.reports s where s.target_kind=x.target_kind and s.target_id=x.target_id and s.status='new') target_new,
   coalesce(nullif(h.company,''),h.name) handler_name
  from meetany_private.reports x
  left join public.profiles rp on rp.id=x.reporter_id
  left join public.requests rq on x.target_kind='request' and rq.id=x.target_id
  left join public.profiles co on x.target_kind='company' and co.id=x.target_id
  left join public.offers o on x.target_kind='offer' and o.id=x.target_id
  left join public.profiles oc on x.target_kind='offer' and oc.id=x.target_owner_id
  left join public.requests oq on x.target_kind='offer' and oq.id=x.context_id
  left join public.profiles h on h.id=x.handled_by
  where p_status is null or x.status=p_status
  order by x.created_at desc,x.id limit 20 offset p_offset) t));
end $$;

create or replace function public.admin_resolve_report(p_id uuid,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_admin();
 v_reason text:=meetany_private.moderation_reason(p_reason);
 v meetany_private.reports; v_effect text:='none'; v_closed integer;
begin
 if v_reason is null then perform meetany_private.fail('MA304'); end if;
 if p_action is null or p_action not in ('hide','reject') then raise exception using errcode='22023',message='invalid report action'; end if;
 select * into v from meetany_private.reports where id=p_id for update;
 if v.id is null or v.status<>'new' then perform meetany_private.report_fail('MA706'); end if;
 if p_action='hide' then
  -- Reuse the audited moderation functions; a target that is already gone or hidden needs no change.
  if v.target_kind='request' then
   if exists(select 1 from public.requests where id=v.target_id and not hidden) then
    perform public.admin_set_hidden(v.target_id,true,v_reason); v_effect:='request.hide'; end if;
  elsif v.target_kind='offer' then
   if exists(select 1 from public.offers where id=v.target_id) then
    perform public.admin_delete_offer(v.target_id,v_reason); v_effect:='offer.delete'; end if;
  else
   if exists(select 1 from public.profiles where id=v.target_id and not blocked and role<>'admin') then
    perform public.admin_set_blocked(v.target_id,true,v_reason); v_effect:='user.block'; end if;
  end if;
  update meetany_private.reports set status='handled',resolution='hidden',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where target_kind=v.target_kind and target_id=v.target_id and status='new';
 else
  update meetany_private.reports set status='handled',resolution='rejected',resolution_reason=v_reason,handled_by=me.id,handled_at=now()
  where id=v.id;
 end if;
 get diagnostics v_closed=row_count;
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)
 values(me.id,v.id,'report_'||case when p_action='hide' then 'hidden' else 'rejected' end,
  jsonb_build_object('kind',v.target_kind,'target_id',v.target_id,'reason',v_reason,'effect',v_effect,'closed',v_closed));
 return jsonb_build_object('id',v.id,'action',p_action,'effect',v_effect,'closed',v_closed);
end $$;

do $$
declare f record;
begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace
  and proname=any(array['report_content','admin_list_reports','admin_resolve_report']) loop
  execute format('revoke all on function %s from public, anonymous, authenticated',f.sig);
  execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
end $$;

commit;
