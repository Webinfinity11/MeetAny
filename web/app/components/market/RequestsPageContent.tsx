"use client";

import { CustomSelect } from "../ui/CustomSelect";
import Link from "next/link";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { RequestRow, type RequestRowData } from "./RequestRow";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, categoryGroups, cities, currentCategory, groupNames } from "../../lib/categories";
import { FacetList, type Facet } from "./FacetList";
import { CatalogHeader } from "./CatalogHeader";
import { useFilters } from "../../lib/use-filters";
import { postedLabel } from "../../lib/format";
import { RequestFormSheet } from "./RequestFormSheet";

type MappedRequest = {
  id: string;
  title: string;
  body?: string;
  category: string;
  city: string;
  ownerId: string;
  createdAt: string;
  photo: string | null;
};

function skeleton() {
  return (
    <div className="catalog-skeleton" aria-busy="true" aria-label="მოთხოვნები იტვირთება">
      {[0, 1, 2, 3].map((i) => (
        <div className="catalog-skeleton__card" key={i}>
          <span className="ma-skel catalog-skeleton__meta" />
          <span className="ma-skel catalog-skeleton__title" />
          <span className="ma-skel catalog-skeleton__line" />
          <span className="ma-skel catalog-skeleton__line catalog-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}

export function RequestsPageContent({ autoOpenNew = false, initial }: { autoOpenNew?: boolean; initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const filters = useFilters("/requests/");
  const city = filters.get("city"), category = currentCategory(filters.get("category")), query = filters.get("q"), sort = filters.get("sort", "newest");
  const period = filters.get("period"), unanswered = filters.get("unanswered") === "1", withPhoto = filters.get("photo") === "1", urgent = filters.get("urgent") === "1";
  const setCity = (city: string) => filters.set({city});
  const setCategory = (category: string) => filters.set({category});
  const setQuery = (q: string) => filters.set({q});
  const setSort = (sort: string) => filters.set({sort});
  const [now, setNow] = useState(0);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  // The old "ახალი" / "მალე იწურება" tabs duplicated the period and urgency filters; old links map onto them.
  const legacyTab = filters.get("tab");
  useEffect(() => {
    if (legacyTab !== "new" && legacyTab !== "expiring") return;
    const next = new URLSearchParams(window.location.search);
    next.delete("tab");
    next.set(legacyTab === "new" ? "period" : "urgent", "1");
    window.history.replaceState(window.history.state, "", `/requests/?${next.toString()}`);
  }, [legacyTab]);
  const [formOpen, setFormOpen] = useState(autoOpenNew);
  const formCategory = searchParams.get("category") || "";
  const formTitle = searchParams.get("title") || "";
  const formCity = searchParams.get("city") || "";

  useEffect(() => {
    if (!autoOpenNew) return;
    // /requests/new/ opens the form once over the list, then the address becomes the list URL —
    // preserves the published /requests/new/ entry point.
    window.history.replaceState(window.history.state, "", "/requests/" + window.location.search);
  }, [autoOpenNew]);

  const list = useCallback(
    (overrides: Partial<{ category: string; city: string; q: string }>) =>
      (store?.listRequests as (args: unknown) => MappedRequest[])?.({
        category,
        city,
        q: query,
        state: "open",
        ...overrides,
      })?.filter(r => (!unanswered || store?.offerCount(r.id) === 0) && (!withPhoto || !!r.photo) && (!urgent || store?.daysLeft(r) <= 3) && (!period || !["1", "7"].includes(period) || Date.now() - Date.parse(r.createdAt) <= Number(period) * 86400000)) || [],
    [store, category, city, query, period, unanswered, withPhoto, urgent],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);
  const categoryFacets: Facet[] = useMemo(
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, icon: g.icon, count: list({ category: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ category: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ category: "" }).length : 0;

  const cityCounts = useMemo(() => Object.fromEntries(Object.keys(cities).map(id => [id, list({ city: id }).length])), [list]);

  const sorted = useMemo(() => {
    const arr = [...results];
    if (["expiring", "ending"].includes(sort) && store) arr.sort((a, b) => (store.daysLeft as (r: unknown) => number)(a) - (store.daysLeft as (r: unknown) => number)(b));
    if (sort === "few" && store) arr.sort((a,b) => store.offerCount(a.id) - store.offerCount(b.id));
    return arr;
  }, [results, sort, store]);

  const rows: RequestRowData[] = useMemo(() => {
    if (!store) return [];
    const me = store.currentUser() as { id: string; role: string } | null;
    return sorted.map((r) => {
      const owner = (store.userById as (id: string) => { company?: string; name?: string } | null)(r.ownerId);
      const ownerName = owner?.company || owner?.name || "მომხმარებელი";
      const offerCount = (store.offerCount as (id: string) => number)(r.id);
      const state = (store.requestState as (r: unknown) => RequestRowData["state"])(r);
      const daysLeft = (store.daysLeft as (r: unknown) => number)(r);
      const isOwn = !!me && r.ownerId === me.id;
      let ownOfferStatus: string | null | undefined;
      if (me?.role === "company") {
        const mine = (store.myOffers as (u: unknown) => { requestId: string; status: string }[])(me);
        ownOfferStatus = mine.find((o) => o.requestId === r.id)?.status;
      }
      const full = r as unknown as {
        photo: string | null;
        quantity: number | null;
        unit: string | null;
        neededBy: string | null;
      };
      return {
        isNew: now - Date.parse(r.createdAt) >= 0 && now - Date.parse(r.createdAt) < 86400000,
        id: r.id,
        title: r.title,
        body: r.body,
        category: r.category,
        city: r.city,
        cityLabel: cities[r.city] || r.city,
        photo: full.photo,
        quantity: full.quantity,
        unit: full.unit,
        neededBy: full.neededBy,
        ownerName,
        offerCount,
        state,
        daysLeft,
        isOwn,
        ownOfferStatus,
        showOwnOfferBadge: me?.role === "company" && !isOwn,
        posted: postedLabel(r.createdAt, now),
      };
    });
  }, [sorted, store, now]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const activeItems = [
    ...(category ? [{key: "category", label: categories[category] || groupNames[category] || category}] : []),
    ...(city ? [{key: "city", label: cities[city] || city}] : []),
    ...(period ? [{key: "period", label: period === "1" ? "ბოლო 24 საათი" : "ბოლო 7 დღე"}] : []),
    ...(unanswered ? [{key: "unanswered", label: "უპასუხო"}] : []),
    ...(withPhoto ? [{key: "photo", label: "ფოტოთი"}] : []),
    ...(urgent ? [{key: "urgent", label: "სასწრაფო"}] : []),
  ];
  const clearFilters = () => filters.set({city: "", category: "", period: "", unanswered: "", photo: "", urgent: ""});

  const requestFilters = (placement: "desktop" | "mobile") => <div className="catalog-filters">
    <div className="catalog-filter-group">
      <h2 className="catalog-filter-title">კატეგორია</h2>
      <FacetList all={categoryFacets} loading={!ready} allLabel="ყველა კატეგორია" allCount={allCount} activeId={category} onSelect={setCategory} />
    </div>
    <div className="ma-field catalog-filter-group">
      <label className="catalog-filter-title" htmlFor={`request-city-${placement}`}>ქალაქი</label>
      <CustomSelect className="ma-select" id={`request-city-${placement}`} value={city} onChange={e => setCity(e.target.value)}>
        <option value="">ყველა ქალაქი</option>
        {Object.entries(cities).map(([value, text]) => <option key={value} value={value}>{text} ({cityCounts[value]})</option>)}
      </CustomSelect>
    </div>
    <div className="ma-field catalog-filter-group">
      <label className="catalog-filter-title" htmlFor={`request-period-${placement}`}>გამოქვეყნდა</label>
      <CustomSelect className="ma-select" id={`request-period-${placement}`} value={period} onChange={e => filters.set({period: e.target.value})}>
        <option value="">ნებისმიერ დროს</option><option value="1">ბოლო 24 საათში</option><option value="7">ბოლო 7 დღეში</option>
      </CustomSelect>
    </div>
    <fieldset className="catalog-filter-group catalog-filter-checks">
      <legend className="catalog-filter-title">დამატებით</legend>
      <label className="ma-check"><input type="checkbox" checked={unanswered} onChange={e => filters.set({unanswered: e.target.checked ? "1" : ""})} /><span>ჯერ არ აქვს შეთავაზება</span></label>
      <label className="ma-check"><input type="checkbox" checked={urgent} onChange={e => filters.set({urgent: e.target.checked ? "1" : ""})} /><span>ვადა იწურება 3 დღეში</span></label>
      <label className="ma-check"><input type="checkbox" checked={withPhoto} onChange={e => filters.set({photo: e.target.checked ? "1" : ""})} /><span>მხოლოდ ფოტოთი</span></label>
    </fieldset>
  </div>;

  const countLabel = !available
    ? ""
    : !ready
      ? ""
      : `${rows.length} ღია მოთხოვნა`;

  return (
    <div className="ma-page requests-catalog catalog-page request-board">
      <CatalogHeader
        overline="ბიზნესები ეძებენ"
        title="ღია მოთხოვნები"
        description="ნახე, რა სჭირდებათ სხვა ბიზნესებს, და გაუგზავნე შეთავაზება."
        search={<CatalogSearch id="query" label="მოთხოვნის ძიება" placeholder="მაგ. ავეჯი, შეფუთვა, გადაზიდვა" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="requests" onCategory={category => filters.set({category, q: ""})} />}
        help={<>მომწოდებელს ეძებ? <Link href="/requests/new/">დაამატე მოთხოვნა</Link></>}
      />
        <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="მოთხოვნების ფილტრები">{requestFilters("desktop")}</aside>
        <div className="catalog-main">
        <ResultsBar
            count={countLabel}
            utility={ready && store?.currentUser()?.role === "company" ? <Link className="ma-btn ma-btn--ghost ma-btn--sm" href="/account/?tab=notifications"><Icon name="bell"/>შეტყობინებები</Link> : null}
            items={activeItems}
            onRemove={key => filters.set({[key]: ""})}
            onClear={clearFilters}
            filterButton={<button type="button" className="ma-btn ma-btn--secondary catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი{activeItems.length > 0 ? ` · ${activeItems.length}` : ""}</button>}
            sort={{value: sort, onChange: setSort, options: [
              {value: "newest", label: "უახლესი"},
              {value: "expiring", label: "მალე იწურება"},
              {value: "few", label: "ნაკლები პასუხი"},
            ]}}
          />
      <section aria-label="მოთხოვნების სია">
          <div className="request-card-grid">
            {!available
              ? (
                  <ServiceUnavailable />
                )
              : !ready
                ? skeleton()
                : rows.length === 0
                  ? (
                      <div className="catalog-empty">
                        <span className="catalog-empty__icon"><DuoIcon name="search" size={34} /></span>
                        <h2>ასეთი მოთხოვნა ჯერ არ გამოქვეყნებულა</h2>
                        <p>სცადე სხვა კატეგორია ან ქალაქი. ახალი მოთხოვნები ყოველდღე ემატება — შეტყობინებებს ანგარიშში მიიღებ.</p>
                        <button type="button" className="ma-btn ma-btn--secondary" onClick={() => filters.set({city: "", category: "", q: "", period: "", unanswered: "", photo: "", urgent: ""})}>ყველა მოთხოვნის ნახვა</button>
                      </div>
                    )
                  : <>
                      {rows.map((r, index) => <RequestRow entranceIndex={index} key={r.id} r={r} priority={index < 4} />)}
                    </>}
          </div>
        </section>
      </div></div>
      <MobileFilterSheet
        id="filters"
        title="ფილტრები"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        triggerRef={filterButtonRef}
        footer={<>
          <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters} disabled={activeItems.length === 0}>გასუფთავება</button>
          <button type="button" className="ma-btn ma-btn--primary" onClick={() => setSheetOpen(false)}>ნახე {rows.length} მოთხოვნა</button>
        </>}
      >
        {requestFilters("mobile")}
      </MobileFilterSheet>
      <RequestFormSheet open={formOpen} initialTitle={formTitle} initialCity={formCity} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
