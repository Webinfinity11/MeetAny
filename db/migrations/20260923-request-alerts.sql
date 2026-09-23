-- Matching request alerts. Additive; does not configure a sender or schedule a worker.
begin;
set local lock_timeout='5s';

create table if not exists meetany_private.request_alert_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 enabled boolean not null default false, generation uuid not null default gen_random_uuid(),
 categories text[] not null default '{}', cities text[] not null default '{}',
 email_mode text not null default 'off' check(email_mode in ('off','instant','daily')),
 check(categories <@ meetany_private.categories() and array_position(categories,null) is null),
 check(cities <@ meetany_private.cities() and array_position(cities,null) is null),
 check(not enabled or (cardinality(categories)>0 and cardinality(cities)>0))
);
alter table meetany_private.request_alert_preferences enable row level security;
alter table meetany_private.notifications alter column offer_id drop not null;
alter table meetany_private.notifications drop constraint if exists notifications_kind_check;
alter table meetany_private.notifications add constraint notifications_kind_check check(kind in ('offer_received','offer_chosen','request_match'));
alter table meetany_private.notifications drop constraint if exists notifications_offer_kind_check;
alter table meetany_private.notifications add constraint notifications_offer_kind_check check((kind='request_match' and offer_id is null) or (kind<>'request_match' and offer_id is not null));
create unique index if not exists notifications_request_match_idx on meetany_private.notifications(user_id,request_id) where kind='request_match';

-- Separate email jobs preserve the existing offer outbox. A daily job has many items.
create table if not exists meetany_private.request_alert_emails (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 bucket text not null, mode text not null check(mode in ('instant','daily')),
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 available_at timestamptz not null, attempts integer not null default 0,
 lease_id uuid, locked_until timestamptz, first_attempt_at timestamptz, sent_at timestamptz,
 payload jsonb, frozen_ids uuid[], last_error text,
 unique(user_id,bucket)
);
create table if not exists meetany_private.request_alert_email_items (
 notification_id uuid primary key references meetany_private.notifications(id) on delete cascade,
 job_id uuid not null references meetany_private.request_alert_emails(id) on delete cascade
);
create index if not exists request_alert_emails_due_idx on meetany_private.request_alert_emails(available_at) where status in ('pending','processing');
create index if not exists request_alert_email_items_job_idx on meetany_private.request_alert_email_items(job_id);
alter table meetany_private.request_alert_emails enable row level security;
alter table meetany_private.request_alert_email_items enable row level security;

create or replace function public.request_alert_preferences() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 select jsonb_build_object('enabled',enabled,'categories',categories,'cities',cities,'emailMode',email_mode)
 into result from meetany_private.request_alert_preferences where user_id=me.id;
 return coalesce(result,jsonb_build_object('enabled',false,'categories','[]'::jsonb,'cities','[]'::jsonb,'emailMode','off'));
end $$;

create or replace function public.set_request_alert_preferences(p_enabled boolean,p_categories text[],p_cities text[],p_email_mode text default 'off') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); cats text[]; towns text[]; changed boolean;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_enabled is null or p_email_mode is null or p_email_mode not in ('off','instant','daily')
 or p_categories is null or p_cities is null or cardinality(p_categories)>13 or cardinality(p_cities)>8
 or array_position(p_categories,null) is not null or array_position(p_cities,null) is not null
 or not p_categories <@ meetany_private.categories() or not p_cities <@ meetany_private.cities() then
  raise exception using errcode='22023',message='invalid request alert preferences';
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into cats from unnest(p_categories) x;
 select coalesce(array_agg(distinct x order by x),'{}') into towns from unnest(p_cities) x;
 if 'georgia'=any(towns) then towns:=array['georgia']; end if;
 if p_enabled and (cardinality(cats)=0 or cardinality(towns)=0) then raise exception using errcode='22023',message='select categories and cities'; end if;
 insert into meetany_private.request_alert_preferences(user_id,enabled,categories,cities,email_mode)
 values(me.id,p_enabled,cats,towns,p_email_mode)
 on conflict(user_id) do update set enabled=excluded.enabled,categories=excluded.categories,cities=excluded.cities,email_mode=excluded.email_mode,generation=gen_random_uuid()
 where (request_alert_preferences.enabled,request_alert_preferences.categories,request_alert_preferences.cities,request_alert_preferences.email_mode)
 is distinct from (excluded.enabled,excluded.categories,excluded.cities,excluded.email_mode)
 returning true into changed;
 -- A preference change cancels queued delivery, not existing inbox history. No backfill.
 update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null
 where changed and user_id=me.id and status in ('pending','processing');
 return public.request_alert_preferences();
end $$;

create or replace function meetany_private.notify_matching_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare n meetany_private.notifications; mode text; due timestamptz; bucket_key text; job uuid; generation_id uuid;
begin
 if new.hidden or new.status<>'open' or new.expires_at<=now() or new.chosen_offer_id is not null
 or not exists(select 1 from public.profiles where id=new.owner_id and not blocked) then return new; end if;
 for n in
  insert into meetany_private.notifications(user_id,request_id,kind)
  select pref.user_id,new.id,'request_match'
  from meetany_private.request_alert_preferences pref join public.profiles p on p.id=pref.user_id
  where pref.enabled and p.role='company' and not p.blocked and p.id<>new.owner_id
    and new.category=any(pref.categories)
    and (new.city='georgia' or 'georgia'=any(pref.cities) or new.city=any(pref.cities))
  on conflict do nothing returning *
 loop
  select email_mode,generation into mode,generation_id from meetany_private.request_alert_preferences where user_id=n.user_id;
  if mode='off' then continue; end if;
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
drop trigger if exists notify_matching_request on public.requests;
create trigger notify_matching_request after insert on public.requests for each row execute function meetany_private.notify_matching_request();

