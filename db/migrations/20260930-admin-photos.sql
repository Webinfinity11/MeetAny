-- T12.4c: admin removal of a company's uploaded photo (logo or gallery); additive and rerunnable.
-- Apply after 20260930-company-gallery.sql and 20260929-admin-v2.sql.
-- 1. moderation_audit accepts the action 'user.photo_remove' (target_type 'user').
-- 2. admin_remove_company_photo(p_user_id, p_url, p_reason): admin only, reason required (MA304);
--    clears logo_url when it is that URL, else removes it from gallery; neither -> MA305 (MA302 when
--    the user does not exist). Audited with the removed URL. The Blob file is removed by the app.
-- 3. admin_list_audit_v2 accepts the new action as a filter.
begin;
set local lock_timeout='5s';

create or replace function meetany_private.fail(p_code text) returns void
language plpgsql volatile set search_path = '' as $$
declare
  t text := case p_code
    when 'MA001' then 'not signed in'
    when 'MA002' then 'account is blocked'
    when 'MA003' then 'admin only'
    when 'MA101' then 'title must be at least 5 characters'
    when 'MA102' then 'description must be at least 10 characters'
    when 'MA103' then 'invalid category'
    when 'MA104' then 'invalid city'
    when 'MA105' then 'too many open requests (max 5)'
    when 'MA106' then 'request not found'
    when 'MA107' then 'request belongs to another user'
    when 'MA108' then 'chosen or hidden request cannot be extended'
    when 'MA109' then 'invalid photo url'
    when 'MA110' then 'request cannot be edited once it has offers or is chosen/hidden'
    when 'MA111' then 'quantity must be a positive number up to 1e9'
    when 'MA112' then 'quantity needs a valid unit (pcs, m2, kg, hour, service)'
    when 'MA113' then 'needed-by date must be between today and 2 years ahead'
    when 'MA114' then 'address note is longer than 120 characters'
    when 'MA115' then 'invalid logo url'
    when 'MA116' then 'gallery allows at most 8 own gallery photos'
    when 'MA201' then 'only company accounts can send offers'
    when 'MA202' then 'cannot send an offer on own request'
    when 'MA203' then 'request no longer accepts offers'
    when 'MA204' then 'offer must be at least 10 characters'
    when 'MA205' then 'price must be a positive number up to 1e9'
    when 'MA206' then 'offer not found'
    when 'MA207' then 'chosen offer cannot be withdrawn'
    when 'MA208' then 'request no longer allows choosing'
    when 'MA209' then 'offer was changed, reload before choosing'
    when 'MA210' then 'invalid price type (unit, total, negotiable)'
    when 'MA211' then 'a negotiable offer has no price'
    when 'MA212' then 'unit or total price type needs a price'
    when 'MA213' then 'delivery days must be an integer from 0 to 365'
    when 'MA301' then 'cannot block own account'
    when 'MA302' then 'user not found'
    when 'MA303' then 'only companies can be verified'
    when 'MA304' then 'moderation reason must be 3 to 500 characters'
    when 'MA305' then 'photo not found on this profile'
    when 'MA401' then 'name is required'
    when 'MA402' then 'company name is required'
    when 'MA403' then 'invalid email'
    when 'MA404' then 'invalid phone, expected +995 5XX XXX XXX'
    when 'MA405' then 'phone already registered'
    when 'MA407' then 'invalid industry'
    when 'MA408' then 'email is not verified'
    when 'MA410' then 'about text is longer than 1000 characters'
    when 'MA411' then 'lists allow at most 8 items of up to 120 characters'
    when 'MA412' then 'address is longer than 200 characters'
    when 'MA413' then 'coordinates must be a valid latitude and longitude pair'
    else 'error' end;
begin
  raise exception using errcode = 'P0001', message = p_code || ': ' || t, hint = p_code;
end
$$;

alter table meetany_private.moderation_audit drop constraint if exists moderation_audit_action_check;
alter table meetany_private.moderation_audit add constraint moderation_audit_action_check
  check (action in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove'));

create or replace function public.admin_remove_company_photo(p_user_id uuid, p_url text, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  v_url text := btrim(coalesce(p_url, ''));
  previous public.profiles;
  v_field text;
  p public.profiles;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if not found then perform meetany_private.fail('MA302'); end if;
  if v_url <> '' and previous.logo_url = v_url then v_field := 'logo';
  elsif v_url <> '' and v_url = any (previous.gallery) then v_field := 'gallery';
  else perform meetany_private.fail('MA305'); end if;
  update public.profiles
     set logo_url = case when v_field = 'logo' then null else logo_url end,
         gallery = case when v_field = 'gallery' then array_remove(gallery, v_url) else gallery end
   where id = p_user_id
  returning * into p;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p_user_id,'user.photo_remove',v_reason,
    jsonb_build_object('field',v_field,'url',v_url),jsonb_build_object('field',v_field,'removed',true));
  return p;
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
  if p_action is not null and p_action not in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove') then
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

revoke all on function public.admin_remove_company_photo(uuid, text, text) from public, anonymous, authenticated;
grant execute on function public.admin_remove_company_photo(uuid, text, text) to authenticated;
commit;
