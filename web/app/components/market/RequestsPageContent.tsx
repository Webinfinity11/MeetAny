"use client";

import Link from "next/link";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogSearch } from "./CatalogSearch";
import { Icon } from "../Icon";
import { ResultsBar } from "./ResultsBar";
import { requestDemoTier } from "../../lib/tier-demo";
import { RequestRow, type RequestRowData } from "./RequestRow";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
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

export function RequestsPageContent({ autoOpenNew = false, initial }: { autoOpenNew?: boolean; initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") === "b" ? "b" : "a";
  const filters = useFilters("/requests/");
  const city = filters.get("city"), category = filters.get("category"), query = filters.get("q"), sort = filters.get("sort", "newest");
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
  const me = store?.currentUser() as { role: string; industry?: string } | null;
  const industry = me?.role === "company" ? me.industry : undefined;
  const requestedTab = filters.get("tab", "all");
  const tab = ["new", "expiring", ...(industry ? ["industry"] : [])].includes(requestedTab) ? requestedTab : "all";
  const tabs = [{id: "all", label: "ყველა"}, {id: "new", label: "ახალი"}, {id: "expiring", label: "მალე იწურება"}, ...(industry ? [{id: "industry", label: "ჩემს დარგში"}] : [])];
  const tabHref = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "all") next.delete("tab"); else next.set("tab", id);
    return `/requests/?${next.toString()}`;
  };
  const [formOpen, setFormOpen] = useState(autoOpenNew);
  const formCategory = searchParams.get("category") || "";

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
      : tab === "expiring" ? store?.daysLeft(r) <= 3
        : tab === "industry" ? r.category === industry : true
  ) : []), [ready, available, list, tab, now, store, industry]);

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
  }, [sorted, store, now]);

  // Rank only already-filtered rows, retaining the selected sort within each tier.
  const vipRows = rows.filter(r => requestDemoTier(r.title) === "vip");
  const topRows = rows.filter(r => requestDemoTier(r.title) === "top");
  const featuredRows = [...vipRows, ...topRows];
  const featuredIds = new Set(featuredRows.map(r => r.id));
  const compactRows = variant === "b"
    ? [...vipRows, ...topRows, ...rows.filter(r => !requestDemoTier(r.title))]
    : rows.filter(r => !featuredIds.has(r.id));

  const clearFilters = () => filters.set({city: "", category: "", q: "", sort: "", period: "", unanswered: "", photo: "", urgent: "", tab: ""});

  const countLabel = !available
    ? ""
    : !ready
      ? "მოთხოვნები იტვირთება…"
      : `${rows.length} ღია მოთხოვნა`;

  return (
    <div className={`ma-page requests-catalog catalog-page request-board request-board--${variant}`}>
      <header className="catalog-header">
        <h1 className="ma-h1">მოთხოვნები</h1>
        {ready && store?.currentUser()?.role === "company" ? <Link className="ma-btn ma-btn--ghost" href="/account/?tab=notifications"><Icon name="bell"/>შეტყობინებების მართვა</Link> : null}

        <CatalogSearch id="query" label="მოთხოვნის ძიება" placeholder="მოძებნე მოთხოვნა…" value={query} onChange={setQuery} resultIds={results.map(result => result.id)} mode="requests" onCategory={category => filters.set({category, q: ""})} />
        {variant === "b" ? <div className="request-board-choices">
          <select className="ma-select" aria-label="კატეგორია" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">ყველა კატეგორია</option>
            {Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select className="ma-select" aria-label="ქალაქი" value={city} onChange={e => setCity(e.target.value)}>
            <option value="">ყველა ქალაქი</option>
            {Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div> : null}
      </header>
      <section className="ma-stack" aria-label="მოთხოვნების სია">
          <ResultsBar
            items={[]}
            onRemove={key => filters.set({[key]: ""})}
            onClear={clearFilters}
            countLabel={countLabel}
            tabs={<nav className="request-board-tabs" aria-label="მოთხოვნების ხედები">
              {tabs.map(item => <Link key={item.id} href={tabHref(item.id)} scroll={false} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}
            </nav>}
            sort={{value: sort, onChange: setSort, options: [
              {value: "newest", label: "უახლესი"},
              {value: "expiring", label: "მალე იწურება"},
              {value: "few", label: "ნაკლები პასუხი"},
            ]}}
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
                        <h2 className="ma-empty__title">მოთხოვნა ვერ მოიძებნა</h2>
                        <p className="ma-empty__text">სცადე სხვა სიტყვა ან დაბრუნდი ყველა მოთხოვნაზე.</p>
                        <button type="button" className="ma-btn ma-btn--secondary" onClick={clearFilters}>
                          საწყის ხედზე დაბრუნება
                        </button>
                      </div>
                    )
                  : <>
                      {variant === "a" && featuredRows.length > 0 ? <div className="request-tier-zone">
                        {featuredRows.map(r => <RequestRow key={r.id} r={r} tier={requestDemoTier(r.title)} size="featured" priority />)}
                      </div> : null}
                      {compactRows.map((r, index) => <RequestRow key={r.id} r={r} tier={requestDemoTier(r.title)} priority={index < 4} />)}
                    </>}
          </div>
        </section>
      <RequestFormSheet open={formOpen} initialCategory={formCategory} onClose={() => setFormOpen(false)} />
    </div>
  );
}
