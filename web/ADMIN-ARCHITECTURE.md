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
- Contacts: private server ingestion, admin-only period totals/top targets and cursor-paginated events. Number disclosure and telephone-link activation are separate actions.

Avoid an all-purpose component that fetches the full marketplace and implements every module. Keep filters, table rendering, mutation confirmation and data access separable. Current roles remain client/company/admin. Add support/moderator capabilities only alongside an explicit policy and server enforcement; UI-only role restrictions are insufficient.

## Implemented server queries and audit

`admin_stats().adminApiVersion >= 1` enables `admin_search_requests`, `admin_search_users`, and `admin_list_audit`. The dedicated `useAdminData` hook handles debounce, stale responses, cursor reset, loading/errors/retry and refresh after moderation. It uses server rows directly, without filtering against the shared catalog cache. Pages default to 25, capped at 100. Ordering uses `(created_at DESC, id DESC)` and an insertion boundary `asOf`; it is not a long-lived transaction snapshot.

Current filters: requests query/state/category at API level (query/state in UI); users query/role/blocked/verified. City, owner/date ranges and additional staff capabilities remain future extensions. Exact filtered counts and substring searches can scan tables: measure query plans before adding indexes or a search service. The global marketplace preload still exists; fully separating application bootstrap is additional work.

Four moderation RPCs now insert minimal before/after flags and explicit reasons into the private append-only audit table in the same transaction. Protected reads enforce administrator access. Deleted targets retain their identifiers. Failed writes and rolled-back operations leave no successful-action event. No historical backfill or contact data is stored in audit flags. Correlation IDs, a retention policy, and audit coverage for direct SQL maintenance are not implemented. Database owners can deliberately disable triggers; this is not a tamper-proof external archive.

## Validation

701 SQL assertions passed in throwaway local databases, loading the schema twice. Tests include authorization, blocked actors, 1,105 requests/users with equal timestamps, full cursor traversal, filtered counts, immutable history and rollback/storage failure. Browser checks cover mocked API v1 rows outside the cache, request/user filters, next/first page, audit, errors/retry and small screens. Legacy moderation checks intercept writes and cover required reasons and pending-dialog protection. Remote API v1 end-to-end validation still requires applying the reviewed migration to a test environment.

## Contact activity (implemented on auth-probe, 2026-09-23)

`CallButton` starts with “ნომრის ნახვა”, then reveals a focused telephone link. It retains `meetany:contact-action` (`action`, `source`, optional `contactId`/`requestId`; never the phone). `market-store.logContactEvent` sends each action with the current user JWT or anonymous token through the existing database transport, with keepalive and isolated error handling. Disclosure is a UI interaction; the existing public phone API is unchanged. `call` means activating the telephone link, not a completed conversation.

The “კონტაქტები” admin tab uses `AdminContacts` and `useAdminContacts` independently of the catalog cache. It displays six real totals (reveal/call today, trailing 7 days, trailing 30 days), top 10 companies and top 10 requests for the selected period, and who contacted which target, timestamp in Asia/Tbilisi, action and source. Target links lead to existing detail pages; deleted targets retain history without a broken link. Anonymous callers are labeled explicitly.

URL filters: `tab=contacts`, `kind=reveal|call`, `target=company|request`, `period=day|week|month`, and JSON `cursor`. Kind/target constrain the event list; the period also controls top lists. The totals always show all three periods. “მეტის ჩვენება” appends the next server page; filter changes clear the cursor; direct cursor URLs load that page. Loading, empty, error/retry, stale response cancellation and first-page navigation are handled explicitly. Pagination preserves its lower date bound in the URL cursor (`from`), alongside the database insertion boundary `asOf`.

The database enforces admin reads, validates targets and source/kind enums, and serializes writes for rolling-minute dedupe and anonymous global cap. Anonymous activity is a shared bucket, so separate visitors can be undercounted. See [contact API contract](../db/CONTRACT.md#contact-events-2026-09-23) for signatures, rate limits and privacy boundaries. No backfill, completed-call tracking, unique-visitor metric or retention cleanup is implemented.

Validation: 164 new contact SQL assertions; 955 total SQL assertions passed with schema loaded twice and migration reapplied. `qa/contact.mjs` checks reveal/call, focused link, reload reset, telemetry-failure tolerance, real anonymous/authenticated admin RPC persistence, URL filters, append pagination/retry with deterministic fixtures, and layouts at 390/1440. Screenshots: `qa/shots/contacts-companies-390.png`, `qa/shots/contacts-admin-1440.png`. Migration was applied to auth-probe and its table/three RPCs checked through `information_schema`; production was not changed.

## Release evidence and next gates

Keep role/authorization SQL tests, read-only admin browser tests, and isolated mutation workflows. Cover denied access, empty/search states, URL reload/back behavior, long Georgian text, small screens, pending dialogs, stale target state and network failures. Before claiming production scale: complete remote migration validation, deployment/rollback review, monitoring, measured query performance and backup recovery checks. Email OTP/reset delivery is a separate pending integration check requiring a complete test mailbox.
