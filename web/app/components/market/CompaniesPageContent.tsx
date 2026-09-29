"use client";

import { CustomSelect } from "../ui/CustomSelect";
import Link from "next/link";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { CatalogHeader } from "./CatalogHeader";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, categoryGroups, cities, currentCategory, groupNames } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import { fetchPhones } from "../../lib/phones";

type MappedCompany = {
  id: string;
  company?: string;
  name: string;
  logoUrl?: string | null;
  phone?: string;
  industry: string;
  city: string;
  serviceCities: string[];
  offers: string[];
  about: string;
  verified: boolean;
  createdAt: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function skeleton() {
  return (
    <div className="catalog-skeleton catalog-skeleton--grid" aria-busy="true" aria-label="კომპანიები იტვირთება">
      {[0, 1, 2, 3].map((i) => (
        <div className="catalog-skeleton__card" key={i}>
          <span className="ma-skel catalog-skeleton__avatar" />
          <span className="ma-skel catalog-skeleton__title" />
          <span className="ma-skel catalog-skeleton__line" />
          <span className="ma-skel catalog-skeleton__line catalog-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}

export function CompaniesPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const filters = useFilters("/companies/");
  const industry = currentCategory(filters.get("industry")), city = filters.get("city"), query = filters.get("q");
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
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, count: list({ industry: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ industry: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ industry: "" }).length : 0;
  const cityOptions = Object.keys(cities);
  const cityCounts = useMemo(() => Object.fromEntries(Object.keys(cities).map(id => [id, list({ city: id }).length])), [list]);

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
      logoUrl: c.logoUrl,
      industry: c.industry,
      city: c.city,
      serviceCities: c.serviceCities || [],
      address: c.address ?? null,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      directions: store.directionsUrl(c) ?? null,
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
    ...(industry ? [{ key: "industry", label: categories[industry] || groupNames[industry] || industry }] : []),
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

  const countLabel = !available || !ready ? "" : `${rows.length} კომპანია`;

  const filtersBody = (placement: "desktop" | "mobile") => (
    <div className="catalog-filters">
      <div className="catalog-filter-group">
        <h2 className="catalog-filter-title">დარგი</h2>
        <FacetList all={industryFacets} loading={!ready} allLabel="ყველა დარგი" allCount={allCount} activeId={industry} onSelect={setIndustry} />
      </div>
      <div className="ma-field catalog-filter-group">
        <label className="catalog-filter-title" htmlFor={`company-city-${placement}`}>მომსახურების ქალაქი</label>
        <CustomSelect className="ma-select" id={`company-city-${placement}`} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {cityOptions.map((id) => (
            <option key={id} value={id}>
              {cities[id]} ({cityCounts[id]})
            </option>
          ))}
        </CustomSelect>
      </div>
      <div className="ma-field catalog-filter-group">
        <label className="catalog-filter-title" htmlFor={`company-type-${placement}`}>საქმიანობის ტიპი</label>
        <CustomSelect className="ma-select" id={`company-type-${placement}`} value={type} onChange={e => filters.set({type: e.target.value})}>
          <option value="">ყველა მიმართულება</option><option value="suppliers">პროდუქციის მომწოდებლები</option><option value="services">მომსახურების კომპანიები</option><option value="distributors">ლოგისტიკა და დისტრიბუცია</option><option value="partners">თანამშრომლობის მსურველები</option>
        </CustomSelect>
      </div>
      <fieldset className="catalog-filter-group catalog-filter-checks"><legend className="catalog-filter-title">მომსახურების არეალი</legend>
        <label className="ma-check"><input type="checkbox" checked={coverage} onChange={e => filters.set({coverage: e.target.checked ? "national" : ""})} /><span>ემსახურება მთელ საქართველოს</span></label>
      </fieldset>
    </div>
  );

  return (
    <div className="ma-page companies-catalog catalog-page">
      <CatalogHeader
        tone="light"
        overline="კომპანიების კატალოგი"
        title="მომწოდებლები და მომსახურება"
        description="მოძებნე კომპანია დარგისა და ქალაქის მიხედვით და დაუკავშირდი პირდაპირ."
        search={<CatalogSearch id="company-query" label="კომპანიის ძიება" placeholder="კომპანიის სახელი ან მომსახურება" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="companies" onCategory={industry => filters.set({industry, q: ""})} />}
        help={<>კონკრეტული საჭიროება გაქვს? <Link href="/requests/new/">გამოაქვეყნე მოთხოვნა</Link></>}
      />
      <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="კომპანიების ფილტრები">{filtersBody("desktop")}</aside>
        <section className="catalog-main" aria-label="კომპანიების სია">
          <ResultsBar count={countLabel} filterButton={<button type="button" className="ma-btn ma-btn--secondary catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი{filterCount > 0 ? ` · ${filterCount}` : ""}</button>}
            utility={ready && store?.currentUser() ? <Link className="ma-btn ma-btn--ghost ma-btn--sm" href="/account/?tab=saved"><Icon name="bookmark" />შენახული</Link> : null}
            items={activeItems} onRemove={removeFilter} onClear={clearFilters} sort={{value: sort, onChange: value => filters.set({sort: value}), options: [{value: "newest", label: "უახლესი"}, {value: "name", label: "სახელით"}]}}
          />
          <div className="company-directory-list">
            {!available ? (
              <ServiceUnavailable />
            ) : !ready ? (
              skeleton()
            ) : rows.length === 0 ? (
              <div className="catalog-empty">
                <Icon name="search" />
                <h2>{query ? `„${query}“ ვერ მოიძებნა` : "ამ პირობით კომპანია ვერ მოიძებნა"}</h2>
                <p>გამოაქვეყნე მოთხოვნა და შესაბამისი კომპანიები თავად გამოგიგზავნიან შეთავაზებას.</p>
                <div className="catalog-empty__actions">
                  <Link className="ma-btn ma-btn--primary" href={`/requests/new/?${new URLSearchParams({ title: query, category: industry, city })}`}>გამოაქვეყნე მოთხოვნა</Link>
                  {filterCount > 0
                    ? <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters}>ფილტრების გასუფთავება</button>
                    : query ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setQuery("")}>ძიების გასუფთავება</button> : null}
                </div>
              </div>
            ) : (
              rows.map((c, index) => <CompanyListingCard key={c.id} c={c} entranceIndex={index} />)
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
        footer={<>
          <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters} disabled={filterCount === 0}>გასუფთავება</button>
          <button type="button" className="ma-btn ma-btn--primary" onClick={() => setSheetOpen(false)}>ნახე {rows.length} კომპანია</button>
        </>}
      >
        {filtersBody("mobile")}
      </MobileFilterSheet>
    </div>
  );
}
