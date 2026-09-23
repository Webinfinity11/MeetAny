-- Additive migration. Does not enable email delivery or alter existing admin APIs.
begin;
set local lock_timeout='5s';
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

-- ============================================================= saved companies and offer notifications
create table if not exists meetany_private.saved_companies (
 user_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,company_id)
);
create index if not exists saved_companies_page_idx on meetany_private.saved_companies(user_id,created_at desc,company_id desc);
create table if not exists meetany_private.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email_offers boolean not null default false
);
create table if not exists meetany_private.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.requests(id) on delete cascade,
 offer_id uuid not null references public.offers(id) on delete cascade,
 kind text not null check(kind in ('offer_received','offer_chosen')),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(user_id,offer_id,kind)
);
create index if not exists notifications_page_idx on meetany_private.notifications(user_id,created_at desc,id desc);
create index if not exists notifications_unread_idx on meetany_private.notifications(user_id) where read_at is null;
create table if not exists meetany_private.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references meetany_private.notifications(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_id uuid, locked_until timestamptz, sent_at timestamptz, last_error text
);
create index if not exists notification_outbox_pending_idx on meetany_private.notification_outbox(available_at) where status in ('pending','processing');
alter table meetany_private.saved_companies enable row level security;
alter table meetany_private.notification_preferences enable row level security;
alter table meetany_private.notifications enable row level security;
alter table meetany_private.notification_outbox enable row level security;

-- Created with the business event in the same transaction; edits do not send new-offer alerts.
create or replace function meetany_private.notify_offer() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; target_offer uuid; target_request uuid; event_kind text; event_id uuid;
begin
 if tg_table_name='offers' then
  select owner_id into recipient from public.requests where id=new.request_id;
  target_offer:=new.id; target_request:=new.request_id; event_kind:='offer_received';
 else
  if new.chosen_offer_id is null or new.chosen_offer_id is not distinct from old.chosen_offer_id then return new; end if;
  select company_id into recipient from public.offers where id=new.chosen_offer_id;
  target_offer:=new.chosen_offer_id; target_request:=new.id; event_kind:='offer_chosen';
 end if;
 if recipient is null or not exists(select 1 from public.profiles where id=recipient and not blocked) then return new; end if;
 insert into meetany_private.notifications(user_id,request_id,offer_id,kind)
 values(recipient,target_request,target_offer,event_kind) on conflict do nothing returning id into event_id;
 if event_id is not null and exists(select 1 from meetany_private.notification_preferences where user_id=recipient and email_offers) then
  insert into meetany_private.notification_outbox(notification_id) values(event_id) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists notify_new_offer on public.offers;
create trigger notify_new_offer after insert on public.offers for each row execute function meetany_private.notify_offer();
drop trigger if exists notify_chosen_offer on public.requests;
create trigger notify_chosen_offer after update of chosen_offer_id on public.requests for each row execute function meetany_private.notify_offer();

create or replace function public.set_saved_company(p_company_id uuid,p_saved boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_saved is null then raise exception using errcode='22023',message='saved is required'; end if;
 if not p_saved then delete from meetany_private.saved_companies where user_id=me.id and company_id=p_company_id; return false; end if;
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then perform meetany_private.fail('MA302'); end if;
 insert into meetany_private.saved_companies(user_id,company_id) values(me.id,p_company_id) on conflict do nothing;
 return true;
end $$;

create or replace function public.list_saved_companies(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select s.created_at,s.company_id,p.company,p.industry,p.city,p.about from meetany_private.saved_companies s
  join public.profiles p on p.id=s.company_id and p.role='company' and not p.blocked
  where s.user_id=me.id and s.created_at<=(c->>'asOf')::timestamptz
  and (p_cursor is null or (s.created_at,s.company_id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid))
  order by s.created_at desc,s.company_id desc limit 26
 ), page as(select * from candidates order by created_at desc,company_id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.company_id desc) from page p),'[]'::jsonb),
 'nextCursor',case when (select count(*) from candidates)>25 then (select jsonb_build_object('created_at',created_at,'id',company_id,'asOf',c->>'asOf') from page order by created_at,company_id limit 1) end) into result;
 return result;
end $$;

