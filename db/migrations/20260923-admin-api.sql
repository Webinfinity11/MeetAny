-- Admin API version 1 (T12.3b). Extracted verbatim from schema.sql (moderation audit .. admin_stats).
-- Idempotent: create if not exists / create or replace / drop+create trigger. Rerunnable.
-- Adds meetany_private.moderation_audit, audited moderation RPCs, paginated admin_search_requests,
-- admin_search_users, admin_list_audit, and admin_stats().adminApiVersion = 1.
-- Requires the base schema helpers (require_admin, fail, is_category, request_state).
begin;
set local lock_timeout='5s';

-- Durable moderation history: identifiers deliberately have no cascading foreign keys.
create table if not exists meetany_private.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  actor_id uuid not null,
  target_type text not null check (target_type in ('request', 'user')),
  target_id uuid not null,
  action text not null check (action in ('request.hide', 'request.show', 'request.delete', 'user.block', 'user.unblock', 'company.verify', 'company.unverify')),
  reason text check (reason is null or char_length(reason) between 3 and 500),
  old_flags jsonb not null,
  new_flags jsonb not null
);
alter table meetany_private.moderation_audit enable row level security;
create index if not exists moderation_audit_page_idx on meetany_private.moderation_audit (created_at desc, id desc);
create index if not exists requests_admin_page_idx on public.requests (created_at desc, id desc);
create index if not exists profiles_admin_page_idx on public.profiles (created_at desc, id desc);
create or replace function meetany_private.reject_audit_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'moderation audit is append-only';
end $$;
drop trigger if exists moderation_audit_immutable on meetany_private.moderation_audit;
create trigger moderation_audit_immutable before update or delete or truncate on meetany_private.moderation_audit
for each statement execute function meetany_private.reject_audit_mutation();

-- ============================================================= admin RPCs
-- Moderation reason (p_reason): optional for the API, trimmed, 3..500 characters when given (MA304);
-- stored while hidden / blocked and cleared on show / unblock. The request page asks for it.
create or replace function meetany_private.moderation_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v is not null and char_length(v) not between 3 and 500 then perform meetany_private.fail('MA304'); end if;
  return v;
end
$$;

drop function if exists public.admin_set_hidden(uuid, boolean);  -- replaced by the 3-argument version
create or replace function public.admin_set_hidden(p_request_id uuid, p_hidden boolean, p_reason text default null)
returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  r public.requests;
  previous public.requests;
begin
  select * into previous from public.requests where id = p_request_id for update;
  if not found then perform meetany_private.fail('MA106'); end if;
  update public.requests
     set hidden = coalesce(p_hidden, false),
         hidden_reason = case when coalesce(p_hidden, false) then v_reason end
   where id = p_request_id returning * into r;
  if not found then perform meetany_private.fail('MA106'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'request',r.id,case when r.hidden then 'request.hide' else 'request.show' end,v_reason,
          jsonb_build_object('hidden',previous.hidden),jsonb_build_object('hidden',r.hidden));
  return r;
end
$$;

create or replace function public.admin_delete_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  previous public.requests;
begin
  delete from public.requests where id = p_request_id returning * into previous;
  if found then
    insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,old_flags,new_flags)
    values (me.id,'request',p_request_id,'request.delete',jsonb_build_object('hidden',previous.hidden,'deleted',false),jsonb_build_object('deleted',true));
  end if;
end
$$;

drop function if exists public.admin_set_blocked(uuid, boolean);  -- replaced by the 3-argument version
create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.profiles;
begin
  if p_user_id = me.id then perform meetany_private.fail('MA301'); end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if not found then perform meetany_private.fail('MA302'); end if;
  update public.profiles
     set blocked = coalesce(p_blocked, false),
         blocked_reason = case when coalesce(p_blocked, false) then v_reason end
   where id = p_user_id;
  if not found then perform meetany_private.fail('MA302'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p_user_id,case when coalesce(p_blocked,false) then 'user.block' else 'user.unblock' end,v_reason,
          jsonb_build_object('blocked',previous.blocked),jsonb_build_object('blocked',coalesce(p_blocked,false)));
end
$$;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  previous public.profiles;
begin
  select * into previous from public.profiles where id = p_user_id and role = 'company' for update;
  if not found then perform meetany_private.fail('MA303'); end if;
  -- verified_at: now() when newly verified, kept when already verified, null when cleared.
  update public.profiles
     set verified = coalesce(p_verified, false),
         verified_at = case when not coalesce(p_verified, false) then null
                            when verified then verified_at else now() end
   where id = p_user_id and role = 'company';
  if not found then perform meetany_private.fail('MA303'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,old_flags,new_flags)
  values (me.id,'user',p_user_id,case when coalesce(p_verified,false) then 'company.verify' else 'company.unverify' end,
          jsonb_build_object('verified',previous.verified),jsonb_build_object('verified',coalesce(p_verified,false)));
