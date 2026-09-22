#!/usr/bin/env bash
# Runs the MeetAny database tests against a throwaway database on the local PostgreSQL.
#   db/tests/run.sh
# Env: PGHOST (default /tmp), PGPORT (default 5432), PGUSER (default current user, must be superuser).
# Loads: stub_neon.sql -> schema.sql -> schema.sql again (re-runnability) -> rls_tests.sql
#        -> security_tests.sql -> profile_tests.sql -> fields_tests.sql (same database, reuse the rls_tests harness)
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

"${PSQL[@]}" -f "$HERE/rls_tests.sql"
"${PSQL[@]}" -f "$HERE/security_tests.sql"
"${PSQL[@]}" -f "$HERE/profile_tests.sql"
"${PSQL[@]}" -f "$HERE/fields_tests.sql"
echo "== tests finished"
