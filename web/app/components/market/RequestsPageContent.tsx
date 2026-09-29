"use client";

import { CustomSelect } from "../ui/CustomSelect";
import Link from "next/link";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { RequestRow, type RequestRowData } from "./RequestRow";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities, currentCategory, groupNames } from "../../lib/categories";
import { categoryOptions } from "./CategoryOptions";
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
    <div className="ma-stack" aria-busy="true" aria-label="მონაცემები იტვირთება">
      <p>იტვირთება…</p>
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
  const requestedTab = filters.get("tab", "all");
  const tab = ["new", "expiring"].includes(requestedTab) ? requestedTab : "all";
  const listRef = useRef<HTMLDivElement>(null);
  const previousTab = useRef(tab);
  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    const list = listRef.current;
    if (!list) return;
    list.dataset.tabChanged = "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const style = getComputedStyle(list);
    const animation = list.animate([{opacity: .5}, {opacity: 1}], {
      duration: parseFloat(style.getPropertyValue("--motion-fast")),
      easing: style.getPropertyValue("--motion-ease").trim(),
    });
    return () => animation.cancel();
  }, [tab]);
  const tabs = [{id: "all", label: "ყველა"}, {id: "new", label: "ახალი"}, {id: "expiring", label: "მალე იწურება"}];
  const tabHref = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "all") next.delete("tab"); else next.set("tab", id);
    return `/requests/?${next.toString()}`;
  };
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

  const results = useMemo(() => (ready && available ? list({}).filter(r =>
    tab === "new" ? now - Date.parse(r.createdAt) >= 0 && now - Date.parse(r.createdAt) < 86400000
      : tab === "expiring" ? store?.daysLeft(r) <= 3 : true
  ) : []), [ready, available, list, tab, now, store]);

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
  // Desktop shows the choices inline; below 768px the same selects live in the filter sheet with visible labels.
  const choice = (placement: "desktop" | "mobile", kind: "category" | "city") => {
    const id = `request-${kind}-${placement}`, label = kind === "category" ? "კატეგორია" : "ქალაქი";
    const select = <CustomSelect className="ma-select" id={id} value={kind === "category" ? category : city} onChange={e => (kind === "category" ? setCategory : setCity)(e.target.value)}>
      <option value="">{kind === "category" ? "ყველა კატეგორია" : "ყველა ქალაქი"}</option>
      {kind === "category" ? categoryOptions(true) : Object.entries(cities).map(([value, text]) => <option key={value} value={value}>{text} ({cityCounts[value]})</option>)}
    </CustomSelect>;
    // Desktop reads like the sort control: "კატეგორია: ყველა".
    return placement === "desktop" ? <div className="ma-field request-board-choice"><label htmlFor={id}>{label}:</label>{select}</div> : <div className="ma-field"><label className="ma-field__label" htmlFor={id}>{label}</label>{select}</div>;
  };

  const clearFilters = () => filters.set({city: "", category: "", period: "", unanswered: "", photo: "", urgent: ""});

  const requestFilters = (placement: "desktop" | "mobile") => <div className="request-filter-fields">
    {choice(placement, "category")}{choice(placement, "city")}
    <div className="ma-field"><label className="ma-field__label" htmlFor={`request-period-${placement}`}>გამოქვეყნების დრო</label><CustomSelect className="ma-select" id={`request-period-${placement}`} value={period} onChange={e => filters.set({period:e.target.value})}><option value="">ყველა პერიოდი</option><option value="1">ბოლო 24 საათი</option><option value="7">ბოლო 7 დღე</option></CustomSelect></div>
    <fieldset className="request-filter-checks"><legend>დამატებით</legend><label className="ma-check"><input type="checkbox" checked={unanswered} onChange={e => filters.set({unanswered:e.target.checked ? "1" : ""})} /><span>ჯერ არ აქვს შეთავაზება</span></label><label className="ma-check"><input type="checkbox" checked={withPhoto} onChange={e => filters.set({photo:e.target.checked ? "1" : ""})} /><span>მხოლოდ ფოტოთი</span></label><label className="ma-check"><input type="checkbox" checked={urgent} onChange={e => filters.set({urgent:e.target.checked ? "1" : ""})} /><span>იწურება 3 დღეში</span></label></fieldset>
    {activeItems.length ? <button type="button" className="ma-btn ma-btn--secondary catalog-reset" onClick={clearFilters}><Icon name="refresh-cw" />ფილტრების გასუფთავება</button> : null}
  </div>;

  const countLabel = !available
    ? ""
    : !ready
      ? "მოთხოვნები იტვირთება…"
      : `${rows.length} ღია მოთხოვნა`;

  return (
    <div className="ma-page requests-catalog catalog-page request-board">
        <header className="catalog-header">
        <div className="catalog-heading"><span className="catalog-overline">ბიზნესები ეძებენ</span><h1 className="ma-h1">ნახე, რას ეძებენ<br />სხვა ბიზნესები.</h1><p className="catalog-description">შეარჩიე მოთხოვნა შენი საქმიანობის მიხედვით და შესთავაზე პირობები.</p></div>
        <div className="catalog-search-area"><span className="catalog-result-count" role="status">{countLabel}</span>
        <CatalogSearch id="query" label="მოთხოვნის ძიება" placeholder="მოძებნე მოთხოვნა…" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="requests" onCategory={category => filters.set({category, q: ""})} /><p className="catalog-search-help">მომწოდებელს ეძებ? <Link href="/requests/new/">დაამატე შენი მოთხოვნა</Link></p></div>
        </header>
        {ready && store?.currentUser()?.role === "company" ? <Link className="ma-btn ma-btn--ghost catalog-utility" href="/account/?tab=notifications"><Icon name="bell"/>შეტყობინებების მართვა</Link> : null}
        <div className="request-workspace">
        <aside className="request-filter-sidebar" aria-label="მოთხოვნების ფილტრები"><h2><Icon name="sliders-horizontal" />ფილტრები{activeItems.length ? <span>{activeItems.length}</span> : null}</h2>{requestFilters("desktop")}</aside>
        <div className="request-workspace-main">
        <ResultsBar
            items={activeItems}
            onRemove={key => filters.set({[key]: ""})}
            onClear={clearFilters}
            filterButton={<button type="button" className="ma-btn ma-btn--secondary catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრი{activeItems.length > 0 ? ` · ${activeItems.length}` : ""}</button>}
            tabs={<><nav className="request-board-tabs" aria-label="მოთხოვნების ხედები">
              {tabs.map(item => <Link key={item.id} href={tabHref(item.id)} scroll={false} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}
            </nav>
            </>}
            sort={{value: sort, onChange: setSort, options: [
              {value: "newest", label: "უახლესი"},
              {value: "expiring", label: "მალე იწურება"},
              {value: "few", label: "ნაკლები პასუხი"},
            ]}}
          />
      <section aria-label="მოთხოვნების სია">
          <div className="request-card-grid" ref={listRef}>
            {!available
              ? (
                  <ServiceUnavailable />
                )
              : !ready
                ? skeleton()
                : rows.length === 0
                  ? (
                      <div className="ma-empty request-board-empty">
                        <p className="ma-empty__text">{tab === "new" ? "ახალი მოთხოვნა ჯერ არ არის." : "ამ პირობით მოთხოვნა არ არის."}</p>
                        <button type="button" className="request-board-reset" onClick={() => filters.set({city: "", category: "", q: "", period: "", unanswered: "", photo: "", urgent: "", tab: ""})}>ყველა მოთხოვნის ნახვა</button>
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
        footer={<button type="button" className="ma-btn ma-btn--primary" onClick={() => setSheetOpen(false)}>{rows.length} მოთხოვნის ჩვენება</button>}
      >
        {requestFilters("mobile")}
      </MobileFilterSheet>
      <RequestFormSheet open={formOpen} initialTitle={formTitle} initialCity={formCity} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
