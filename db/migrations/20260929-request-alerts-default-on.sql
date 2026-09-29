-- Default site notifications; email settings are preserved.
begin;
set local lock_timeout='5s';

-- Missing preference rows follow the current company profile; saved rows always win.
create or replace function meetany_private.default_request_alert_preferences(p public.profiles)
returns table(enabled boolean,categories text[],cities text[],email_mode text)
language sql stable set search_path='' as $$
 with defaults as (
  select case when p.industry is not null then array[p.industry] else '{}'::text[] end cats,
   case when cardinality(p.service_cities)>0 then p.service_cities
    when p.city is not null then array[p.city] else '{}'::text[] end towns
 )
 select p.role='company' and cardinality(cats)>0 and cardinality(towns)>0,cats,
  case when 'georgia'=any(towns) then array['georgia'] else towns end,'off'::text
 from defaults
$$;
revoke all on function meetany_private.default_request_alert_preferences(public.profiles) from public, anonymous, authenticated;

create or replace function public.request_alert_preferences() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 select jsonb_build_object('enabled',enabled,'categories',categories,'cities',cities,'emailMode',email_mode)
 into result from meetany_private.request_alert_preferences where user_id=me.id;
 if result is null then
  select jsonb_build_object('enabled',enabled,'categories',categories,'cities',cities,'emailMode',email_mode)
  into result from meetany_private.default_request_alert_preferences(me);
 end if;
 return result;
end $$;

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
  where pref.enabled and p.role='company' and not p.blocked and p.id<>new.owner_id
    and new.category=any(pref.categories)
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
-- The marker and updates commit together; later explicit opt-outs survive every rerun.
do $$
begin
 insert into meetany_private.settings(key,value) values('request_alerts_default_on','on') on conflict(key) do nothing;
 if found then
  update meetany_private.request_alert_preferences set enabled=true
   where not enabled and cardinality(categories)>0 and cardinality(cities)>0;
  delete from meetany_private.request_alert_preferences
   where not enabled and (cardinality(categories)=0 or cardinality(cities)=0);
 end if;
end $$;

commit;
