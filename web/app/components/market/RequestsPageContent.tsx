"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "../Icon";
import { PageBand } from "./PageBand";
import { SectionHead } from "./SectionHead";
import { FacetList, type Facet } from "./FacetList";
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
      }) || [],
    [store, category, city, query],
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
  const allCount = ready && available ? list({ category: "" }).length : 0;

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
    ...(city ? [{ key: "city", label: cities[city] }] : []),
    ...(category ? [{ key: "category", label: categories[category] }] : []),
  ];
  const removeFilter = (key: string) => {
    if (key === "city") setCity("");
    else setCategory("");
  };
  const clearFilters = () => filters.set({city: "", category: "", q: "", sort: ""});

  const filterCount = Number(!!city) + Number(!!category);
  const countLabel = !available
    ? ""
    : !ready
      ? "მოთხოვნები იტვირთება…"
      : `${rows.length} ღია მოთხოვნა`;

  const filtersBody = (
    <div className="ma-proto-filters">
      <div>
        <h2 className="ma-title">კატეგორია</h2>
        <FacetList all={categoryFacets} loading={!ready} allLabel="ყველა კატეგორია" allCount={allCount} activeId={category} onSelect={setCategory} />
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="city-desktop">
          ქალაქი
        </label>
        <select className="ma-select" id="city-desktop" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">ყველა ქალაქი</option>
          {cityFacets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}{ready ? ` (${f.count})` : ""}
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
    <div className="ma-page">
      <PageBand
        eyebrow="MeetAny · საქმიანი კავშირები"
        title="მოთხოვნები"
        description="ნებისმიერს შეუძლია დაწეროს, რა სჭირდება — კომპანიები პასუხობენ შეთავაზებით."
        searchSlot={
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="query">
              მოთხოვნის ძიება
            </label>
            <input
              className="ma-input"
              id="query"
              type="search"
              placeholder="რა მიმართულებას ეძებ?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      />
      <SectionHead eyebrow="შენი შემდეგი საქმიანი კავშირი" title="მოთხოვნების სია" />
      <div className="ma-proto-columns">
        <aside className="ma-proto-sidebar ma-panel" aria-label="ფილტრები">
          {filtersBody}
        </aside>
        <section className="ma-stack" aria-label="მოთხოვნების სია">
          <div className="ma-proto-toolbar">
            <button
              type="button"
              className="ma-btn ma-btn--secondary ma-lg-down"
              ref={filterButtonRef}
              onClick={() => setSheetOpen(true)}
            >
              <Icon name="sliders-horizontal" />
              ფილტრი ({filterCount})
            </button>
          </div>
          <ResultsBar
            items={activeItems}
            onRemove={removeFilter}
            onClear={clearFilters}
            countLabel={countLabel}
            sort={{
              value: sort,
              onChange: setSort,
              options: [
                { value: "newest", label: "ახლად დამატებული" },
                { value: "expiring", label: "მალე იწურება" },
                { value: "few", label: "ნაკლები შეთავაზება" },
              ],
            }}
          />
          <div className="ma-stack">
            {!available
              ? (
                  <div className="ma-empty">
                    <span className="ma-empty__icon">
                      <Icon name="refresh-cw" />
                    </span>
                    <h2 className="ma-empty__title">სერვისი დროებით მიუწვდომელია</h2>
                    <p className="ma-empty__text">სცადე ცოტა ხანში — გვერდი თავიდან ჩატვირთე.</p>
                  </div>
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
        {filtersBody}
      </MobileFilterSheet>

      <RequestFormSheet open={formOpen} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
