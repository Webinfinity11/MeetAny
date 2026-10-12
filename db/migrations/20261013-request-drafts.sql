-- Server-side request draft: one per account, so an unfinished request follows the user across devices.
-- Safe to run twice.
begin;
set local lock_timeout='5s';
create table if not exists meetany_private.request_drafts (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
alter table meetany_private.request_drafts enable row level security;
revoke all on meetany_private.request_drafts from public,anonymous,authenticated;

create or replace function public.save_request_draft(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); saved meetany_private.request_drafts;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>16000
  or exists(select 1 from jsonb_object_keys(p_data) k where k not in('title','category','city','addressNote','quantity','unit','neededByText','body','preferences','attachmentDraft'))
 then perform meetany_private.flow_fail('MA902'); end if;
 insert into meetany_private.request_drafts(owner_id,data,updated_at) values(me.id,p_data,now())
 on conflict(owner_id) do update set data=excluded.data,updated_at=excluded.updated_at
 returning * into saved;
 return jsonb_build_object('data',saved.data,'updatedAt',saved.updated_at);
end $$;

create or replace function public.my_request_draft() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); saved meetany_private.request_drafts;
begin
 select * into saved from meetany_private.request_drafts where owner_id=me.id;
 if not found then return null; end if;
 return jsonb_build_object('data',saved.data,'updatedAt',saved.updated_at);
end $$;

create or replace function public.delete_request_draft() returns boolean
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); n int;
begin
 delete from meetany_private.request_drafts where owner_id=me.id;
 get diagnostics n=row_count;
 return n>0;
end $$;

revoke all on function public.save_request_draft(jsonb),public.my_request_draft(),public.delete_request_draft() from public,anonymous,authenticated;
grant execute on function public.save_request_draft(jsonb),public.my_request_draft(),public.delete_request_draft() to authenticated;
commit;
