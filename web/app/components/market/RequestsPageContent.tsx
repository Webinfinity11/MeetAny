"use client";

import Link from "next/link";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { type Facet } from "./FacetList";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { RequestRow, type RequestRowData } from "./RequestRow";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { useFilters } from "../../lib/use-filters";
import { RequestFormSheet } from "./RequestFormSheet";

type MappedRequest = {
  id: string;
  title: string;
  category: string;
  city: string;
  ownerId: string;
  createdAt: string;
  photo: string | null;
};

function skeleton() {
  return (
    <div className="ma-stack" aria-busy="true" aria-label="მონაცემები იტვირთება">
      <p role="status">იტვირთება…</p>
      {[0, 1, 2].map((i) => (
        <div className="ma-card ma-stack" key={i}>
          <span className="ma-skel ma-skel--title" />
          <span className="ma-skel ma-skel--line" />
          <span className="ma-skel ma-skel--line ma-skel--w60" />
        </div>
      ))}
    </div>
  );
}

export function RequestsPageContent({ autoOpenNew = false }: { autoOpenNew?: boolean }) {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const filters = useFilters("/requests/");
  const city = filters.get("city"), category = filters.get("category"), query = filters.get("q"), sort = filters.get("sort", "newest");
  const period = filters.get("period"), unanswered = filters.get("unanswered") === "1", withPhoto = filters.get("photo") === "1", urgent = filters.get("urgent") === "1";
  const setCity = (city: string) => filters.set({city});
  const setCategory = (category: string) => filters.set({category});
  const setQuery = (q: string) => filters.set({q});
  const setSort = (sort: string) => filters.set({sort});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(autoOpenNew);
  const formCategory = searchParams.get("category") || "";
  const filterButtonRef = useRef<HTMLButtonElement>(null);

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

  const sorted = useMemo(() => {
    const arr = [...results];
    if (["expiring", "ending"].includes(sort) && store) arr.sort((a, b) => (store.daysLeft as (r: unknown) => number)(a) - (store.daysLeft as (r: unknown) => number)(b));
    if (sort === "few" && store) arr.sort((a,b) => store.offerCount(a.id) - store.offerCount(b.id));
    return arr;
  }, [results, sort, store]);

  const categoryFacets: Facet[] = useMemo(
    () => Object.entries(categories).map(([id, label]) => ({ id, label, count: list({ category: id }).length })),
    [list],
  );
  const cityFacets: Facet[] = useMemo(
    () => Object.entries(cities).map(([id, label]) => ({ id, label, count: list({ city: id }).length })),
    [list],
  );

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
        id: r.id,
        title: r.title,
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
      };
    });
  }, [sorted, store]);

  const activeItems = [
    ...(["1", "7"].includes(period) ? [{key: "period", label: period === "1" ? "ბოლო 24 საათი" : "ბოლო 7 დღე"}] : []),
    ...(unanswered ? [{key: "unanswered", label: "პასუხის გარეშე"}] : []),
    ...(withPhoto ? [{key: "photo", label: "ფოტოთი"}] : []),
    ...(urgent ? [{key: "urgent", label: "ვადა: 3 დღემდე"}] : []),
    ...(city ? [{ key: "city", label: cities[city] }] : []),
    ...(category ? [{ key: "category", label: categories[category] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "city") setCity("");
    else filters.set({[key]: ""});
  };
  const clearFilters = () => filters.set({city: "", category: "", q: "", sort: "", period: "", unanswered: "", photo: "", urgent: ""});

  const filterCount = activeItems.length;
  const countLabel = !available
    ? ""
    : !ready
      ? "მოთხოვნები იტვირთება…"
      : `${rows.length} ღია მოთხოვნა`;

  const filtersBody = (placement: "desktop" | "mobile") => (
    <div className="ma-proto-filters">
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="request-category">კატეგორია</label>
        <select className="ma-select" id="request-category" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">ყველა კატეგორია</option>
          {categoryFacets.map(f => <option key={f.id} value={f.id}>{f.label}{ready ? ` (${f.count})` : ""}</option>)}
        </select>
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor={`city-${placement}`}>
          სად არის საჭირო
        </label>
        <select className="ma-select" id={`city-${placement}`} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {cityFacets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}{ready ? ` (${f.count})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="ma-field filter-section">
        <label className="ma-field__label" htmlFor={`period-${placement}`}>გამოქვეყნების დრო</label>
        <select className="ma-select" id={`period-${placement}`} value={period} onChange={e => filters.set({period: e.target.value})}>
          <option value="">ნებისმიერ დროს</option><option value="1">ბოლო 24 საათი</option><option value="7">ბოლო 7 დღე</option>
        </select>
      </div>
      <fieldset className="filter-section filter-options"><legend>დამატებითი პირობები</legend>
        <label className="ma-check"><input type="checkbox" checked={unanswered} onChange={e => filters.set({unanswered: e.target.checked ? "1" : ""})} /><span>ჯერ არ აქვს შეთავაზება</span></label>
        <label className="ma-check"><input type="checkbox" checked={urgent} onChange={e => filters.set({urgent: e.target.checked ? "1" : ""})} /><span>ვადა იწურება 3 დღეში</span></label>
        <label className="ma-check"><input type="checkbox" checked={withPhoto} onChange={e => filters.set({photo: e.target.checked ? "1" : ""})} /><span>მხოლოდ ფოტოთი</span></label>
      </fieldset>
      <button type="button" className="ma-btn ma-btn--ghost filter-reset" onClick={clearFilters}>
        ფილტრების გასუფთავება
      </button>
    </div>
  );

  return (
    <div className="ma-page requests-catalog">
      <header className="requests-intro">
        <h1 className="ma-h1">მოთხოვნები</h1>
        {ready && store?.currentUser()?.role === "company" ? <Link className="ma-btn ma-btn--ghost" href="/account/?tab=notifications"><Icon name="bell"/>შეტყობინებების მართვა</Link> : null}
      </header>
      <div className="request-search-toolbar">
        <CatalogSearch id="query" label="მოთხოვნის ძიება" placeholder="მოძებნე მოთხოვნა…" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="requests" onCategory={category => filters.set({category, q: ""})} />
        <button type="button" className="ma-btn ma-btn--secondary" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <Icon name="sliders-horizontal" />ფილტრები{filterCount > 0 ? ` (${filterCount})` : ""}
        </button>
      </div>
      <div className="request-catalog-results">
        <section className="ma-stack" aria-label="მოთხოვნების სია">
          <ResultsBar
            items={activeItems}
            onRemove={removeFilter}
            onClear={clearFilters}
            countLabel={countLabel}
            sort={{
              value: sort,
              onChange: setSort,
              options: [
                { value: "newest", label: "უახლესი" },
                { value: "expiring", label: "მალე იწურება" },
                { value: "few", label: "ნაკლები პასუხი" },
              ],
            }}
          />
          <div className="request-card-grid">
            {!available
              ? (
                  <ServiceUnavailable />
                )
              : !ready
                ? skeleton()
                : rows.length === 0
                  ? (
                      <div className="ma-empty">
                        <span className="ma-empty__icon">
                          <Icon name="search" />
                        </span>
                        <h2 className="ma-empty__title">ამ ფილტრით მოთხოვნა ვერ მოიძებნა</h2>
                        <p className="ma-empty__text">შეცვალე ან გაასუფთავე ფილტრები.</p>
                        <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters}>
                          საწყის ხედზე დაბრუნება
                        </button>
                      </div>
                    )
                  : rows.map((r) => <RequestRow key={r.id} r={r} />)}
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
            {rows.length} მოთხოვნის ჩვენება
          </button>
        }
      >
        {filtersBody("mobile")}
      </MobileFilterSheet>

      <RequestFormSheet open={formOpen} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
