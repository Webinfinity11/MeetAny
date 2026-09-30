"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCombobox } from "./SearchCombobox";
import { useSearchSuggestions } from "../lib/search-suggestions";
import { cities } from "../lib/categories";
import { DuoIcon } from "./ui/DuoIcon";
import { Icon } from "./Icon";

/** Home search, Airbnb-style: mode tabs above a segmented pill (what | city | round search button). */
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
    <div className="home-search-entry">
      <div className="home-search-seg home-search-seg--what">
        <span className="home-search-seg__label" aria-hidden="true">რას ეძებ</span>
        <SearchCombobox key={mode} id="home-search" name="q" label={mode === "companies" ? "პროდუქტის, მომსახურების ან კომპანიის ძიება" : "ღია მოთხოვნის ძიება"} hideLabel placeholder={mode === "companies" ? "პროდუქტი, მომსახურება ან კომპანია" : "რა პროდუქტს ან მომსახურებას სთავაზობ?"} value={query} onChange={setQuery}
          suggestions={suggestions} onSelect={item => router.push(item.href)} />
      </div>
      <label className="home-search-seg home-search-seg--city">
        <span className="home-search-seg__label">ქალაქი</span>
        <select name={city ? "city" : undefined} value={city} onChange={e => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {Object.entries(cities).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <button className="home-search-submit" type="submit" aria-label="ძიება"><Icon name="search" /><span>ძიება</span></button>
    </div>
  </form>;
}
