// Registration analytics deliberately sends no field values, URL parameters or contact details.
// A session is one attempt in this tab, not a person. Guests can forge these events; only the
// server-confirmed profile_created stage is authoritative. Analytics never blocks registration.
export type RegistrationRole = "client" | "company";
export type RegistrationStage = "form_open" | "form_started" | "form_submitted" | "email_pending" | "profile_created";
type Attempt = { id: string; at: number; stages: RegistrationStage[]; source?:string; device?:string };
const TTL = 24 * 60 * 60 * 1000;
const memory = new Map<RegistrationRole, Attempt>();
let queue: Promise<unknown> = Promise.resolve();

function attempt(role: RegistrationRole): Attempt {
  const key = `meetany.registration.${role}`;
  let current = memory.get(role);
  if (!current) {
    try { current = JSON.parse(sessionStorage.getItem(key) || "null") as Attempt | undefined; } catch { /* Storage may be unavailable. */ }
  }
  if (!current || Date.now() - current.at > TTL || !/^[a-f0-9-]{36}$/i.test(current.id) || !Array.isArray(current.stages)) {
    const params=new URLSearchParams(window.location.search),entry=params.get("entry");
    const next=params.get("next")||"";
    // Only a coarse route category is derived in the browser. The URL is never transmitted.
    const source=entry&&["direct","header","request","company","account","unknown"].includes(entry)?entry:next.startsWith("/requests/")?"request":next.startsWith("/companies/")?"company":next.startsWith("/account/")?"account":"direct";
    const device=window.innerWidth<768?"mobile":window.innerWidth<1024?"tablet":"desktop";
    current = { id: crypto.randomUUID(), at: Date.now(), stages: [],source,device };
  }
  memory.set(role, current);
  return current;
}

export async function registrationToken(): Promise<string | null> {
  const base = String(process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  const response = await fetch(`${base}/token`, { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data?.token === "string" ? data.token : null;
}

export function trackRegistration(role: string, stage: RegistrationStage): void {
  if (typeof window === "undefined" || (role !== "client" && role !== "company")) return;
  const current = attempt(role);
  if (current.stages.includes(stage)) return;
  current.stages.push(stage);
  try { sessionStorage.setItem(`meetany.registration.${role}`, JSON.stringify(current)); } catch { /* Optional telemetry. */ }
  const body = JSON.stringify({ eventId: crypto.randomUUID(), sessionId: current.id, role, stage,source:current.source||"unknown",device:current.device||"unknown" });
  // Serialize this small flow so form_open reaches the server before subsequent stages.
  queue = queue.catch(() => {}).then(async () => {
    const token = stage === "profile_created" ? await registrationToken().catch(() => null) : null;
    if (stage === "profile_created" && !token) return;
    await fetch("/api/analytics/registration", {
      method: "POST", keepalive: true, credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body, signal: AbortSignal.timeout(5000),
    });
  }).catch(() => { /* Registration succeeds independently of analytics availability. */ });
}
