"use client";

import { AdminBusiness } from "./AdminBusiness";

import { AccountSkeleton, ListSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { adminErrorMessage, useAdminData } from "../../lib/use-admin-data";
import { AdminAuditTable, type AdminAuditEvent } from "./AdminAuditTable";
import { AdminState } from "./AdminState";
import { AdminOffersTable, type AdminOffer } from "./AdminOffersTable";
import { AdminContacts } from "./AdminContacts";
import { PageBand } from "./PageBand";
import { AdminFilters } from "./AdminFilters";
import { AdminOverview } from "./AdminOverview";
import { AdminPhotos } from "./AdminPhotos";
import { AdminDetail, type AdminTarget } from "./AdminDetail";
import { isTestAccount, downloadCsv, readAllAdminPages } from "../../lib/admin-helpers";
import styles from "./admin.module.css";
import { ModerationSheet } from "./ModerationSheet";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";

// ids: a bulk action over the selected rows (id is then the first of them).
type PendingAction = { kind: "requests" | "users" | "offers" | "photos"; action: string; id: string; label: string; ids?: string[]; url?: string } | null;

export function AdminPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const role = searchParams.get("role") || "";
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "cursor") next.delete("cursor");
    router.replace(`/admin/?${next}`, { scroll: false });
  }
  const selectedTab = searchParams.get("tab");
  // The overview is the landing screen; the other tabs are the working tools.
  const tab = selectedTab === "reviews" || selectedTab === "plans" || selectedTab === "requests" || selectedTab === "offers" || selectedTab === "users" || selectedTab === "photos" || selectedTab === "audit" || selectedTab === "contacts" ? selectedTab : "overview";
  // QA/demo accounts are hidden from the lists unless asked for (?tests=1).
  const showTests = searchParams.get("tests") === "1";
  const cursor = searchParams.get("cursor") || "";
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const bounds = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft -= bounds.left - item.left;
    else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
  }, [tab, ready, available]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [detail, setDetail] = useState<AdminTarget>(null);
  // Row selection belongs to one list view: a new tab, filter or page starts empty.
  const selectionKey = JSON.stringify([selectedTab, query, status, role, cursor, showTests]);
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const selected = selection.key === selectionKey ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ key: selectionKey, ids });
  const toggleSelected = (id: string) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = ready && available ? store?.currentUser() : null;

  const admin = useAdminData({ store, enabled: !!me && me.role === "admin" && tab !== "contacts" && tab !== "overview" && tab !== "photos" && tab !== "reviews" && tab !== "plans", tab: tab === "contacts" || tab === "overview" || tab === "photos" || tab === "reviews" || tab === "plans" ? "audit" : tab, query, status, role, cursor });

  const data = useMemo(() => {
    if (!store || !me || me.role !== "admin") return null;
    const stats = store.stats();
    const requests = store.listRequests({ state: "", includeHidden: true }) as {
      id: string;
      title: string;
      category: string;
      createdAt: string;
      ownerId: string;
      hidden: boolean;
      hiddenReason?: string;
      state?: string;
      ownerName?: string;
      ownerCompany?: string;
      offerCount?: number;
    }[];
    const users = store.allUsers() as {
      id: string;
      role: string;
      name: string;
      company?: string;
      city: string;
      industry?: string;
      phone: string;
      email: string;
      verified: boolean;
      blocked: boolean;
      blockedReason?: string;
    }[];
    return { stats, requests, users };
  }, [store, me]);

  if (ready && !available) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready) return <AccountSkeleton admin label="ადმინ-პანელი იტვირთება…" />;

  if (!me || me.role !== "admin") {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <Icon name="lock" />
          <h2 className="ma-empty__title">ადმინ-პანელი</h2>
          <p className="ma-empty__text">ეს გვერდი ხელმისაწვდომია მხოლოდ ადმინისტრატორისთვის.</p>
          {!me ? (
            <Link className="ma-btn ma-btn--primary" href="/account/?next=%2Fadmin%2F">
              შესვლა
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const { stats, requests, users } = data!;
  // v2 needs both the migrated database and the store methods that call it.
  const v2 = Number(stats.adminApiVersion) >= 2 && typeof store?.adminSearchOffers === "function";
  const hasFilters = tab !== "audit" && tab !== "overview" && tab !== "photos" && !!(query || status || role);
  const clearFilters = () => router.replace(`/admin/?tab=${tab}`, { scroll: false });

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (value: string) => terms.every(term => value.toLocaleLowerCase().includes(term));
  const cachedRequests = requests.filter(r => {
    const owner = store?.userById(r.ownerId);
    return (!status || store?.requestState(r) === status) && matches(`${r.title} ${r.id} ${owner?.company || ""} ${owner?.name || ""}`);
  });
  const cachedUsers = users.filter(u => (!role || u.role === role) && (!status || (status === "blocked" ? u.blocked : status === "verified" ? u.role === "company" && u.verified && !u.blocked : !u.blocked)) && matches(`${u.company || ""} ${u.name} ${u.email} ${u.phone} ${u.id}`));

  const allRequests = admin.mode === "legacy" ? cachedRequests : (tab === "requests" ? admin.page?.items || [] : []) as unknown as typeof requests;
  const allUsers = admin.mode === "legacy" ? cachedUsers : (tab === "users" ? admin.page?.items || [] : []) as unknown as typeof users;
  const requestOwner = (r: (typeof requests)[number]) => admin.mode === "ready" ? { name: r.ownerName, company: r.ownerCompany } : store?.userById(r.ownerId);
  const filteredRequests = showTests ? allRequests : allRequests.filter(r => !isTestAccount(requestOwner(r)));
  const filteredUsers = showTests ? allUsers : allUsers.filter(u => !isTestAccount(u));
  const hiddenTests = tab === "requests" ? allRequests.length - filteredRequests.length : tab === "users" ? allUsers.length - filteredUsers.length : 0;
  const canShowRecords = admin.mode === "legacy" || admin.mode === "ready";
  // One definition for the KPI and the users tab: admin_stats().users counts non-admins only,
  // the list also shows admins — say how many, so the two numbers add up.
  const unfilteredUsers = admin.mode === "ready" ? (!query && !status && !role ? admin.page?.filteredTotal : undefined) : users.length;
  const adminCount = unfilteredUsers === undefined ? 0 : Math.max(0, unfilteredUsers - stats.users);
  const adminNote = tab === "users" && adminCount ? ` · მათ შორის ${adminCount} ადმინი — ზედა მთვლელში არ ითვლება` : "";

  async function run(kind: "requests" | "users" | "offers" | "photos", action: string, id: string, reason: string, url?: string) {
    if (!store) return;
    if (kind === "photos") { await store.adminRemovePhoto(id, url, reason); return; }
    if (kind === "requests") {
      if (action === "hide") await store.adminSetHidden(id, true, reason);
      else if (action === "unhide") await store.adminSetHidden(id, false);
      else if (action === "delete") await (v2 ? store.adminDeleteRequest(id, reason) : store.adminDeleteRequest(id));
    } else if (kind === "offers") {
      await store.adminDeleteOffer(id, reason);
    } else {
      if (action === "verify") await store.adminSetVerified(id, true);
      else if (action === "unverify") await store.adminSetVerified(id, false);
      else if (action === "block") await store.adminSetBlocked(id, true, reason);
      else if (action === "unblock") await store.adminSetBlocked(id, false);
    }
  }

  async function confirm(reason: string) {
    if (!pendingAction || !store) return;
    setBusy(true);
    setError(null);
    const ids = pendingAction.ids || [pendingAction.id];
    let done = 0;
    let failure: unknown = null;
    // One at a time: each call is audited separately and a failure stops nothing else.
    for (const id of ids) {
      try { await run(pendingAction.kind, pendingAction.action, id, reason, pendingAction.url); done++; }
      catch (err) { failure = failure || err; }
    }
    setBusy(false);
    if (done) admin.reload();
    if (failure && !done) { setError(adminErrorMessage(failure, "მოქმედება ვერ შესრულდა. სცადე ხელახლა.")); return; }
    setPendingAction(null);
    if (pendingAction.ids) setSelected([]);
    toast(failure ? `შესრულდა ${done} / ${ids.length}. დანარჩენი ვერ შეიცვალა — სცადე ხელახლა.` : ids.length > 1 ? `შესრულდა ${done} ჩანაწერზე.` : "ცვლილება შენახულია.");
  }

  async function exportCsv() {
    if (!store || exporting) return;
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (tab === "users") {
        const rows = admin.mode === "legacy" ? allUsers as unknown as Record<string, unknown>[] : await readAllAdminPages<Record<string, unknown>>(store.adminSearchUsers, {
          p_q: query || null, p_role: role || null, p_blocked: status === "blocked" ? true : ["active", "verified"].includes(status) ? false : null, p_verified: status === "verified" ? true : null });
        const list = showTests ? rows : rows.filter(u => !isTestAccount(u as { name?: string; company?: string; email?: string }));
        downloadCsv(`meetany-users-${date}.csv`, [["ID", "სახელი", "კომპანია", "როლი", "დარგი", "ქალაქი", "ტელეფონი", "ელფოსტა", "დადასტურებული", "დაბლოკილი", "რეგისტრაცია"],
          ...list.map(u => [u.id, u.name, u.company, u.role === "company" ? "კომპანია" : u.role === "admin" ? "ადმინი" : "კლიენტი", categories[String(u.industry || "")] || u.industry, cities[String(u.city || "")] || u.city, u.phone, u.email, u.verified ? "კი" : "არა", u.blocked ? "კი" : "არა", String(u.created_at || u.createdAt || "").slice(0, 10)] as string[])]);
      } else {
        const rows = admin.mode === "legacy" ? allRequests as unknown as Record<string, unknown>[] : await readAllAdminPages<Record<string, unknown>>(store.adminSearchRequests, { p_q: query || null, p_state: status || null });
        const owner = (r: Record<string, unknown>) => admin.mode === "legacy" ? store.userById(String(r.ownerId)) : { name: r.owner_name, company: r.owner_company };
        const list = showTests ? rows : rows.filter(r => !isTestAccount(owner(r)));
        downloadCsv(`meetany-requests-${date}.csv`, [["ID", "სათაური", "კატეგორია", "ქალაქი", "ავტორი", "სტატუსი", "შეთავაზებები", "დამალული", "გამოქვეყნდა"],
          ...list.map(r => { const o = owner(r) as { name?: string; company?: string } | null; return [r.id, r.title, categories[String(r.category)] || r.category, cities[String(r.city)] || r.city, o?.company || o?.name, ({ open: "ღია", chosen: "არჩეული", expired: "ვადაგასული", closed: "დახურული", hidden: "დამალული" } as Record<string, string>)[String(r.state || store.requestState(r))] || r.state, r.offer_count ?? store.offerCount(r.id), r.hidden ? "კი" : "არა", String(r.created_at || r.createdAt || "").slice(0, 10)] as string[]; })]);
      }
      toast("CSV ფაილი ჩამოიტვირთა.");
    } catch (err) {
      toast(adminErrorMessage(err, "ექსპორტი ვერ შესრულდა."));
    } finally {
      setExporting(false);
    }
  }

  // Bulk actions per list: nothing permanent (no bulk delete).
  const bulkActions: { action: string; label: string; danger?: boolean }[] = tab === "users"
    ? [{ action: "verify", label: "დადასტურება" }, { action: "unblock", label: "განბლოკვა" }, { action: "block", label: "დაბლოკვა", danger: true }]
    : [{ action: "unhide", label: "გამოჩენა" }, { action: "hide", label: "დამალვა", danger: true }];
  const bulkTargets = (action: string) => tab === "users"
    ? filteredUsers.filter(u => selected.includes(u.id) && u.role !== "admin" && (action !== "verify" || (u.role === "company" && !u.verified)) && (action !== "block" || !u.blocked) && (action !== "unblock" || u.blocked)).map(u => u.id)
    : filteredRequests.filter(r => selected.includes(r.id) && (action === "hide" ? !r.hidden : r.hidden)).map(r => r.id);
  const visibleIds = tab === "users" ? filteredUsers.filter(u => u.role !== "admin").map(u => u.id) : filteredRequests.map(r => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const selectAll = <input type="checkbox" className={styles.check} aria-label="ყველას მონიშვნა ამ გვერდზე" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} />;

  return (
    <div className={`ma-page ${styles.workspace}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeading}><div><strong>ადმინისტრირება</strong><span>პლატფორმის მართვა</span></div></div>
        <nav ref={navigation} className={styles.navigation} aria-label="ადმინისტრირების განყოფილებები">
          {[
            { key: "overview", label: "მიმოხილვა", icon: "layout-grid" },
            { key: "requests", label: "მოთხოვნები", icon: "clipboard-list" },
            { key: "users", label: "მომხმარებლები", icon: "users" },
            ...(v2 || tab === "offers" ? [{ key: "offers", label: "შეთავაზებები", icon: "inbox" }] : []),
            { key: "reviews", label: "შეფასებები", icon: "star" },
            { key: "plans", label: "პაკეტები", icon: "sparkles" },
            { key: "photos", label: "ფოტოები", icon: "image" },
            { key: "audit", label: "მოქმედებების ჟურნალი", icon: "clock" },
            { key: "contacts", label: "კონტაქტები", icon: "phone" },
          ].map(item => <Link key={item.key} href={item.key === "overview" ? "/admin/" : `/admin/?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span><Icon name="chevron-right" className={styles.navArrow} /></Link>)}
        </nav>
        <Link className={styles.backToSite} href="/"><Icon name="arrow-left" />საიტზე დაბრუნება</Link>
      </aside>
      <div className={styles.content}>
      {tab !== "reviews" && tab !== "plans" ? <PageBand title={{ reviews:"შეფასებები", plans:"პაკეტები", overview: "მიმოხილვა", photos: "ფოტოები", requests: "მოთხოვნები", users: "მომხმარებლები", offers: "შეთავაზებები", audit: "მოქმედებების ჟურნალი", contacts: "კონტაქტები" }[tab]} description={{ reviews:"შეფასებების შემოწმება და გამოქვეყნება", plans:"კომპანიების ხილვადობის პაკეტები", overview: "პლატფორმის მდგომარეობა და ის, რასაც ყურადღება სჭირდება", photos: "კომპანიების ატვირთული ლოგოები და გალერეის ფოტოები", requests: "მოთხოვნების სტატუსი და მოდერაცია", users: "ანგარიშები, როლები და წვდომის მართვა", offers: "კომპანიების შეთავაზებების მართვა", audit: "პლატფორმაზე შესრულებული მოქმედებების ისტორია", contacts: "საკონტაქტო აქტივობა და სტატისტიკა" }[tab]} /> : null}
      {tab === "reviews" || tab === "plans" ? <AdminBusiness key={tab} kind={tab}/> : tab === "overview" ? <AdminOverview store={store!} stats={stats} onOpenUser={id => setDetail({ kind: "user", id })}
        onVerify={u => setPendingAction({ kind: "users", action: "verify", id: u.id, label: u.label })} /> : null}

      {tab === "photos" ? <AdminPhotos store={store!} onRemove={p => setPendingAction({ kind: "photos", action: "removePhoto", id: p.userId, url: p.url, label: p.label })} /> : null}
      {tab === "overview" || tab === "photos" || tab === "reviews" || tab === "plans" ? null : tab === "contacts" ? <AdminContacts store={store!} kind={searchParams.get("kind") || ""} target={searchParams.get("target") || ""} period={searchParams.get("period") || "month"} cursor={cursor} onChange={setFilter} onClear={clearFilters} /> : <>
      {tab !== "audit" && (tab !== "offers" || v2) ? <AdminFilters tab={tab} query={query} status={status} role={role} onChange={setFilter} /> : null}
      {hasFilters && (tab !== "offers" || v2) ? <button type="button" className={`ma-btn ma-btn--secondary ${styles.clear}`} onClick={clearFilters}>ფილტრების გასუფთავება</button> : null}
      {admin.mode === "legacy" && (tab === "requests" || tab === "users") ? <>
        <p className={styles.count} role="status">ნაჩვენებია {tab === "requests" ? filteredRequests.length : filteredUsers.length} / {tab === "requests" ? requests.length : users.length} ჩატვირთული ჩანაწერი{adminNote}.</p>
        <p className={styles.note}>{tab === "requests" ? "ძიება მოიცავს ჩატვირთულ მოთხოვნებს — მაქსიმუმ ბოლო 1 000 ჩანაწერს. ზედა მაჩვენებლები მთელ პლატფორმას ასახავს." : "ძიება მოიცავს ამჟამად ჩატვირთულ მომხმარებლებს. განახლებული მონაცემებისთვის განაახლე გვერდი."}</p>
      </> : null}
      {admin.mode === "ready" && admin.page ? <p className={styles.count} role="status">{admin.page.filteredTotal} ჩანაწერი{adminNote}</p> : null}
      {(tab === "requests" || tab === "users") && canShowRecords ? <div className={styles.listTools}><label className={`filter-switch ${styles.testSwitch}`}>
        <span><strong>სატესტო ანგარიშების ჩვენება</strong><small>{showTests ? "ნაჩვენებია ყველა ჩანაწერი" : hiddenTests ? `ამ გვერდზე დამალულია ${hiddenTests}` : "e2e და სატესტო ანგარიშები დამალულია"}</small></span>
        <input type="checkbox" role="switch" checked={showTests} onChange={e => setFilter("tests", e.target.checked ? "1" : "")} />
        <span className="filter-switch__track" aria-hidden="true" />
      </label>
      <button type="button" className="ma-btn ma-btn--secondary" onClick={exportCsv} disabled={exporting}><Icon name="download" />{exporting ? "მზადდება…" : "CSV ექსპორტი"}</button></div> : null}
      {admin.mode === "loading" ? <ListSkeleton compact kind="records" label="ჩანაწერები იტვირთება…" /> : null}
      {admin.mode === "error" ? <AdminState error title="ჩანაწერები ვერ ჩაიტვირთა" text={admin.error || undefined} onRetry={admin.reload} onFirst={cursor ? () => setFilter("cursor", "") : undefined} /> : null}
      {((tab === "offers" && !v2) || (tab === "audit" && admin.mode === "legacy")) ? <AdminState title="საჭიროა ბაზის განახლება" text={tab === "offers" ? "შეთავაზებების მოდერაცია ხელმისაწვდომი გახდება ადმინისტრირების API v2-ის ამოქმედების შემდეგ." : "მოქმედებების ჟურნალი ამ ვერსიაში ხელმისაწვდომი არ არის."} /> : null}
      {canShowRecords && !(tab === "offers" && !v2) && !(tab === "audit" && admin.mode === "legacy") && (tab === "requests" ? !filteredRequests.length : tab === "users" ? !filteredUsers.length : !admin.page?.items.length) ? <AdminState
        title={hasFilters ? "ამ ფილტრებით ჩანაწერები ვერ მოიძებნა" : cursor ? "ამ გვერდზე ჩანაწერები აღარ არის" : "ჩანაწერები ჯერ არ არის"}
        text={hasFilters ? "შეცვალე ძიება ან გაასუფთავე ფილტრები." : "ახალი ჩანაწერები აქ გამოჩნდება."}
        onClear={hasFilters ? clearFilters : undefined} onFirst={cursor ? () => setFilter("cursor", "") : undefined} /> : null}
      {tab === "audit" && admin.mode === "ready" && !!admin.page?.items.length ? <AdminAuditTable events={admin.page.items as unknown as AdminAuditEvent[]} /> : null}
      {tab === "offers" && admin.mode === "ready" && !!admin.page?.items.length ? <AdminOffersTable offers={admin.page.items as unknown as AdminOffer[]} onDelete={offer => setPendingAction({ kind: "offers", action: "deleteOffer", id: offer.id, label: `${offer.company_name || "კომპანია"} · ${offer.request_title || offer.body.slice(0, 80)}` })} /> : null}
      {canShowRecords && tab === "requests" && filteredRequests.length > 0 ? (
        <div className="ma-table-wrap">
          <table className="ma-table">
            <caption className="ma-sr-only">მოთხოვნა — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>{selectAll}</th>
                <th scope="col">მოთხოვნა</th>
                <th scope="col">ავტორი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">შეთავაზებები</th>
                <th scope="col">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => {
                const owner = store?.userById(r.ownerId);
                const state = admin.mode === "ready" ? r.state : store?.requestState(r);
                const count = admin.mode === "ready" ? r.offerCount ?? 0 : store?.offerCount(r.id) ?? 0;
                return (
                  <tr key={r.id} data-selected={selected.includes(r.id) || undefined}>
                    <td className={styles.checkCell}><input type="checkbox" className={styles.check} aria-label={`მონიშვნა: ${r.title}`} checked={selected.includes(r.id)} onChange={() => toggleSelected(r.id)} /></td>
                    <td data-label="მოთხოვნა">
                      <button type="button" className={styles.rowLink} onClick={() => setDetail({ kind: "request", id: r.id })}>
                        {r.title}
                      </button>
                      <small>
                        {categories[r.category] || r.category} · {dateLabel(r.createdAt)}
                      </small>
                    </td>
                    <td data-label="ავტორი">
                      {admin.mode === "ready" ? r.ownerCompany || r.ownerName || "—" : owner?.company || owner?.name || "—"}
                      {admin.mode === "legacy" ? <small>{owner?.phone || ""}</small> : null}
                    </td>
                    <td data-label="სტატუსი">
                      <span
                        className={`ma-badge ma-badge--${state === "open" ? "success" : r.hidden ? "warning" : "neutral"}`}
                      >
                        {r.hidden ? "დამალული" : state === "open" ? "ღია" : state === "chosen" ? "არჩეული" : state === "expired" ? "ვადაგასული" : "დახურული"}
                      </span>
                      {r.hidden && r.hiddenReason ? <small>მიზეზი: {r.hiddenReason}</small> : null}
                    </td>
                    <td data-label="შეთავაზებები">{count}</td>
                    <td data-label="მოქმედება">
                      <div className="ma-proto-tableactions">
                        <button
                          type="button"
                          className="ma-btn ma-btn--secondary"
                          onClick={() =>
                            setPendingAction({ kind: "requests", action: r.hidden ? "unhide" : "hide", id: r.id, label: r.title })
                          }
                        >
                          {r.hidden ? "გამოჩენა" : "დამალვა"}
                        </button>
                        <button
                          type="button"
                          className="ma-btn ma-btn--danger-quiet"
                          onClick={() => setPendingAction({ kind: "requests", action: "delete", id: r.id, label: r.title })}
                        >
                          წაშლა
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : canShowRecords && tab === "users" && filteredUsers.length > 0 ? (
        <div className="ma-table-wrap">
          <table className="ma-table">
            <caption className="ma-sr-only">მომხმარებელი — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>{selectAll}</th>
                <th scope="col">მომხმარებელი</th>
                <th scope="col">როლი</th>
                <th scope="col">კონტაქტი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} data-selected={selected.includes(u.id) || undefined}>
                  <td className={styles.checkCell}>{u.role !== "admin" ? <input type="checkbox" className={styles.check} aria-label={`მონიშვნა: ${u.company || u.name}`} checked={selected.includes(u.id)} onChange={() => toggleSelected(u.id)} /> : null}</td>
                  <td data-label="მომხმარებელი">
                    <button type="button" className={styles.rowLink} onClick={() => setDetail({ kind: "user", id: u.id })}>{u.company || u.name}</button>
                    <small>
                      {u.name} · {cities[u.city] || u.city}
                    </small>
                  </td>
                  <td data-label="როლი">
                    {u.role === "company" ? "კომპანია" : u.role === "admin" ? "ადმინი" : "კლიენტი"}
                    {u.industry ? <small>{categories[u.industry] || u.industry}</small> : null}
                  </td>
                  <td data-label="კონტაქტი">
                    {u.phone}
                    <small>{u.email}</small>
                  </td>
                  <td data-label="სტატუსი">
                    {u.blocked ? (
                      <span className="ma-badge ma-badge--danger">დაბლოკილი</span>
                    ) : u.role === "company" && u.verified ? (
                      <span className="ma-badge ma-badge--success">დადასტურებული</span>
                    ) : (
                      <span className="ma-badge ma-badge--info">აქტიური</span>
                    )}
                    {u.blocked && u.blockedReason ? <small>მიზეზი: {u.blockedReason}</small> : null}
                  </td>
                  <td data-label="მოქმედება">
                    <div className="ma-proto-tableactions">
                      {u.role === "company" ? (
                        <button
                          type="button"
                          className="ma-btn ma-btn--secondary"
                          onClick={() =>
                            setPendingAction({
                              kind: "users",
                              action: u.verified ? "unverify" : "verify",
                              id: u.id,
                              label: u.company || u.name,
                            })
                          }
                        >
                          {u.verified ? "დადასტურების მოხსნა" : "დადასტურება"}
                        </button>
                      ) : null}
                      {u.role !== "admin" ? (
                        <button
                          type="button"
                          className="ma-btn ma-btn--danger-quiet"
                          onClick={() =>
                            setPendingAction({
                              kind: "users",
                              action: u.blocked ? "unblock" : "block",
                              id: u.id,
                              label: u.company || u.name,
                            })
                          }
                        >
                          {u.blocked ? "განბლოკვა" : "დაბლოკვა"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {(tab === "requests" || tab === "users") && selected.length ? <div className={styles.bulkBar} role="region" aria-label="მონიშნულ ჩანაწერებზე მოქმედებები">
        <strong>{selected.length} მონიშნული</strong>
        {bulkActions.map(b => { const ids = bulkTargets(b.action); return <button key={b.action} type="button" disabled={!ids.length}
          className={`ma-btn ${b.danger ? "ma-btn--danger-quiet" : "ma-btn--secondary"}`}
          onClick={() => setPendingAction({ kind: tab === "users" ? "users" : "requests", action: b.action, id: ids[0], ids, label: `${ids.length} ჩანაწერი` })}>{b.label}{ids.length !== selected.length ? ` (${ids.length})` : ""}</button>; })}
        <button type="button" className="ma-btn ma-btn--ghost" onClick={() => setSelected([])}>გაუქმება</button>
      </div> : null}
      {admin.mode === "ready" && admin.page ? <nav className={styles.pagination} aria-label="ჩანაწერების გვერდები">
        {cursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setFilter("cursor", "")}>პირველი გვერდი</button> : null}
        {admin.page.hasMore && admin.page.nextCursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setFilter("cursor", typeof admin.page!.nextCursor === "string" ? admin.page!.nextCursor : JSON.stringify(admin.page!.nextCursor))}>შემდეგი გვერდი<Icon name="arrow-right" /></button> : null}
      </nav> : null}

      </>}
      </div>
      <AdminDetail store={store!} target={detail} v2={v2} onClose={() => setDetail(null)} onOpen={setDetail} onAction={setPendingAction} />
      <ModerationSheet
        open={!!pendingAction}
        title={
          pendingAction
            ? { removePhoto: "ფოტოს წაშლა", hide: "მოთხოვნის დამალვა", unhide: "მოთხოვნის გამოჩენა", delete: "მოთხოვნის წაშლა", deleteOffer: "შეთავაზების წაშლა", verify: "დადასტურება", unverify: "დადასტურების მოხსნა", block: "დაბლოკვა", unblock: "განბლოკვა" }[pendingAction.action] || ""
            : ""
        }
        subject={pendingAction?.label || ""}
        action={pendingAction?.action || ""}
        pending={busy}
        requireDeleteReason={v2}
        error={error}
        onConfirm={confirm}
        onCancel={() => {
          setPendingAction(null);
          setError(null);
        }}
      />
    </div>
  );
}
