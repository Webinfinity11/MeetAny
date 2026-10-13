import { JsonLd } from "../../../components/JsonLd";
import { siteUrl } from "../../../lib/site-url";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { categories, cities } from "../../../lib/categories";
import { loadPublicSnapshot, loadPublicCompany } from "../../../lib/public-snapshot";
import { CompanyProfilePageContent } from "../../../components/market/CompanyProfilePageContent";
import { isUuid } from "../../../lib/ids";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

type SnapshotCompany = { id: string; company?: string | null; name?: string | null; about?: string | null; industry?: string; city?: string; logo_url?: string | null; website?: string | null };

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Unknown or private profiles are not indexed.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return { robots: { index: false } };
  if (!isUuid(id)) return { title: "კომპანია ვერ მოიძებნა — MeetAny", robots: { index: false } };
  const snapshot = await loadPublicSnapshot();
  const c = (snapshot?.companies as SnapshotCompany[] | undefined)?.find(item => item.id === id);
  const name = c ? (c.company || c.name || "").trim() : "";
  if (!c || !name) return { title: "კომპანია ვერ მოიძებნა — MeetAny", robots: { index: false } };
  const title = `${clip(name, 70)} — MeetAny`;
  const about = String(c.about || "").replace(/^სადემო კომპანია\. ინფორმაცია და ფოტოები საილუსტრაციოა\.\s*/, "");
  const lead = [c.industry ? categories[c.industry] : "", c.city ? cities[c.city] : ""].filter(Boolean).join(" · ");
  const summary = [lead, about].filter(Boolean).join(". ");
  const description = clip(summary.length >= 50 ? summary : `${summary}. გაეცანით კომპანიის საქმიანობასა და მომსახურებას MeetAny-ზე და იპოვეთ ბიზნესპარტნიორი.`, 160);
  return {
    title,
    description,
    alternates: { canonical: `/companies/view/?id=${id}` },
    twitter: { card: "summary_large_image" },
    openGraph: { title, description, type: "profile", siteName: "MeetAny", locale: "ka_GE", images: [{ url: `/og?kind=company&id=${id}` }] },
  };
}

// Use the same public snapshot for SSR and the first client render.
export default async function CompanyViewPage({ searchParams }: Props) {
  await connection();
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const initial = await loadPublicCompany(id);
  const item = (initial?.companies as SnapshotCompany[] | undefined)?.find(row => row.id === id);
  const url = `${siteUrl()}/companies/view/?id=${id}`;
  return (
    <>
    <Suspense>
      <CompanyProfilePageContent initial={initial} />
    </Suspense>
    {item && <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization",
      name: item.company || item.name, url, description: item.about || undefined,
      logo: item.logo_url ? new URL(item.logo_url, siteUrl()).href : undefined,
      ...(item.city ? { address: { "@type": "PostalAddress", addressLocality: cities[item.city] || item.city } } : {}),
      ...(item.website && /^https?:\/\//.test(item.website) ? { sameAs: [item.website] } : {}),
    }} />}
    </>
  );
}
