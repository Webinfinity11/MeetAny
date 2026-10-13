#!/usr/bin/env bash
# Local measurements against `next start` on 127.0.0.1:3708 with auth-fixture.mjs on :3718.
# Usage (from web/): bash qa/p7-perf/run-local.sh before|after
set -euo pipefail
tag="$1"; dir=qa/p7-perf
m=(node qa/perf-2026-10-12/measure.mjs --origin http://127.0.0.1:3708 --company 74cc28fc-47de-45cb-9563-93735b86855e --runs 3 --auth http://127.0.0.1:3718)
# Guest: public request; signed in: demo-hotel (client) on a request it owns (5 offers).
"${m[@]}" --request 012ca27c-5913-46e2-899f-254785bd3d23 --pages request-view,company-view --out "$dir/$tag-local-guest.json"
"${m[@]}" --request 0101aaac-f4e6-4ed4-b1bd-5a52e0942db9 --user bacf1572-7493-4ac9-bfc7-95719e911c4c --pages request-view,company-view --out "$dir/$tag-local-client.json"
