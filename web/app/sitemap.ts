import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/site-url";

// Public pages and the two catalogs. Detail pages (/requests/view/?id=, /companies/view/?id=)
// are query-string views and stay out; account, admin and the new-request form are private.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/requests/`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/companies/`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/terms/`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
