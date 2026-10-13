-- QA round: catalog import, optional verification logo and legal onboarding fields.
-- Apply after 20261009-flow-completion.sql. Safe to run repeatedly.
begin;
set local lock_timeout='5s';
alter table meetany_private.company_products drop constraint if exists company_products_items_check;
alter table meetany_private.company_products add constraint company_products_items_check
 check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=100);

create or replace function public.company_products(p_company_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(item order by ord) from meetany_private.company_products b
 join public.profiles p on p.id=b.company_id cross join lateral jsonb_array_elements(b.items) with ordinality a(item,ord)
 where p.id=p_company_id and p.role='company' and not p.blocked
 and (coalesce(item->>'photoUrl','')='' or item->>'photoUrl'=any(p.gallery))),'[]'::jsonb)
$$;
create or replace function public.set_my_products(p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); item jsonb; cleaned jsonb:='[]'; product jsonb;
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then perform meetany_private.fail('MA622'); end if;
 if jsonb_array_length(p_items)>100 then perform meetany_private.fail('MA622'); end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 2 and 80
   or (item ? 'photoUrl' and jsonb_typeof(item->'photoUrl') not in ('string','null'))
   or (coalesce(item->>'photoUrl','')<>'' and
       (not coalesce(meetany_private.valid_photo_url(item->>'photoUrl',me.id),false)
        or not coalesce(item->>'photoUrl'=any(me.gallery),false)))
   or (item ? 'note' and jsonb_typeof(item->'note')<>'string') or length(coalesce(item->>'note',''))>200
   or (item ? 'code' and (jsonb_typeof(item->'code')<>'string' or length(item->>'code')>40))
   or (item ? 'unit' and (jsonb_typeof(item->'unit')<>'string' or item->>'unit' not in ('pcs','m2','kg','hour','service','m','l','set','pack')))
   or (item ? 'price' and jsonb_typeof(item->'price')<>'number')
  then perform meetany_private.fail('MA622'); end if;
  -- Cast only after checking the JSON type, so malformed prices also produce MA622.
  if item ? 'price' and ((item->>'price')::numeric<0 or (item->>'price')::numeric>1000000000)
  then perform meetany_private.fail('MA622'); end if;
  product:=jsonb_build_object('name',trim(item->>'name'),'photoUrl',item->>'photoUrl','note',trim(coalesce(item->>'note','')));
  if item ? 'code' then product:=product||jsonb_build_object('code',item->>'code'); end if;
  if item ? 'unit' then product:=product||jsonb_build_object('unit',item->>'unit'); end if;
  if item ? 'price' then product:=product||jsonb_build_object('price',item->'price'); end if;
  cleaned:=cleaned||jsonb_build_array(product);
 end loop;
 insert into meetany_private.company_products(company_id,items) values(me.id,cleaned) on conflict(company_id) do update set items=excluded.items;
 return cleaned;
end $$;

create or replace function public.submit_verification() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if me.verified then return me; end if;
 if me.legal_name is null or me.registration_code is null or not exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='registration') or not exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='tax') then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set verification_documents_status='pending' where id=me.id returning * into me;
 return me;
end $$;

-- Each boolean means the requirement is satisfied, not missing.
create or replace function public.verification_requirements() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 return jsonb_build_object(
  'legal_name',me.legal_name is not null,
  'registration_code',me.registration_code is not null,
  'registration_document',exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='registration'),
  'tax_document',exists(select 1 from meetany_private.attachments where kind='verification' and target_id=me.id and slot='tax'));
end $$;

create or replace function public.complete_onboarding() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.flow_fail('MA901'); end if;
 if length(btrim(coalesce(me.company,'')))<2 then perform meetany_private.flow_fail('MA902'); end if;
 update public.profiles set onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=me.id returning * into me;
 return me;
end $$;

revoke all on function public.company_products(uuid),public.set_my_products(jsonb),public.submit_verification(),public.verification_requirements(),public.complete_onboarding() from public,anonymous,authenticated;
grant execute on function public.company_products(uuid) to anonymous,authenticated;
grant execute on function public.set_my_products(jsonb),public.submit_verification(),public.verification_requirements(),public.complete_onboarding() to authenticated;
commit;
