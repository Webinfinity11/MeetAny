"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Structure";
import { Icon } from "../Icon";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { SkeletonGrid } from "./Skeletons";
import { ResultsBar } from "./ResultsBar";
import { CatalogSearch } from "./CatalogSearch";
import { CatalogHeader } from "./CatalogHeader";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import { CatalogFilters, majorCities } from "./catalog/CatalogFilters";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities, currentCategory, groupNames } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import type { MapCompany } from "./CompaniesMap";
import { matchesDistribution } from "../../lib/distribution-filter";
import { distributionChannels, type Distribution } from "../../lib/distribution";
import { useBusinessResource, useCompanyFeatures } from "../../lib/business-client";
import { BusinessError } from "./CompanyBusiness";
import styles from "./catalog/Catalog.module.css";

const CompaniesMap = dynamic(() => import("./CompaniesMap").then(m => m.CompaniesMap), {
  ssr: false,
  loading: () => <SkeletonGrid />,
});
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


export function CompaniesPageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const filters = useFilters("/companies/");
  const industry = currentCategory(filters.get("industry")), city = filters.get("city"), query = filters.get("q");
  const business = useCompanyFeatures(store, ready && available);
  const featureById = useMemo(() => new Map(business.data?.map(f => [f.id, f]) || []), [business.data]);
  const type = filters.get("type"), coverage = filters.get("coverage") === "national", sort = filters.get("sort", "recommended");
  const verified = filters.get("verified") === "1";
  const mapView = filters.get("view") === "map";
  const paid = filters.get("plan") === "paid";
  const distribution = useBusinessResource<Distribution[]>(ready && type === "distributors" ? store?.companyDistributionProfiles : undefined, "distribution");
  const distributionById = useMemo(() => new Map(distribution.data?.map(d => [d.id, d]) || []), [distribution.data]);
  const channels = filters.get("channels"), product = filters.get("product"), warehouse = filters.get("warehouse"), transport = filters.get("transport"), cold = filters.get("cold");
  // A chosen city means "serves it" (own city, service cities or all Georgia); "office" narrows to
  // companies based there, for when the buyer needs to visit in person.
  const office = !!city && city !== "georgia" && filters.get("office") === "1";
  const [sheetOpen, setSheetOpen] = useState(false);

  const list = useCallback(
    (overrides: Partial<{ industry: string; city: string }>) => {
      const where = overrides.city ?? city;
      return (store?.listCompanies as (args: unknown) => MappedCompany[])?.({ industry, city: city === "other" ? "" : city, verified, type: type === "distributors" ? "" : type, q: type === "distributors" ? "" : query, ...overrides })
        ?.filter(c => {
          if (type !== "distributors") return true;
          return matchesDistribution(c, distributionById.get(c.id), {query,product,channels,warehouse,transport,cold}, categories);
        })
        ?.filter(c => (city !== "other" || !majorCities.includes(c.city)) && (type !== "distributors" || featureById.get(c.id)?.distributor) && (!coverage || c.city === "georgia" || c.serviceCities?.includes("georgia")) && (!office || !where || c.city === where) && (!paid || !!featureById.get(c.id)?.plan)) || [];
    },
    [store, industry, city, verified, query, type, coverage, office, paid, featureById, distributionById, channels, product, warehouse, transport, cold],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);

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
      stats: store.companyStats(c.id),
    }));
  }, [results, store, sort, featureById]);

  const activeItems = [
    ...(verified ? [{ key: "verified", label: "ვერიფიცირებული" }] : []),
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
    ...(city ? [{ key: "city", label: city === "other" ? "სხვა" : office ? `ოფისი ${(cities[city] || city).replace(/ი$/, "")}ში` : cities[city] || city }] : []),
  ];
  const clearFilters = () => filters.set({industry: "", city: "", office: "", verified: "", q: "", type: "", coverage: "", plan: "", sort: "", channels: "", product: "", warehouse: "", transport: "", cold: ""});
  const setFilters = (values: Record<string, string>) => filters.set("city" in values ? { ...values, office: "" } : values);
  const count = (key: "category" | "city", value: string) =>
    (ready && available ? list(key === "category" ? { industry: value } : { city: value === "other" ? "" : value }) : [])
      .filter(c => key !== "city" || value !== "other" || !majorCities.includes(c.city)).length;
  const body = <CatalogFilters companies category={industry} city={city} verified={verified} count={count} onChange={setFilters} />;
  const mapped: MapCompany[] = rows.filter(c => c.lat != null && c.lng != null).map(c => ({ id: c.id, name: c.name, industry: c.industry, city: c.city, lat: c.lat!, lng: c.lng! }));
  const unmapped = rows.filter(c => c.lat == null || c.lng == null);
  return <div className={`ma-page companies-catalog catalog-page ${styles.page}`}>
    <CatalogHeader title="კომპანიები" description="კომპანიები და მომსახურება მთელი საქართველოდან." />
    <div className="catalog-workspace">
      <aside className="catalog-sidebar" aria-label="კომპანიების ფილტრები">{body}</aside>
      <section className="catalog-main" id="company-results" aria-label="კომპანიების სია">
        <div className={styles.toolbar}>
          <div className={styles.search}><CatalogSearch id="company-query" label="ძიება" placeholder="მოძებნე კომპანია ან მომსახურება" value={query} onChange={q => filters.set({ q })} mode="companies" resultIds={rows.map(c => c.id)} onCategory={industry => filters.set({ industry, q: "" })} /></div>
          <ResultsBar count={ready && available ? `ნაპოვნია ${rows.length} კომპანია` : ""} items={activeItems} onRemove={key => setFilters({ [key]: "" })} onClear={clearFilters}
            filterButton={<Button variant="secondary" className="catalog-filter-toggle" aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრები ({activeItems.length})</Button>}
            sort={{ value: sort, onChange: sort => filters.set({ sort }), options: [{ value: "recommended", label: "რეკომენდებული" }, { value: "newest", label: "უახლესი" }, { value: "active", label: "ყველაზე აქტიური" }] }}
            utility={<div className="view-switch" role="group" aria-label="ხედი"><Button variant="secondary" aria-pressed={!mapView} onClick={() => filters.set({ view: "" })}><Icon name="layout-grid" />ბადე</Button><Button variant="secondary" aria-pressed={mapView} onClick={() => filters.set({ view: "map" })}><Icon name="map-pin" />რუკა</Button></div>} />
        </div>
        <div className={styles.grid}>
          {!available ? <ServiceUnavailable /> : !ready ? <SkeletonGrid count={6} /> : type === "distributors" && (business.error || distribution.error) ? <BusinessError error={business.error || distribution.error!} retry={() => { business.reload(); distribution.reload(); }} /> : type === "distributors" && (business.loading || distribution.loading) ? <SkeletonGrid count={6} /> : !rows.length
            ? <EmptyState icon="search" title="ვერაფერი მოიძებნა" text="სცადე სხვა დარგი ან ქალაქი." action={<Button variant="secondary" onClick={clearFilters}>ფილტრების გასუფთავება</Button>} />
            : mapView ? <div className="companies-map-view"><CompaniesMap companies={mapped} />{unmapped.length > 0 && <p className="companies-map__unmapped">რუკაზე არ ჩანს ({unmapped.length}), მისამართი არ აქვს მითითებული: {unmapped.map((c, index) => <span key={c.id}>{index ? ", " : ""}<Link href={`/companies/view/?id=${encodeURIComponent(c.id)}`}>{c.name}</Link></span>)}</p>}</div>
            : rows.map(c => <CompanyListingCard key={c.id} catalog c={c} />)}
        </div>
      </section>
    </div>
    <MobileFilterSheet id="filters" title="ფილტრები" open={sheetOpen} onOpenChange={setSheetOpen} footer={<><Button variant="secondary" onClick={clearFilters} disabled={!activeItems.length && !query}>გასუფთავება</Button><Button onClick={() => setSheetOpen(false)}>{rows.length} შედეგის ნახვა</Button></>}>{body}</MobileFilterSheet>
  </div>;
}
