-- Verification is an optional company trust badge, not permission to participate.
-- All registered nonblocked clients and companies can send offers; personal suppliers
-- remain outside the company directory. Apply after the 20261015 migrations. Re-runnable.
begin;
set local lock_timeout='5s';

-- Preserve the installed offer implementation and its pricing, locking and upsert rules.
do $$
declare definition text; previous text;
begin
 definition:=pg_get_functiondef('public.send_offer(uuid,text,numeric,text,boolean,integer,boolean)'::regprocedure);
 previous:=definition;
 definition:=replace(definition,$old$if me.role <> 'company' then perform meetany_private.fail('MA201'); end if;$old$,
 $new$if me.role not in ('client','company') then perform meetany_private.fail('MA201'); end if;$new$);
 definition:=replace(definition,$old$  if not me.verified then raise exception using errcode='42501',message='MA801: კომპანია ადმინისტრატორის დადასტურებას ელოდება',hint='MA801'; end if;$old$,'');
 if definition not like '%me.role not in (''client'',''company'')%' or definition like '%MA801%' then
  raise exception 'Offer participation policy could not be applied';
 end if;
 if definition<>previous then execute definition; end if;
end $$;

create or replace function meetany_private.can_view_company(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id and p.role='company' and
 (meetany_private.is_admin() or p.id=meetany_private.uid() or (not p.blocked and not p.catalog_hidden)))
$$;
revoke all on function meetany_private.can_view_company(uuid) from public;
grant execute on function meetany_private.can_view_company(uuid) to anonymous,authenticated;
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles for select to anonymous,authenticated using
 (meetany_private.is_admin() or id=meetany_private.uid() or (not blocked and (role<>'company' or not catalog_hidden)));

-- Recommendations remain category-based company discovery. Being unverified no longer
-- removes a matching company; moderation and explicit notification opt-outs still apply.
create or replace function meetany_private.matching_suppliers(p_category text,p_exclude uuid)
returns table(id uuid,exact boolean,alerted boolean)
language sql stable set search_path='' as $$
 with base as (
  select p.id,p_category=any(p.provide_categories) exact from public.profiles p
  where p.role='company' and not p.blocked and not p.catalog_hidden and p.id is distinct from p_exclude
   and p.provide_categories && meetany_private.category_group_members(p_category)
 ), n as (select count(*) filter(where b.exact) exact_count from base b)
 select b.id,b.exact,b.exact or n.exact_count=0 from base b cross join n
 where b.exact or n.exact_count<3
$$;
revoke all on function meetany_private.matching_suppliers(text,uuid) from public,anonymous,authenticated;

create or replace function meetany_private.default_request_alert_preferences(p public.profiles)
returns table(enabled boolean,categories text[],cities text[],email_mode text)
language sql stable set search_path='' as $$
 with defaults as (
  select case when cardinality(p.provide_categories)>0 then p.provide_categories
   when p.industry is not null then array[p.industry] else '{}'::text[] end cats
 )
 select p.role='company' and not p.blocked and not p.catalog_hidden and cardinality(cats)>0,cats,array['georgia']::text[],'off'::text
 from defaults
$$;
revoke all on function meetany_private.default_request_alert_preferences(public.profiles) from public,anonymous,authenticated;

do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.list_matching_feed(text,text,integer,integer)'::regprocedure);
 definition:=replace(definition,$old$p.role='company' and p.verified and not p.blocked$old$,$new$p.role='company' and not p.blocked$new$);
 execute definition;
 -- Conversation identity distinguishes a personal supplier from a company.
 definition:=pg_get_functiondef('public.list_my_conversations()'::regprocedure);
 if position('other_role' in definition)=0 then
  definition:=replace(definition,'p.id other_id,p.name other_name,p.company other_company,','p.id other_id,p.name other_name,p.company other_company,p.role other_role,');
  if position('other_role' in definition)=0 then raise exception 'Conversation participant role insertion point missing'; end if;
  execute definition;
 end if;
 -- Return the role so clients never link a personal supplier to a company profile.
 definition:=pg_get_functiondef('public.compare_offers(uuid)'::regprocedure);
 if position('supplier_role' in definition)=0 then
  definition:=replace(definition,'select o.*,p.company,p.verified,p.city,','select o.*,p.company,p.verified,p.city,p.role supplier_role,');
  if position('supplier_role' in definition)=0 then raise exception 'Comparison supplier role insertion point missing'; end if;
  execute definition;
 end if;
