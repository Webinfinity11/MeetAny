"use client";

import { SearchCombobox } from "./SearchCombobox";
import { Icon } from "./Icon";
import { CustomSelect } from "./ui/CustomSelect";
import { cities } from "../lib/categories";
import type { SearchSuggestion } from "../lib/search-suggestions";

/** The segmented search pill (styles/search.css): "what" combobox | city select | search button.
 *  Used by the home hero (inside a GET form) and by catalog headers (live filters). */
export function SegmentedSearch({ id, label, placeholder, query, onQuery, suggestions, onSelect, city, onCity, framed = false, cityField = false, emptyHref }: {
  id: string; label: string; placeholder: string;
  query: string; onQuery: (value: string) => void;
  suggestions: SearchSuggestion[]; onSelect: (item: SearchSuggestion) => void;
  city: string; onCity: (value: string) => void;
  /** Bordered variant for light headers (the home hero sits on blue and needs none). */
  framed?: boolean;
  /** Submit the city with a GET form (home); catalogs filter live instead. */
  cityField?: boolean;
  emptyHref?: string;
}) {
  return <div className={`home-search-entry${framed ? " home-search-entry--framed" : ""}`}>
    <div className="home-search-seg home-search-seg--what">
      <span className="home-search-seg__label" aria-hidden="true">რას ეძებ</span>
      <SearchCombobox id={id} name="q" label={label} hideLabel placeholder={placeholder} value={query} onChange={onQuery} suggestions={suggestions} onSelect={onSelect} emptyHref={emptyHref} />
    </div>
    <div className="home-search-seg home-search-seg--city">
      <span className="home-search-seg__label">ქალაქი</span>
      <CustomSelect className="home-search-city" name={cityField && city ? "city" : undefined} value={city} onChange={e => onCity(e.target.value)} aria-label="ქალაქი">
        <option value="">ყველა ქალაქი</option>
        {Object.entries(cities).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </CustomSelect>
    </div>
    <button className="home-search-submit" type="submit" aria-label="ძიება"><Icon name="search" /><span>ძიება</span></button>
  </div>;
}
