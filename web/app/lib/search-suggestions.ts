"use client";

import { companyImage } from "../components/market/CompanyAvatar";
import { useMemo } from "react";
import { useMarketStore } from "./market-client";
import { categories, cities, groupNames, groupOf } from "./categories";

export type SearchSuggestion = { id: string; label: string; detail: string; category: string; href: string; kind: "category" | "result"; image?: string | null };
export function useSearchSuggestions(mode: "companies" | "requests", query: string, type = "", allowedIds?: string[]): SearchSuggestion[] {
  const { store, ready, available } = useMarketStore();
  return useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ka");
    const sectors: SearchSuggestion[] = Object.entries(categories).filter(([, label]) => !q || label.toLocaleLowerCase("ka").includes(q)).map(([id, label]) => ({
      id: `category-${id}`, label, detail: groupNames[groupOf[id]] && groupNames[groupOf[id]] !== label ? groupNames[groupOf[id]] : "კატეგორია", category: id, kind: "category", href: `/${mode}/?${mode === "companies" ? "industry" : "category"}=${id}`,
    }));
    if (!q) return sectors.slice(0, 4);
    const records: SearchSuggestion[] = !ready || !available || !store ? [] : mode === "companies"
      ? store.listCompanies({ q, type }).map((c: { id: string; company: string; name: string; industry: string; city: string; logoUrl?: string | null }) => ({ id: c.id, label: c.company || c.name, detail: `${categories[c.industry] || c.industry} · ${cities[c.city] || c.city}`, category: c.industry, kind: "result", href: `/companies/view/?id=${encodeURIComponent(c.id)}`, image: companyImage(c.company || c.name, c.logoUrl) }))
      : store.listRequests({ q, state: "open" }).map((r: { id: string; title: string; category: string; city: string }) => ({ id: r.id, label: r.title, detail: `${cities[r.city] || r.city} · მოთხოვნა`, category: r.category, kind: "result", href: `/requests/view/?id=${encodeURIComponent(r.id)}` }));
    const allowed = allowedIds ? new Set(allowedIds) : null;
    const scoped = allowed ? records.filter(record => allowed.has(record.id)) : records;
    return [...sectors.slice(0, 2), ...scoped.slice(0, 4)];
  }, [mode, query, type, allowedIds, ready, available, store]);
}
