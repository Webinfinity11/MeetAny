#!/usr/bin/env bash
# Local measurements against `next start` on 127.0.0.1:3002 with auth-fixture.mjs on :3012.
# Usage (from web/): bash qa/perf-2026-10-12/run-local.sh before|after
set -euo pipefail
tag="$1"; dir=qa/perf-2026-10-12
m=(node "$dir/measure.mjs" --origin http://127.0.0.1:3002 --company 74cc28fc-47de-45cb-9563-93735b86855e --runs 3 --auth http://127.0.0.1:3012)
# Guest: public request; signed in: demo-hotel (client) on a request it owns (5 offers).
"${m[@]}" --request 3c6c7198-9e2c-4950-9dfb-f32a1545ec26 --pages home,requests,request-view,companies,company-view --out "$dir/$tag-local-guest.json"
"${m[@]}" --request 0101aaac-f4e6-4ed4-b1bd-5a52e0942db9 --user bacf1572-7493-4ac9-bfc7-95719e911c4c --out "$dir/$tag-local-client.json"
