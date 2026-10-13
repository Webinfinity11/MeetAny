-- Restores admin_remove_company_photo on databases where 20260930-admin-photos.sql never ran
-- (found missing on production 2026-10-13). Only the function and its grants: fail(), the audit
-- action check and admin_list_audit_v2 have newer definitions in later migrations and stay untouched.
begin;
set local lock_timeout='5s';

create or replace function public.admin_remove_company_photo(p_user_id uuid, p_url text, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := meetany_private.require_admin();
  v_reason text := meetany_private.moderation_reason(p_reason);
  v_url text := btrim(coalesce(p_url, ''));
  previous public.profiles;
  v_field text;
  p public.profiles;
begin
  if v_reason is null then perform meetany_private.fail('MA304'); end if;
  select * into previous from public.profiles where id = p_user_id for update;
  if not found then perform meetany_private.fail('MA302'); end if;
  if v_url <> '' and previous.logo_url = v_url then v_field := 'logo';
  elsif v_url <> '' and v_url = any (previous.gallery) then v_field := 'gallery';
  else perform meetany_private.fail('MA305'); end if;
  update public.profiles
     set logo_url = case when v_field = 'logo' then null else logo_url end,
         gallery = case when v_field = 'gallery' then array_remove(gallery, v_url) else gallery end
   where id = p_user_id
  returning * into p;
  insert into meetany_private.moderation_audit (actor_id,target_type,target_id,action,reason,old_flags,new_flags)
  values (me.id,'user',p_user_id,'user.photo_remove',v_reason,
    jsonb_build_object('field',v_field,'url',v_url),jsonb_build_object('field',v_field,'removed',true));
  return p;
end $$;

revoke all on function public.admin_remove_company_photo(uuid, text, text) from public, anonymous, authenticated;
grant execute on function public.admin_remove_company_photo(uuid, text, text) to authenticated;
commit;
