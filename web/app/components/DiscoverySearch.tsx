"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedSearch } from "./SegmentedSearch";
import { useSearchSuggestions } from "../lib/search-suggestions";
import { DuoIcon } from "./ui/DuoIcon";

/** Home search, Airbnb-style: mode tabs above the segmented pill (what | city | round search button). */
export function DiscoverySearch() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"companies" | "requests">("companies");
  const suggestions = useSearchSuggestions(mode, query);
  const router = useRouter();
  return <form className="discovery-search" action={`/${mode}/`}>
    <fieldset className="market-search-types">
      <legend className="ma-sr-only">რის პოვნა გსურს?</legend>
      <label><input type="radio" checked={mode === "companies"} onChange={() => setMode("companies")} name="search-intent" value="companies" /><DuoIcon name="store" size={22} /><span>მომწოდებლები</span></label>
      <label><input type="radio" checked={mode === "requests"} onChange={() => setMode("requests")} name="search-intent" value="requests" /><DuoIcon name="file-text" size={22} /><span>მოთხოვნები</span></label>
    </fieldset>
    <SegmentedSearch key={mode} id="home-search" cityField
      label={mode === "companies" ? "პროდუქტის, მომსახურების ან კომპანიის ძიება" : "ღია მოთხოვნის ძიება"}
      placeholder={mode === "companies" ? "პროდუქტი, მომსახურება ან კომპანია" : "რა პროდუქტს ან მომსახურებას სთავაზობ?"}
      query={query} onQuery={setQuery} suggestions={suggestions} onSelect={item => router.push(item.href)}
      city={city} onCity={setCity} />
  </form>;
}
