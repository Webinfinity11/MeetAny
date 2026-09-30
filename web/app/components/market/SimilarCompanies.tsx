"use client";

import { useEffect, useMemo, useState } from "react";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import type { BusinessFeature } from "../../lib/business-client";
import { groupOf } from "../../lib/categories";
import { fetchPhones } from "../../lib/phones";

type Pool = Omit<CompanyListingData, "name" | "feature" | "stats" | "phone" | "directions"> & { name: string; company?: string; phone?: string; createdAt: string };
type Store = { listCompanies: (args: unknown) => Pool[]; companyStats: (id: string) => { sent: number; chosen: number }; directionsUrl: (c: unknown) => string | null };

const LIMIT = 6;

/** Companies from the same category group, nearest first (same category, then shared cities); VIP/Premium lead. */
export function SimilarCompanies({ store, current, features }: { store: Store; current: Pool; features?: BusinessFeature[] }) {
  const group = groupOf[current.industry as keyof typeof groupOf];
  const planById = useMemo(() => new Map((features || []).map(f => [f.id, f.plan])), [features]);
  const picked = useMemo(() => {
    const cities = new Set([current.city, ...current.serviceCities].filter(Boolean));
    const near = (c: Pool) => [c.city, ...c.serviceCities].filter(Boolean).some(id => cities.has(id)) ? 1 : 0;
    const rank = (c: Pool) => planById.get(c.id) === "vip" ? 2 : planById.get(c.id) === "premium" ? 1 : 0;
    const same = (c: Pool) => c.industry === current.industry ? 1 : 0;
    return store.listCompanies({})
      .filter(c => c.id !== current.id && groupOf[c.industry as keyof typeof groupOf] === group)
      .sort((a, b) => rank(b) - rank(a) || near(b) - near(a) || same(b) - same(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, LIMIT);
  }, [store, current, group, planById]);
  const ids = picked.filter(c => c.phone === undefined).map(c => c.id).join(",");
  const [phones, setPhones] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetchPhones(ids ? ids.split(",") : []).then(map => { if (!cancelled) setPhones(map); });
    return () => { cancelled = true; };
  }, [ids]);
  if (!picked.length) return null;
  return (
    <section className="company-similar" aria-labelledby="company-similar">
      <h2 id="company-similar" className="detail-section-title">მსგავსი კომპანიები</h2>
      <div className="company-directory-list">
        {picked.map(c => <CompanyListingCard key={c.id} c={{
          ...c, name: c.company || c.name, feature: (features || []).find(f => f.id === c.id), phone: c.phone || phones[c.id],
          directions: store.directionsUrl(c) ?? null, stats: store.companyStats(c.id),
        }} />)}
      </div>
    </section>
  );
}
