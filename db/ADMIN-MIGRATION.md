# Admin API version 1 — migration `migrations/20260923-admin-api.sql`

The schema adds a foundation for paginated administration and transactional moderation history. The block (moderation audit table through `admin_stats`, plus grants) is extracted verbatim from `schema.sql` into the rerunnable migration `db/migrations/20260923-admin-api.sql` (`create if not exists`, `create or replace`, drop/create trigger, one transaction with `lock_timeout 5s`).

**Status 2026-09-24: applied to auth-probe** (`node web/scripts/apply-migration.mjs admin-api`, twice; host asserted to `ep-withered-glade-b54ts1g5`). The script verifies `moderation_audit`, the nine admin RPCs and `adminApiVersion` in `admin_stats`. Live check with the demo admin through the dev API: `rpc/admin_search_users`, `rpc/admin_search_requests`, `rpc/admin_list_audit`, `rpc/admin_stats` → 200, `adminApiVersion: 1`. **Production has not been migrated**; deploying the web client alone must retain the existing admin fallback.

## Capability and compatibility

`admin_stats()` adds `adminApiVersion: 1`. Existing keys and all legacy moderation/list RPC signatures remain unchanged. Clients should use the new API only when this capability is present. A missing capability means the existing database needs the reviewed schema migration; it is not a permission error to hide or retry indefinitely.

New authenticated RPCs (all call `require_admin`, including the blocked-account check):

```sql
admin_search_requests(p_q text default null, p_state text default null,
  p_category text default null, p_cursor jsonb default null, p_limit integer default 25)
admin_search_users(p_q text default null, p_role text default null,
  p_blocked boolean default null, p_verified boolean default null,
  p_cursor jsonb default null, p_limit integer default 25)
admin_list_audit(p_cursor jsonb default null, p_limit integer default 25)
```

Each returns JSON `{items, nextCursor, hasMore, filteredTotal, asOf}`. Items use database snake_case keys. Request items additionally include `state`, `owner_name`, `owner_company`, and `offer_count`. User items are admin-only profile records. Audit items contain `id`, `created_at`, `actor_id`, `target_type`, `target_id`, `action`, `reason`, `old_flags`, and `new_flags`.

`nextCursor` is either null or `{created_at, id, asOf}`. Pass it back unchanged, retaining filters; reset the cursor whenever a filter changes. Ordering is descending `(created_at, id)`, including when many rows share timestamps. `filteredTotal` counts all matching rows, independent of cursor. The default page size is 25, capped at 100; nonpositive limits and malformed filters/cursors fail with SQLSTATE `22023`. Search is a trimmed, case-insensitive literal substring, maximum 200 characters; `%` and `_` are not wildcards. Request search covers ID, title, description, owner company/name; user search covers ID, name, company, email, and phone.

States: `open`, `closed`, `expired`, `chosen`, `hidden`. Roles: `client`, `company`, `admin`. Nullable booleans mean any; false is an actual filter. Categories use existing IDs. `asOf` bounds inserts and computes expiry state consistently across pages. It is **not** a long-lived database snapshot: edits/deletes may change membership between pages; refresh after moderation. Backdated imports can also change page membership.

## Audit guarantees and limits

Successful hide/show/delete/block/unblock/verify/unverify calls insert history in the same transaction as the mutation. The row locks serialize before/after capture. Failed authorization/validation/storage or a transaction rollback cannot leave a successful audit record. Legacy deletion of an absent request remains idempotent and emits no event. Since `20260924-empty-conversations.sql`, deleting a request (including `admin_delete_request`) also deletes that request's conversations and messages; the audit row is unaffected.

Audit actor/target identifiers deliberately have no cascading foreign keys, so request or account deletion does not erase history. In v1, flags contain only moderation booleans, never copied profile/contact data or request content. API v2 additionally permits offer identifiers and status (see below). Reasons are the explicit administrator input (3–500 characters when supplied); administrators should avoid putting unnecessary personal data into reasons.

The private table has RLS enabled and no API role table privileges. Only the protected reader RPC exposes it. A trigger rejects updates/deletes/truncation, including accidental owner operations. This is an application-level append-only history, **not** protection against a database owner deliberately dropping/disabling its triggers. Direct SQL maintenance and non-admin user lifecycle actions are outside these four RPCs and do not claim complete audit coverage. There is no historical backfill, new staff-role system, retention policy, or contact analytics storage in this migration.

