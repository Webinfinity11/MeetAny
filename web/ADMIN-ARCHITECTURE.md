# MeetAny administration: operational foundation

Status: implemented and tested locally, 2026-09-23. Remote schema migration and deployment are pending. See [migration contract](../db/ADMIN-MIGRATION.md) for exact APIs and rollout limits.

## Current authority and data boundaries

The database, not navigation visibility, authorizes moderation. Existing moderation RPCs call `meetany_private.require_admin()` and reject blocked or non-admin actors. Keep this check on every future administrative read and write. Do not turn public search endpoints into privileged endpoints or expose a service credential in the browser.

Current store loading is shared with the marketplace: requests are limited to the latest 1,000, company discovery is capped at 1,000, and offers use a bounded query. `admin_list_users()` is unbounded in legacy mode; API v1 skips this preload and uses dedicated paginated queries. Request details now load by ID under existing authorization, including records outside the catalog cache. Global `admin_stats()` counts the database, not just the loaded subset. Client-side filters and pagination cannot make this complete or scalable. The interface must identify its loaded-record scope until dedicated server queries replace this transport.

The operational interface supports both the legacy APIs and capability-detected admin API v1: searchable request/user management, URL-backed filters, clear empty states, explicit moderation reasons, and action-specific confirmations. Destructive actions disclose that deleting a request also deletes its offers. Pending writes must not be submitted twice or have their dialog dismissed mid-operation.

## Module boundaries

- Overview: global totals and links into operational queues; never label a request with a chosen offer as verified payment or revenue.
- Requests: query, state, category, author, detail, visibility and deletion.
- Users/companies: query, role, blocked/verification state, profile detail and moderation.
- Moderation: reusable action contracts and confirmation; reason requirements, pending/error states and authorized RPC execution.
- Audit: server-backed, cursor-paginated moderation history in API v1. Legacy mode explicitly indicates that a schema update is required.
- Contact analytics: a future ingestion/reporting module; do not display placeholder counts as real activity.

Avoid an all-purpose component that fetches the full marketplace and implements every module. Keep filters, table rendering, mutation confirmation and data access separable. Current roles remain client/company/admin. Add support/moderator capabilities only alongside an explicit policy and server enforcement; UI-only role restrictions are insufficient.

## Implemented server queries and audit

`admin_stats().adminApiVersion >= 1` enables `admin_search_requests`, `admin_search_users`, and `admin_list_audit`. The dedicated `useAdminData` hook handles debounce, stale responses, cursor reset, loading/errors/retry and refresh after moderation. It uses server rows directly, without filtering against the shared catalog cache. Pages default to 25, capped at 100. Ordering uses `(created_at DESC, id DESC)` and an insertion boundary `asOf`; it is not a long-lived transaction snapshot.

Current filters: requests query/state/category at API level (query/state in UI); users query/role/blocked/verified. City, owner/date ranges and additional staff capabilities remain future extensions. Exact filtered counts and substring searches can scan tables: measure query plans before adding indexes or a search service. The global marketplace preload still exists; fully separating application bootstrap is additional work.

Four moderation RPCs now insert minimal before/after flags and explicit reasons into the private append-only audit table in the same transaction. Protected reads enforce administrator access. Deleted targets retain their identifiers. Failed writes and rolled-back operations leave no successful-action event. No historical backfill or contact data is stored in audit flags. Correlation IDs, a retention policy, and audit coverage for direct SQL maintenance are not implemented. Database owners can deliberately disable triggers; this is not a tamper-proof external archive.

## Validation

701 SQL assertions passed in throwaway local databases, loading the schema twice. Tests include authorization, blocked actors, 1,105 requests/users with equal timestamps, full cursor traversal, filtered counts, immutable history and rollback/storage failure. Browser checks cover mocked API v1 rows outside the cache, request/user filters, next/first page, audit, errors/retry and small screens. Legacy moderation checks intercept writes and cover required reasons and pending-dialog protection. Remote API v1 end-to-end validation still requires applying the reviewed migration to a test environment.

## Contact event contract available in the UI

`CallButton` emits `meetany:contact-action` as a browser CustomEvent. Detail: `action` (`reveal` or `call`), `source`, optional `contactId`, optional `requestId`. The phone number is omitted. `reveal` means a visitor requested the number; `call` means they activated the telephone link. Neither proves a completed telephone conversation.

Events are currently not sent or persisted. Later ingestion should validate allowed sources, generate server timestamps, define deduplication and abuse controls, separate test traffic, and follow the agreed analytics/consent policy. Client events are untrusted and must never authorize access or affect billing. An eventual dashboard should separate reveals, call-link activations and unique actors according to a documented definition.

## Release evidence and next gates

Keep role/authorization SQL tests, read-only admin browser tests, and isolated mutation workflows. Cover denied access, empty/search states, URL reload/back behavior, long Georgian text, small screens, pending dialogs, stale target state and network failures. Before claiming production scale: complete remote migration validation, deployment/rollback review, monitoring, measured query performance and backup recovery checks. Email OTP/reset delivery is a separate pending integration check requiring a complete test mailbox.