end
$$;

create or replace function public.admin_list_users() returns setof public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return query select * from public.profiles order by created_at desc;
end
$$;

-- Validate cursors centrally. asOf bounds inserts, not a long-lived MVCC snapshot:
-- edits/deletes between pages remain visible and require refreshing the list.
create or replace function meetany_private.admin_page_cursor(p_cursor jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_time timestamptz;
  v_id uuid;
  v_asof timestamptz := statement_timestamp();
begin
  if p_cursor is null then return jsonb_build_object('asOf',v_asof); end if;
  if jsonb_typeof(p_cursor) <> 'object' or not (p_cursor ?& array['created_at','id','asOf']) then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end if;
  begin
    v_time := (p_cursor->>'created_at')::timestamptz;
    v_id := (p_cursor->>'id')::uuid;
    v_asof := (p_cursor->>'asOf')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end;
  if v_time is null or v_id is null or v_asof is null or not isfinite(v_time) or not isfinite(v_asof)
     or v_time > v_asof or v_asof > statement_timestamp() then
    raise exception using errcode = '22023', message = 'invalid admin cursor';
  end if;
  return jsonb_build_object('created_at',v_time,'id',v_id,'asOf',v_asof);
end $$;

create or replace function public.admin_search_requests(p_q text default null, p_state text default null, p_category text default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
  if p_state is not null and p_state not in ('open','closed','expired','chosen','hidden') then
    raise exception using errcode = '22023', message = 'invalid request state'; end if;
  if p_category is not null and not meetany_private.is_category(p_category) then
    raise exception using errcode = '22023', message = 'invalid category'; end if;
  with source as (select r.*, case when r.hidden then 'hidden' when r.chosen_offer_id is not null then 'chosen'
              when r.status = 'closed' then 'closed' when r.expires_at <= v_asof then 'expired' else 'open' end as state,
              p.name as owner_name, p.company as owner_company
       from public.requests r join public.profiles p on p.id=r.owner_id),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.title || ' ' || x.body || ' ' || x.owner_company || ' ' || x.owner_name)) > 0)
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

create or replace function public.admin_search_users(p_q text default null, p_role text default null, p_blocked boolean default null, p_verified boolean default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
  if p_role is not null and p_role not in ('client','company','admin') then
    raise exception using errcode = '22023', message = 'invalid user role'; end if;
  with source as (select p.* from public.profiles p),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (v_q is null or position(lower(v_q) in lower(x.id::text || ' ' || x.name || ' ' || x.company || ' ' || x.email || ' ' || x.phone)) > 0)
       and (p_role is null or x.role=p_role) and (p_blocked is null or x.blocked=p_blocked)
       and (p_verified is null or x.verified=p_verified)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_list_audit(p_cursor jsonb default null, p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  with source as (select a.* from meetany_private.moderation_audit a),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and true
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

-- 'users' counts the people using the marketplace: every profile except admins.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return jsonb_build_object(
    'adminApiVersion', 1,
    'users',     (select count(*) from public.profiles where role <> 'admin'),
    'companies', (select count(*) from public.profiles where role = 'company'),
    'verified',  (select count(*) from public.profiles where role = 'company' and verified),
    'open',      (select count(*) from public.requests r where meetany_private.request_state(r) = 'open'),
    'requests',  (select count(*) from public.requests where not hidden),
    'offers',    (select count(*) from public.offers),
    'chosen',    (select count(*) from public.requests where not hidden and chosen_offer_id is not null));
end
$$;

revoke all on function meetany_private.reject_audit_mutation(), meetany_private.moderation_reason(text),
  meetany_private.admin_page_cursor(jsonb) from public, anonymous, authenticated;
revoke all on function
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_search_requests(text, text, text, jsonb, integer),
  public.admin_search_users(text, text, boolean, boolean, jsonb, integer),
  public.admin_list_audit(jsonb, integer),
  public.admin_list_users(), public.admin_stats()
  from public, anonymous, authenticated;
grant execute on function
  public.admin_set_hidden(uuid, boolean, text), public.admin_delete_request(uuid),
  public.admin_set_blocked(uuid, boolean, text), public.admin_set_verified(uuid, boolean),
  public.admin_search_requests(text, text, text, jsonb, integer),
  public.admin_search_users(text, text, boolean, boolean, jsonb, integer),
  public.admin_list_audit(jsonb, integer),
  public.admin_list_users(), public.admin_stats()
  to authenticated;
revoke all on meetany_private.moderation_audit from public, anonymous, authenticated;
commit;
