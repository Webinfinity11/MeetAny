"use client";

import Link from "next/link";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SegmentedSearch } from "../SegmentedSearch";
import { useSearchSuggestions } from "../../lib/search-suggestions";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { CatalogHeader } from "./CatalogHeader";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import dynamic from "next/dynamic";
import type { MapCompany } from "./CompaniesMap";

// Leaflet and its CSS load only when someone opens the map view.
const CompaniesMap = dynamic(() => import("./CompaniesMap").then(m => m.CompaniesMap), {
  ssr: false,
  loading: () => <div className="companies-map"><div className="companies-map__loading" role="status">რუკა იტვირთება…</div></div>,
});
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, categoryGroups, cities, currentCategory, groupNames } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import { fetchPhones } from "../../lib/phones";

type MappedCompany = {
  id: string;
  company?: string;
  name: string;
  logoUrl?: string | null;
  gallery?: string[];
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
  // "type" (suppliers/services/…) duplicated the industry facets and is no longer offered.
  const type = "", coverage = filters.get("coverage") === "national", sort = filters.get("sort", "newest");
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
  const suggestions = useSearchSuggestions("companies", query, "", results.map(result => result.id));
  const router = useRouter();

  const industryFacets: Facet[] = useMemo(
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, icon: g.icon, count: list({ industry: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ industry: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ industry: "" }).length : 0;

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
      gallery: c.gallery,
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
    ...(industry ? [{ key: "industry", label: categories[industry] || groupNames[industry] || industry }] : []),
    ...(city ? [{ key: "city", label: cities[city] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "industry") setIndustry("");
    else if (key === "city") setCity("");
    else filters.set({[key]: ""});
  };
  const clearFilters = () => filters.set({industry: "", city: "", verified: "", q: "", type: "", coverage: "", sort: ""});
  const filterCount = activeItems.length;
  const mapView = filters.get("view") === "map";
  const mapped: MapCompany[] = useMemo(() => rows.filter(c => c.lat != null && c.lng != null).map(c => ({ id: c.id, name: c.name, industry: c.industry, city: c.city, lat: c.lat as number, lng: c.lng as number })), [rows]);
  const unmapped = rows.filter(c => c.lat == null || c.lng == null);
  const viewSwitch = <div className="view-switch" role="group" aria-label="ხედი">
    <button type="button" aria-pressed={!mapView} onClick={() => filters.set({ view: "" })}><Icon name="layout-grid" />სია</button>
    <button type="button" aria-pressed={mapView} onClick={() => filters.set({ view: "map" })}><Icon name="map-pin" />რუკა</button>
  </div>;

  const countLabel = !available || !ready ? "" : `${rows.length} კომპანია`;

  // City lives in the search pill above; the sidebar holds what the pill does not.
  const filtersBody = (placement: "desktop" | "mobile") => (
    <div className="catalog-filters">
      {placement === "desktop" ? <div className="catalog-filters__head">
        <h2>ფილტრები{filterCount > 0 ? <span className="catalog-filters__count">{filterCount}</span> : null}</h2>
        {filterCount > 0 ? <button type="button" className="catalog-clear" onClick={clearFilters}>გასუფთავება</button> : null}
      </div> : null}
      <div className="catalog-filter-group">
        <h3 className="catalog-filter-title">დარგი</h3>
        <FacetList all={industryFacets} loading={!ready} allLabel="ყველა დარგი" allCount={allCount} activeId={industry} onSelect={setIndustry} />
      </div>
      <div className="catalog-filter-group">
        <label className="filter-switch">
          <span><strong>მთელი საქართველო</strong><small>კომპანიები, რომლებიც ყველა რეგიონს ემსახურებიან</small></span>
          <input type="checkbox" role="switch" checked={coverage} onChange={e => filters.set({ coverage: e.target.checked ? "national" : "" })} />
          <span className="filter-switch__track" aria-hidden="true" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="ma-page companies-catalog catalog-page">
      <CatalogHeader
        tone="light"
        center
        title="იპოვე მომწოდებელი"
        description="იპოვე სანდო პარტნიორი შენი ბიზნესისთვის."
        search={<form onSubmit={e => { e.preventDefault(); document.getElementById("company-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <SegmentedSearch framed id="company-query" label="კომპანიის ძიება" placeholder="სახელი ან მომსახურება"
            emptyHref={`/requests/new/?${new URLSearchParams({ title: query.trim(), city })}`}
            query={query} onQuery={setQuery} suggestions={suggestions}
            onSelect={item => item.kind === "category" ? filters.set({ industry: item.category, q: "" }) : router.push(item.href)}
            city={city} onCity={setCity} />
        </form>}
      />
      <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="კომპანიების ფილტრები">{filtersBody("desktop")}</aside>
        <section className="catalog-main" id="company-results" aria-label="კომპანიების სია">
          <ResultsBar count={countLabel} filterButton={<button type="button" className="ma-btn ma-btn--secondary catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი{filterCount > 0 ? ` · ${filterCount}` : ""}</button>}
            utility={<>{viewSwitch}{ready && store?.currentUser() ? <Link className="ma-btn ma-btn--ghost ma-btn--sm" href="/account/?tab=saved"><Icon name="bookmark" />შენახული</Link> : null}</>}
            items={activeItems} onRemove={removeFilter} onClear={clearFilters} sort={{value: sort, onChange: value => filters.set({sort: value}), options: [{value: "newest", label: "უახლესი"}, {value: "name", label: "სახელით"}]}}
          />
          <div className="company-directory-list">
            {!available ? (
              <ServiceUnavailable />
            ) : !ready ? (
              skeleton()
            ) : rows.length === 0 ? (
              <div className="catalog-empty">
                <span className="catalog-empty__icon"><DuoIcon name="search" size={34} /></span>
                <h2>{query ? `„${query}“ — ჯერ ვერავინ ვიპოვეთ` : "ამ პირობით კომპანია ჯერ არ გვყავს"}</h2>
                <p>აღწერე, რა გჭირდება — მოთხოვნას შესაბამისი კომპანიები ნახავენ და თავად დაგიკავშირდებიან.</p>
                <div className="catalog-empty__actions">
                  <Link className="ma-btn ma-btn--primary" href={`/requests/new/?${new URLSearchParams({ title: query, category: industry, city })}`}>გამოაქვეყნე მოთხოვნა</Link>
                  {filterCount > 0
                    ? <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters}>ფილტრების გასუფთავება</button>
                    : query ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setQuery("")}>ძიების გასუფთავება</button> : null}
                </div>
              </div>
            ) : mapView ? (
              <div className="companies-map-view">
                <CompaniesMap companies={mapped} />
                {unmapped.length ? <p className="companies-map__unmapped">რუკაზე არ ჩანს ({unmapped.length}), მისამართი არ აქვს მითითებული: {unmapped.map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link href={`/companies/view/?id=${encodeURIComponent(c.id)}`}>{c.name}</Link></span>)}</p> : null}
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
