# Saved companies and offer notifications — 2026-09-23

`migrations/20260923-engagement.sql` is additive and transactional. It was applied to the existing **auth-probe** endpoint (`ep-withered-glade-b54ts1g5`) after a private schema-only backup at `/tmp/meetany-before-engagement.sql`. Production was not changed. This migration does not apply the separately pending admin API v1 migration. `schema.sql` includes both for clean installations.

## Access and events

Private tables: saved companies, notification preferences, notifications, email outbox. All have RLS enabled and no application-role table privileges. Authenticated RPCs use the server identity and reject blocked users. A caller cannot provide a recipient/user ID. Company save/remove and read acknowledgements are idempotent. Saved companies and notifications have cursor pages of 25; saved IDs are returned as a compact per-user list for card state. This ID list is currently unpaginated and should be revisited if users build extremely large lists.

New offer INSERT -> request owner notification. Offer edits do not generate duplicate new-offer alerts. Choosing an offer -> supplier notification. Both triggers execute in the business transaction; rollback produces no notification. Withdrawing/deleting an offer removes its related notices; deleting a request removes notices and queued emails. Hidden requests are excluded for suppliers; owners can still see their own request notices. There is no historical backfill. No category alerts/digests have been added.

`GET /api/db/capabilities` reports schema availability, allowing older databases to fail gracefully without fake browser-local saves. Notification updates poll every 30 seconds while visible, on focus and when opening the bell; they are not a live push subscription. The dropdown previews five items; the account page has cursor navigation. A guest save intent lasts 30 minutes in session storage and is fulfilled after successful sign-in. Actual saved companies are stored in PostgreSQL.

## Email delivery remains OFF

`web/scripts/notification-worker.mjs` provides a one-shot Resend adapter and bounded worker loop. No provider account, sender domain, scheduler, real email delivery or paid subscription was created. Required environment when the user connects their sender: `NOTIFICATION_EMAIL_ENABLED=true`, `RESEND_API_KEY`, `NOTIFICATION_FROM`, `APP_ORIGIN` (HTTPS origin without path), plus `DATABASE_URL` for the worker. Secrets must never use NEXT_PUBLIC prefixes. Configure a scheduler only after sender and test delivery verification. Users explicitly opt in; preferences default off. The checkbox remains disabled until configuration is enabled.

The worker claims one job with `FOR UPDATE SKIP LOCKED`, a two-minute lease and a random ownership token. Completion checks the token. Failed sends have exponential retry delay, at most eight attempts; ambiguous deliveries older than 23 hours stop automatically, within Resend's documented 24-hour idempotency window. The provider payload is frozen on first attempt so the same key never changes content. Stale leases are recoverable. Queue access is worker-only, not a browser RPC. Success means the provider accepted the message, not confirmed inbox delivery.

The worker rechecks recipient blocking, email verification, preference and request visibility before claims. Opt-out cancels queued jobs. An email already in flight cannot be recalled. Provider webhook/bounce handling, delivery monitoring and scheduler deployment are still rollout work. Do not automatically retry `failed` jobs outside the idempotency window without checking provider history.

Reference: https://resend.com/changelog/idempotency-keys

## Validation / rollback

Local SQL tests cover isolation, authentication, duplicate saves/events, read ownership, queue preferences/leases/retry, blocked accounts, deletion cleanup, rollback and page traversal beyond 1,000 saved companies. The worker tests use a fake provider; no mail is sent. Browser mock tests cover guest intent, failed writes, unread/read states, Escape and small screens. Real auth-probe QA separately checks persistence and offer notification workflows; QA-owned changes are removed.

Rollback the client first if needed; the additive schema may remain with existing data. Stop the worker before any database rollback. Removing triggers stops new notices but loses new-event coverage; review before doing so. Never restore the schema-only backup as if it were a data backup or delete user saves/history as a routine rollback.
