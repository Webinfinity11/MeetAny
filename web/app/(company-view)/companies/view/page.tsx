import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { categories, cities } from "../../../lib/categories";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { CompanyProfilePageContent } from "../../../components/market/CompanyProfilePageContent";
import { isUuid } from "../../../lib/ids";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

type SnapshotCompany = { id: string; company?: string | null; name?: string | null; about?: string | null; industry?: string; city?: string; logo_url?: string | null };

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Like /requests/view/: a shared profile link carries the company's own name and description from the
// cached public snapshot; unknown ids keep the layout's generic metadata (the page itself says "not found").
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return {};
  if (!isUuid(id)) return { title: "კომპანია ვერ მოიძებნა — MeetAny", robots: { index: false } };
  const snapshot = await loadPublicSnapshot();
  const c = (snapshot?.companies as SnapshotCompany[] | undefined)?.find(item => item.id === id);
  const name = c ? (c.company || c.name || "").trim() : "";
  if (!c || !name) return {};
  const title = `${clip(name, 70)} — MeetAny`;
  const about = String(c.about || "").replace(/^სადემო კომპანია\. ინფორმაცია და ფოტოები საილუსტრაციოა\.\s*/, "");
  const lead = [c.industry ? categories[c.industry] : "", c.city ? cities[c.city] : ""].filter(Boolean).join(" · ");
  const description = clip([lead, about].filter(Boolean).join(". "), 160) || "კომპანიის პროფილი MeetAny-ზე.";
  return {
    title,
    description,
    openGraph: { title, description, type: "profile", siteName: "MeetAny", locale: "ka_GE", ...(c.logo_url ? { images: [{ url: c.logo_url }] } : {}) },
  };
}

// Use the same public snapshot for SSR and the first client render.
export default async function CompanyViewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <CompanyProfilePageContent initial={initial} />
    </Suspense>
  );
}