create or replace function public.list_notifications(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with candidates as (
  select n.id,n.kind,n.request_id,n.created_at,n.read_at,r.title from meetany_private.notifications n
  join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id)
  where n.user_id=me.id and n.created_at<=(c->>'asOf')::timestamptz
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
 return jsonb_build_object('version',1,
 'savedIds',coalesce((select jsonb_agg(s.company_id) from meetany_private.saved_companies s join public.profiles p on p.id=s.company_id and not p.blocked and p.role='company' where s.user_id=me.id),'[]'::jsonb),
 'unread',(select count(*) from meetany_private.notifications n join public.requests r on r.id=n.request_id and (not r.hidden or r.owner_id=me.id) where n.user_id=me.id and n.read_at is null),
 'notifications',public.list_notifications(),
 'emailOffers',coalesce((select email_offers from meetany_private.notification_preferences where user_id=me.id),false));
end $$;
create or replace function public.mark_notification_read(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 update meetany_private.notifications set read_at=coalesce(read_at,now()) where user_id=me.id and id=p_id;
end $$;
create or replace function public.set_notification_email(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if p_enabled is null then raise exception using errcode='22023',message='enabled is required'; end if;
 insert into meetany_private.notification_preferences(user_id,email_offers) values(me.id,p_enabled)
 on conflict(user_id) do update set email_offers=excluded.email_offers;
 if not p_enabled then
  update meetany_private.notification_outbox set status='cancelled',lease_id=null,locked_until=null
  where status in ('pending','processing') and notification_id in(select id from meetany_private.notifications where user_id=me.id);
 end if;
 return p_enabled;
end $$;

-- Worker-only delivery leases: no grants to application roles.
alter table meetany_private.notification_outbox add column if not exists first_attempt_at timestamptz;
alter table meetany_private.notification_outbox add column if not exists payload jsonb;
create or replace function meetany_private.claim_notification_email(p_from text,p_origin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job meetany_private.notification_outbox; event meetany_private.notifications; recipient public.profiles; message text;
begin
 if p_origin !~ '^https://[^/]+$' or p_from is null or length(p_from)<5 then raise exception using errcode='22023',message='invalid email configuration'; end if;
 -- Re-check consent, visibility and verified identity before every attempt.
 update meetany_private.notification_outbox o set status='cancelled',lease_id=null,locked_until=null
 where o.status in ('pending','processing') and not exists (
  select 1 from meetany_private.notifications n join public.profiles p on p.id=n.user_id and not p.blocked
  join neon_auth."user" u on u.id=p.id and u."emailVerified"=true
  join public.requests r on r.id=n.request_id and not r.hidden
  join meetany_private.notification_preferences pref on pref.user_id=p.id and pref.email_offers
  where n.id=o.notification_id
 );
 update meetany_private.notification_outbox set status='failed',last_error='retry_limit',lease_id=null,locked_until=null
 where status in ('pending','processing') and (attempts>=8 or first_attempt_at<now()-interval '23 hours')
 and (locked_until is null or locked_until<=now());
 select * into job from meetany_private.notification_outbox
 where ((status='pending' and available_at<=now()) or (status='processing' and locked_until<=now()))
 and attempts<8 order by available_at,id for update skip locked limit 1;
 if not found then return null; end if;
 select * into event from meetany_private.notifications where id=job.notification_id;
 select * into recipient from public.profiles where id=event.user_id;
 message:=case when event.kind='offer_chosen' then 'შენი შეთავაზება აირჩიეს' else 'ახალი შეთავაზება მიიღე' end;
 update meetany_private.notification_outbox set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',
 first_attempt_at=coalesce(first_attempt_at,now()),
 payload=coalesce(payload,jsonb_build_object('from',p_from,'to',jsonb_build_array(recipient.email),'subject','MeetAny · '||message,
 'text',message||E'\n\n'||p_origin||'/requests/view/?id='||event.request_id::text||E'\n\nშეტყობინებების პარამეტრები: '||p_origin||'/account/?tab=notifications'))
 where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'lease',job.lease_id,'payload',job.payload);
end $$;
create or replace function meetany_private.finish_notification_email(p_id uuid,p_lease uuid,p_success boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 update meetany_private.notification_outbox set
 status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when p_success then now() end,
 available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),
 locked_until=null,lease_id=null,last_error=case when p_success then null else left(coalesce(p_error,'delivery_error'),80) end
 where id=p_id and lease_id=p_lease and status='processing';
 get diagnostics affected=row_count;
 return affected=1;
end $$;


revoke all on function meetany_private.admin_page_cursor(jsonb), meetany_private.notify_offer(), meetany_private.claim_notification_email(text,text), meetany_private.finish_notification_email(uuid,uuid,boolean,text) from public,anonymous,authenticated;
revoke all on meetany_private.saved_companies, meetany_private.notification_preferences, meetany_private.notifications, meetany_private.notification_outbox from public,anonymous,authenticated;
revoke all on function public.engagement_state(), public.set_saved_company(uuid,boolean), public.list_saved_companies(jsonb), public.list_notifications(jsonb), public.mark_notification_read(uuid), public.set_notification_email(boolean) from public,anonymous,authenticated;
grant execute on function public.engagement_state(), public.set_saved_company(uuid,boolean), public.list_saved_companies(jsonb), public.list_notifications(jsonb), public.mark_notification_read(uuid), public.set_notification_email(boolean) to authenticated;
commit;
