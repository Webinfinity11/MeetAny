"use client";

import { SearchCombobox } from "./SearchCombobox";
import { Icon } from "./Icon";
import { CustomSelect } from "./ui/CustomSelect";
import { cities } from "../lib/categories";
import type { SearchSuggestion } from "../lib/search-suggestions";

/** The segmented search pill (styles/search.css): "what" combobox | city select | search button.
 *  No visible labels (owner): the placeholder and "ყველა ქალაქი" say it; aria labels stay.
 *  Used by the home hero (inside a GET form) and by catalog headers (live filters). */
export function SegmentedSearch({ id, label, placeholder, query, onQuery, suggestions, onSelect, city, onCity, framed = false, cityField = false, emptyHref, allResultsHref }: {
  id: string; label: string; placeholder: string;
  query: string; onQuery: (value: string) => void;
  suggestions: SearchSuggestion[]; onSelect: (item: SearchSuggestion) => void;
  city: string; onCity: (value: string) => void;
  /** Rounded rectangular frame with aligned fields and a labelled mobile search button. */
  framed?: boolean;
  /** Submit the city with a GET form (home); catalogs filter live instead. */
  cityField?: boolean;
  emptyHref?: string;
  allResultsHref?: string;
}) {
  return <div className={`home-search-entry${framed ? " home-search-entry--framed" : ""}`}>
    <div className="home-search-seg home-search-seg--what">
      <SearchCombobox id={id} name="q" label={label} hideLabel placeholder={placeholder} value={query} onChange={onQuery} suggestions={suggestions} onSelect={onSelect} emptyHref={emptyHref} allResultsHref={allResultsHref} />
    </div>
    <div className="home-search-seg home-search-seg--city">
      <CustomSelect className="home-search-city" name={cityField && city ? "city" : undefined} value={city} onChange={e => onCity(e.target.value)} aria-label="ქალაქი">
        <option value="">ყველა ქალაქი</option>
        {Object.entries(cities).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </CustomSelect>
    </div>
    <button className="home-search-submit" type="submit" aria-label="ძიება"><Icon name="search" /><span>ძიება</span></button>
  </div>;
}
