#!/usr/bin/env bash
# Local perf DB: the schema chain of db/tests/run.sh (tests skipped) plus any extra migrations
# given as arguments. Prints the new database name. Rows come from copy-rows.mjs.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; DBDIR="$HERE/../../../db"
DB="meetany_preview_$(date +%s)000"
createdb "$DB"
P=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
export PGOPTIONS='-c client_min_messages=warning'
"${P[@]}" -f "$DBDIR/tests/stub_neon.sql" >/dev/null
"${P[@]}" -f "$DBDIR/schema.sql" >/dev/null
# run.sh order; flows_20261007.sql pulls its migrations in with \ir.
for m in $(grep -oE '(migrations/[0-9A-Za-z_.-]+|flows_20261007)\.sql' "$DBDIR/tests/run.sh" \
    | while read -r x; do if [ "$x" = flows_20261007.sql ]; then grep -oE 'migrations/[0-9A-Za-z_.-]+\.sql' "$DBDIR/tests/$x"; else echo "$x"; fi; done \
    | awk '!seen[$0]++'); do
  "${P[@]}" -f "$DBDIR/$m" >/dev/null
done
for m in "$@"; do "${P[@]}" -f "$m" >/dev/null; done
echo "$DB"
