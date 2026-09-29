"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCombobox } from "./SearchCombobox";
import { useSearchSuggestions } from "../lib/search-suggestions";

export function DiscoverySearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"companies" | "requests">("companies");
  const suggestions = useSearchSuggestions(mode, query);
  const router = useRouter();
  return <form className="discovery-search" action={`/${mode}/`}>
    <fieldset className="market-search-types">
      <legend className="ma-sr-only">რის პოვნა გსურს?</legend>
      <label><input type="radio" checked={mode === "companies"} onChange={() => setMode("companies")} name="search-intent" value="companies" /><span>ვეძებ მომწოდებელს</span></label>
      <label><input type="radio" checked={mode === "requests"} onChange={() => setMode("requests")} name="search-intent" value="requests" /><span>ვეძებ შეკვეთას</span></label>
    </fieldset>
    <div className="home-search-entry">
      <SearchCombobox key={mode} id="home-search" name="q" label={mode === "companies" ? "პროდუქტის, მომსახურების ან კომპანიის ძიება" : "ღია მოთხოვნის ძიება"} hideLabel placeholder={mode === "companies" ? "პროდუქტი, მომსახურება ან კომპანია" : "რა პროდუქტს ან მომსახურებას სთავაზობ?"} value={query} onChange={setQuery}
        suggestions={suggestions} onSelect={item => router.push(item.href)} />
      <button className="home-search-submit" type="submit">მოძებნე</button>
    </div>
  </form>;
}
