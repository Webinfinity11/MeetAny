"use client";
import { Button } from "../ui/Button";


import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "../Icon";
import { EmptyState } from "../ui/Structure";
import { SkeletonGrid } from "./Skeletons";
import { OpportunityCard } from "./OpportunityCard";
import { majorCities } from "./catalog/CatalogFilters";
import styles from "./catalog/Catalog.module.css";
import { ResultsBar } from "./ResultsBar";
import { MobileFilterSheet } from "./MobileFilterSheet";
import type { RequestRowData } from "./RequestRow";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities, currentCategory, groupNames, categoryGroups, categoryKeys, groupOf } from "../../lib/categories";
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

export function RequestsPageContent({ autoOpenNew = false, initial, initialNow = 0 }: { autoOpenNew?: boolean; initial?: PublicSnapshot; initialNow?: number }) {
  const { store, ready, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const filters = useFilters("/requests/");
  const setFilters = (values: Record<string, string>) => filters.set({ page: "", ...values });
  const verified = filters.get("verified") === "1";
  const city = filters.get("city"), category = currentCategory(filters.get("category")), query = filters.get("q"), sort = filters.get("sort", "newest");
  const setQuery = (q: string) => setFilters({q});
  const setSort = (sort: string) => setFilters({sort});
  const [now, setNow] = useState(initialNow);
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
        city: city === "other" ? "" : city,
        q: query,
        state: "",
        ...overrides,
      }) || [],
    [store, category, city, query],
  );

  const deadline = filters.get("deadline");
  const results = useMemo(() => (ready && available ? list({}).filter(r => {
    if (!now || store?.requestState(r, now) !== "open") return false;
    const days = store?.daysLeft(r, now) ?? 0;
    if (city === "other" && majorCities.includes(r.city)) return false;
    if (verified && !store?.userById(r.ownerId)?.verified) return false;
    return deadline === "7" ? days <= 7 : deadline === "30" ? days <= 30 : deadline === "later" ? days > 30 : true;
  }) : []), [ready, available, list, store, deadline, city, verified, now]);
  const sorted = useMemo(() => {
    const arr = [...results];
    // Whole days tie often; the exact deadline breaks the tie so "ending soon" really is in order.
    const ends = (r: unknown) => Date.parse((r as { expiresAt?: string }).expiresAt ?? "") || Infinity;
    if (["expiring", "ending"].includes(sort) && store) arr.sort((a, b) => ends(a) - ends(b));
    return arr;
  }, [results, sort, store]);

  const rows: (RequestRowData & { ownerVerified: boolean })[] = useMemo(() => {
    if (!store) return [];
    const me = store.currentUser() as { id: string; role: string } | null;
    return sorted.map((r) => {
      const owner = (store.userById as (id: string) => { company?: string; name?: string; verified?: boolean } | null)(r.ownerId);
      const ownerName = owner?.company || owner?.name || "მომხმარებელი";
      const state = (store.requestState as (r: unknown, now: number) => RequestRowData["state"])(r, now);
      const daysLeft = (store.daysLeft as (r: unknown, now: number) => number)(r, now);
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
        ownerVerified: !!owner?.verified,
        state,
        daysLeft,
        isOwn,
        offerCount: store.offerCount(r.id),
        canOffer: !isOwn && me?.role === "company" && state === "open",
        ownOfferStatus,
        showOwnOfferBadge: me?.role === "company" && !isOwn,
        posted: postedLabel(r.createdAt, now),
      };
    });
  }, [sorted, store, now]);

  const pageCount = Math.max(1, Math.ceil(rows.length / 12));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(filters.get("page")) || 1)));
  const pageHref = (value: number) => { const next = new URLSearchParams(searchParams.toString()); next.set("page", String(value)); return `/requests/?${next}`; };

  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const activeItems = [
    ...(verified ? [{ key: "verified", label: "ვერიფიცირებული მყიდველი" }] : []),
    ...(deadline ? [{key: "deadline", label: deadline === "7" ? "7 დღემდე" : deadline === "30" ? "30 დღემდე" : "30 დღეზე მეტი"}] : []),
    ...(category ? [{key: "category", label: categories[category] || groupNames[category] || category}] : []),
    ...(city ? [{key: "city", label: city === "other" ? "სხვა" : cities[city] || city}] : []),
  ];
  const clearFilters = () => setFilters({city: "", category: "", deadline: "", verified: "", q: ""});

  // Facet counts ignore their own selection, but retain the other active filters.
  const facetRequests = ready && available ? list({ category: "", city: "" }).filter(r =>
    !!now && store?.requestState(r, now) === "open" && (!verified || store?.userById(r.ownerId)?.verified)
  ) : [];
  const matchesCity = (r: MappedRequest, value: string) => !value || (value === "other"
    ? !majorCities.includes(r.city)
    : value.split(",").includes(r.city) || r.city === "georgia");
  const matchesDeadline = (r: MappedRequest, value: string) => {
    const days = store?.daysLeft(r, now) ?? 0;
    return value === "7" ? days <= 7 : value === "30" ? days <= 30 : value === "later" ? days > 30 : true;
  };
  const matchesCategory = (r: MappedRequest, value: string) => !value || categoryKeys(value).includes(r.category);
  const facetCount = (key: "category" | "city" | "deadline", value: string) => facetRequests.filter(r =>
    matchesCategory(r, key === "category" ? value : category) &&
    matchesCity(r, key === "city" ? value : city) &&
    matchesDeadline(r, key === "deadline" ? value : deadline)
  ).length;
  const verifiedSwitch = () => <label className={styles.requestVerified}>
    <input type="checkbox" role="switch" checked={verified} onChange={e => setFilters({ verified: e.target.checked ? "1" : "" })} />
    <span className={styles.switchTrack} aria-hidden="true" /><span>მხოლოდ ვერიფიცირებული</span>
  </label>;
  const categoryRow = (id: string, label: string, icon: string, expanded?: boolean) =>
    <Button variant="ghost" className={styles.categoryRow} aria-pressed={category === id} aria-expanded={expanded}
      onClick={() => setFilters({ category: category === id ? "" : id })}>
      <Icon name={icon} /><span>{label}</span><small>{facetCount("category", id)}</small>
    </Button>;
  const requestFilters = () => <div className={styles.requestFilters}>
    <section><h3>კატეგორიები</h3><ul>
      <li>{categoryRow("", "ყველა", "layout-grid")}</li>
      {categoryGroups.map(group => {
        const expanded = category === group.id || groupOf[category] === group.id;
        const hasChildren = group.items.some(([id]) => id !== group.id);
        return <li key={group.id}>
          {categoryRow(group.id, group.short, group.icon, hasChildren ? expanded : undefined)}
          {expanded && hasChildren && <ul className={styles.subcategories}>{group.items.map(([id, label]) =>
            <li key={id}>{categoryRow(id, label, group.icon)}</li>
          )}</ul>}
        </li>;
      })}
    </ul></section>
    <section><h3>ადგილმდებარეობა</h3><ul>{[...majorCities.map(id => [id, cities[id]]), ["other", "სხვა რეგიონები"]].map(([id, label]) =>
      <li key={id}><label className={styles.filterCheck}><input type="checkbox" checked={city === id}
        onChange={() => setFilters({ city: city === id ? "" : id })} /><span>{label}</span><small>{facetCount("city", id)}</small></label></li>
    )}</ul></section>
    <section><h3>ვადა</h3><ul>{[["7", "7 დღემდე"], ["30", "30 დღემდე"], ["later", "30 დღეზე მეტი"]].map(([id, label]) =>
      <li key={id}><label className={styles.filterCheck}><input type="checkbox" checked={deadline === id}
        onChange={() => setFilters({ deadline: deadline === id ? "" : id })} /><span>{label}</span><small>{facetCount("deadline", id)}</small></label></li>
    )}</ul></section>
  </div>;

  const countLabel = !available
    ? ""
    : !ready
      ? ""
      : `ნაპოვნია ${rows.length} შესაძლებლობა`;

  return (
    <div className={`ma-page requests-catalog catalog-page request-board ${styles.page}`}>
      <CatalogHeader
        title="ბიზნეს შესაძლებლობები"
        description="რეალური ბიზნეს მოთხოვნები — გაუგზავნე შეთავაზება იმათ, ვისაც შენი პროდუქტი სჭირდება."

      />
        <div className={styles.requestSearchBar}><div className={styles.search}><form onSubmit={e => { e.preventDefault(); document.getElementById("request-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <CatalogSearch id="query" label="ძიება" placeholder="მოძებნე პროდუქტი, მომსახურება, კომპანია ან კატეგორია"
            value={query} onChange={setQuery} mode="requests" resultIds={results.map(r => r.id)}
            onCategory={value => setFilters({ category: value, q: "" })} />
        </form></div>{verifiedSwitch()}</div>
        <div className="catalog-workspace">
        <aside className="catalog-sidebar" aria-label="მოთხოვნების ფილტრები">{requestFilters()}</aside>
        <div className="catalog-main" id="request-results">
        <div className={styles.requestResults}>
        <ResultsBar
            count={countLabel}
            items={activeItems}
            onRemove={key => setFilters({[key]: ""})}
            onClear={clearFilters}
            filterButton={<Button type="button" variant="secondary" className="catalog-filter-toggle" ref={filterButtonRef} aria-haspopup="dialog" aria-controls="filters" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}><Icon name="sliders-horizontal" />ფილტრები ({activeItems.length})</Button>}
            sort={{value: sort, onChange: setSort, options: [
              {value: "newest", label: "უახლესი"},
              {value: "expiring", label: "მალე იწურება"},
            ]}}
          /></div>
      <section aria-label="მოთხოვნების სია">
          <div className={styles.grid}>
            {!available
              ? (
                  <ServiceUnavailable />
                )
              : !ready
                ? <SkeletonGrid count={6} />
                : rows.length === 0
                  ? (
                      <EmptyState icon="search" title="ვერაფერი მოიძებნა" text="სცადე სხვა კატეგორია ან ქალაქი." action={<Button variant="secondary" onClick={clearFilters}>ფილტრების გასუფთავება</Button>} />
                    )
                  : <>
                      {rows.slice((page - 1) * 12, page * 12).map(r => <OpportunityCard key={r.id} request={r} offers={r.offerCount} buyer={{ name: r.ownerName, verified: r.ownerVerified }} canOffer={r.canOffer && !r.ownOfferStatus} />)}
                    </>}
          </div>
        </section>
        {pageCount > 1 && <nav className={styles.pagination} aria-label="გვერდები"><Button variant="secondary" href={pageHref(page - 1)} disabled={page === 1}>წინა</Button>{Array.from({ length: pageCount }, (_, index) => index + 1).filter(value => value === 1 || value === pageCount || Math.abs(value - page) <= 1).map(value => <Button key={value} variant="secondary" href={pageHref(value)} aria-current={page === value ? "page" : undefined}>{value}</Button>)}<Button variant="secondary" href={pageHref(page + 1)} disabled={page === pageCount}>შემდეგი</Button></nav>}
      </div></div>
      <MobileFilterSheet
        id="filters"
        title="ფილტრები"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        triggerRef={filterButtonRef}
        footer={<>
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={activeItems.length === 0 && !query}>გასუფთავება</Button>
          <Button type="button" variant="primary" onClick={() => setSheetOpen(false)}>{rows.length} შედეგის ნახვა</Button>
        </>}
      >
        {requestFilters()}
        {verifiedSwitch()}
      </MobileFilterSheet>
      {formOpen && <RequestFormSheet open={formOpen} initialTitle={formTitle} initialCity={formCity} initialCategory={formCategory} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
