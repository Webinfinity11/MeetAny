begin;
create table if not exists meetany_private.site_design (
 id boolean primary key default true check (id),
 config jsonb not null,
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table meetany_private.site_design enable row level security;
revoke all on meetany_private.site_design from public, anonymous, authenticated;

create or replace function public.site_design() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('config',config||jsonb_build_object('badgeStyle',coalesce(config->>'badgeStyle','outline')),'version',version) from meetany_private.site_design where id),
 jsonb_build_object('config',jsonb_build_object('primary','#2b66de','controlHeight',44,'buttonRadius',8,'fieldRadius',8,'cardRadius',12,'buttonFont',15,'bodyFont',16,'spacing',100,'badgeStyle','outline'),'version',0));
$$;
create or replace function public.admin_save_site_design(p_config jsonb, p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles:=meetany_private.require_admin(); k text; v jsonb; current_version integer;
begin
 if p_config is null or jsonb_typeof(p_config)<>'object' or (select count(*) from jsonb_object_keys(p_config))<>9 then
  raise exception using errcode='22023',message='invalid design settings';
 end if;
 for k,v in select key,value from jsonb_each(p_config) loop
  if not (case k
   when 'primary' then jsonb_typeof(v)='string' and (v#>>'{}')=any(array['#2b66de','#1d4ed8','#0f766e','#7c3aed','#be123c','#171717'])
   when 'controlHeight' then v=any(array['44','48','52']::jsonb[])
   when 'buttonRadius' then v=any(array['4','8','12']::jsonb[])
   when 'fieldRadius' then v=any(array['4','8','12']::jsonb[])
   when 'cardRadius' then v=any(array['8','12','16','20']::jsonb[])
   when 'buttonFont' then v=any(array['14','15','16']::jsonb[])
   when 'bodyFont' then v=any(array['16','17','18']::jsonb[])
   when 'spacing' then v=any(array['100','110','120']::jsonb[])
   when 'badgeStyle' then (v#>>'{}')=any(array['outline','soft']) and jsonb_typeof(v)='string'
   else false end) then raise exception using errcode='22023',message='invalid design setting'; end if;
 end loop;
 -- Serialize saves, including the first one, so two editors cannot overwrite each other.
 perform pg_advisory_xact_lock(20261009,1);
 select version into current_version from meetany_private.site_design where id;
 if p_version is null or p_version<>coalesce(current_version,0) then
  raise exception using errcode='MA409',message='MA409: design settings changed; reload before saving';
 end if;
 insert into meetany_private.site_design(id,config,version) values(true,p_config,coalesce(current_version,0)+1)
 on conflict(id) do update set config=excluded.config,version=excluded.version,updated_at=now();
 insert into meetany_private.business_audit(actor_id,target_id,action,detail)
 values(me.id,me.id,'site_design_saved',jsonb_build_object('version',coalesce(current_version,0)+1));
 return public.site_design();
end $$;
revoke all on function public.site_design(), public.admin_save_site_design(jsonb,integer) from public, anonymous, authenticated;
grant execute on function public.site_design() to anonymous, authenticated;
grant execute on function public.admin_save_site_design(jsonb,integer) to authenticated;
commit;
