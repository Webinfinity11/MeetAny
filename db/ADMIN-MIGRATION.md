# Admin API version 1 — reviewed migration required

The schema adds a foundation for paginated administration and transactional moderation history. It has only been tested against throwaway local PostgreSQL databases. **It has not been applied to the live auth-probe database or production.** Deploying the web client alone must retain the existing admin fallback.

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

Successful hide/show/delete/block/unblock/verify/unverify calls insert history in the same transaction as the mutation. The row locks serialize before/after capture. Failed authorization/validation/storage or a transaction rollback cannot leave a successful audit record. Legacy deletion of an absent request remains idempotent and emits no event.

Audit actor/target identifiers deliberately have no cascading foreign keys, so request or account deletion does not erase history. Flags contain only moderation booleans, never copied profile/contact data or request content. Reasons are the explicit administrator input (3–500 characters when supplied); administrators should avoid putting unnecessary personal data into reasons.

The private table has RLS enabled and no API role table privileges. Only the protected reader RPC exposes it. A trigger rejects updates/deletes/truncation, including accidental owner operations. This is an application-level append-only history, **not** protection against a database owner deliberately dropping/disabling its triggers. Direct SQL maintenance and non-admin user lifecycle actions are outside these four RPCs and do not claim complete audit coverage. There is no historical backfill, new staff-role system, retention policy, or contact analytics storage in this migration.

## Validation and rollout

`bash db/tests/run.sh` creates and drops a local database, loads the schema twice, then runs all existing and admin tests. The admin suite covers >1,000 users and requests with identical timestamps, full cursor traversal, filter counts, limits, invalid input, denied/blocked actors, immutable audit records, deleted targets, and rollback/storage failures.

Before applying remotely: review the schema diff and backup/restore procedure, identify the target environment, and validate the migration there with authorized credentials. The additive table and indexes require normal migration planning for large installations. No production database operation is implicit in these code changes. Exact filtered counts and substring searches can scan matching tables; measure real query plans before adding trigram indexes or approximate counts. Offer counts are calculated only for returned request rows.
