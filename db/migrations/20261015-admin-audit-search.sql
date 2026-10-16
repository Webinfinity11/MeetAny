begin;

-- Search and date filtering happen before counting and cursor pagination.
-- Keep v2 for older deployed clients while the new UI switches to this additive RPC.
create or replace function public.admin_search_audit(
 p_cursor jsonb default null, p_limit integer default 25, p_action text default null,
 p_target_type text default null, p_q text default null, p_days integer default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 me public.profiles := meetany_private.require_admin();
 v_cursor jsonb := meetany_private.admin_page_cursor(p_cursor);
 v_asof timestamptz := (v_cursor->>'asOf')::timestamptz;
 v_limit integer := least(coalesce(p_limit,25),100);
 v_since timestamptz;
 v_query text := lower(trim(coalesce(p_q,'')));
 result jsonb;
begin
 if v_limit < 1 or length(v_query)>200 or (p_days is not null and p_days not in (1,7,30)) then
  raise exception using errcode='22023',message='invalid audit filters';
 end if;
 if p_action is not null and p_action not in ('request.hide','request.show','request.delete','user.block','user.unblock','company.verify','company.unverify','offer.delete','user.photo_remove',
  'edit_profile','edit_request','company.verification_review','request.preferences','deal.stage','deal.issue_resolve','user.role','user.anonymize','company.hide','company.show','offer.edit','report.resolve','deal.issue_comment') then
  raise exception using errcode='22023',message='invalid audit action';
 end if;
 if p_target_type is not null and p_target_type not in ('request','user','offer','deal','report') then
  raise exception using errcode='22023',message='invalid audit target type';
 end if;
 if p_days is not null then
  v_since := (date_trunc('day',v_asof at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi')-(p_days-1)*interval '1 day';
 end if;
 with source as (
  select a.*, coalesce(nullif(actor.company,''),actor.name) actor_name, actor.email actor_email,
   case a.target_type when 'user' then coalesce(nullif(u.company,''),u.name)
    when 'request' then r.title when 'offer' then coalesce(nullif(company.company,''),company.name)
    when 'deal' then dr.title end target_name,
   case when a.target_type='user' then u.role end target_role,
   case a.target_type when 'user' then u.id is not null when 'request' then r.id is not null
    when 'offer' then o.id is not null when 'deal' then deal.id is not null end target_exists,
   context.title target_context, case when a.target_type='offer' then (a.old_flags->>'request_id')::uuid end target_context_id
  from meetany_private.moderation_audit a
  left join public.profiles actor on actor.id=a.actor_id
  left join public.profiles u on a.target_type='user' and u.id=a.target_id
  left join public.requests r on a.target_type='request' and r.id=a.target_id
  left join public.offers o on a.target_type='offer' and o.id=a.target_id
  left join public.profiles company on a.target_type='offer' and company.id=coalesce(o.company_id,(a.old_flags->>'company_id')::uuid)
  left join public.requests context on a.target_type='offer' and context.id=coalesce(o.request_id,(a.old_flags->>'request_id')::uuid)
  left join meetany_private.deals deal on a.target_type='deal' and deal.id=a.target_id
  left join public.requests dr on dr.id=deal.request_id
 ), filtered as materialized (
  select * from source x where x.created_at<=v_asof and (v_since is null or x.created_at>=v_since)
   and (p_action is null or x.action=p_action) and (p_target_type is null or x.target_type=p_target_type)
   and (v_query='' or not exists (
    select 1 from regexp_split_to_table(v_query,'\s+') term
    where strpos(lower(coalesce(x.target_name,'')||' '||x.target_id::text||' '||coalesce(x.target_context,'')),term)=0
   ))
 ), candidates as (
  select * from filtered x where p_cursor is null or (x.created_at,x.id)<((v_cursor->>'created_at')::timestamptz,(v_cursor->>'id')::uuid)
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
revoke all on function public.admin_search_audit(jsonb,integer,text,text,text,integer) from public,anonymous;
grant execute on function public.admin_search_audit(jsonb,integer,text,text,text,integer) to authenticated;
commit;
