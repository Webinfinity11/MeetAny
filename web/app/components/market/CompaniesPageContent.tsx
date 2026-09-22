"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { PageBand } from "./PageBand";
import { SectionHead } from "./SectionHead";
import { FacetList, type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { CompanyListingCard, type CompanyListingData } from "./CompanyListingCard";
import { DirectionPhotoCard } from "./DirectionPhotoCard";
import { PartnershipCTA } from "./PartnershipCTA";
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
  const industry = filters.get("industry"), city = filters.get("city"), query = filters.get("q"), verified = filters.get("verified") === "1";
  const type = filters.get("type");
  const setIndustry = (industry: string) => filters.set({industry});
  const setCity = (city: string) => filters.set({city});
  const setQuery = (q: string) => filters.set({q});
  const setVerified = (value: boolean) => filters.set({verified: value ? "1" : ""});
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useCallback(
    (overrides: Partial<{ industry: string; city: string; verified: boolean }>) =>
      (store?.listCompanies as (args: unknown) => MappedCompany[])?.({ industry, city, verified, type, q: query, ...overrides }) || [],
    [store, industry, city, verified, query, type],
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
    ...(verified ? [{ key: "verified", label: "დადასტურებული" }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "type") filters.set({type: ""});
    else if (key === "industry") setIndustry("");
    else if (key === "city") setCity("");
    else setVerified(false);
  };
  const clearFilters = () => filters.set({industry: "", city: "", verified: "", q: "", type: ""});
  const filterCount = Number(!!industry) + Number(!!city) + Number(verified);

  const countLabel = !available ? "" : !ready ? "კომპანიები იტვირთება…" : `${rows.length} კომპანია`;

  const filtersBody = (
    <div className="ma-proto-filters">
      <div>
        <h2 className="ma-title">დარგი</h2>
        <FacetList all={industryFacets} loading={!ready} allLabel={`ყველა დარგი${ready ? ` (${allCount})` : ""}`} activeId={industry} onSelect={setIndustry} />
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="company-city-desktop">
          ქალაქი
        </label>
        <select className="ma-select" id="company-city-desktop" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {cityOptions.map((id) => (
            <option key={id} value={id}>
              {cities[id]}
            </option>
          ))}
        </select>
      </div>
      <label className="ma-check">
        <input type="checkbox" role="switch" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        <span>მხოლოდ დადასტურებული</span>
      </label>
      <button type="button" className="ma-btn ma-btn--ghost" onClick={clearFilters}>
        ფილტრების გასუფთავება
      </button>
    </div>
  );

  return (
    <div className="ma-page">
      <PageBand
        eyebrow="MeetAny · საქმიანი კავშირები"
        title="კომპანიები"
        description="აღმოაჩინე პარტნიორი შენი ბიზნესისთვის."
        searchSlot={
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="company-query">
              კომპანიის ძიება
            </label>
            <input
              className="ma-input"
              id="company-query"
              type="search"
              placeholder="სახელი ან მომსახურება"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      />
      <div className="ma-proto-columns">
        <aside className="ma-proto-sidebar ma-panel" aria-label="კომპანიების ფილტრები">
          {filtersBody}
        </aside>
        <section className="ma-stack">
          <SectionHead eyebrow="კომპანიების კატალოგი" title="იპოვე შენი პარტნიორი" />
          <button type="button" className="ma-btn ma-btn--secondary ma-lg-down" ref={filterButtonRef} onClick={() => setSheetOpen(true)}>
            <Icon name="sliders-horizontal" />
            ფილტრი ({filterCount})
          </button>
          <ResultsBar items={activeItems} onRemove={removeFilter} onClear={clearFilters} countLabel={countLabel} />
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

      <section className="r2-section">
        <SectionHead eyebrow="აღმოაჩინე მეტი" title="მიმართულებები შენი ბიზნესისთვის" />
        <div className="r2-photo-grid">
          <DirectionPhotoCard title="ტექსტილი და სასტუმროები" imageSrc="/assets/photos/hotel-linen.jpg" href="/companies/?industry=textiles" />
          <DirectionPhotoCard title="შეფუთვა და წარმოება" imageSrc="/assets/photos/cardboard-packaging.jpg" href="/companies/?industry=packaging" />
          <DirectionPhotoCard title="საკვები და სასმელი" imageSrc="/assets/photos/fresh-produce.jpg" href="/companies/?industry=food" />
        </div>
      </section>

      <PartnershipCTA
        eyebrow="ადამიანები საქმიანი კავშირების მიღმა"
        title="დიდი საქმე კარგი პარტნიორის პოვნით იწყება."
        action={{ label: "მოთხოვნის დამატება", href: "/requests/new/" }}
        imageSrc="/assets/photos/workshop-process-banner.jpg"
      />

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
        {filtersBody}
      </MobileFilterSheet>
    </div>
  );
}
