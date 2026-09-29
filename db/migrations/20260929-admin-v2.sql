-- Admin API v2: additive RPC names preserve cached v1 signatures.
begin;
set local lock_timeout='5s';

alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_target_type_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_target_type_check
  check (target_type in ('request','user','offer'));
alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check
  check (action in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete'));

create or replace function public.admin_search_offers(p_q text default null, p_status text default null, p_cursor jsonb default null, p_limit integer default 25) returns jsonb
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
  if p_status is not null and p_status not in ('sent','chosen','declined') then
    raise exception using errcode = '22023', message = 'invalid offer status'; end if;
  with source as (
    select o.*, coalesce(nullif(p.company,''),p.name) as company_name,
           r.title as request_title, r.hidden as request_hidden, p.name as search_name
    from public.offers o join public.profiles p on p.id=o.company_id
    join public.requests r on r.id=o.request_id
  ), filtered as materialized (
    select * from source x where x.created_at <= v_asof
      and (v_q is null or position(lower(v_q) in lower(concat_ws(' ',x.id::text,x.body,x.company_name,x.search_name,x.request_title))) > 0)
      and (p_status is null or x.status=p_status)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) - 'search_name' order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_delete_offer(p_offer_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.offers;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  select * into previous from public.offers where id=p_offer_id for update;
  if not found then perform meetany_private.fail('MA206'); end if;
  if previous.status='chosen' then perform meetany_private.fail('MA207'); end if;
  delete from public.offers where id=p_offer_id;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'offer',p_offer_id,'offer.delete',v_reason,
    jsonb_build_object('deleted',false,'status',previous.status,'request_id',previous.request_id,'company_id',previous.company_id),
    jsonb_build_object('deleted',true));
end $$;

create or replace function public.admin_delete_request_v2(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  previous public.requests;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  delete from public.requests where id=p_request_id returning * into previous;
  if not found then perform meetany_private.fail('MA106'); end if;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'request',p_request_id,'request.delete',v_reason,
    jsonb_build_object('hidden',previous.hidden,'deleted',false),jsonb_build_object('deleted',true));
end $$;

create or replace function public.admin_list_audit_v2(p_cursor jsonb default null, p_limit integer default 25, p_action text default null, p_target_type text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
  v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
  v_limit integer := least(coalesce(p_limit,25),100);
  result jsonb;
begin
  if v_limit < 1 then raise exception using errcode = '22023', message = 'limit must be positive'; end if;
  if p_action is not null and p_action not in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete') then
    raise exception using errcode = '22023', message = 'invalid audit action'; end if;
  if p_target_type is not null and p_target_type not in ('request','user','offer') then
    raise exception using errcode = '22023', message = 'invalid audit target type'; end if;
  with source as (select a.* from meetany_private.moderation_audit a),
  filtered as materialized (
    select * from source x where x.created_at <= v_asof and (p_action is null or x.action=p_action) and (p_target_type is null or x.target_type=p_target_type)
  ), candidates as (
    select * from filtered x
    where p_cursor is null or (x.created_at,x.id) < ((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
    order by x.created_at desc,x.id desc limit v_limit+1
  ), page as (select * from candidates order by created_at desc,id desc limit v_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'actor_name',coalesce(nullif(actor.company,''),actor.name),'actor_email',actor.email,
      'target_name',case p.target_type when 'user' then coalesce(nullif(u.company,''),u.name)
        when 'request' then r.title when 'offer' then case when o.id is not null then coalesce(nullif(company.company,''),company.name) end end,
      'target_exists',case p.target_type when 'user' then u.id is not null when 'request' then r.id is not null when 'offer' then o.id is not null end,
      'target_context',context.title,'target_context_id',case when p.target_type='offer' then (p.old_flags->>'request_id')::uuid end
    ) order by p.created_at desc,p.id desc) from page p
    left join public.profiles actor on actor.id=p.actor_id
    left join public.profiles u on p.target_type='user' and u.id=p.target_id
    left join public.requests r on p.target_type='request' and r.id=p.target_id
    left join public.offers o on p.target_type='offer' and o.id=p.target_id
    left join public.profiles company on p.target_type='offer' and company.id=(p.old_flags->>'company_id')::uuid
    left join public.requests context on p.target_type='offer' and context.id=(p.old_flags->>'request_id')::uuid),'[]'::jsonb),
    'hasMore',(select count(*)>v_limit from candidates),
    'nextCursor',case when (select count(*)>v_limit from candidates) then
      (select jsonb_build_object('created_at',created_at,'id',id,'asOf',v_asof) from page order by created_at,id limit 1) end,
    'filteredTotal',(select count(*) from filtered),'asOf',v_asof) into result;
  return result;
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
begin
  return jsonb_build_object(
    'adminApiVersion', 2,
    'hidden',    (select count(*) from public.requests where hidden),
    'blocked',   (select count(*) from public.profiles where blocked and role <> 'admin'),
    'users',     (select count(*) from public.profiles where role <> 'admin'),
    'companies', (select count(*) from public.profiles where role = 'company'),
    'verified',  (select count(*) from public.profiles where role = 'company' and verified),
    'open',      (select count(*) from public.requests r where meetany_private.request_state(r) = 'open'),
    'requests',  (select count(*) from public.requests where not hidden),
    'offers',    (select count(*) from public.offers),
    'chosen',    (select count(*) from public.requests where not hidden and chosen_offer_id is not null));
end
$$;

revoke all on function public.admin_search_offers(text,text,jsonb,integer) from public, anonymous;
grant execute on function public.admin_search_offers(text,text,jsonb,integer) to authenticated;
revoke all on function public.admin_delete_offer(uuid,text) from public, anonymous;
grant execute on function public.admin_delete_offer(uuid,text) to authenticated;
revoke all on function public.admin_delete_request_v2(uuid,text) from public, anonymous;
grant execute on function public.admin_delete_request_v2(uuid,text) to authenticated;
revoke all on function public.admin_list_audit_v2(jsonb,integer,text,text) from public, anonymous;
grant execute on function public.admin_list_audit_v2(jsonb,integer,text,text) to authenticated;

commit;
