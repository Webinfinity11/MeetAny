-- Contact identifiers remain admin-managed. Queue a request, never change credentials here.
begin;
set local lock_timeout='5s';
alter table meetany_private.reports drop constraint if exists reports_target_kind_check;
alter table meetany_private.reports add constraint reports_target_kind_check check(target_kind in ('request','company','offer','contact_change'));
create or replace function public.request_contact_change(p_phone text,p_email text,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me public.profiles:=meetany_private.require_user();
 phone text:=nullif(btrim(p_phone),''); email text:=nullif(lower(btrim(p_email)),'');
 note text:=btrim(coalesce(p_note,'')); description text; result meetany_private.reports;
begin
 if phone is not null then
  phone:=meetany_private.normalize_phone(phone);
  if phone is null then raise exception using message='MA711: invalid mobile phone',hint='MA711'; end if;
 end if;
 if email is not null and (length(email)>200 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
  raise exception using message='MA711: invalid email',hint='MA711'; end if;
 if (phone is null and email is null) or (coalesce(phone,me.phone)=me.phone and coalesce(email,me.email)=me.email) then
  raise exception using message='MA711: provide a new contact identifier',hint='MA711'; end if;
 description:='ტელეფონი: '||coalesce(phone,'—')||' · ელფოსტა: '||coalesce(email,'—')||' · შენიშვნა: '||coalesce(nullif(note,''),'—');
 if length(description)>500 then raise exception using message='MA711: maximum 500 characters',hint='MA711'; end if;
 perform pg_advisory_xact_lock(hashtextextended('meetany.contact_change:'||me.id::text,0));
 if exists(select 1 from meetany_private.reports where reporter_id=me.id and target_kind='contact_change' and status='new') then
  raise exception using message='MA710: contact change already requested',hint='MA710'; end if;
 insert into meetany_private.reports(reporter_id,target_kind,target_id,target_owner_id,target_label,reason,body)
 values(me.id,'contact_change',me.id,me.id,left(coalesce(nullif(me.company,''),me.name),300),'other',description)
 returning * into result;
 return jsonb_build_object('id',result.id,'status',result.status,'created_at',result.created_at);
end $$;
revoke all on function public.request_contact_change(text,text,text) from public,anonymous,authenticated;
grant execute on function public.request_contact_change(text,text,text) to authenticated;

-- Preserve the installed moderation version (including notifications). Its old catch-all
-- company branch must not block an account when handling an administrative contact request.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.admin_resolve_report(uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,E'  else\n   if exists(select 1 from public.profiles where id=v.target_id',E'  elsif v.target_kind=''company'' then\n   if exists(select 1 from public.profiles where id=v.target_id');
 execute definition;
end $$;
commit;
