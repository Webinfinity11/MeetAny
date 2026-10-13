import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/site-url";

import { loadPublicSnapshot } from "./lib/public-snapshot";

// Metadata routes support the same revalidation config as other route handlers.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const snapshot = await loadPublicSnapshot();
  // Do not cache a deceptively complete sitemap during a database outage.
  if (!snapshot) throw new Error("Public sitemap unavailable");
  const now = Date.now();
  const requests = snapshot.requests as { id: string; status: string; hidden: boolean; expires_at: string; created_at: string }[];
  const companies = snapshot.companies as { id: string }[];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/requests/`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/companies/`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/how-it-works/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms/`, changeFrequency: "yearly", priority: 0.2 },
    ...requests.filter(r => r.status === "open" && !r.hidden && Date.parse(r.expires_at) > now)
      .map(r => ({ url: `${base}/requests/view/?id=${r.id}`, lastModified: r.created_at })),
    ...companies.map(c => ({ url: `${base}/companies/view/?id=${c.id}` })),
  ];
}
