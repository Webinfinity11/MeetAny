import { asCaller, isConnectionError } from "../../../lib/db.js";
import { verifyCaller } from "../../../lib/neon-jwt.js";
import { validRegistrationEvent } from "../../../lib/registration-event.js";

export const dynamic = "force-dynamic";
const MAX_BODY = 512;
type QueryDb = { query: (sql: string, values?: unknown[]) => Promise<{ rows: {data?: unknown}[] }> };
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const enabled = () => process.env.REGISTRATION_ANALYTICS_ENABLED === "true";

export async function POST(request: Request) {
  // Browser telemetry is same-origin only. This is a CSRF check, not proof of a real visitor.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply(403, { error: "origin" });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, { error: "content_type" });
  if (Number(request.headers.get("content-length")) > MAX_BODY) return reply(413, { error: "body_size" });
  // Enforce the cap while reading, including chunked bodies without Content-Length.
  const reader=request.body?.getReader(),buffer=new Uint8Array(MAX_BODY);
  let size=0;
  if(reader)while(true){
    const chunk=await reader.read();if(chunk.done)break;
    if(size+chunk.value.length>MAX_BODY){await reader.cancel();return reply(413,{error:"body_size"});}
    buffer.set(chunk.value,size);size+=chunk.value.length;
  }
  const text=new TextDecoder().decode(buffer.subarray(0,size));
  let event;
  try { event = JSON.parse(text); } catch { return reply(400, { error: "event" }); }
  if (!validRegistrationEvent(event)) return reply(400, { error: "event" });
  if (!enabled()) return reply(202, { enabled: false });
  try {
    const claims = await verifyCaller(request.headers.get("authorization"));
    if (event.stage === "profile_created" && claims.role !== "authenticated") return reply(401, { error: "authentication" });
    await asCaller(claims, (db: QueryDb) => db.query("select public.record_registration_event($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::text)", [event.eventId,event.sessionId,event.role,event.stage,event.source||"unknown",event.device||"unknown"]));
    return reply(202, { accepted: true });
  } catch (error) {
    const err = error as { code?: string; hint?: string; status?: number };
    if (err.status === 401) return reply(401, { error: "authentication" });
    if (err.hint === "MA001") return reply(401, { error: "authentication" });
    if (err.hint === "MA002") return reply(403, { error: "access" });
    if (err.code === "MA802") return reply(429, { error: "limit" });
    if (err.code === "MA801" || err.code === "MA803") return reply(400, { error: "event" });
    if (err.code === "42883" || err.code === "42P01" || isConnectionError(error)) return reply(503, { enabled: false });
    return reply(500, { error: "unavailable" });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const role = params.get("role") || "all";
  const days = Number(params.get("days") || 30);
  if (!["all","client","company"].includes(role) || ![7,30,90].includes(days)) return reply(400, { error: "filters" });
  try {
    const claims = await verifyCaller(request.headers.get("authorization"));
    if (claims.role !== "authenticated") return reply(401, { error: "authentication" });
    // Validate the actual database profile on every request; a user JWT alone is not admin access.
    const data = await asCaller(claims, async (db: QueryDb) => {
      if (!enabled()) { await db.query("select public.admin_stats()"); return { enabled: false }; }
      return (await db.query("select public.admin_registration_analytics($1::int,$2::text) as data", [days,role])).rows[0].data;
    });
    return reply(200, data);
  } catch (error) {
    const err = error as { code?: string; hint?: string; status?: number };
    if (err.status === 401) return reply(401, { error: "authentication" });
    if (["MA003","MA001","MA002"].includes(err.hint || "") || err.code === "42501") return reply(403, { error: "access" });
    if (err.code === "42883" || err.code === "42P01") return reply(200, { enabled: false });
    return reply(isConnectionError(error) ? 503 : 500, { error: "unavailable" });
  }
}
