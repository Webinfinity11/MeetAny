"""Freeze reviewed snapshot IDs into a standalone transactional maintenance script."""
import json,pathlib
root=pathlib.Path('web/qa/CLEANUP-2026-10-14'); r=json.loads((root/'relations.json').read_text()); protected=json.loads((root/'protected-accounts.json').read_text())
values=',\n'.join(" ('%s'::uuid, '%s')"%(p['id'],p['email']) for p in r['candidates'])
exclude=',\n'.join(" '%s'::uuid"%p['id'] for p in protected)
sql="""-- 2026-10-14 snapshot-reviewed cleanup. Requires a backup; no reverse migration.
-- Run: psql -X -v ON_ERROR_STOP=1 -d <reviewed_database> -f db/maintenance/20261014-cleanup.sql
-- Why no DROP FUNCTION/TABLE/COLUMN: all 201 signatures exist in source; no proven dead storage.
-- Never deletes Neon Auth, business_audit or moderation_audit. No CASCADE DDL or trigger disabling.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table cleanup_candidates(id uuid primary key, email text not null) on commit drop;
insert into cleanup_candidates values
"""+values+""";
-- Why: only explicitly inventoried blocked, incomplete e2e registrations; IDs AND emails must match.
-- Ledger exclusions are explicit even though the two sets are disjoint.
create temporary table cleanup_profiles on commit drop as
select p.id from public.profiles p join cleanup_candidates c on c.id=p.id and c.email=p.email
where p.blocked and p.onboarding_completed_at is null
 and p.email ~ '^e2e\\+[0-9]+-[a-z0-9-]+@meetany\\.local$'
 and p.id not in (
"""+exclude+"""
 );
-- Refuse changed identities/state instead of partially applying a stale manifest.
do $$ begin
 if exists(select 1 from public.profiles p join cleanup_candidates c using(id)
           where not exists(select 1 from cleanup_profiles t where t.id=p.id)) then
  raise exception 'Reviewed profile changed; re-inventory required';
 end if;
end $$;
-- Lock selected profiles before checking relations, preventing concurrent FK inserts.
select p.id as locked_profile from public.profiles p join cleanup_profiles c using(id) for update of p;
-- Why: no dependent business rows existed in the snapshot. Fail if this has changed;
-- silently cascading would risk somebody else\'s data. Immutable audits are intentionally retained.
do $$ declare c record; n bigint; begin
 for c in select table_schema,table_name,column_name from information_schema.columns
  where table_schema in ('public','meetany_private') and udt_name='uuid'
   and table_name not in ('profiles','registration_events','moderation_audit','business_audit')
 loop
  execute format('select count(*) from %I.%I where %I in (select id from cleanup_profiles)',
    c.table_schema,c.table_name,c.column_name) into n;
  if n<>0 then raise exception 'New relation %.%.% (% rows); re-inventory required',c.table_schema,c.table_name,c.column_name,n; end if;
 end loop;
end $$;
create temporary table cleanup_changes(category text primary key, deleted bigint) on commit drop;
-- Why: this exact session has four registration events, including the reviewed e2e company.
-- Delete children first; require every linked profile to belong to the reviewed deletion set.
create temporary table cleanup_sessions on commit drop as
select s.id from meetany_private.registration_sessions s
where s.id='21ead4e8-2b34-499c-ac7f-4dff3daab339'::uuid
 and exists(select 1 from meetany_private.registration_events e where e.session_id=s.id and e.profile_id in (select id from cleanup_profiles))
 and not exists(select 1 from meetany_private.registration_events e where e.session_id=s.id and e.profile_id is not null and e.profile_id not in (select id from cleanup_profiles));
do $$ begin
 if exists(select 1 from meetany_private.registration_events e where e.profile_id in (select id from cleanup_profiles)
  and e.session_id not in (select id from cleanup_sessions)) then raise exception 'Registration relationship changed; re-inventory required'; end if;
end $$;
with deleted as (delete from meetany_private.registration_events where session_id in (select id from cleanup_sessions) returning 1)
insert into cleanup_changes select 'registration_events',count(*) from deleted;
with deleted as (delete from meetany_private.registration_sessions where id in (select id from cleanup_sessions) returning 1)
insert into cleanup_changes select 'registration_sessions',count(*) from deleted;
-- Why: no remaining mutable children; FK constraints stay enabled.
with deleted as (delete from public.profiles where id in (select id from cleanup_profiles) returning 1)
insert into cleanup_changes select 'profiles',count(*) from deleted;
-- Why: exact anonymous orphan; three ledger-owned orphan events are explicitly retained.
with deleted as (
 delete from meetany_private.contact_events e
 where e.id='7946c958-443d-496f-aeca-f15498e2d07d'::uuid and e.actor_id is null
  and e.target_kind='request' and e.target_id='a96618c0-5ab5-41a5-8ecf-718aea3df71f'::uuid
  and not exists(select 1 from public.requests r where r.id=e.target_id)
 returning 1
) insert into cleanup_changes select 'contact_events',count(*) from deleted;
-- Why no draft deletion: request_drafts has no expiry rule; both rows belong to ledger accounts.
-- The single file_uploads row also belongs to a ledger account and is preserved.
-- Verification: second run must show deleted=0 for every category.
select category,deleted from cleanup_changes order by category;
select count(*) as remaining_reviewed_profiles from public.profiles p join cleanup_candidates c using(id);
select count(*) as remaining_reviewed_orphan from meetany_private.contact_events
 where id='7946c958-443d-496f-aeca-f15498e2d07d'::uuid and actor_id is null
 and not exists(select 1 from public.requests where id=target_id);
select count(*) as protected_profiles from public.profiles where id in (
"""+exclude+"""
);
select 'requests' as retained,count(*) from public.requests
union all select 'offers',count(*) from public.offers
union all select 'moderation_audit',count(*) from meetany_private.moderation_audit
union all select 'business_audit',count(*) from meetany_private.business_audit
union all select 'request_drafts',count(*) from meetany_private.request_drafts;
commit;
"""
pathlib.Path('db/maintenance/20261014-cleanup.sql').write_text(sql)
