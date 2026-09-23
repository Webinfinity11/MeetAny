-- Private participant messaging; additive and rerunnable. No realtime service or UI.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.conversations (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid references public.requests(id) on delete set null,
 context_key text not null,
 created_at timestamptz not null default clock_timestamp(),
 last_message_at timestamptz,
 client_last_read_at timestamptz, company_last_read_at timestamptz,
 check(client_id<>company_id),
 check(context_key='general' or context_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 check(request_id is null or context_key=request_id::text),
 unique(client_id,company_id,context_key)
);
create table if not exists meetany_private.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references meetany_private.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000 and body=regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')),
 created_at timestamptz not null default clock_timestamp(), read_at timestamptz
);
create index if not exists conversations_client_idx on meetany_private.conversations(client_id,last_message_at desc);
create index if not exists conversations_company_idx on meetany_private.conversations(company_id,last_message_at desc);
create index if not exists conversations_request_idx on meetany_private.conversations(request_id) where request_id is not null;
create index if not exists conversations_page_idx on meetany_private.conversations(created_at desc,id desc);
create index if not exists messages_conversation_idx on meetany_private.messages(conversation_id,created_at,id);
create index if not exists messages_sender_idx on meetany_private.messages(sender_id,created_at desc);
create index if not exists messages_unread_idx on meetany_private.messages(conversation_id,sender_id) where read_at is null;
alter table meetany_private.conversations enable row level security;
alter table meetany_private.messages enable row level security;
revoke all on meetany_private.conversations,meetany_private.messages from public,anonymous,authenticated;

-- A deleted request must not merge its conversation with the general thread.
create or replace function meetany_private.messaging_context_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.client_id,new.company_id,new.context_key) is distinct from (old.client_id,old.company_id,old.context_key)
 or (new.request_id is distinct from old.request_id and new.request_id is not null) then
  perform meetany_private.fail('MA507');
 end if;
 return new;
end $$;
drop trigger if exists messaging_context_guard on meetany_private.conversations;
create trigger messaging_context_guard before update on meetany_private.conversations
for each row execute function meetany_private.messaging_context_guard();

create or replace function meetany_private.require_conversation(p_id uuid,p_user_id uuid) returns meetany_private.conversations
language plpgsql stable security definer set search_path='' as $$
declare c meetany_private.conversations;
begin
 select * into c from meetany_private.conversations where id=p_id and p_user_id in (client_id,company_id);
 if not found then perform meetany_private.fail('MA501'); end if;
 return c;
end $$;

create or replace function public.start_conversation(p_company_id uuid,p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); client uuid:=me.id; context text:=coalesce(p_request_id::text,'general'); c meetany_private.conversations;
begin
 if not exists(select 1 from public.profiles where id=p_company_id and role='company' and not blocked) then
  perform meetany_private.fail('MA502'); end if;
 if p_request_id is not null then
  select owner_id into client from public.requests where id=p_request_id and not hidden;
  if not found then perform meetany_private.fail('MA504'); end if;
  if me.id<>client and me.id<>p_company_id then perform meetany_private.fail('MA504'); end if;
  if not exists(select 1 from public.profiles where id=client and not blocked) then perform meetany_private.fail('MA504'); end if;
 end if;
 if client=p_company_id then perform meetany_private.fail('MA503'); end if;
 insert into meetany_private.conversations(client_id,company_id,request_id,context_key)
 values(client,p_company_id,p_request_id,context)
 on conflict(client_id,company_id,context_key) do nothing;
 select * into c from meetany_private.conversations where client_id=client and company_id=p_company_id and context_key=context;
 return to_jsonb(c);
end $$;

create or replace function public.send_message(p_conversation_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c meetany_private.conversations;
 text_body text:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g'); at_time timestamptz; m meetany_private.messages;
begin
 c:=meetany_private.require_conversation(p_conversation_id,me.id);
 if text_body is null or char_length(text_body) not between 1 and 2000 then perform meetany_private.fail('MA505'); end if;
 -- Sender lock protects the global sliding-minute cap across all conversations.
 perform pg_advisory_xact_lock(hashtextextended('meetany-message:'||me.id::text,0));
 -- Sending and marking read serialize per conversation; timestamps follow commit order.
 select * into c from meetany_private.conversations where id=c.id for update;
 if not found then perform meetany_private.fail('MA501'); end if;
 at_time:=clock_timestamp();
 if (select count(*) from meetany_private.messages where sender_id=me.id and created_at>at_time-interval '1 minute')>=20
 or exists(select 1 from meetany_private.messages where sender_id=me.id and conversation_id=c.id and created_at>at_time-interval '2 seconds') then
  perform meetany_private.fail('MA506'); end if;
 at_time:=greatest(at_time,c.last_message_at+interval '1 microsecond');
 insert into meetany_private.messages(conversation_id,sender_id,body,created_at)
 values(c.id,me.id,text_body,at_time) returning * into m;
 update meetany_private.conversations set last_message_at=at_time where id=c.id;
 return to_jsonb(m);
end $$;

create or replace function public.list_my_conversations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last,x.created_at desc,x.id desc),'[]'::jsonb) into result from (
  select c.*,p.id other_id,p.name other_name,p.company other_company,
   (select to_jsonb(m) from meetany_private.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) last_message,
   (select count(*) from meetany_private.messages m where m.conversation_id=c.id and m.sender_id<>me.id and m.read_at is null) unread_count
  from meetany_private.conversations c join public.profiles p on p.id=case when c.client_id=me.id then c.company_id else c.client_id end
  where me.id in (c.client_id,c.company_id)
 ) x;
 return result;