## Validation and rollout

`bash db/tests/run.sh` creates and drops a local database, loads the schema twice, applies `20260923-admin-api.sql` twice on top (idempotency), then runs all existing and admin tests. The admin suite covers >1,000 users and requests with identical timestamps, full cursor traversal, filter counts, limits, invalid input, denied/blocked actors, immutable audit records, deleted targets, and rollback/storage failures.

Before applying remotely: review the schema diff and backup/restore procedure, identify the target environment, and validate the migration there with authorized credentials. The additive table and indexes require normal migration planning for large installations. No production database operation is implicit in these code changes. Exact filtered counts and substring searches can scan matching tables; measure real query plans before adding trigram indexes or approximate counts. Offer counts are calculated only for returned request rows.

## API v2 — `migrations/20260929-admin-v2.sql`

**Status 2026-09-29: applied to auth-probe.** `node web/scripts/apply-migration.mjs admin-v2` succeeded twice: 1 table and 5 RPCs verified, with exact source version 2. Schema, runner, handler and store are synchronized. Production has not been migrated. Local synchronized runner passed 1,182 existing assertions and 94 v2 assertions. Do not replay v1 after this migration.

The migration runs in one transaction with `lock_timeout='5s'` and can be run twice. Named audit checks are dropped/re-added to admit target `offer` and action `offer.delete`; existing rows and the append-only trigger are preserved. All four new functions are `SECURITY DEFINER SET search_path = ''`, require an unblocked admin, revoke PUBLIC/anonymous execution, and grant execution to authenticated. No role-changing RPC, RLS change, or marketplace column change is included.

```sql
admin_search_offers(p_q text default null, p_status text default null,
  p_cursor jsonb default null, p_limit integer default 25) returns jsonb
admin_delete_offer(p_offer_id uuid, p_reason text) returns void
admin_delete_request_v2(p_request_id uuid, p_reason text) returns void
admin_list_audit_v2(p_cursor jsonb default null, p_limit integer default 25,
  p_action text default null, p_target_type text default null) returns jsonb
```

Both readers use the v1 `{items,nextCursor,hasMore,filteredTotal,asOf}` envelope, descending `(created_at,id)` cursor, default 25/cap 100 limit, and the same insertion horizon (not an MVCC snapshot). Invalid limits/cursors/enums return `22023`. Offer search trims and matches a case-insensitive literal substring (including `%`/`_`), at most 200 characters, over offer ID/body, company company/name and request title. Status accepts `sent|chosen|declined`. Items contain the complete offer row plus `company_name = coalesce(nullif(company,''),name)`, `request_title`, and `request_hidden`.

Both delete RPCs require a trimmed reason of 3–500 characters; null/blank/invalid length returns `MA304`. Offer deletion rejects absent targets with `MA206` and chosen status with `MA207`; request deletion rejects absent targets with `MA106`. Mutation and audit insert are atomic, including existing request cascades. Offer events contain `old_flags = {deleted:false,status,request_id,company_id}` and `new_flags = {deleted:true}`; request events retain `{hidden,deleted:false}` → `{deleted:true}`. Offer identifiers/status extend the v1 boolean-only flags: body, price, names and contact data are never copied. Admin-entered reasons remain the only free text stored by these calls.

Audit v2 accepts all eight action values and target types `request|user|offer`. Items contain `id, created_at, actor_id, actor_name, actor_email, target_type, target_id, target_name, target_exists, target_context, target_context_id, action, reason, old_flags, new_flags`. Actor and user names use company/name fallback; request names use title; existing offer names use the company referenced by `old_flags.company_id`. Names and actor email are joined at read time. Deleted targets have null name and false existence. Offer context uses `old_flags.request_id`: its current request title (null after deletion) and durable request ID. Other target types have null context fields. Deleting profiles does not erase audit identifiers.

`admin_stats()` preserves the seven existing count definitions, sets `adminApiVersion: 2`, and adds `hidden` (all hidden requests) and `blocked` (blocked non-admin profiles). Legacy `admin_delete_request(uuid)` and `admin_list_audit(jsonb,integer)` stay unchanged. New names avoid cached SQL signatures in `db-handler.js` and the ambiguous one-argument call caused by combining `f(uuid)` with `f(uuid,text default null)`.

### Local verification order

