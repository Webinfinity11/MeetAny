import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cities } from "../../../lib/categories";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { RequestViewPageContent } from "../../../components/market/RequestViewPageContent";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

type SnapshotRequest = { id: string; title: string; body: string; city?: string; photo_url?: string | null };

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Shared links get the request's own title/description (and photo) from the cached public
// snapshot — no extra query; unknown or private ids keep the layout's generic metadata.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return {};
  const snapshot = await loadPublicSnapshot();
  const r = (snapshot?.requests as SnapshotRequest[] | undefined)?.find(item => item.id === id);
  if (!r) return {};
  const title = `${clip(r.title, 70)} — MeetAny`;
  const city = r.city ? cities[r.city] : "";
  const description = clip(city ? `${city}. ${r.body}` : r.body, 160);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "MeetAny",
      locale: "ka_GE",
      ...(r.photo_url ? { images: [{ url: r.photo_url }] } : {}),
    },
  };
}

// The public snapshot seeds the store on the server (as on /companies/view/), so the request
// renders in the first paint instead of after the token → ensureRequest → profiles chain.
export default async function RequestViewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <RequestViewPageContent initial={initial} />
    </Suspense>
  );
}
