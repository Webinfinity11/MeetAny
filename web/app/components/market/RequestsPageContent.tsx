"use client";

import Link from "next/link";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SegmentedSearch } from "../SegmentedSearch";
import { useSearchSuggestions } from "../../lib/search-suggestions";
import { useRouter } from "next/navigation";
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
  // Filters kept only where they change a decision: category, city (search pill) and "no offers yet".
  const unanswered = filters.get("unanswered") === "1";
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
      })?.filter(r => !unanswered || store?.offerCount(r.id) === 0) || [],
    [store, category, city, query, unanswered],
  );

  const results = useMemo(() => (ready && available ? list({}) : []), [ready, available, list]);
  const suggestions = useSearchSuggestions("requests", query, "", results.map(result => result.id));
  const router = useRouter();
  const categoryFacets: Facet[] = useMemo(
    () => categoryGroups.map(g => ({
      id: g.id, label: g.short, icon: g.icon, count: list({ category: g.id }).length,
      children: g.items.length > 1 ? g.items.map(([id, label]) => ({ id, label, count: list({ category: id }).length })) : undefined,
    })),
    [list],
  );
  const allCount = ready && available ? list({ category: "" }).length : 0;


  const sorted = useMemo(() => {
    const arr = [...results];
    if (["expiring", "ending"].includes(sort) && store) arr.sort((a, b) => (store.daysLeft as (r: unknown) => number)(a) - (store.daysLeft as (r: unknown) => number)(b));
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
    ...(unanswered ? [{key: "unanswered", label: "უპასუხო"}] : []),
  ];
  const clearFilters = () => filters.set({city: "", category: "", unanswered: ""});

  const filterCount = activeItems.length;
  const toggle = (label: string, hint: string, checked: boolean, key: string) => <label className="filter-switch">
    <span><strong>{label}</strong><small>{hint}</small></span>
    <input type="checkbox" role="switch" checked={checked} onChange={e => filters.set({ [key]: e.target.checked ? "1" : "" })} />
    <span className="filter-switch__track" aria-hidden="true" />
  </label>;
  // Same panel as the companies catalog; the city lives in the search pill.
  const requestFilters = (placement: "desktop" | "mobile") => <div className="catalog-filters">
    {placement === "desktop" ? <div className="catalog-filters__head">
      <h2>ფილტრები{filterCount > 0 ? <span className="catalog-filters__count">{filterCount}</span> : null}</h2>
      {filterCount > 0 ? <button type="button" className="catalog-clear" onClick={clearFilters}>გასუფთავება</button> : null}
    </div> : null}
    <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">კატეგორია</h3>
      <FacetList all={categoryFacets} loading={!ready} allLabel="ყველა კატეგორია" allCount={allCount} activeId={category} onSelect={setCategory} />
    </div>
    <div className="catalog-filter-group">
      {toggle("შეთავაზების გარეშე", "ჯერ არავის უპასუხია — პირველი იყავი", unanswered, "unanswered")}
    </div>
  </div>;

  const countLabel = !available
    ? ""
    : !ready
      ? ""
      : `${rows.length} ღია მოთხოვნა`;

  return (
    <div className="ma-page requests-catalog catalog-page request-board">
      <CatalogHeader
        center
        overline="ბიზნესები ეძებენ"
        title="ღია მოთხოვნები"
        description="ნახე, რა სჭირდებათ სხვა ბიზნესებს, და გაუგზავნე შეთავაზება."
        search={<form onSubmit={e => { e.preventDefault(); document.getElementById("request-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <SegmentedSearch id="query" label="მოთხოვნის ძიება" placeholder="მაგ. ავეჯი, შეფუთვა, გადაზიდვა"
            query={query} onQuery={setQuery} suggestions={suggestions}
            onSelect={item => item.kind === "category" ? filters.set({ category: item.category, q: "" }) : router.push(item.href)}
            city={city} onCity={setCity} />
        </form>}
        help={<>მომწოდებელს ეძებ? <Link href="/requests/new/">დაამატე მოთხოვნა</Link></>}
      />
        <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="მოთხოვნების ფილტრები">{requestFilters("desktop")}</aside>
        <div className="catalog-main" id="request-results">
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
                        <button type="button" className="ma-btn ma-btn--secondary" onClick={() => filters.set({city: "", category: "", q: "", unanswered: ""})}>ყველა მოთხოვნის ნახვა</button>
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
