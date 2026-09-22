// Thin Route Handler wrapper: the actual PostgREST-subset logic lives in ../../../lib/db-handler.js
// (ported from site/api/db.js unchanged) so it can be reviewed against the Vercel Function original.
import handler from "../../../lib/db-handler.js";

export async function GET(request: Request) {
  return handler.fetch(request);
}

export async function POST(request: Request) {
  return handler.fetch(request);
}
