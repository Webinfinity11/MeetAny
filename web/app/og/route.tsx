import { ImageResponse } from "next/og";
import { loadPublicSnapshot } from "../lib/public-snapshot";
import { categories, cities } from "../lib/categories";
import { isUuid } from "../lib/ids";
import { siteUrl } from "../lib/site-url";

let fontPromise: Promise<ArrayBuffer | null> | undefined;
function font() {
  return fontPromise ??= (async () => {
    try {
      const css = await fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@600", { signal: AbortSignal.timeout(10000) }).then(r => r.text());
      const url = /src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype|woff)'\)/.exec(css)?.[1];
      if (!url) throw new Error("Georgian font unavailable");
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Georgian font unavailable");
      return await response.arrayBuffer();
    } catch { fontPromise = undefined; return null; }
  })();
}

type Card = { id: string; title?: string; company?: string; name?: string; category?: string; industry?: string; city?: string; logo_url?: string; verified?: boolean };

async function logoData(source?: string) {
  if (!source) return null;
  try {
    const url = new URL(source, siteUrl());
    // Only public, application-owned assets; no arbitrary server-side URL fetches.
    if (!(url.origin === new URL(siteUrl()).origin && url.pathname.startsWith("/assets/")) &&
        !(url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com"))) return null;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    const mime = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !mime || !["image/png", "image/jpeg", "image/webp"].includes(mime)) return null;
    const data = await response.arrayBuffer();
    if (data.byteLength > 2_000_000) return null;
    return `data:${mime};base64,${Buffer.from(data).toString("base64")}`;
  } catch { return null; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  const snapshot = id && isUuid(id) && (kind === "request" || kind === "company") ? await loadPublicSnapshot() : null;
  const list = kind === "request" ? snapshot?.requests : snapshot?.companies;
  const card = (list as Card[] | undefined)?.find(row => row.id === id);
  const name = card ? (kind === "request" ? card.title : card.company || card.name) || "MeetAny" : "MeetAny";
  const category = card?.category || card?.industry;
  const lead = card ? [category ? categories[category] || category : "", card.city ? cities[card.city] || card.city : ""].filter(Boolean).join(" · ") : "იპოვეთ თქვენი ბიზნესპარტნიორი";
  const [data, logo] = await Promise.all([font(), kind === "company" ? logoData(card?.logo_url) : null]);
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#1d4ed8", color: "white", padding: "64px", fontFamily: data ? "Georgian" : "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
        <span>MeetAny</span><span>{card ? kind === "request" ? "ბიზნესის მოთხოვნა" : "კომპანიის პროფილი" : "ბიზნესები ბიზნესებისთვის"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "36px", flexGrow: 1 }}>
        {kind === "company" && card && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "160px", height: "160px", flexShrink: 0, borderRadius: "24px", background: "white", color: "#1d4ed8", fontSize: 64 }}>
          {/* ImageResponse requires a native image with embedded bytes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img alt="" src={logo} width={160} height={160} style={{ objectFit: "contain" }} /> : name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")}
        </div>}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "block", fontSize: 58, lineHeight: 1.25, maxHeight: "145px", overflow: "hidden", lineClamp: 2 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 28, marginTop: "28px" }}>{lead}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: 26 }}>
        {kind === "company" && card?.verified && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m7 12 3 3 7-7" /></svg>}
        {kind === "company" && card?.verified ? "ვერიფიცირებული კომპანია" : "ერთი სივრცე თქვენი ბიზნესის საჭიროებებისთვის"}
      </div>
    </div>,
    { width: 1200, height: 630, ...(data ? { fonts: [{ name: "Georgian", data, weight: 600 as const, style: "normal" as const }] } : {}), headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } },
  );
}
