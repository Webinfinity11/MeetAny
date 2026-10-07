"use client";
import { Button } from "../ui/Button";


import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { RequestRow, type RequestRowData } from "./RequestRow";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, categoryGroups, cities, currentCategory, groupNames } from "../../lib/categories";
import { FacetList, type Facet } from "./FacetList";
import { CatalogSearch } from "./CatalogSearch";
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
  // Old "ახალი" / "მალე იწურება" tab links map onto the default order and the expiring sort.
  const legacyTab = filters.get("tab");
  useEffect(() => {
    if (legacyTab !== "new" && legacyTab !== "expiring") return;
    const next = new URLSearchParams(window.location.search);
    next.delete("tab");
    if (legacyTab === "expiring") next.set("sort", "expiring");
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
      }) || [],
    [store, category, city, query],
  );

  const deadline = filters.get("deadline");
  const results = useMemo(() => (ready && available ? list({}).filter(r => {
    const days = store?.daysLeft(r) ?? 0;
    return deadline === "7" ? days <= 7 : deadline === "30" ? days <= 30 : deadline === "later" ? days > 30 : true;
  }) : []), [ready, available, list, store, deadline]);
  const categoryFacets: Facet[] = useMemo(
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, icon: g.icon, count: list({ category: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ category: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ category: "" }).length : 0;
  // Cities where work is needed; a request for all of Georgia counts in every city (store rule).
  const cityFacets: Facet[] = useMemo(
    () => Object.entries(cities).filter(([id]) => id !== "georgia").map(([id, label]) => ({ id, label, count: list({ city: id }).length })),
    [list],
  );


  const sorted = useMemo(() => {
    const arr = [...results];
    // Whole days tie often; the exact deadline breaks the tie so "ending soon" really is in order.
    const ends = (r: unknown) => Date.parse((r as { expiresAt?: string }).expiresAt ?? "") || Infinity;
    if (["expiring", "ending"].includes(sort) && store) arr.sort((a, b) => (store.daysLeft as (r: unknown) => number)(a) - (store.daysLeft as (r: unknown) => number)(b) || ends(a) - ends(b));
    return arr;
  }, [results, sort, store]);

  const rows: RequestRowData[] = useMemo(() => {
    if (!store) return [];
    const me = store.currentUser() as { id: string; role: string } | null;
    return sorted.map((r) => {
      const owner = (store.userById as (id: string) => { company?: string; name?: string } | null)(r.ownerId);
      const ownerName = owner?.company || owner?.name || "მომხმარებელი";
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
        state,
        daysLeft,
        isOwn,
        offerCount: store.offerCount(r.id),
        canOffer: !isOwn && (!me || me.role === "company") && state === "open",
        ownOfferStatus,
        showOwnOfferBadge: me?.role === "company" && !isOwn,
        posted: postedLabel(r.createdAt, now),
      };
    });
  }, [sorted, store, now]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const activeItems = [
    ...(deadline ? [{key: "deadline", label: deadline === "7" ? "7 დღემდე" : deadline === "30" ? "30 დღემდე" : "30 დღეზე მეტი"}] : []),
    ...(category ? [{key: "category", label: categories[category] || groupNames[category] || category}] : []),
    ...(city ? [{key: "city", label: cities[city] || city}] : []),
  ];
  const clearFilters = () => filters.set({city: "", category: "", deadline: ""});

  const filterCount = activeItems.length;
  // The desktop sidebar and mobile sheet share the same URL-backed filters.
  const requestFilters = (placement: "desktop" | "mobile") => <div className="catalog-filters">
    {placement === "desktop" ? <div className="catalog-filters__head">
      <h2>ფილტრები{filterCount > 0 ? <span className="catalog-filters__count">{filterCount}</span> : null}</h2>
    </div> : null}
    <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">კატეგორიები</h3>
      <FacetList all={categoryFacets} loading={!ready} allLabel="ყველა კატეგორია" allCount={allCount} activeId={category} onSelect={setCategory} />
    </div>
    <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">ადგილმდებარეობა</h3>
      <div className="catalog-location-checks">{cityFacets.map(f => <label className="catalog-check" key={f.id}>
        <input type="checkbox" checked={city === f.id} disabled={!f.count && city !== f.id} onChange={e => setCity(e.target.checked ? f.id : "")} />
        <span>{f.label}</span><small>{f.count}</small>
      </label>)}</div>
    </div>
    <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">ვადა</h3>
      {[["7", "7 დღემდე"], ["30", "30 დღემდე"], ["later", "30 დღეზე მეტი"]].map(([value, label]) => <label className="catalog-check" key={value}>
        <input type="checkbox" checked={deadline === value} onChange={e => filters.set({deadline: e.target.checked ? value : ""})} /><span>{label}</span>
      </label>)}
    </div>
  </div>;

  const countLabel = !available
    ? ""
    : !ready
      ? ""
      : `ნაპოვნია ${rows.length} შესაძლებლობა`;

  return (
    <div className="ma-page requests-catalog catalog-page request-board">
      <CatalogHeader
        title="ბიზნეს შესაძლებლობები"
        description="რეალური ბიზნეს მოთხოვნები — გაუგზავნე შეთავაზება იმათ, ვისაც შენი პროდუქტი სჭირდება."
        search={<form onSubmit={e => { e.preventDefault(); document.getElementById("request-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <CatalogSearch id="query" label="ძიება" placeholder="მოძებნე პროდუქტი, მომსახურება, კომპანია ან კატეგორია"
            value={query} onChange={setQuery} mode="requests" resultIds={results.map(r => r.id)}
            onCategory={value => filters.set({ category: value, q: "" })} />
        </form>}
      />
        <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="მოთხოვნების ფილტრები">{requestFilters("desktop")}</aside>
        <div className="catalog-main" id="request-results">
        <ResultsBar
            count={countLabel}
            items={activeItems}
            onRemove={key => filters.set({[key]: ""})}
            onClear={clearFilters}
            filterButton={<Button type="button" variant="secondary" className="catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრები{activeItems.length > 0 ? ` · ${activeItems.length}` : ""}</Button>}
            sort={{value: sort, onChange: setSort, options: [
              {value: "newest", label: "უახლესი"},
              {value: "expiring", label: "მალე იწურება"},
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
                        <Button type="button" variant="secondary" onClick={() => filters.set({city: "", category: "", q: "", deadline: ""})}>ყველა მოთხოვნის ნახვა</Button>
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
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={activeItems.length === 0}>გასუფთავება</Button>
          <Button type="button" variant="primary" onClick={() => setSheetOpen(false)}>ნახე {rows.length} მოთხოვნა</Button>
        </>}
      >
        {requestFilters("mobile")}
      </MobileFilterSheet>
      <RequestFormSheet open={formOpen} initialTitle={formTitle} initialCity={formCity} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
