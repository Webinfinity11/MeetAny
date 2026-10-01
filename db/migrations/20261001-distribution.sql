begin;
set local lock_timeout='5s';
alter table meetany_private.company_business
 add column if not exists dist_categories text[] not null default '{}',
 add column if not exists dist_channels text[] not null default '{}',
 add column if not exists dist_brands text[] not null default '{}',
 add column if not exists dist_warehouse text not null default 'none',
 add column if not exists dist_transport text not null default 'none',
 add column if not exists dist_cold_chain boolean not null default false,
 add column if not exists dist_min_order text not null default '',
 add column if not exists dist_exclusive boolean not null default false;
create or replace function public.company_distribution_profiles() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'regions',p.service_cities,
 'categories',b.dist_categories,'channels',b.dist_channels,'brands',b.dist_brands,
 'warehouse',b.dist_warehouse,'transport',b.dist_transport,'coldChain',b.dist_cold_chain,
 'minOrder',b.dist_min_order,'exclusive',b.dist_exclusive) order by p.id),'[]'::jsonb)
 from meetany_private.company_business b join public.profiles p on p.id=b.company_id
 where b.distributor and p.role='company' and not p.blocked
$$;
create or replace function public.my_business_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user();
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 return jsonb_build_object('distributor',coalesce((select distributor from meetany_private.company_business where company_id=me.id),false),
 'distribution',(select jsonb_build_object('categories',dist_categories,'channels',dist_channels,'brands',dist_brands,
 'warehouse',dist_warehouse,'transport',dist_transport,'coldChain',dist_cold_chain,'minOrder',dist_min_order,'exclusive',dist_exclusive,
 'regions',me.service_cities) from meetany_private.company_business where company_id=me.id),
 'membership',(select to_jsonb(p)-'company_id' from meetany_private.company_plans p where p.company_id=me.id and expires_at>now()),
 'application',(select to_jsonb(a)-'company_id' from meetany_private.plan_requests a where a.company_id=me.id));
end $$;
-- Regions update the existing profile field atomically with distribution settings.
create or replace function public.set_my_distribution(p_categories text[],p_channels text[],p_brands text[],p_warehouse text,p_transport text,p_cold_chain boolean,p_min_order text,p_exclusive boolean,p_regions text[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_user(); v text; regions text[]:=coalesce(p_regions,me.service_cities);
begin
 if me.role<>'company' then perform meetany_private.fail('MA201'); end if;
 if coalesce(cardinality(regions),0)<1 or cardinality(regions)>40 then perform meetany_private.fail('MA621'); end if;
 foreach v in array regions loop if v is null or not meetany_private.is_city(v) then perform meetany_private.fail('MA621'); end if; end loop;
 if p_categories is null or cardinality(p_categories)>6 or p_channels is null or cardinality(p_channels) not between 1 and 8
  or array_position(p_channels,null) is not null or not (p_channels <@ array['horeca','retail_chain','retail_small','pharmacy','subdistributors','online','institutions','export'])
  then perform meetany_private.fail('MA621'); end if;
 foreach v in array p_categories loop if v is null or not meetany_private.is_category(v) then perform meetany_private.fail('MA621'); end if; end loop;
 if p_brands is null or cardinality(p_brands)>20 then perform meetany_private.fail('MA621'); end if;
 foreach v in array p_brands loop if v is null or length(trim(v)) not between 1 and 80 then perform meetany_private.fail('MA621'); end if; end loop;
 if p_warehouse is null or p_warehouse not in ('none','own','rented') or p_transport is null or p_transport not in ('none','own','contracted')
  or p_cold_chain is null or p_exclusive is null or p_min_order is null or length(trim(p_min_order))>80 then perform meetany_private.fail('MA621'); end if;
 update public.profiles set service_cities=regions where id=me.id;
 insert into meetany_private.company_business(company_id,distributor,dist_categories,dist_channels,dist_brands,dist_warehouse,dist_transport,dist_cold_chain,dist_min_order,dist_exclusive)
 values(me.id,true,p_categories,p_channels,p_brands,p_warehouse,p_transport,p_cold_chain,trim(p_min_order),p_exclusive)
 on conflict(company_id) do update set distributor=true,dist_categories=excluded.dist_categories,dist_channels=excluded.dist_channels,dist_brands=excluded.dist_brands,
 dist_warehouse=excluded.dist_warehouse,dist_transport=excluded.dist_transport,dist_cold_chain=excluded.dist_cold_chain,dist_min_order=excluded.dist_min_order,dist_exclusive=excluded.dist_exclusive,updated_at=now();
 return public.my_business_settings();
end $$;
revoke all on function public.company_distribution_profiles(),public.set_my_distribution(text[],text[],text[],text,text,boolean,text,boolean,text[]) from public,anonymous,authenticated;
grant execute on function public.company_distribution_profiles() to anonymous,authenticated;
grant execute on function public.set_my_distribution(text[],text[],text[],text,text,boolean,text,boolean,text[]) to authenticated;
commit;
