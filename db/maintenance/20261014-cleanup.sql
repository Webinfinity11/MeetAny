-- 2026-10-14 snapshot-reviewed cleanup. Requires a backup; no reverse migration.
-- Run: psql -X -v ON_ERROR_STOP=1 -d <reviewed_database> -f db/maintenance/20261014-cleanup.sql
-- Why no DROP FUNCTION/TABLE/COLUMN: all 201 signatures exist in source; no proven dead storage.
-- Never deletes Neon Auth, business_audit or moderation_audit. No CASCADE DDL or trigger disabling.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table cleanup_candidates(id uuid primary key, email text not null) on commit drop;
insert into cleanup_candidates values
 ('a1b3d831-b513-4d96-a4ff-b7cdf19d8f17'::uuid, 'e2e+1791543795353-client-0@meetany.local'),
 ('2314ad31-cddf-4f03-9444-b89338856f12'::uuid, 'e2e+1791544041565-company-2@meetany.local'),
 ('00f283bd-8a4c-4047-ab57-e0908507445d'::uuid, 'e2e+1790276755145-registration-company@meetany.local'),
 ('d578e0f4-547d-48f3-a5ae-e6aabef917b5'::uuid, 'e2e+1790677953780-password-client@meetany.local'),
 ('ab660790-4da9-4ac9-8cea-3e3ffacc59c6'::uuid, 'e2e+1791543795353-client-1@meetany.local'),
 ('dced80aa-62b8-449f-8c5c-c69c600e5e0e'::uuid, 'e2e+1790681404609-registration-company@meetany.local'),
 ('91e5e293-6457-4720-8e1a-8169756e93d3'::uuid, 'e2e+1790273772670-registration-company@meetany.local'),
 ('f0a8b56c-9baf-448e-bb49-df66c7b6b9ba'::uuid, 'e2e+1790775806890-registration-company@meetany.local'),
 ('463d5536-1040-4ca2-be84-164fd56b6f83'::uuid, 'e2e+1790840603000-registration-client@meetany.local'),
 ('59d9615b-ba17-4844-b6b2-152d8091cd82'::uuid, 'e2e+1790844719213-registration-company@meetany.local'),
 ('3ac87aab-9b46-4ae1-a9ec-d40bd8b60306'::uuid, 'e2e+1790272582086-registration-client@meetany.local'),
 ('c7587302-5998-4dae-a450-f92d1549aae3'::uuid, 'e2e+1790275301743-registration-client@meetany.local'),
 ('c5888741-642a-4273-b08f-bddbb6a45d8f'::uuid, 'e2e+1790278824902-registration-client@meetany.local'),
 ('a38d5ece-8ec2-4015-9eb1-24df13f49b35'::uuid, 'e2e+1790669700000-registration-client@meetany.local'),
 ('6a893664-020b-451d-a623-1c09a96b1ed5'::uuid, 'e2e+1790681404609-registration-client@meetany.local'),
 ('1eea8de0-537c-46e6-964c-605a31509bc5'::uuid, 'e2e+1790775806890-registration-client@meetany.local'),
 ('0c33dcc0-6b9e-40ca-bdab-8f258b7fd673'::uuid, 'e2e+1790840603000-registration-company@meetany.local'),
 ('80d6d454-31e6-4d08-8b6a-5968c50f1999'::uuid, 'e2e+1790273123900-registration-client@meetany.local'),
 ('9d7cdf83-8dd8-4167-b041-25dfa2381931'::uuid, 'e2e+1790275301743-registration-company@meetany.local'),
 ('3723c5e0-f4ef-42e0-ad07-b214a13cfbb1'::uuid, 'e2e+1790278824902-registration-company@meetany.local'),
 ('7c3fcdef-c077-4fe6-a78b-639a46e83204'::uuid, 'e2e+1790273123900-registration-company@meetany.local'),
 ('5f2a8413-d8c9-4f6c-8f7b-11fe5a27f847'::uuid, 'e2e+1790669700000-registration-company@meetany.local'),
 ('767c765b-f867-4c74-8280-543d8d52c695'::uuid, 'e2e+1790273772670-registration-client@meetany.local'),
 ('0fe9dce5-6923-491b-8dc5-56121654858d'::uuid, 'e2e+1790276755145-registration-client@meetany.local'),
 ('c95ab182-277e-45b5-839b-7359e1ec8d57'::uuid, 'e2e+1790844719213-registration-client@meetany.local');
