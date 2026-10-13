"use client";
import { Button } from "../ui/Button";
import { AdminContentEditor } from "./AdminContentEditor";
import { AdminReviews } from "./AdminReviews";
import { AdminDeals } from "./AdminDeals";
import { AccountSkeleton, ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, toastError } from "../Toasts";
import { Icon } from "../Icon";
import { adminErrorMessage, useAdminData } from "../../lib/use-admin-data";
import { adminUserFilterParams, adminUserMatchesStatus } from "../../lib/admin-user-filters";
import { AdminBusinessAudit } from "./AdminBusinessAudit";
import { AdminAuditTable, AdminAuditFilters, type AdminAuditEvent } from "./AdminAuditTable";
import { AdminState } from "./AdminState";
import { AdminOffersTable, type AdminOffer } from "./AdminOffersTable";
import { AdminContacts } from "./AdminContacts";
import { PageBand } from "./PageBand";
import { AdminUserStatus } from "./AdminUserStatus";
import { AdminFilters } from "./AdminFilters";
import { AdminOverview } from "./AdminOverview";
import { AdminNavigation } from "./AdminNavigation";
import { adminSections, type AdminSection } from "../../lib/admin-sections";
import { AdminPhotos } from "./AdminPhotos";
import { AdminReports, type ReportAction } from "./AdminReports";
import { AdminDetail, type AdminTarget, type AdminAction } from "./AdminDetail";
import { downloadCsv, readAllAdminPages } from "../../lib/admin-helpers";
import styles from "./admin.module.css";
import { ModerationSheet } from "./ModerationSheet";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";

type PendingAction = AdminAction | null;

