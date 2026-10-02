begin;
set local lock_timeout='5s';
-- Approval is independent from email or phone verification. Existing verified companies retain access.
create or replace function meetany_private.can_view_company(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id and p.role='company' and (meetany_private.is_admin() or p.id=meetany_private.uid() or (p.verified and not p.blocked)))
$$;
revoke all on function meetany_private.can_view_company(uuid) from public;
grant execute on function meetany_private.can_view_company(uuid) to anonymous,authenticated;
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles for select to anonymous,authenticated using
 (meetany_private.is_admin() or id=meetany_private.uid() or (not blocked and (role<>'company' or verified)));
-- Preserve all current signatures, ordering, paging and column shapes while guarding each public RPC.
do $$
declare f record; definition text; changed text;
begin
 for f in select p.oid,p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any(array['list_companies','company_business_features','company_products','company_distribution_profiles','company_stats','company_reviews','send_offer']) loop
 definition:=pg_get_functiondef(f.oid);
 if f.proname='send_offer' then
 if definition not like '%MA801%' then
 changed:=replace(definition,'if me.role <> ''company'' then perform meetany_private.fail(''MA201''); end if;','if me.role <> ''company'' then perform meetany_private.fail(''MA201''); end if;'||E'\n'||'  if not me.verified then raise exception using errcode=''42501'',message=''MA801: კომპანია ადმინისტრატორის დადასტურებას ელოდება'',hint=''MA801''; end if;');
 if changed=definition then raise exception 'send_offer approval gate insertion point not found'; end if;
 execute changed;
 end if;
 elsif definition not like '%meetany_private.can_view_company%' then
 if f.proname='company_reviews' then
 changed:=replace(definition,E'begin\n',E'begin\n if not meetany_private.can_view_company(p_company_id) then perform meetany_private.fail(''MA302''); end if;\n');
 elsif f.proname='company_stats' then
 changed:=regexp_replace(definition,'p\.role\s*=\s*''company''','p.role=''company'' and meetany_private.can_view_company(p.id)');
 else
 changed:=regexp_replace(definition,'p\.role\s*=\s*''company''\s+and\s+not\s+p\.blocked','p.role=''company'' and not p.blocked and meetany_private.can_view_company(p.id)');
 end if;
 if changed=definition then raise exception 'company approval gate insertion point not found: %',f.proname; end if;
 execute changed;
 end if;
 end loop;
end $$;
commit;
