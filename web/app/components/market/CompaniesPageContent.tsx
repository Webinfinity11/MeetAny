"use client";
import { Button } from "../ui/Button";


import Link from "next/link";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";
import { CustomSelect } from "../ui/CustomSelect";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { CatalogSearch } from "./CatalogSearch";
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
import { matchesDistribution } from "../../lib/distribution-filter";
import { distributionChannels, type Distribution } from "../../lib/distribution";
import { useBusinessResource, useCompanyFeatures } from "../../lib/business-client";
import { BusinessError } from "./CompanyBusiness";
import { fetchPhones } from "../../lib/phones";
import { useSiteContent } from "../../lib/site-content";

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
  const content = useSiteContent();
  const { store, ready, available } = useMarketStore(initial);
  const filters = useFilters("/companies/");
  const industry = currentCategory(filters.get("industry")), city = filters.get("city"), query = filters.get("q");
  const business = useCompanyFeatures(store, ready && available);
  const featureById = useMemo(() => new Map(business.data?.map(f => [f.id, f]) || []), [business.data]);
  const type = filters.get("type"), coverage = filters.get("coverage") === "national", sort = filters.get("sort", "recommended");
  const paid = filters.get("plan") === "paid";
  const distribution = useBusinessResource<Distribution[]>(ready && type === "distributors" ? store?.companyDistributionProfiles : undefined, "distribution");
  const distributionById = useMemo(() => new Map(distribution.data?.map(d => [d.id, d]) || []), [distribution.data]);
  const channels = filters.get("channels"), product = filters.get("product"), warehouse = filters.get("warehouse"), transport = filters.get("transport"), cold = filters.get("cold");
  // A chosen city means "serves it" (own city, service cities or all Georgia); "office" narrows to
  // companies based there, for when the buyer needs to visit in person.
  const office = !!city && city !== "georgia" && filters.get("office") === "1";
  const setCity = (city: string) => filters.set(city ? { city } : { city, office: "" });
  const setIndustry = (industry: string) => filters.set({industry});
  const setQuery = (q: string) => filters.set({q});
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useCallback(
    (overrides: Partial<{ industry: string; city: string }>) => {
      const where = overrides.city ?? city;
      return (store?.listCompanies as (args: unknown) => MappedCompany[])?.({ industry, city, type: type === "distributors" ? "" : type, q: type === "distributors" ? "" : query, ...overrides })
        ?.filter(c => {
          if (type !== "distributors") return true;
          return matchesDistribution(c, distributionById.get(c.id), {query,product,channels,warehouse,transport,cold}, categories);
        })
        ?.filter(c => (type !== "distributors" || featureById.get(c.id)?.distributor) && (!coverage || c.city === "georgia" || c.serviceCities?.includes("georgia")) && (!office || !where || c.city === where) && (!paid || !!featureById.get(c.id)?.plan)) || [];
    },
    [store, industry, city, query, type, coverage, office, paid, featureById, distributionById, channels, product, warehouse, transport, cold],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);

  const industryFacets: Facet[] = useMemo(
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, icon: g.icon, count: list({ industry: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ industry: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ industry: "" }).length : 0;
  const cityFacets: Facet[] = useMemo(
    () => Object.entries(cities).filter(([id]) => id !== "georgia").map(([id, label]) => ({ id, label, count: list({ city: id }).length })),
    [list],
  );

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
    const stats = (c: MappedCompany) => store.companyStats(c.id) as { sent: number; chosen: number };
    // Recommended: verified first, then a complete profile (description, photos, services) and a
    // proven record (chosen offers weigh more than sent ones). Newest breaks ties.
    const score = (c: MappedCompany) => {
      const s = stats(c);
      return (c.verified ? 10 : 0) + (c.about ? 2 : 0) + (c.logoUrl || c.gallery?.length ? 2 : 0) + (c.offers?.length ? 1 : 0)
        + Math.min(s.sent, 10) * 0.5 + s.chosen * 2;
    };
    const newest = (a: MappedCompany, b: MappedCompany) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
    const planRank = (c: MappedCompany) => featureById.get(c.id)?.plan === "vip" ? 2 : featureById.get(c.id)?.plan === "premium" ? 1 : 0;
    const order = sort === "newest" ? newest
      : sort === "active" ? (a: MappedCompany, b: MappedCompany) => stats(b).chosen - stats(a).chosen || stats(b).sent - stats(a).sent || newest(a, b)
      : (a: MappedCompany, b: MappedCompany) => planRank(b) - planRank(a) || score(b) - score(a) || newest(a, b);
    return [...results].sort(order).map((c) => ({
      id: c.id,
      feature: featureById.get(c.id),
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
  }, [results, store, phones, sort, featureById]);

  const activeItems = [
    ...(type === "distributors" ? [
      ...(product ? [{key:"product",label:categories[product]||product}] : []),
      ...(channels ? [{key:"channels",label:channels.split(",").map(c=>distributionChannels[c]||c).join(", ")}] : []),
      ...(warehouse ? [{key:"warehouse",label:"საკუთარი საწყობი"}] : []),
      ...(transport ? [{key:"transport",label:"საკუთარი ტრანსპორტი"}] : []),
      ...(cold ? [{key:"cold",label:"გაცივებული მიწოდება"}] : []),
    ] : []),
    ...(type ? [{key:"type",label:({distributors:"დისტრიბუტორები",suppliers:"მომწოდებლები",services:"მომსახურება",partners:"პარტნიორები"} as Record<string,string>)[type] || type}] : []),
    ...(coverage ? [{key: "coverage", label: "მთელი საქართველო"}] : []),
    ...(paid ? [{key: "plan", label: "Premium და VIP"}] : []),
    ...(industry ? [{ key: "industry", label: categories[industry] || groupNames[industry] || industry }] : []),
    ...(city ? [{ key: "city", label: office ? `ოფისი ${cities[city].replace(/ი$/, "")}ში` : cities[city] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "industry") setIndustry("");
    else if (key === "city") setCity("");
    else filters.set({[key]: ""});
  };
  const clearFilters = () => filters.set({industry: "", city: "", office: "", verified: "", q: "", type: "", coverage: "", plan: "", sort: "", channels:"", product:"", warehouse:"", transport:"", cold:""});
  const filterCount = activeItems.length;
  const mapView = filters.get("view") === "map";
  const mapped: MapCompany[] = useMemo(() => rows.filter(c => c.lat != null && c.lng != null).map(c => ({ id: c.id, name: c.name, industry: c.industry, city: c.city, lat: c.lat as number, lng: c.lng as number })), [rows]);
  const unmapped = rows.filter(c => c.lat == null || c.lng == null);
  const viewSwitch = <div className="view-switch" role="group" aria-label="ხედი">
    <button type="button" aria-pressed={!mapView} onClick={() => filters.set({ view: "" })}><Icon name="layout-grid" />ბადე</button>
    <button type="button" aria-pressed={mapView} onClick={() => filters.set({ view: "map" })}><Icon name="map-pin" />რუკა</button>
  </div>;

  const countLabel = !available || !ready ? "" : `ნაპოვნია ${rows.length} კომპანია`;

  // All location controls use the same URL-backed city selection.
  const filtersBody = (placement: "desktop" | "mobile") => (
    <div className="catalog-filters">
      {placement === "desktop" ? <div className="catalog-filters__head">
        <h2>ფილტრები{filterCount > 0 ? <span className="catalog-filters__count">{filterCount}</span> : null}</h2>
      </div> : null}
      <div className="catalog-filter-group"><label className="catalog-filter-title" htmlFor={`${placement}-type`}>კომპანიის ტიპი</label><CustomSelect id={`${placement}-type`} className="ma-select" value={type} onChange={e=>filters.set({type:e.target.value})}><option value="">ყველა კომპანია</option><option value="suppliers">მომწოდებლები</option><option value="services">მომსახურება</option><option value="distributors">დისტრიბუტორები</option><option value="partners">პარტნიორის მაძიებლები</option></CustomSelect></div>
      {type === "distributors" ? <div className="catalog-filter-group">
        <label className="catalog-filter-title" htmlFor={`${placement}-product`}>პროდუქტის კატეგორია</label>
        <CustomSelect className="ma-select" id={`${placement}-product`} value={product} onChange={e=>filters.set({product:e.target.value})}><option value="">ყველა პროდუქტი</option>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</CustomSelect>
        <fieldset className="report-reasons"><legend className="catalog-filter-title">გაყიდვის არხები</legend>{Object.entries(distributionChannels).map(([key,label])=><label className="ma-check" key={key}><input type="checkbox" checked={channels.split(",").includes(key)} onChange={e=>filters.set({channels:(e.target.checked?[...channels.split(",").filter(Boolean),key]:channels.split(",").filter(v=>v!==key)).join(",")})}/>{label}</label>)}</fieldset>
        {[["warehouse","საკუთარი საწყობი",warehouse],["transport","საკუთარი ტრანსპორტი",transport],["cold","გაცივებული / გაყინული მიწოდება",cold]].map(([key,label,value])=><label className="ma-check" key={key}><input type="checkbox" checked={!!value} onChange={e=>filters.set({[key]:e.target.checked?"1":""})}/>{label}</label>)}
      </div> : null}
      <div className="catalog-filter-group">
        <h3 className="catalog-filter-title">დარგი</h3>
        <FacetList all={industryFacets} loading={!ready} allLabel="ყველა დარგი" allCount={allCount} activeId={industry} onSelect={setIndustry} />
      </div>
      <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">ადგილმდებარეობა</h3>
      <div className="catalog-location-checks">{cityFacets.map(f => <label className="catalog-check" key={f.id}>
        <input type="checkbox" checked={city === f.id} disabled={!f.count && city !== f.id} onChange={e => setCity(e.target.checked ? f.id : "")} />
        <span>{f.label}</span><small>{f.count}</small>
      </label>)}</div>
        {city && city !== "georgia" && Object.hasOwn(cities, city) ? <label className="filter-switch filter-switch--nested">
          <span><strong>ოფისი {cities[city].replace(/ი$/, "")}ში</strong><small>მხოლოდ ამ ქალაქში მდებარე კომპანიები</small></span>
          <input type="checkbox" role="switch" checked={office} onChange={e => filters.set({ office: e.target.checked ? "1" : "" })} />
          <span className="filter-switch__track" aria-hidden="true" />
        </label> : null}
      </div>
      <div className="catalog-filter-group">
        <label className="filter-switch">
          <span><strong>მთელი საქართველო</strong><small>კომპანიები, რომლებიც ყველა რეგიონს ემსახურებიან</small></span>
          <input type="checkbox" role="switch" checked={coverage} onChange={e => filters.set({ coverage: e.target.checked ? "national" : "" })} />
          <span className="filter-switch__track" aria-hidden="true" />
        </label>
        <label className="filter-switch">
          <span><strong>Premium და VIP</strong></span>
          <input type="checkbox" role="switch" checked={paid} onChange={e => filters.set({ plan: e.target.checked ? "paid" : "" })} />
          <span className="filter-switch__track" aria-hidden="true" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="ma-page companies-catalog catalog-page">
      <CatalogHeader
        title="კომპანიები"
        description={content.businessSubtitle || "კომპანიები და მომსახურება მთელი საქართველოდან."}
        search={<form onSubmit={e => { e.preventDefault(); document.getElementById("company-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <CatalogSearch id="company-query" label="ძიება" placeholder="მოძებნე პროდუქტი, მომსახურება, კომპანია ან კატეგორია"
            value={query} onChange={setQuery} mode="companies" resultIds={results.map(r => r.id)}
            onCategory={value => filters.set({ industry: value, q: "" })} />
        </form>}
      />
      <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="კომპანიების ფილტრები">{filtersBody("desktop")}</aside>
        <section className="catalog-main" id="company-results" aria-label="კომპანიების სია">
          <ResultsBar count={countLabel} filterButton={<Button type="button" variant="secondary" className="catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრები{filterCount > 0 ? ` · ${filterCount}` : ""}</Button>}
            utility={<>{viewSwitch}{ready && store?.currentUser() ? <Button variant="ghost" size="sm" className="catalog-saved-toggle" aria-label="შენახული კომპანიების ნახვა" href="/account/?tab=saved"><Icon name="bookmark" />შენახული</Button> : null}</>}
            items={activeItems} onRemove={removeFilter} onClear={clearFilters} sort={{value: sort, onChange: value => filters.set({sort: value}), options: [{value: "recommended", label: "რეკომენდებული"}, {value: "active", label: "ყველაზე აქტიური"}, {value: "newest", label: "უახლესი"}]}}
          />
          <div className="company-directory-list">
            {!available ? (
              <ServiceUnavailable />
            ) : !ready ? (
              skeleton()
            ) : type === "distributors" && (business.error || distribution.error) ? (<BusinessError error={business.error || distribution.error!} retry={()=>{business.reload();distribution.reload();}}/>) : type === "distributors" && (business.loading || distribution.loading) ? (skeleton()) : rows.length === 0 ? (
              <div className="catalog-empty">
                <span className="catalog-empty__icon"><DuoIcon name="search" size={34} /></span>
                <h2>{query ? `„${query}“ — ჯერ ვერავინ ვიპოვეთ` : "ამ პირობით კომპანია ჯერ არ გვყავს"}</h2>
                <p>აღწერე, რა გჭირდება — მოთხოვნას შესაბამისი კომპანიები ნახავენ და თავად დაგიკავშირდებიან.</p>
                <div className="catalog-empty__actions">
                  <Button variant="primary" href={`/requests/new/?${new URLSearchParams({ title: query || (type === "distributors" ? "ვეძებ დისტრიბუტორს" : ""), category: product || industry, city })}`}>გამოაქვეყნე მოთხოვნა</Button>
                  {filterCount > 0
                    ? <Button type="button" variant="secondary" onClick={clearFilters}>ფილტრების გასუფთავება</Button>
                    : query ? <Button type="button" variant="secondary" onClick={() => setQuery("")}>ძიების გასუფთავება</Button> : null}
                </div>
              </div>
            ) : mapView ? (
              <div className="companies-map-view">
                <CompaniesMap companies={mapped} />
                {unmapped.length ? <p className="companies-map__unmapped">რუკაზე არ ჩანს ({unmapped.length}), მისამართი არ აქვს მითითებული: {unmapped.map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link href={`/companies/view/?id=${encodeURIComponent(c.id)}`}>{c.name}</Link></span>)}</p> : null}
              </div>
            ) : (
              rows.map((c, index) => <CompanyListingCard catalog key={c.id} c={c} entranceIndex={index} />)
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
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={filterCount === 0}>გასუფთავება</Button>
          <Button type="button" variant="primary" onClick={() => setSheetOpen(false)}>ნახე {rows.length} კომპანია</Button>
        </>}
      >
        {filtersBody("mobile")}
      </MobileFilterSheet>
    </div>
  );
}