end $$;

-- Company chats keep their existing entry points. Personal suppliers can only be
-- contacted in the context of an offer they actually sent; no public personal directory.
create or replace function public.start_conversation(p_company_id uuid,p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); client uuid:=me.id; context text:=coalesce(p_request_id::text,'general'); c meetany_private.conversations;
begin
 if not exists(select 1 from public.profiles p where p.id=p_company_id and not p.blocked and
  (p.role='company' or (p.role='client' and p_request_id is not null and exists(
   select 1 from public.offers o where o.request_id=p_request_id and o.company_id=p.id)))) then
  perform meetany_private.fail('MA502'); end if;
 if p_request_id is not null then
  select owner_id into client from public.requests where id=p_request_id and not hidden;
  if not found then perform meetany_private.fail('MA504'); end if;
  if me.id<>client and me.id<>p_company_id then perform meetany_private.fail('MA504'); end if;
  if not exists(select 1 from public.profiles where id=client and not blocked) then perform meetany_private.fail('MA504'); end if;
 end if;
 if client=p_company_id then perform meetany_private.fail('MA503'); end if;
 insert into meetany_private.conversations(client_id,company_id,request_id,context_key,started_by)
 values(client,p_company_id,p_request_id,context,me.id)
 on conflict(client_id,company_id,context_key) do nothing;
 select * into c from meetany_private.conversations where client_id=client and company_id=p_company_id and context_key=context;
 return to_jsonb(c);
end $$;
revoke all on function public.start_conversation(uuid,uuid) from public,anonymous,authenticated;
grant execute on function public.start_conversation(uuid,uuid) to authenticated;

-- Normal request alerts replace the previous verification nudge. Existing historical
-- notice rows remain intact and the client routes them to their actual request.
create or replace function meetany_private.notify_matching_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare n meetany_private.notifications; mode text; due timestamptz; bucket_key text; job uuid; generation_id uuid;
begin
 if new.hidden or new.status<>'open' or new.expires_at<=now() or new.chosen_offer_id is not null
 or not exists(select 1 from public.profiles where id=new.owner_id and not blocked) then return new; end if;
 for n in
  insert into meetany_private.notifications(user_id,request_id,kind)
  select p.id,new.id,'request_match'
  from public.profiles p
  left join meetany_private.request_alert_preferences saved on saved.user_id=p.id
  cross join lateral meetany_private.default_request_alert_preferences(p) defaults
  cross join lateral (select
   case when saved.user_id is null then defaults.enabled else saved.enabled end enabled,
   case when saved.user_id is null then defaults.categories else saved.categories end categories,
   case when saved.user_id is null then defaults.cities else saved.cities end cities) pref
  left join meetany_private.matching_suppliers(new.category,new.owner_id) fallback on fallback.id=p.id and fallback.alerted and not fallback.exact
  where pref.enabled and p.role='company' and not p.blocked and not p.catalog_hidden and p.id<>new.owner_id
    and (new.category=any(pref.categories) or fallback.id is not null)
    and (new.city='georgia' or 'georgia'=any(pref.cities) or new.city=any(pref.cities))
  on conflict do nothing returning *
 loop
  select email_mode,generation into mode,generation_id from meetany_private.request_alert_preferences where user_id=n.user_id;
  if mode is null or mode='off' then continue; end if;
  if mode='daily' then
   due:=((now() at time zone 'Asia/Tbilisi')::date+time '20:00') at time zone 'Asia/Tbilisi';
   if due<=now() then due:=due+interval '1 day'; end if;
   bucket_key:='daily/'||generation_id::text||'/'||to_char(due at time zone 'UTC','YYYY-MM-DD HH24:MI');
  else due:=now(); bucket_key:='instant/'||n.id::text; end if;
  -- Cancelled buckets must never be revived (including after an opt-out/opt-in).
  insert into meetany_private.request_alert_emails(user_id,bucket,mode,available_at)
  values(n.user_id,bucket_key,mode,due)
  on conflict(user_id,bucket) do update set bucket=excluded.bucket
  returning id into job;
  insert into meetany_private.request_alert_email_items(notification_id,job_id) values(n.id,job) on conflict do nothing;
 end loop;
 return new;
end $$;
revoke all on function meetany_private.notify_matching_request() from public,anonymous,authenticated;
commit;