end $$;

create or replace function public.list_messages(p_conversation_id uuid,p_after timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result jsonb;
begin
 perform meetany_private.require_conversation(p_conversation_id,me.id);
 if p_after is not null and not isfinite(p_after) then raise exception using errcode='22023',message='invalid message timestamp'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by created_at,id),'[]'::jsonb) into result
 from meetany_private.messages m where conversation_id=p_conversation_id and (p_after is null or created_at>p_after);
 return result;
end $$;

create or replace function public.mark_read(p_conversation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); c meetany_private.conversations; at_time timestamptz; marked integer;
begin
 c:=meetany_private.require_conversation(p_conversation_id,me.id);
 select * into c from meetany_private.conversations where id=c.id for update;
 if not found then perform meetany_private.fail('MA501'); end if;
 at_time:=clock_timestamp();
 update meetany_private.messages set read_at=at_time where conversation_id=c.id and sender_id<>me.id and read_at is null;
 get diagnostics marked=row_count;
 update meetany_private.conversations set
 client_last_read_at=case when client_id=me.id then at_time else client_last_read_at end,
 company_last_read_at=case when company_id=me.id then at_time else company_last_read_at end where id=c.id;
 return jsonb_build_object('marked',marked,'read_at',at_time);
end $$;

create or replace function public.unread_message_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); result bigint;
begin
 select count(*) into result from meetany_private.messages m join meetany_private.conversations c on c.id=m.conversation_id
 where me.id in (c.client_id,c.company_id) and m.sender_id<>me.id and m.read_at is null;
 return result;
end $$;

create or replace function public.admin_list_conversations(p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 with filtered as materialized (select * from meetany_private.conversations where created_at<=(c->>'asOf')::timestamptz),
 candidates as (select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid) order by created_at desc,id desc limit 26),
 page as (select * from candidates order by created_at desc,id desc limit 25),
 enriched as (select x.*,a.name client_name,a.company client_company,b.name company_name,b.company company,
 (select to_jsonb(m) from meetany_private.messages m where conversation_id=x.id order by created_at desc,id desc limit 1) last_message
 from page x join public.profiles a on a.id=x.client_id join public.profiles b on b.id=x.company_id)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from enriched x),'[]'::jsonb),
 'hasMore',(select count(*)>25 from candidates),'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf',
 'nextCursor',case when (select count(*)>25 from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.admin_conversation_messages(p_conversation_id uuid,p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); c jsonb:=meetany_private.admin_page_cursor(p_cursor); result jsonb;
begin
 if not exists(select 1 from meetany_private.conversations where id=p_conversation_id) then perform meetany_private.fail('MA501'); end if;
 with filtered as materialized (select * from meetany_private.messages where conversation_id=p_conversation_id and created_at<=(c->>'asOf')::timestamptz),
 candidates as (select * from filtered where p_cursor is null or (created_at,id)<((c->>'created_at')::timestamptz,(c->>'id')::uuid) order by created_at desc,id desc limit 26),
 page as (select * from candidates order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from page x),'[]'::jsonb),
 'hasMore',(select count(*)>25 from candidates),'filteredTotal',(select count(*) from filtered),'asOf',c->>'asOf',
 'nextCursor',case when (select count(*)>25 from candidates) then (select jsonb_build_object('created_at',created_at,'id',id,'asOf',c->>'asOf') from page order by created_at,id limit 1) end) into result;
 return result;
end $$;

create or replace function public.admin_message_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); result jsonb;
begin
 with periods as (select label,starts from (values
 ('day',date_trunc('day',now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi'),
 ('week',now()-interval '7 days'),('month',now()-interval '30 days')) p(label,starts))
 select jsonb_build_object('totals',jsonb_object_agg(label,jsonb_build_object(
 'conversations',(select count(*) from meetany_private.conversations where created_at>=p.starts and created_at<=now()),
 'messages',(select count(*) from meetany_private.messages where created_at>=p.starts and created_at<=now())))) into result from periods p;
 return result;
end $$;

revoke all on function meetany_private.require_conversation(uuid,uuid),meetany_private.messaging_context_guard() from public,anonymous,authenticated;
revoke all on function public.start_conversation(uuid,uuid),public.send_message(uuid,text),public.list_my_conversations(),public.list_messages(uuid,timestamptz),public.mark_read(uuid),public.unread_message_count(),public.admin_list_conversations(jsonb),public.admin_conversation_messages(uuid,jsonb),public.admin_message_stats() from public,anonymous,authenticated;
grant execute on function public.start_conversation(uuid,uuid),public.send_message(uuid,text),public.list_my_conversations(),public.list_messages(uuid,timestamptz),public.mark_read(uuid),public.unread_message_count(),public.admin_list_conversations(jsonb),public.admin_conversation_messages(uuid,jsonb),public.admin_message_stats() to authenticated;
commit;