create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.request_id,n.created_at,n.read_at,r.title,r.category,r.city,r.needed_by
  from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
  and (n.kind<>'request_match' or (meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked)))
  and (p_cursor is null or (n.created_at,n.id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), page as(select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;
create or replace function public.engagement_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 return jsonb_build_object('version',2,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.read_at is null and (n.kind<>'request_match' or (meetany_private.request_state(r)='open' and exists(select 1 from public.profiles where id=r.owner_id and not blocked)))),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false),
 'requestAlerts',case when me.role='company' then public.request_alert_preferences() else null end);
end $$;

-- Worker-only, leased and idempotent email batches. Do not call from the browser.
create or replace function meetany_private.claim_request_alert_email(p_from text,p_origin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job meetany_private.request_alert_emails; ids uuid[]; body text; recipient_email text; title text;
begin
 if p_origin !~ '^https://[^/]+$' or p_from is null or length(p_from)<5 then raise exception using errcode='22023',message='invalid email configuration'; end if;
 update meetany_private.request_alert_emails j set status='cancelled',lease_id=null,locked_until=null
 where j.status in ('pending','processing') and not exists (
  select 1 from meetany_private.request_alert_preferences pref join public.profiles p on p.id=pref.user_id and p.role='company' and not p.blocked
  join neon_auth."user" u on u.id=p.id and u."emailVerified"=true
  where pref.user_id=j.user_id and pref.enabled and pref.email_mode=j.mode
 );
 update meetany_private.request_alert_emails set status='failed',last_error='retry_limit',lease_id=null,locked_until=null
 where status in ('pending','processing') and (attempts>=8 or first_attempt_at<now()-interval '23 hours') and (locked_until is null or locked_until<=now());
 for job in select * from meetany_private.request_alert_emails
  where (status='pending' and available_at<=now()) or (status='processing' and locked_until<=now())
  order by available_at,id for update skip locked limit 50
 loop
  select array_agg(n.id order by n.id),string_agg(
   r.title||E'\n'||coalesce('{"tbilisi":"თბილისი","batumi":"ბათუმი","kutaisi":"ქუთაისი","rustavi":"რუსთავი","zugdidi":"ზუგდიდი","telavi":"თელავი","gori":"გორი","georgia":"მთელი საქართველო"}'::jsonb->>r.city,r.city)
   ||case when r.needed_by is not null then ' · საჭიროა '||to_char(r.needed_by,'DD.MM.YYYY') else '' end
   ||E'\n'||p_origin||'/requests/view/?id='||r.id::text,E'\n\n' order by n.created_at,n.id)
  into ids,body
  from meetany_private.request_alert_email_items i join meetany_private.notifications n on n.id=i.notification_id
  join public.requests r on r.id=n.request_id
  join public.profiles owner on owner.id=r.owner_id and not owner.blocked
  join meetany_private.request_alert_preferences pref on pref.user_id=n.user_id
  where i.job_id=job.id and meetany_private.request_state(r)='open'
   and r.category=any(pref.categories) and (r.city='georgia' or 'georgia'=any(pref.cities) or r.city=any(pref.cities));
  -- A retry cannot change provider content. If a request disappeared, cancel the frozen batch.
  if ids is null or (job.payload is not null and ids is distinct from job.frozen_ids) then
   update meetany_private.request_alert_emails set status='cancelled',lease_id=null,locked_until=null where id=job.id;
   continue;
  end if;
  select email into recipient_email from public.profiles where id=job.user_id;
  title:=case when job.mode='daily' then 'ახალი მოთხოვნების დღის შეჯამება ('||cardinality(ids)||')' else 'შენთვის ახალი მოთხოვნა გამოქვეყნდა' end;
  update meetany_private.request_alert_emails set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),
   frozen_ids=coalesce(frozen_ids,ids),payload=coalesce(payload,jsonb_build_object('from',p_from,'to',jsonb_build_array(recipient_email),'subject','MeetAny · '||title,
   'text',title||E'\n\n'||body||E'\n\nშეტყობინებების გამორთვა ან შეცვლა: '||p_origin||'/account/?tab=notifications'))
  where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'lease',job.lease_id,'payload',job.payload);
 end loop;
 return null;
end $$;
create or replace function meetany_private.finish_request_alert_email(p_id uuid,p_lease uuid,p_success boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 update meetany_private.request_alert_emails set status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when p_success then now() end,available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),
 lease_id=null,locked_until=null,last_error=case when p_success then null else left(coalesce(p_error,'delivery_error'),80) end
 where id=p_id and lease_id=p_lease and status='processing';
 get diagnostics affected=row_count; return affected=1;
end $$;
revoke all on meetany_private.request_alert_preferences,meetany_private.request_alert_emails,meetany_private.request_alert_email_items from public,anonymous,authenticated;
revoke all on function meetany_private.notify_matching_request(),meetany_private.claim_request_alert_email(text,text),meetany_private.finish_request_alert_email(uuid,uuid,boolean,text) from public,anonymous,authenticated;
revoke all on function public.request_alert_preferences(),public.set_request_alert_preferences(boolean,text[],text[],text) from public,anonymous,authenticated;
grant execute on function public.request_alert_preferences(),public.set_request_alert_preferences(boolean,text[],text[],text) to authenticated;
commit;
