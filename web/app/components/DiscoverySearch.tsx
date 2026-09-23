"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { SearchCombobox } from "./SearchCombobox";
import { useSearchSuggestions } from "../lib/search-suggestions";

export function DiscoverySearch() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const suggestions = useSearchSuggestions("companies", query, type);
  const router = useRouter();
  return <form className="discovery-search" action="/companies/">
    <fieldset className="market-search-types">
      <legend className="sr-only">რას ეძებ?</legend>
      <label><input type="radio" name="type" value="" checked={type === ""} onChange={() => setType("")} /><span className="search-type-full">ყველა კომპანია</span><span className="search-type-short" aria-hidden="true">ყველა</span></label>
      <label><input type="radio" name="type" value="suppliers" checked={type === "suppliers"} onChange={() => setType("suppliers")} /><span className="search-type-full">მომწოდებლები</span><span className="search-type-short" aria-hidden="true">პროდუქცია</span></label>
      <label><input type="radio" name="type" value="services" checked={type === "services"} onChange={() => setType("services")} />მომსახურება</label>
    </fieldset>
    <SearchCombobox id="home-search" name="q" label="რა სჭირდება შენს ბიზნესს?" hideLabel placeholder="აღწერე, რა გჭირდება" value={query} onChange={setQuery}
      suggestions={suggestions} onSelect={item => router.push(item.href)} />
    <button className="button" type="submit">მოძებნე <Icon name="arrow-right" /></button>
  </form>;
}
