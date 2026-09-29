#!/usr/bin/env bash
# Runs the MeetAny database tests against a throwaway database on the local PostgreSQL.
#   db/tests/run.sh
# Env: PGHOST (default /tmp), PGPORT (default 5432), PGUSER (default current user, must be superuser).
# Loads: stub_neon.sql -> schema.sql -> schema.sql again (re-runnability) -> rls_tests.sql
#        -> security_tests.sql -> profile_tests.sql -> fields_tests.sql -> admin_tests.sql
#        -> ... -> messaging, empty-conversations migrations -> conversation_cleanup_tests.sql
#        -> logo_tests.sql (company-logo migration is applied twice right after addresses)
#        (same database, reuse the rls_tests harness)
# Exit code is non-zero on any failure. The database is always dropped.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="${SCHEMA:-$HERE/../schema.sql}"
export PGHOST="${PGHOST:-/tmp}"
export PGPORT="${PGPORT:-5432}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
DB="meetany_test_$$_${RANDOM}"

PSQL=(psql -X -q -v ON_ERROR_STOP=1 --set=VERBOSITY=default -d "$DB")

cleanup() { dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

createdb "$DB"
echo "== database $DB created"

"${PSQL[@]}" -f "$HERE/stub_neon.sql"
echo "== Neon stub loaded"

"${PSQL[@]}" -f "$SCHEMA"
echo "== schema.sql loaded (1st run)"

"${PSQL[@]}" -f "$SCHEMA"
echo "== schema.sql loaded (2nd run, re-runnable)"

"${PSQL[@]}" -f "$HERE/../migrations/20260923-admin-api.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-admin-api.sql"
echo "== admin API migration applied twice"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-engagement.sql"
echo "== additive engagement migration re-applied"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-request-alerts.sql"

"${PSQL[@]}" -f "$HERE/../migrations/20260923-addresses.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-addresses.sql"
# addresses re-creates the 11-argument update_my_profile; the logo migration replaces it.
"${PSQL[@]}" -f "$HERE/../migrations/20260924-company-logo.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260924-company-logo.sql"

"${PSQL[@]}" -f "$HERE/rls_tests.sql"
"${PSQL[@]}" -f "$HERE/security_tests.sql"
"${PSQL[@]}" -f "$HERE/profile_tests.sql"
"${PSQL[@]}" -f "$HERE/fields_tests.sql"
"${PSQL[@]}" -f "$HERE/admin_tests.sql"
"${PSQL[@]}" -f "$HERE/engagement_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-request-alerts-default-on.sql"
"${PSQL[@]}" -f "$HERE/request_alert_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-contact-events.sql"
"${PSQL[@]}" -f "$HERE/contact_event_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260923-messaging.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260924-empty-conversations.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260924-empty-conversations.sql"
"${PSQL[@]}" -f "$HERE/messaging_tests.sql"
"${PSQL[@]}" -f "$HERE/address_tests.sql"
"${PSQL[@]}" -f "$HERE/conversation_cleanup_tests.sql"
"${PSQL[@]}" -f "$HERE/logo_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-admin-v2.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-admin-v2.sql"
"${PSQL[@]}" -f "$HERE/admin_v2_tests.sql"
echo "== tests finished"
