-- Public request budget (range / exact) on public.requests, and saved requests (bookmarks) with engagement_state.savedRequestIds.
-- Re-runnable. The source of truth for the budget stays meetany_private.request_preferences; private budgets are never copied.
begin;

alter table public.requests
 add column if not exists budget_type text,
 add column if not exists budget_min numeric(12,2),
 add column if not exists budget_max numeric(12,2);
alter table public.requests drop constraint if exists requests_budget_type_check;
alter table public.requests add constraint requests_budget_type_check check(budget_type is null or budget_type in('range','exact'));
alter table public.requests drop constraint if exists requests_budget_values_check;
alter table public.requests add constraint requests_budget_values_check check(
 (budget_type is null and budget_min is null and budget_max is null)
 or (budget_type='exact' and budget_min>0 and budget_max is null)
 or (budget_type='range' and budget_min>0 and budget_max>=budget_min));

-- Same body as 20261009-flow-completion.sql, plus the public budget sync before the return.
create or replace function public.set_request_preferences(p_request_id uuid,p_preferences jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); r public.requests; p jsonb:=p_preferences;
begin
 select * into r from public.requests where id=p_request_id and owner_id=me.id for update;
 if not found then perform meetany_private.flow_fail('MA901'); end if;
 if meetany_private.request_state(r)<>'open' then perform meetany_private.flow_fail('MA903'); end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 or exists(select 1 from jsonb_object_keys(p) k where k not in('specification','design','supplierTypes','certificates','verifiedOnly','flexibility','budgetType','budgetMin','budgetMax','budgetPrivate','payment','vatInvoice','deferredPayment')) then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('specification','design','certificates','payment') and jsonb_typeof(x.value)<>'string') then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'design' and p->>'design' not in('','ready','needed','none') then perform meetany_private.flow_fail('MA902'); end if;
 if length(coalesce(p->>'specification',''))>2000 or length(coalesce(p->>'design',''))>120 or length(coalesce(p->>'payment',''))>500 or length(coalesce(p->>'certificates',''))>500 then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'flexibility' and (jsonb_typeof(p->'flexibility')<>'number' or (p->>'flexibility')::numeric not between 0 and 30) then perform meetany_private.flow_fail('MA902'); end if;
 if p ? 'supplierTypes' and (jsonb_typeof(p->'supplierTypes')<>'array' or jsonb_array_length(p->'supplierTypes')>3 or exists(select 1 from jsonb_array_elements_text(p->'supplierTypes') t where t not in('manufacturer','distributor','service'))) then perform meetany_private.flow_fail('MA902'); end if;
 if coalesce(p->>'budgetType','negotiable') not in('range','exact','negotiable') then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetMin','budgetMax') and (jsonb_typeof(x.value)<>'number' or (x.value::text)::numeric not between 0 and 1000000000)) then perform meetany_private.flow_fail('MA902'); end if;
 if coalesce(p->>'budgetType','negotiable')<>'negotiable' and (not p ? 'budgetMin' or (p->>'budgetMin')::numeric<=0 or (p->>'budgetType'='range' and (not p ? 'budgetMax' or (p->>'budgetMax')::numeric<(p->>'budgetMin')::numeric))) then perform meetany_private.flow_fail('MA902'); end if;
 if exists(select 1 from jsonb_each(p) x where x.key in('budgetPrivate','verifiedOnly','vatInvoice','deferredPayment') and jsonb_typeof(x.value)<>'boolean') then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.request_preferences(request_id,preferences) values(r.id,p) on conflict(request_id) do update set preferences=excluded.preferences;
 update public.requests set
  budget_type=case when p->>'budgetType' in('range','exact') and not coalesce((p->>'budgetPrivate')::boolean,false) then p->>'budgetType' end,
  budget_min=case when p->>'budgetType' in('range','exact') and not coalesce((p->>'budgetPrivate')::boolean,false) then (p->>'budgetMin')::numeric end,
  budget_max=case when p->>'budgetType'='range' and not coalesce((p->>'budgetPrivate')::boolean,false) then (p->>'budgetMax')::numeric end
 where id=r.id;
 return p;
end $$;

-- One-off backfill for requests that already have preferences (private budgets stay null). Idempotent.
update public.requests r set
 budget_type=case when pr.preferences->>'budgetType' in('range','exact') and not coalesce((pr.preferences->>'budgetPrivate')::boolean,false) then pr.preferences->>'budgetType' end,
 budget_min=case when pr.preferences->>'budgetType' in('range','exact') and not coalesce((pr.preferences->>'budgetPrivate')::boolean,false) then (pr.preferences->>'budgetMin')::numeric end,
 budget_max=case when pr.preferences->>'budgetType'='range' and not coalesce((pr.preferences->>'budgetPrivate')::boolean,false) then (pr.preferences->>'budgetMax')::numeric end
from meetany_private.request_preferences pr
where pr.request_id=r.id;

-- ============================================================= saved requests
create table if not exists meetany_private.saved_requests (
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.requests(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create index if not exists saved_requests_page_idx on meetany_private.saved_requests(user_id,created_at desc,request_id desc);
alter table meetany_private.saved_requests enable row level security;
revoke all on meetany_private.saved_requests from public,anonymous,authenticated;

create or replace function public.set_saved_request(p_request_id uuid,p_saved boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_saved is null then raise exception using errcode='22023',message='saved is required'; end if;
 if not p_saved then delete from meetany_private.saved_requests where user_id=me.id and request_id=p_request_id; return false; end if;
 if not exists(select 1 from public.requests r join public.profiles o on o.id=r.owner_id and not o.blocked where r.id=p_request_id and not r.hidden) then perform meetany_private.fail('MA106'); end if;
 if exists(select 1 from public.requests where id=p_request_id and owner_id=me.id) then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.saved_requests(user_id,request_id) values(me.id,p_request_id) on conflict do nothing;
 return true;
end $$;

create or replace function public.list_saved_requests(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select s.created_at,s.request_id,r.title,r.category,r.city,r.budget_type,r.budget_min,r.budget_max,r.expires_at,
   o.company as owner_company,meetany_private.request_state(r) as state
  from meetany_private.saved_requests s
  join public.requests r on r.id=s.request_id and not r.hidden
  join public.profiles o on o.id=r.owner_id and not o.blocked
  where s.user_id=me.id and s.created_at<=(c->>'asOf')::timestamptz
  and (p_cursor is null or (s.created_at,s.request_id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by s.created_at desc,s.request_id desc limit 26
 ), page as(select * from candidates order by created_at desc,request_id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.request_id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',request_id,'asOf',c->>'asOf') from page order by created_at,request_id limit 1) end) into result;
 return result;
end $$;

-- Same body as 20260923-request-alerts.sql, plus savedRequestIds.
create or replace function public.engagement_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return jsonb_build_object('version',2,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'savedRequestIds',coalesce((select jsonb_agg(s.request_id) from meetany_private.saved_requests s join public.requests r on r.id=s.request_id and not r.hidden join public.profiles o on o.id=r.owner_id and not o.blocked where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.read_at is null and (n.kind<>'request_match' or (meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked)))),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false),
 'requestAlerts',case when me.role='company' then public.request_alert_preferences() else null end);
end $$;

revoke all on function public.set_saved_request(uuid,boolean),public.list_saved_requests(jsonb),public.engagement_state() from public,anonymous,authenticated;
grant execute on function public.set_saved_request(uuid,boolean),public.list_saved_requests(jsonb),public.engagement_state() to authenticated;

commit;
