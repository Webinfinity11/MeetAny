import { JsonLd } from "../../../components/JsonLd";
import { siteUrl } from "../../../lib/site-url";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cities } from "../../../lib/categories";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { RequestViewPageContent } from "../../../components/market/RequestViewPageContent";
import { isUuid } from "../../../lib/ids";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

type SnapshotRequest = { id: string; title: string; body: string; city?: string; photo_url?: string | null };

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Shared links expose only data visible in the anonymous snapshot.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return { robots: { index: false } };
  if (!isUuid(id)) return { title: "მოთხოვნა ვერ მოიძებნა — MeetAny", robots: { index: false } };
  const snapshot = await loadPublicSnapshot();
  const r = (snapshot?.requests as SnapshotRequest[] | undefined)?.find(item => item.id === id);
  if (!r) return { title: "მოთხოვნა ვერ მოიძებნა — MeetAny", robots: { index: false } };
  const title = `${clip(r.title, 70)} — MeetAny`;
  const city = r.city ? cities[r.city] : "";
  const summary = [city, r.body].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  const description = clip(summary.length >= 50 ? summary : `${summary}. გაეცანით ბიზნესის მოთხოვნას და გააგზავნეთ თქვენი შეთავაზება MeetAny-ზე.`, 160);
  return {
    title,
    description,
    alternates: { canonical: `/requests/view/?id=${id}` },
    twitter: { card: "summary_large_image" },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "MeetAny",
      locale: "ka_GE",
      images: [{ url: r.photo_url || `/og?kind=request&id=${id}` }],
    },
  };
}

// The public snapshot seeds the store on the server (as on /companies/view/), so the request
// renders in the first paint instead of after the token → ensureRequest → profiles chain.
export default async function RequestViewPage({ searchParams }: Props) {
  await connection();
  const initial = await loadPublicSnapshot();
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const item = (initial?.requests as SnapshotRequest[] | undefined)?.find(row => row.id === id);
  const url = `${siteUrl()}/requests/view/?id=${id}`;
  return (
    <>
    <Suspense>
      <RequestViewPageContent initial={initial} />
    </Suspense>
    {item && <JsonLd data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "მთავარი", item: `${siteUrl()}/` },
        { "@type": "ListItem", position: 2, name: "მოთხოვნები", item: `${siteUrl()}/requests/` },
        { "@type": "ListItem", position: 3, name: item.title, item: url },
      ] },
      { "@type": "Demand", name: item.title, description: item.body, url,
        ...(item.city ? { availableAtOrFrom: { "@type": "Place", name: cities[item.city] || item.city } } : {}),
      },
    ] }} />}
    </>
  );
}
