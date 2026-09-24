-- Conversation hygiene (T12.3b); additive and rerunnable. Apply after 20260923-messaging.sql.
-- 1. list_my_conversations hides an empty conversation (no message yet) from everyone except
--    the participant who started it (new column started_by; legacy rows with null are hidden
--    until the first message).
-- 2. Deleting a request (delete_request, admin_delete_request, owner SQL, profile cascade)
--    deletes that request's conversations and their messages. A request conversation has no
--    other link: its context_key is the request UUID and it never merges with 'general'.
--    General conversations are untouched.
-- 3. Removes conversations already orphaned by earlier request deletions
--    (request_id null, context_key not 'general').
begin;
set local lock_timeout='5s';

alter table meetany_private.conversations
 add column if not exists started_by uuid references public.profiles(id) on delete cascade;

create or replace function meetany_private.delete_request_conversations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from meetany_private.conversations where request_id=old.id;
 return old;
end $$;
drop trigger if exists requests_delete_conversations on public.requests;
create trigger requests_delete_conversations before delete on public.requests
for each row execute function meetany_private.delete_request_conversations();

delete from meetany_private.conversations where request_id is null and context_key<>'general';

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
 insert into meetany_private.conversations(client_id,company_id,request_id,context_key,started_by)
 values(client,p_company_id,p_request_id,context,me.id)
 on conflict(client_id,company_id,context_key) do nothing;
 select * into c from meetany_private.conversations where client_id=client and company_id=p_company_id and context_key=context;
 return to_jsonb(c);
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
  where me.id in (c.client_id,c.company_id) and (c.last_message_at is not null or c.started_by=me.id)
 ) x;
 return result;
end $$;

revoke all on function meetany_private.delete_request_conversations() from public,anonymous,authenticated;
revoke all on function public.start_conversation(uuid,uuid),public.list_my_conversations() from public,anonymous,authenticated;
grant execute on function public.start_conversation(uuid,uuid),public.list_my_conversations() to authenticated;
commit;