-- Why: only explicitly inventoried blocked, incomplete e2e registrations; IDs AND emails must match.
-- Ledger exclusions are explicit even though the two sets are disjoint.
create temporary table cleanup_profiles on commit drop as
select p.id from public.profiles p join cleanup_candidates c on c.id=p.id and c.email=p.email
where p.blocked and p.onboarding_completed_at is null
 and p.email ~ '^e2e\+[0-9]+-[a-z0-9-]+@meetany\.local$'
 and p.id not in (
 'bacf1572-7493-4ac9-bfc7-95719e911c4c'::uuid,
 '97bfdfe6-76eb-476e-9d8b-61f4dc13a882'::uuid,
 'debb7d06-549b-49a7-be89-6122a2fb1c63'::uuid,
 '74cc28fc-47de-45cb-9563-93735b86855e'::uuid,
 '3d12ff1f-0d72-4a53-a92f-1830cfd5b290'::uuid,
 'cdb14451-5727-454e-9d04-6d47cf1d070e'::uuid,
 '7c204e30-33f6-4bbd-a9aa-e7df37c9119f'::uuid,
 '1a5b8b24-3854-434e-9081-e48e122c5918'::uuid,
 '6e3709d3-2a3a-4819-9243-0d08cf512bc7'::uuid,
 'a5e8fc96-994d-4a70-9191-ad8a699898f9'::uuid,
 '2dcc2797-d07a-4752-a5f4-f61e9848bbe9'::uuid,
 '95703e1b-7236-4661-bb11-49654c4a3b6f'::uuid,
 'c260e12a-5f1b-4548-af33-785dd8d7f7dc'::uuid,
 '85509946-985a-409d-86ad-26c87c185546'::uuid,
 'f7b2fa99-7d1f-4428-a5e1-fe399ea138f4'::uuid,
 '08b22cfb-9de5-420b-a342-90d8f0bfb812'::uuid,
 'f08e2f75-3eec-442a-8fa9-eb3aca4d945a'::uuid,
 'ff0def53-f3f9-43a5-8121-aade9a8e9cab'::uuid,
 'f5afadad-23be-4a4d-89ce-e69bf257b07e'::uuid,
 'bef8acbe-9b2c-46cc-a111-184ddade342d'::uuid,
 'd2517b00-554d-4e6b-929a-ef3da51f3b47'::uuid,
 'd53baf36-958f-4700-8b0d-74502a895635'::uuid
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
-- silently cascading would risk somebody else's data. Immutable audits are intentionally retained.
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
 'bacf1572-7493-4ac9-bfc7-95719e911c4c'::uuid,
 '97bfdfe6-76eb-476e-9d8b-61f4dc13a882'::uuid,
 'debb7d06-549b-49a7-be89-6122a2fb1c63'::uuid,
 '74cc28fc-47de-45cb-9563-93735b86855e'::uuid,
 '3d12ff1f-0d72-4a53-a92f-1830cfd5b290'::uuid,
 'cdb14451-5727-454e-9d04-6d47cf1d070e'::uuid,
 '7c204e30-33f6-4bbd-a9aa-e7df37c9119f'::uuid,
 '1a5b8b24-3854-434e-9081-e48e122c5918'::uuid,
 '6e3709d3-2a3a-4819-9243-0d08cf512bc7'::uuid,
 'a5e8fc96-994d-4a70-9191-ad8a699898f9'::uuid,
 '2dcc2797-d07a-4752-a5f4-f61e9848bbe9'::uuid,
 '95703e1b-7236-4661-bb11-49654c4a3b6f'::uuid,
 'c260e12a-5f1b-4548-af33-785dd8d7f7dc'::uuid,
 '85509946-985a-409d-86ad-26c87c185546'::uuid,
 'f7b2fa99-7d1f-4428-a5e1-fe399ea138f4'::uuid,
 '08b22cfb-9de5-420b-a342-90d8f0bfb812'::uuid,
 'f08e2f75-3eec-442a-8fa9-eb3aca4d945a'::uuid,
 'ff0def53-f3f9-43a5-8121-aade9a8e9cab'::uuid,
 'f5afadad-23be-4a4d-89ce-e69bf257b07e'::uuid,
 'bef8acbe-9b2c-46cc-a111-184ddade342d'::uuid,
 'd2517b00-554d-4e6b-929a-ef3da51f3b47'::uuid,
 'd53baf36-958f-4700-8b0d-74502a895635'::uuid
);
select 'requests' as retained,count(*) from public.requests
union all select 'offers',count(*) from public.offers
union all select 'moderation_audit',count(*) from meetany_private.moderation_audit
union all select 'business_audit',count(*) from meetany_private.business_audit
union all select 'request_drafts',count(*) from meetany_private.request_drafts;
commit;
