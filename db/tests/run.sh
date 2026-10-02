#!/usr/bin/env bash
# Runs the MeetAny database tests against a throwaway database on the local PostgreSQL.
#   db/tests/run.sh
# Env: PGHOST (default /tmp), PGPORT (default 5432), PGUSER (default current user, must be superuser).
# Loads: stub_neon.sql -> schema.sql -> schema.sql again (re-runnability) -> rls_tests.sql
#        -> security_tests.sql -> profile_tests.sql -> fields_tests.sql -> admin_tests.sql
#        -> ... -> messaging, empty-conversations migrations -> conversation_cleanup_tests.sql
#        -> logo_tests.sql (company-logo migration is applied twice right after addresses)
#        -> company-gallery migration twice -> gallery_tests.sql
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
"${PSQL[@]}" -f "$HERE/../migrations/20260930-company-gallery.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260930-company-gallery.sql"
"${PSQL[@]}" -f "$HERE/gallery_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-admin-v2.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-admin-v2.sql"
"${PSQL[@]}" -f "$HERE/admin_v2_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260930-admin-photos.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260930-admin-photos.sql"
"${PSQL[@]}" -f "$HERE/admin_photo_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260929-categories.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260930-business-features.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20260930-business-features.sql"
"${PSQL[@]}" -f "$HERE/business_feature_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-reports.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-reports.sql"
"${PSQL[@]}" -f "$HERE/report_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-distribution.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-distribution.sql"
"${PSQL[@]}" -f "$HERE/distribution_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-market-metrics.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-market-metrics.sql"
"${PSQL[@]}" -f "$HERE/market_metrics_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-products.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261001-products.sql"
"${PSQL[@]}" -f "$HERE/product_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-admin-management.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-admin-management.sql"
"${PSQL[@]}" -f "$HERE/admin_management_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-company-approval.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-company-approval.sql"
"${PSQL[@]}" -f "$HERE/company_approval_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-registration-analytics.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-registration-analytics.sql"
"${PSQL[@]}" -f "$HERE/registration_analytics_tests.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-admin-overview.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261002-admin-overview.sql"
"${PSQL[@]}" -f "$HERE/admin_overview_tests.sql"
"${PSQL[@]}" -c "select format('TOTAL %s SQL ASSERTIONS PASSED', count(*)) from t.passed"
echo "== tests finished"
