"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import { fetchPhones } from "../../lib/phones";

type MappedCompany = {
  id: string;
  company?: string;
  name: string;
  industry: string;
  city: string;
  serviceCities: string[];
  offers: string[];
  about: string;
  verified: boolean;
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

export function CompaniesPageContent() {
  const { store, ready, available } = useMarketStore();
  const filters = useFilters("/companies/");
  const industry = filters.get("industry"), city = filters.get("city"), query = filters.get("q");
  const type = filters.get("type");
  const setIndustry = (industry: string) => filters.set({industry});
  const setCity = (city: string) => filters.set({city});
  const setQuery = (q: string) => filters.set({q});
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useCallback(
    (overrides: Partial<{ industry: string; city: string }>) =>
      (store?.listCompanies as (args: unknown) => MappedCompany[])?.({ industry, city, type, q: query, ...overrides }) || [],
    [store, industry, city, query, type],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);

  const industryFacets: Facet[] = useMemo(
    () => Object.entries(categories).map(([id, label]) => ({ id, label, count: list({ industry: id }).length })),
    [list],
  );
  const allCount = ready && available ? list({ industry: "" }).length : 0;
  const cityOptions = Object.keys(cities);

  const resultIds = useMemo(() => results.map((c) => c.id).join(","), [results]);
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
    return results.map((c) => ({
      id: c.id,
      name: c.company || c.name,
      industry: c.industry,
      city: c.city,
      serviceCities: c.serviceCities || [],
      offers: c.offers || [],
      about: c.about || "",
      verified: c.verified,
      phone: phones[c.id],
      stats: store.companyStats(c.id),
    }));
  }, [results, store, phones]);

  const activeItems = [
    ...(type ? [{key: "type", label: ({suppliers: "მომწოდებლები", services: "მომსახურება", distributors: "დისტრიბუტორები", partners: "ბიზნესპარტნიორები"} as Record<string, string>)[type] || type}] : []),
    ...(industry ? [{ key: "industry", label: categories[industry] }] : []),
    ...(city ? [{ key: "city", label: cities[city] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "type") filters.set({type: ""});
    else if (key === "industry") setIndustry("");
    else if (key === "city") setCity("");
  };
  const clearFilters = () => filters.set({industry: "", city: "", verified: "", q: "", type: ""});
  const filterCount = Number(!!industry) + Number(!!city);

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
      <button type="button" className="ma-btn ma-btn--ghost" onClick={clearFilters}>
        ფილტრების გასუფთავება
      </button>
    </div>
  );

  return (
    <div className="ma-page companies-catalog">
      <header className="companies-intro">
        <h1 className="ma-h1">კომპანიები</h1>
        <CatalogSearch id="company-query" label="კომპანიის ძიება" placeholder="სახელი ან მომსახურება" value={query} onChange={setQuery} />
      </header>
      <div className="ma-proto-columns">
        <aside className="ma-proto-sidebar ma-panel" aria-label="კომპანიების ფილტრები">
          {filtersBody("desktop")}
        </aside>
        <section className="ma-stack">
          <ResultsBar items={activeItems} onRemove={removeFilter} onClear={clearFilters} countLabel={countLabel}
            filterButton={<button type="button" className="ma-btn ma-btn--secondary ma-lg-down" ref={filterButtonRef} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი ({filterCount})</button>}
          />
          <div className="ma-stack">
            {!available ? (
              <div className="ma-empty">
                <h2 className="ma-empty__title">სერვისი დროებით მიუწვდომელია</h2>
              </div>
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
