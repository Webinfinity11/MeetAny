"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedSearch } from "./SegmentedSearch";
import { useSearchSuggestions } from "../lib/search-suggestions";
import { DuoIcon } from "./ui/DuoIcon";

/** A single compact row, retaining both catalogs, suggestions and city filtering. */
export function DiscoverySearch() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"companies" | "requests">("companies");
  const suggestions = useSearchSuggestions(mode, query);
  const router = useRouter();
  return <form className="discovery-search" action={`/${mode}/`}>
    <fieldset className="market-search-types">
      <legend className="ma-sr-only">რის პოვნა გსურს?</legend>
      <label title="მომწოდებლები"><input type="radio" checked={mode === "companies"} onChange={() => setMode("companies")} name="search-intent" value="companies" aria-label="მომწოდებლები" /><DuoIcon name="store" size={22} /><span>მომწოდებლები</span></label>
      <label title="მოთხოვნები"><input type="radio" checked={mode === "requests"} onChange={() => setMode("requests")} name="search-intent" value="requests" aria-label="მოთხოვნები" /><DuoIcon name="file-text" size={22} /><span>მოთხოვნები</span></label>
    </fieldset>
    <SegmentedSearch key={mode} id="home-search" framed cityField cityPlaceholder="ქალაქი"
      label={mode === "companies" ? "პროდუქტის, მომსახურების ან კომპანიის ძიება" : "ღია მოთხოვნის ძიება"}
      placeholder={mode === "companies" ? "პროდუქტი ან კომპანია" : "მოთხოვნის ძიება"}
      query={query} onQuery={setQuery} suggestions={suggestions} onSelect={item => router.push(item.href)}
      city={city} onCity={setCity}
      allResultsHref={`/${mode}/?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), ...(city ? { city } : {}) })}`}
      emptyHref={`/requests/new/?${new URLSearchParams({ title: query.trim(), city })}`} />
  </form>;
}
