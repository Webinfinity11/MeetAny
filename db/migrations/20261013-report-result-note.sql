-- QA-07: the reporter receives the result key and the administrator's reason.
-- Keep the installed resolver (including contact-change handling) intact.
begin;
set local lock_timeout = '5s';
do $$
declare definition text;
begin
 select pg_get_functiondef('public.admin_resolve_report(uuid,text,text)'::regprocedure) into definition;
 definition := replace(definition,
  $old$'resolution','hidden','kind',c.target_kind$old$,
  $new$'resolution','hidden','resolution_reason',left(v_reason,500),'report_id',c.id,'kind',c.target_kind$new$);
 definition := replace(definition,
  $old$'resolution','rejected','kind',v.target_kind$old$,
  $new$'resolution','rejected','resolution_reason',left(v_reason,500),'report_id',v.id,'kind',v.target_kind$new$);
 -- Fail closed if the upstream notification contract changed; reruns are safe.
 if position($expected$'resolution','hidden','resolution_reason',left(v_reason,500),'report_id',c.id$expected$ in definition)=0
 or position($expected$'resolution','rejected','resolution_reason',left(v_reason,500),'report_id',v.id$expected$ in definition)=0 then
  raise exception 'Unsupported admin_resolve_report notification shape';
 end if;
 execute definition;
end $$;
-- list_notifications already projects n.detail unchanged. Do not overwrite its
-- installed filtering, cursor or visibility rules. Old notices without report_id
-- cannot be safely backfilled by a non-unique target title.
commit;
