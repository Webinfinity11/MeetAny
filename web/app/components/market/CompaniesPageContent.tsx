"use client";

import Link from "next/link";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import { fetchPhones } from "../../lib/phones";

type MappedCompany = {
  id: string;
  company?: string;
  name: string;
  phone?: string;
  industry: string;
  city: string;
  serviceCities: string[];
  offers: string[];
  about: string;
  verified: boolean;
  createdAt: string;
};

function skeleton() {
  return (
    <div className="ma-stack" aria-busy="true" aria-label="მონაცემები იტვირთება">
      <p role="status">იტვირთება…</p>
      {[0, 1, 2].map((i) => (
        <div className="ma-card ma-stack" key={i}>
          <span className="ma-skel ma-skel--title" />
          <span className="ma-skel ma-skel--line" />
        </div>
      ))}
    </div>
  );
}

export function CompaniesPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const filters = useFilters("/companies/");
  const industry = filters.get("industry"), city = filters.get("city"), query = filters.get("q");
  const type = filters.get("type"), coverage = filters.get("coverage") === "national", sort = filters.get("sort", "newest");
  const setIndustry = (industry: string) => filters.set({industry});
  const setCity = (city: string) => filters.set({city});
  const setQuery = (q: string) => filters.set({q});
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useCallback(
    (overrides: Partial<{ industry: string; city: string }>) =>
      (store?.listCompanies as (args: unknown) => MappedCompany[])?.({ industry, city, type, q: query, ...overrides })?.filter(c => !coverage || c.city === "georgia" || c.serviceCities?.includes("georgia")) || [],
    [store, industry, city, query, type, coverage],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);

  const industryFacets: Facet[] = useMemo(
    () => Object.entries(categories).map(([id, label]) => ({ id, label, count: list({ industry: id }).length })),
    [list],
  );
  const allCount = ready && available ? list({ industry: "" }).length : 0;
  const cityOptions = Object.keys(cities);

  const resultIds = useMemo(() => results.filter(c => c.phone === undefined).map((c) => c.id).join(","), [results]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetchPhones(resultIds ? resultIds.split(",") : []).then((map) => {
      if (!cancelled) setPhones(map);
    });
    return () => {
      cancelled = true;
    };
  }, [resultIds]);

  const rows: CompanyListingData[] = useMemo(() => {
    if (!store) return [];
    return [...results].sort((a, b) => sort === "name" ? (a.company || a.name).localeCompare(b.company || b.name, "ka") : Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((c) => ({
      id: c.id,
      name: c.company || c.name,
      industry: c.industry,
      city: c.city,
      serviceCities: c.serviceCities || [],
      offers: c.offers || [],
      about: c.about || "",
      verified: c.verified,
      phone: c.phone || phones[c.id],
      stats: store.companyStats(c.id),
    }));
  }, [results, store, phones, sort]);

  const activeItems = [
    ...(coverage ? [{key: "coverage", label: "მთელი საქართველო"}] : []),
    ...(type ? [{key: "type", label: ({suppliers: "მომწოდებლები", services: "მომსახურება", distributors: "დისტრიბუტორები", partners: "ბიზნესპარტნიორები"} as Record<string, string>)[type] || type}] : []),
    ...(industry ? [{ key: "industry", label: categories[industry] }] : []),
    ...(city ? [{ key: "city", label: cities[city] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "type") filters.set({type: ""});
    else if (key === "industry") setIndustry("");
    else if (key === "city") setCity("");
    else filters.set({[key]: ""});
  };
  const clearFilters = () => filters.set({industry: "", city: "", verified: "", q: "", type: "", coverage: "", sort: ""});
  const filterCount = activeItems.length;

  const countLabel = !available ? "" : !ready ? "კომპანიები იტვირთება…" : `${rows.length} კომპანია`;

  const filtersBody = (placement: "desktop" | "mobile") => (
    <div className="ma-proto-filters">
      <div>
        <h2 className="ma-title">დარგი</h2>
        <FacetList all={industryFacets} loading={!ready} allLabel="ყველა დარგი" allCount={allCount} activeId={industry} onSelect={setIndustry} />
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor={`company-city-${placement}`}>
          მომსახურების ქალაქი
        </label>
        <select className="ma-select" id={`company-city-${placement}`} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {cityOptions.map((id) => (
            <option key={id} value={id}>
              {cities[id]}
            </option>
          ))}
        </select>
      </div>
      <div className="ma-field filter-section">
        <label className="ma-field__label" htmlFor={`company-type-${placement}`}>საქმიანობის მიმართულება</label>
        <select className="ma-select" id={`company-type-${placement}`} value={type} onChange={e => filters.set({type: e.target.value})}>
          <option value="">ყველა მიმართულება</option><option value="suppliers">პროდუქციის მომწოდებლები</option><option value="services">მომსახურების კომპანიები</option><option value="distributors">ლოგისტიკა და დისტრიბუცია</option><option value="partners">თანამშრომლობის მსურველები</option>
        </select>
      </div>
      <fieldset className="filter-section filter-options"><legend>მომსახურების არეალი</legend>
        <label className="ma-check"><input type="checkbox" checked={coverage} onChange={e => filters.set({coverage: e.target.checked ? "national" : ""})} /><span>ემსახურება მთელ საქართველოს</span></label>
      </fieldset>
      <button type="button" className="ma-btn ma-btn--ghost filter-reset" onClick={clearFilters}>
        ფილტრების გასუფთავება
      </button>
    </div>
  );

  return (
    <div className="ma-page companies-catalog">
      <header className="companies-intro">
        <div className="company-directory-heading"><h1 className="ma-h1">კომპანიები</h1><Link className="ma-btn ma-btn--secondary" href="/account/?tab=saved">შენახული კომპანიები <Icon name="arrow-right" /></Link></div>
        <CatalogSearch id="company-query" label="კომპანიის ძიება" placeholder="სახელი ან მომსახურება" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="companies" onCategory={industry => filters.set({industry, q: ""})} />
      </header>
      <div className="ma-proto-columns">
        <aside className="ma-proto-sidebar filter-rail" aria-label="კომპანიების ფილტრები">{filtersBody("desktop")}</aside>
        <section className="ma-stack" aria-label="კომპანიების სია">
          <ResultsBar filterButton={<button type="button" className="ma-btn ma-btn--secondary ma-lg-down" ref={filterButtonRef} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი ({filterCount})</button>} items={activeItems} onRemove={removeFilter} onClear={clearFilters} countLabel={countLabel} sort={{value: sort, onChange: value => filters.set({sort: value}), options: [{value: "newest", label: "უახლესი"}, {value: "name", label: "სახელით"}]}}
          />
          <div className="company-directory-list">
            {!available ? (
              <ServiceUnavailable />
            ) : !ready ? (
              skeleton()
            ) : rows.length === 0 ? (
              <div className="ma-empty">
                <span className="ma-empty__icon">
                  <Icon name="search" />
                </span>
                <h2 className="ma-empty__title">კომპანია ვერ მოიძებნა</h2>
                <p className="ma-empty__text">შეცვალე ან გაასუფთავე ფილტრები.</p>
                <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters}>
                  საწყის ხედზე დაბრუნება
                </button>
              </div>
            ) : (
              rows.map((c) => <CompanyListingCard key={c.id} c={c} />)
            )}
          </div>
        </section>
      </div>

      <MobileFilterSheet
        id="filters"
        title="ფილტრები"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        triggerRef={filterButtonRef}
        footer={
          <button type="button" className="ma-btn ma-btn--primary" onClick={() => setSheetOpen(false)}>
            {rows.length} კომპანიის ჩვენება
          </button>
        }
      >
        {filtersBody("mobile")}
      </MobileFilterSheet>
    </div>
  );
}