Use a temporary runner outside the repository, copying `db/tests/run.sh` with absolute paths and its existing create/stub/schema×2/migrations/tests/drop sequence unchanged. After `logo_tests.sql`, apply v2 twice and run `admin_v2_tests.sql` last. The EXIT trap must always drop the temporary local database. Existing `admin_tests.sql` asserts version exactly 1 and checks boolean-only audit flags, so those tests must precede v2 data creation. The new suite checks permission denial for client/company/blocked admin/anonymous, validation, literal search, complete cursor walks, successful/failed/rolled-back audit writes, current/deleted names, exact version 2 and legacy compatibility.

The v2 suite also replays v1 after v2 and exercises all new RPCs, including successful offer/request deletion. **Replaying v1 replaces `admin_stats()` with version 1 and removes its two new keys.** It does not remove the four v2 functions or narrow existing table checks. The suite explicitly checks that downgrade, reapplies v2, and verifies version 2 again. Deployment ordering must therefore end with v2.

### Phase 2 handoff (line numbers before synchronization)

- `db/schema.sql:934–956`: widen audit target/action checks; include the migration's named drop/add operations so rerunning the schema also upgrades existing constraints. Preserve rows, RLS and immutable trigger.
- `db/schema.sql:1186–1201`: replace `admin_stats()` with the v2 definition; add the four new RPC definitions after `admin_list_audit` (currently ends at 1183), retaining the legacy blocks at 995–1007 and 1158–1183.
- `db/schema.sql:1399–1415` and `1427–1435`: add the four new signatures to the revoke/grant blocks, using the exact signatures at the end of the v2 migration.
- `db/tests/run.sh:65–66`: after `logo_tests.sql` and before the finished message, apply `20260929-admin-v2.sql` twice, then run `admin_v2_tests.sql`. Keep `admin_tests.sql` at line 54 on v1. The existing v1 migration at lines 37–38 restores v1 stats even after schema synchronization; no change to existing tests is needed.
- `web/scripts/apply-migration.mjs:5–12`: add the following `plans` entry (and include `admin-v2` in the version verification branch currently at lines 30–33, ideally verifying exact expected version/keys rather than only presence of the source token):

```js
'admin-v2': {
  file: '20260929-admin-v2',
  tables: ['moderation_audit'],
  routines: ['admin_search_offers', 'admin_delete_offer',
    'admin_delete_request_v2', 'admin_list_audit_v2', 'admin_stats'],
},
```

- `db/CONTRACT.md:182–187`: add four RPC rows with the signatures, authorization, filters, return fields and errors above; update the stats row to include capability/hidden/blocked, and retain legacy request deletion semantics. After lines 193–195 document reason-required offer moderation and read-time audit joins/envelope. At lines 407–409 document the client v2 methods once the UI thread has finalized them; at line 493 include `admin_delete_request_v2` among request conversation cleanup paths. No staff role RPC is introduced; the manual role process at lines 335–340 stays unchanged.

Phase 1 local result (2026-09-29): `/tmp/run-meetany-admin-v2.sh` passed **1,178 existing assertions and 94 v2 assertions** on PostgreSQL 16. The temporary database was dropped by the runner's EXIT trap. Test output: `/tmp/meetany-admin-v2.log` (local artifact, not committed).

### Phase 2 acceptance (2026-09-29)

Committed-tree validation after restoring native selects in `AdminFilters.tsx` and `AdminContacts.tsx` (the redesign-only `CustomSelect.tsx` is untracked): `npx tsc --noEmit` passed. `BASE=http://localhost:3003 node qa/admin-v2-perms.mjs` passed **64/64** checks across all **18** allowlisted admin RPCs. Both `owner_user` and `owner_company` received HTTP 400 / `MA003`; anonymous received HTTP 401 / `42501`. No company fallback was needed. Admin capability was exactly 2; offers/audit envelopes passed, missing UUID deletes returned `MA206` / `MA106`, and both non-admin browser visits showed denial with zero tables. No real records were mutated.

`BASE=http://localhost:3003 node qa/admin-ui-check.mjs` passed all **5 tabs × 2 widths (1440/390)**, with 0 console errors and 0 horizontal overflow. Offers displayed live rows and audit displayed server-provided actor names. Empty search and opening/cancelling the moderation sheet also passed. Ten screenshots: `web/qa/shots/admin-2026-09-29/v2-*.png`. Visual review included the live phone panel. The isolated server/worktree are temporary; localhost:3001 is not restarted or rebuilt.
