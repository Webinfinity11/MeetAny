begin;
set local lock_timeout='5s';
create table if not exists meetany_private.company_products (
 company_id uuid primary key references public.profiles(id) on delete cascade,
 items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=12)
);
alter table meetany_private.company_products enable row level security;
revoke all on meetany_private.company_products from public,anonymous,authenticated;
create or replace function public.company_products(p_company_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(item order by ord) from meetany_private.company_products b
 join public.profiles p on p.id=b.company_id cross join lateral jsonb_array_elements(b.items) with ordinality a(item,ord)
 where p.id=p_company_id and p.role='company' and not p.blocked and item->>'photoUrl'=any(p.gallery)),'[]'::jsonb)
$$;
create or replace function public.set_my_products(p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); item jsonb; cleaned jsonb:='[]';
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then perform meetany_private.fail('MA622'); end if;
 if jsonb_array_length(p_items)>12 then perform meetany_private.fail('MA622'); end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 2 and 80
   or jsonb_typeof(item->'photoUrl') is distinct from 'string' or not coalesce(meetany_private.valid_photo_url(item->>'photoUrl',me.id),false)
   or not coalesce(item->>'photoUrl'=any(me.gallery),false)
   or (item ? 'note' and jsonb_typeof(item->'note')<>'string') or length(coalesce(item->>'note',''))>200
  then perform meetany_private.fail('MA622'); end if;
  cleaned:=cleaned||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'photoUrl',item->>'photoUrl','note',trim(coalesce(item->>'note',''))));
 end loop;
 insert into meetany_private.company_products(company_id,items) values(me.id,cleaned) on conflict(company_id) do update set items=excluded.items;
 return cleaned;
end $$;
revoke all on function public.company_products(uuid),public.set_my_products(jsonb) from public,anonymous,authenticated;
grant execute on function public.company_products(uuid) to anonymous,authenticated;
grant execute on function public.set_my_products(jsonb) to authenticated;
commit;
