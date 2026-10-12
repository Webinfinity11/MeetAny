-- Performance: one read for the files of many targets. A request page rendered one
-- list_attachments call per offer card (N+1). Same access rules as list_attachments, per target:
-- a target the caller may not read is left out instead of failing the whole batch.
-- Additive and re-runnable; list_attachments stays for single targets and older clients.
begin;
set local lock_timeout='5s';
create or replace function public.list_attachments_many(p_kind text,p_targets uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_kind is null or p_targets is null or cardinality(p_targets)>50 then perform meetany_private.flow_fail('MA902'); end if;
 return (select coalesce(jsonb_object_agg(t.id,(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]')
   from (select a.id,a.owner_id,a.kind,a.target_id,a.slot,a.name,a.mime,octet_length(a.content) size,a.created_at
           from meetany_private.attachments a
          where a.kind=p_kind and a.target_id=t.id and (p_kind not in('request_draft','offer_draft') or a.owner_id=meetany_private.uid())) x)),'{}')
   from (select distinct u.id from unnest(p_targets) u(id) where u.id is not null) t
  where p_kind in('request_draft','offer_draft') or meetany_private.file_scope(p_kind,t.id,false));
end $$;
revoke all on function public.list_attachments_many(text,uuid[]) from public;
grant execute on function public.list_attachments_many(text,uuid[]) to anonymous,authenticated;
commit;
