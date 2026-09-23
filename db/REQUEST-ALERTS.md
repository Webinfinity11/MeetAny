# Matching request alerts

Local UI: http://localhost:3001/account/?tab=notifications, signed in as a company.
Applied to auth-probe only on 2026-09-23; no production migration or web deployment.

Companies explicitly enable alerts and select categories and service cities. Profile values
prefill the form, without subscribing automatically. `georgia` means any city; nationwide
requests match every selected city. Only new open, visible requests from an unblocked owner
notify matching unblocked companies. Own requests are excluded. Edits do not notify again;
there is no backfill. Closed, expired, hidden and deleted requests disappear from the feed.
The bell refreshes on focus/open and every 30 seconds while the page is visible.

`migrations/20260923-request-alerts.sql` is additive and rerunnable, and included in schema.sql.
The settings RPC requires the company role. Private tables and worker functions are denied
to application roles. Notifications and optional email jobs are created in the request's
transaction; rollback creates neither. Changing preferences cancels pending email jobs;
saving identical preferences preserves them. Existing inbox history is retained.

Email delivery is **not configured or enabled**. The UI keeps the email selector disabled.
When an approved sender and scheduled worker are configured, modes are off, instant, and
daily (20:00 Asia/Tbilisi; actual delivery is the next worker run). The daily bucket contains
only requests since subscription/previous cutoff and sends nothing when empty. Opt-out and
re-enable create a fresh bucket. Worker claims recheck visibility, subscription, blocked
status and verified email. Retries use a frozen payload and provider idempotency key, leases,
backoff, and a maximum of eight attempts within 23 hours of the first attempt.

The one-shot `web/scripts/notification-worker.mjs` processes both offer and request queues.
It requires NOTIFICATION_EMAIL_ENABLED=true, DATABASE_URL, RESEND_API_KEY,
NOTIFICATION_FROM and an HTTPS APP_ORIGIN. A scheduler is required for automatic emails;
none is installed by this change. Apply both engagement and request-alert migrations before
running the worker. Do not use a test branch with a real sender unless explicitly intended.

Validation: `bash db/tests/run.sh`, `node web/qa/notification-worker.mjs`, web build/lint.
`web/qa/request-alerts-live.mjs` uses localhost:3001 and guards the auth-probe endpoint;
it restores preferences and deletes its request fixture. It never sends email.