export function AdminPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const role = searchParams.get("tab") === "companies" ? "company" : searchParams.get("role") || "";
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key === "status" && value === "unverified") next.set("role", "company");
    if (key === "role" && value !== "company" && status === "unverified") next.delete("status");
    if (key !== "cursor") next.delete("cursor");
    router.replace(`/admin/?${next}`, { scroll: false });
  }
  const selectedTab = searchParams.get("tab");
  // The overview is the landing screen; the other tabs are the working tools.
  const tab: AdminSection = selectedTab && Object.hasOwn(adminSections, selectedTab) ? selectedTab as AdminSection : "overview";
  const cursor = searchParams.get("cursor") || "";
  const auditAction = tab === "audit" ? searchParams.get("action") || "" : "";
  const auditTarget = tab === "audit" ? searchParams.get("target") || "" : "";
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [detail, setDetail] = useState<AdminTarget>(null);
  // Row selection belongs to one list view: a new tab, filter or page starts empty.
  const selectionKey = JSON.stringify([selectedTab, query, status, role, cursor]);
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const selected = selection.key === selectionKey ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ key: selectionKey, ids });
  const toggleSelected = (id: string) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after every moderation write: lists with their own loaders (deals, reviews, reports, detail) reload.
  const [revision, setRevision] = useState(0);

  const me = ready && available ? store?.currentUser() : null;

  const ownData = tab === "content" || tab === "contacts" || tab === "overview" || tab === "photos" || tab === "reviews" || tab === "reports" || tab === "deals";
  const admin = useAdminData({ store, enabled: !!me && me.role === "admin" && !ownData, tab: ownData ? "audit" : tab === "companies" ? "users" : tab, query, status, role, cursor, action: auditAction, target: auditTarget });
  // New reports and open deal issues: the navigation badges. Loaded once per admin visit and after each write.
  const [reportCount, setReportCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const isAdmin = !!me && me.role === "admin";
  useEffect(() => {
    if (!isAdmin || !store) return;
    let active = true;
    if (typeof store.adminListReports === "function") store.adminListReports("new", 0).then((page: { newCount?: number }) => { if (active) setReportCount(Number(page.newCount) || 0); }, () => undefined);
    store.callRpc("admin_deal_issues", {}).then((items: { status: string }[]) => { if (active) setIssueCount(Array.isArray(items) ? items.filter(i => i.status === "open").length : 0); }, () => undefined);
    return () => { active = false; };
  }, [store, isAdmin, revision]);
  const onReportCount = useCallback((count: number) => setReportCount(count), []);

  // Store snapshots are mutable; read the current cache on every notified render.
  const data = (() => {
    if (!store || !me || me.role !== "admin") return null;
    const stats = store.stats();
    const requests = store.listRequests({ state: "", includeHidden: true }) as {
      id: string; title: string; category: string; createdAt: string; ownerId: string; hidden: boolean;
      hiddenReason?: string; state?: string; ownerName?: string; ownerCompany?: string; offerCount?: number;
    }[];
    const users = store.allUsers() as {
      id: string; role: string; name: string; company?: string; city: string; industry?: string; phone: string; email: string;
      verified: boolean; blocked: boolean; blockedReason?: string; verification_documents_status?: string;
    }[];
    return { stats, requests, users };
  })();

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
            <Button variant="primary" href="/account/?next=%2Fadmin%2F">
              შესვლა
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const { stats, requests, users } = data!;
  // v2 needs both the migrated database and the store methods that call it.
  const v2 = Number(stats.adminApiVersion) >= 2 && typeof store?.adminSearchOffers === "function";
  // On the companies tab the company role is the tab itself, not a filter.
  const hasFilters = tab !== "audit" && tab !== "overview" && tab !== "photos" && !!(query || status || (tab === "companies" ? "" : role));
  const clearFilters = () => router.replace(`/admin/?tab=${tab}`, { scroll: false });

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (value: string) => terms.every(term => value.toLocaleLowerCase().includes(term));
  const cachedRequests = requests.filter(r => {
    const owner = store?.userById(r.ownerId);
    return (!status || store?.requestState(r) === status) && matches(`${r.title} ${r.id} ${owner?.company || ""} ${owner?.name || ""}`);
  });
  const cachedUsers = users.filter(u => (!role || status === "unverified" || u.role === role) && adminUserMatchesStatus(u, status) && matches(`${u.company || ""} ${u.name} ${u.email} ${u.phone} ${u.id}`));

  const allRequests = admin.mode === "legacy" ? cachedRequests : (tab === "requests" ? admin.page?.items || [] : []) as unknown as typeof requests;
  const allUsers = admin.mode === "legacy" ? cachedUsers : (tab === "users" || tab === "companies" ? admin.page?.items || [] : []) as unknown as typeof users;
  const filteredRequests = allRequests;
  const filteredUsers = allUsers;
  const canShowRecords = admin.mode === "legacy" || admin.mode === "ready";
  // One definition for the KPI and the users tab: admin_stats().users counts non-admins only,
  // the list also shows admins — say how many, so the two numbers add up.
  const unfilteredUsers = admin.mode === "ready" ? (!query && !status && !role ? admin.page?.filteredTotal : undefined) : users.length;
  const adminCount = unfilteredUsers === undefined ? 0 : Math.max(0, unfilteredUsers - stats.users);
  const adminNote = tab === "users" && adminCount ? ` · ${adminCount} ადმინი` : "";

  async function run(action: AdminAction, id: string, reason: string, choice?: string) {
    if (!store) return;
    const { kind, url } = action;
    if (kind === "reports") { await store.adminResolveReport(id, action.action === "reportReject" ? "reject" : "hide", reason); return; }
    if (kind === "photos") { await store.adminRemovePhoto(id, url, reason); return; }
    if (kind === "reviews") { await store.adminModerateReview(id, action.action === "hideReview" ? "hidden" : "published", reason); return; }
    if (kind === "deals") { await store.mutateRpc("admin_set_deal_stage", { p_deal: id, p_stage: action.action === "dealCancel" ? "cancelled" : choice, p_reason: reason }); return; }
    if (kind === "issues") { await store.mutateRpc("admin_resolve_deal_issue", { p_issue_id: id, p_resolution: reason, p_outcome: choice || "resolved" }); return; }
    if (kind === "requests") {
      if (action.action === "hide") await store.adminSetHidden(id, true, reason);
      else if (action.action === "unhide") await store.adminSetHidden(id, false);
      else if (action.action === "delete") await (v2 ? store.adminDeleteRequest(id, reason) : store.adminDeleteRequest(id));
    } else if (kind === "offers") {
      await store.adminDeleteOffer(id, reason);
    } else {
      if (action.action === "verify") await store.adminSetVerified(id, true);
      else if (action.action === "unverify") await store.mutateRpc("admin_set_verified", { p_user_id: id, p_verified: false, p_reason: reason });
      else if (action.action === "approveDocs") await store.mutateRpc("review_verification", { p_profile_id: id, p_status: "approved", p_note: null });
      else if (action.action === "returnDocs") await store.mutateRpc("review_verification", { p_profile_id: id, p_status: "rejected", p_note: reason });
      else if (action.action === "block") await store.adminSetBlocked(id, true, reason);
      else if (action.action === "unblock") await store.adminSetBlocked(id, false);
    }
  }

  async function confirm(reason: string, choice?: string) {
    if (!pendingAction || !store) return;
    setBusy(true);
    setError(null);
    const ids = pendingAction.ids || [pendingAction.id];
    let done = 0;
    let failure: unknown = null;
    // One at a time: each call is audited separately and a failure stops nothing else.
    for (const id of ids) {
      try { await run(pendingAction, id, reason, choice); done++; }
      catch (err) { failure = failure || err; }
    }
    setBusy(false);
    if (done) { admin.reload(); setRevision(n => n + 1); }
    if (failure && !done) { setError(adminErrorMessage(failure, "მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.")); return; }
    setPendingAction(null);
    if (pendingAction.ids) setSelected([]);
    toast(failure ? { title: `შესრულდა ${done} / ${ids.length}. დანარჩენი ვერ შეიცვალა — სცადეთ ხელახლა.`, tone: "warning" } : ids.length > 1 ? `შესრულდა ${done} ჩანაწერზე.` : "ცვლილება შენახულია.");
  }

  async function exportCsv() {
    if (!store || exporting) return;
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if ((tab === "users" || tab === "companies")) {
        const rows = admin.mode === "legacy" ? allUsers as unknown as Record<string, unknown>[] : await readAllAdminPages<Record<string, unknown>>(store.adminSearchUsers, {
          p_q: query || null, ...adminUserFilterParams(status, role) });
        downloadCsv(`meetany-users-${date}.csv`, [["ID", "სახელი", "კომპანია", "როლი", "დარგი", "ქალაქი", "ტელეფონი", "ელფოსტა", "ვერიფიცირებული", "დაბლოკილი", "რეგისტრაცია"],
          ...rows.map(u => [u.id, u.name, u.company, u.role === "company" ? "კომპანია" : u.role === "admin" ? "ადმინი" : "კლიენტი", categories[String(u.industry || "")] || u.industry, cities[String(u.city || "")] || u.city, u.phone, u.email, u.verified ? "კი" : "არა", u.blocked ? "კი" : "არა", String(u.created_at || u.createdAt || "").slice(0, 10)] as string[])]);
      } else {
        const rows = admin.mode === "legacy" ? allRequests as unknown as Record<string, unknown>[] : await readAllAdminPages<Record<string, unknown>>(store.adminSearchRequests, { p_q: query || null, p_state: status || null });
        const owner = (r: Record<string, unknown>) => admin.mode === "legacy" ? store.userById(String(r.ownerId)) : { name: r.owner_name, company: r.owner_company };
        downloadCsv(`meetany-requests-${date}.csv`, [["ID", "სათაური", "კატეგორია", "ქალაქი", "ავტორი", "სტატუსი", "შეთავაზებები", "დამალული", "გამოქვეყნდა"],
          ...rows.map(r => { const o = owner(r) as { name?: string; company?: string } | null; return [r.id, r.title, categories[String(r.category)] || r.category, cities[String(r.city)] || r.city, o?.company || o?.name, requestStates[String(r.state || store.requestState(r))] || r.state, r.offer_count ?? store.offerCount(r.id), r.hidden ? "კი" : "არა", String(r.created_at || r.createdAt || "").slice(0, 10)] as string[]; })]);
      }
      toast("CSV ფაილი ჩამოიტვირთა.");
    } catch (err) {
      toastError(adminErrorMessage(err, "ექსპორტი ვერ შესრულდა. სცადეთ ხელახლა."));
    } finally {
      setExporting(false);
    }
  }

  // Bulk actions per list: nothing permanent (no bulk delete).
  const peopleTab = tab === "users" || tab === "companies";
  const bulkActions: { action: string; label: string; danger?: boolean }[] = peopleTab
    ? [...(tab === "companies" ? [{ action: "verify", label: "ვერიფიცირება" }] : []), { action: "unblock", label: "განბლოკვა" }, { action: "block", label: "დაბლოკვა", danger: true }]
    : [{ action: "unhide", label: "გამოჩენა" }, { action: "hide", label: "დამალვა", danger: true }];
  const bulkTargets = (action: string) => peopleTab
    ? filteredUsers.filter(u => selected.includes(u.id) && u.role !== "admin" && (action !== "verify" || (u.role === "company" && !u.verified)) && (action !== "block" || !u.blocked) && (action !== "unblock" || u.blocked)).map(u => u.id)
    : filteredRequests.filter(r => selected.includes(r.id) && (action === "hide" ? !r.hidden : r.hidden)).map(r => r.id);
  const visibleIds = peopleTab ? filteredUsers.filter(u => u.role !== "admin").map(u => u.id) : filteredRequests.map(r => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const selectAll = <label className={styles.checkHit}><input type="checkbox" className={styles.check} aria-label="ყველას მონიშვნა ამ გვერდზე" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} /></label>;
  const listTab = tab === "requests" || peopleTab || tab === "offers" || tab === "audit";

  return (
    <div className={`ma-page ${styles.workspace}`}>
      <AdminNavigation tab={tab} reports={reportCount} issues={issueCount} offersEnabled={v2} />
      <div key={tab} className={styles.content}>
      <PageBand title={adminSections[tab].label} description={adminSections[tab].description} />
      {tab === "overview" ? <AdminOverview store={store!} stats={stats} onOpenUser={id => setDetail({ kind: "user", id })}
        onVerify={u => setPendingAction({ kind: "users", action: "verify", id: u.id, label: u.label })} /> : null}
      {tab === "reviews" ? <AdminReviews store={store!} revision={revision} onOpen={setDetail} onAction={setPendingAction} /> : null}
      {tab === "deals" ? <AdminDeals store={store!} revision={revision} stage={status} query={query} cursor={cursor} onChange={setFilter} onClear={clearFilters} onOpen={setDetail} onAction={setPendingAction} /> : null}
      {tab === "content" ? <AdminContentEditor store={store!} /> : null}
      {tab === "reports" ? <section className={styles.listSurface}><AdminReports key={status} store={store!} status={status === "handled" ? "handled" : "new"} revision={revision} onStatus={value => setFilter("status", value === "new" ? "" : value)} onCount={onReportCount} onOpen={setDetail}
        onAction={({ report, action, label }: ReportAction) => setPendingAction({ kind: "reports", action: action === "reportReject" ? "reportReject" : `reportHide.${report.target_kind}`, id: report.id, label })} /></section> : null}
      {tab === "photos" ? <AdminPhotos store={store!} onOpen={setDetail} onRemove={p => setPendingAction({ kind: "photos", action: "removePhoto", id: p.userId, url: p.url, label: p.label })} /> : null}
      {tab === "contacts" ? <AdminContacts store={store!} kind={searchParams.get("kind") || ""} target={searchParams.get("target") || ""} period={searchParams.get("period") || "month"} cursor={cursor} onChange={setFilter} onClear={clearFilters} /> : null}
      {listTab ? <section className={styles.listSurface} aria-label="ჩანაწერების მართვა">
      {tab !== "audit" && (tab !== "offers" || v2) ? <AdminFilters lockRole={tab === "companies"} tab={tab === "companies" ? "companies" : tab} query={query} status={status} role={role} onChange={setFilter} /> : null}
      {tab === "audit" && v2 ? <AdminAuditFilters action={auditAction} target={auditTarget} onChange={setFilter} /> : null}
      {hasFilters && (tab !== "offers" || v2) ? <Button type="button" variant="secondary" className={styles.clear} onClick={clearFilters}>ფილტრების გასუფთავება</Button> : null}
      {admin.mode === "legacy" && (tab === "requests" || peopleTab) ? <>
        <p className={styles.count} role="status">ნაჩვენებია {tab === "requests" ? filteredRequests.length : filteredUsers.length} / {tab === "requests" ? requests.length : users.length} ჩატვირთული ჩანაწერი{adminNote}.</p>
        <p className={styles.note}>{tab === "requests" ? "ძიება მოიცავს ჩატვირთულ მოთხოვნებს — მაქსიმუმ ბოლო 1 000 ჩანაწერს. ზედა მაჩვენებლები მთელ პლატფორმას ასახავს." : "ძიება მოიცავს ამჟამად ჩატვირთულ მომხმარებლებს. განახლებული მონაცემებისთვის განაახლეთ გვერდი."}</p>
      </> : null}
      {(tab === "requests" || peopleTab) && canShowRecords ? <div className={styles.listTools}>
        {admin.mode === "ready" && admin.page ? <p className={styles.count} role="status">{admin.page.filteredTotal} ჩანაწერი{adminNote}</p> : <span />}
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={exporting}><Icon name="download" />{exporting ? "მზადდება…" : "CSV ექსპორტი"}</Button></div>
        : admin.mode === "ready" && admin.page ? <p className={styles.count} role="status">{admin.page.filteredTotal} ჩანაწერი</p> : null}
      {admin.mode === "loading" ? <ListSkeleton compact kind="records" label="ჩანაწერები იტვირთება…" /> : null}
      {admin.mode === "ready" && admin.error ? <p className="ma-field__error" role="status">{admin.error} <Button variant="ghost" onClick={admin.reload}>ხელახლა ცდა</Button></p> : null}
      {admin.mode === "error" ? <AdminState error title="ჩანაწერები ვერ ჩაიტვირთა" text={admin.error || undefined} onRetry={admin.reload} onFirst={cursor ? () => setFilter("cursor", "") : undefined} /> : null}
      {((tab === "offers" && !v2) || (tab === "audit" && admin.mode === "legacy")) ? <AdminState title="საჭიროა ბაზის განახლება" text={tab === "offers" ? "შეთავაზებების მოდერაცია ხელმისაწვდომი გახდება ადმინისტრირების API v2-ის ამოქმედების შემდეგ." : "მოქმედებების ჟურნალი ამ ვერსიაში ხელმისაწვდომი არ არის."} /> : null}
      {canShowRecords && !(tab === "offers" && !v2) && !(tab === "audit" && admin.mode === "legacy") && (tab === "requests" ? !filteredRequests.length : peopleTab ? !filteredUsers.length : !admin.page?.items.length) ? <AdminState
        title={hasFilters || auditAction || auditTarget ? "ამ ფილტრებით ჩანაწერები ვერ მოიძებნა" : cursor ? "ამ გვერდზე ჩანაწერები აღარ არის" : "ჩანაწერები ჯერ არ არის"}
        text={hasFilters || auditAction || auditTarget ? "შეცვალეთ ძიება ან გაასუფთავეთ ფილტრები." : "ახალი ჩანაწერები აქ გამოჩნდება."}
        onClear={hasFilters || auditAction || auditTarget ? clearFilters : undefined} onFirst={cursor ? () => setFilter("cursor", "") : undefined} /> : null}
      {tab === "audit" && admin.mode === "ready" && !!admin.page?.items.length ? <AdminAuditTable events={admin.page.items as unknown as AdminAuditEvent[]} onOpen={setDetail} /> : null}
      {tab === "offers" && admin.mode === "ready" && !!admin.page?.items.length ? <AdminOffersTable offers={admin.page.items as unknown as AdminOffer[]} onOpen={setDetail}
        onDelete={offer => setPendingAction({ kind: "offers", action: "deleteOffer", id: offer.id, label: `${offer.company_name || "კომპანია"} · ${offer.request_title || offer.body.slice(0, 80)}` })} /> : null}
      {canShowRecords && tab === "requests" && filteredRequests.length > 0 ? (
        <div className="ma-table-wrap">
          <table className={`ma-table ${styles.compactRequests}`}>
            <caption className="ma-sr-only">მოთხოვნები — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>{selectAll}</th>
                <th scope="col">მოთხოვნა</th>
                <th scope="col">ავტორი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">შეთავაზებები</th>
                <th scope="col"><span className="ma-sr-only">მოქმედება</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => {
                const owner = store?.userById(r.ownerId);
                const state = admin.mode === "ready" ? r.state : store?.requestState(r);
                const count = admin.mode === "ready" ? r.offerCount ?? 0 : store?.offerCount(r.id) ?? 0;
                return (
                  <tr key={r.id} data-selected={selected.includes(r.id) || undefined}>
                    <td className={styles.checkCell}><label className={styles.checkHit}><input type="checkbox" className={styles.check} aria-label={`მონიშვნა: ${r.title}`} checked={selected.includes(r.id)} onChange={() => toggleSelected(r.id)} /></label></td>
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
                    </td>
                    <td data-label="სტატუსი">
                      <span className={`ma-badge ma-badge--${state === "open" ? "success" : r.hidden ? "warning" : "neutral"}`}>
                        {r.hidden ? "დამალული" : requestStates[state || ""] || "დახურული"}
                      </span>
                      {r.hidden && r.hiddenReason ? <small>მიზეზი: {r.hiddenReason}</small> : null}
                    </td>
                    <td data-label="შეთავაზებები"><span className={styles.mobileOnly}>შეთავაზებები: </span>{count}</td>
                    <td data-label="მოქმედება"><Button type="button" variant="secondary" onClick={() => setDetail({ kind: "request", id: r.id })}>დეტალების ნახვა</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : canShowRecords && peopleTab && filteredUsers.length > 0 ? (
        <div className="ma-table-wrap">
          <table className={`ma-table ${styles.compactUsers}`}>
            <caption className="ma-sr-only">{tab === "companies" ? "კომპანიები" : "მომხმარებლები"} — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>{selectAll}</th>
                <th scope="col">{tab === "companies" ? "კომპანია" : "მომხმარებელი"}</th>
                <th scope="col">{tab === "companies" ? "საქმიანობა" : "როლი"}</th>
                <th scope="col">კონტაქტი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col"><span className="ma-sr-only">მოქმედება</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} data-selected={selected.includes(u.id) || undefined}>
                  <td className={styles.checkCell}>{u.role !== "admin" ? <label className={styles.checkHit}><input type="checkbox" className={styles.check} aria-label={`მონიშვნა: ${u.company || u.name}`} checked={selected.includes(u.id)} onChange={() => toggleSelected(u.id)} /></label> : null}</td>
                  <td data-label={tab === "companies" ? "კომპანია" : "მომხმარებელი"}>
                    <button type="button" className={styles.rowLink} onClick={() => setDetail({ kind: "user", id: u.id })}>{u.company || u.name}</button>
                    <small>{[u.name !== (u.company || u.name) ? u.name : null, cities[u.city] || u.city, tab === "companies" ? categories[u.industry || ""] || u.industry : null].filter(Boolean).join(" · ")}</small>
                  </td>
                  <td data-label={tab === "companies" ? "საქმიანობა" : "როლი"}>
                    {tab === "companies" ? categories[u.industry || ""] || u.industry || "—" : u.role === "company" ? "კომპანია" : u.role === "admin" ? "ადმინი" : "კლიენტი"}
                  </td>
                  <td data-label="კონტაქტი" className={styles.userContact}>
                    {u.phone ? <a href={`tel:${u.phone.replace(/[^+\d]/g, "")}`}>{u.phone}</a> : null}
                    {u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : null}
                    {!u.phone && !u.email ? "—" : null}
                  </td>
                  <td data-label="სტატუსი">
                    <AdminUserStatus user={u} onAction={setPendingAction} />
                  </td>
                  <td data-label="მოქმედება"><Button type="button" variant="secondary" onClick={() => setDetail({ kind: "user", id: u.id })}>დეტალების ნახვა</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {(tab === "requests" || peopleTab) && selected.length ? <div className={styles.bulkBar} role="region" aria-label="მონიშნულ ჩანაწერებზე მოქმედებები">
        <strong>{selected.length} მონიშნული</strong>
        {bulkActions.map(b => { const ids = bulkTargets(b.action); return <Button key={b.action} type="button" disabled={!ids.length}
          variant={b.danger ? "danger-quiet" : "secondary"}
          onClick={() => setPendingAction({ kind: peopleTab ? "users" : "requests", action: b.action, id: ids[0], ids, label: `${ids.length} ჩანაწერი` })}>{b.label}{ids.length !== selected.length ? ` (${ids.length})` : ""}</Button>; })}
        <Button type="button" variant="ghost" onClick={() => setSelected([])}>მონიშვნის მოხსნა</Button>
      </div> : null}
      {admin.mode === "ready" && admin.page && (cursor || admin.page.hasMore) ? <nav className={styles.pagination} aria-label="ჩანაწერების გვერდები">
        {cursor ? <Button type="button" variant="secondary" onClick={() => setFilter("cursor", "")}>პირველი გვერდი</Button> : null}
        {admin.page.hasMore && admin.page.nextCursor ? <Button type="button" variant="secondary" onClick={() => setFilter("cursor", typeof admin.page!.nextCursor === "string" ? admin.page!.nextCursor : JSON.stringify(admin.page!.nextCursor))}>შემდეგი გვერდი</Button> : null}
      </nav> : null}
      </section> : null}
      {tab === "audit" ? <AdminBusinessAudit store={store!} /> : null}
      </div>
      <AdminDetail store={store!} target={detail} v2={v2} revision={revision} onClose={() => setDetail(null)} onOpen={setDetail} onAction={setPendingAction} />
      <ModerationSheet
        open={!!pendingAction}
        subject={pendingAction?.label || ""}
        action={pendingAction?.action || ""}
        choice={pendingAction?.choice}
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

const requestStates: Record<string, string> = { open: "ღია", chosen: "მომწოდებელი არჩეულია", expired: "ვადაგასული", closed: "დახურული", hidden: "დამალული" };
