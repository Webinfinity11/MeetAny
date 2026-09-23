"use client";

import { AccountSkeleton, ListSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "../Toasts";
import { Icon } from "../Icon";
import { useAdminData } from "../../lib/use-admin-data";
import { AdminAuditTable, type AdminAuditEvent } from "./AdminAuditTable";
import { AdminContacts } from "./AdminContacts";
import { PageBand } from "./PageBand";
import { AdminFilters } from "./AdminFilters";
import styles from "./admin.module.css";
import { ModerationSheet } from "./ModerationSheet";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";

type PendingAction = { kind: "requests" | "users"; action: string; id: string; label: string } | null;

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
  const tab = selectedTab === "users" || selectedTab === "audit" || selectedTab === "contacts" ? selectedTab : "requests";
  const cursor = searchParams.get("cursor") || "";
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = ready && available ? store?.currentUser() : null;

  const admin = useAdminData({ store, enabled: !!me && me.role === "admin" && tab !== "contacts", tab: tab === "contacts" ? "audit" : tab, query, status, role, cursor });

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
            <Link className="ma-btn ma-btn--primary" href="/account/">
              შესვლა
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const { stats, requests, users } = data!;

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (value: string) => terms.every(term => value.toLocaleLowerCase().includes(term));
  const cachedRequests = requests.filter(r => {
    const owner = store?.userById(r.ownerId);
    return (!status || store?.requestState(r) === status) && matches(`${r.title} ${r.id} ${owner?.company || ""} ${owner?.name || ""}`);
  });
  const cachedUsers = users.filter(u => (!role || u.role === role) && (!status || (status === "blocked" ? u.blocked : status === "verified" ? u.role === "company" && u.verified && !u.blocked : !u.blocked)) && matches(`${u.company || ""} ${u.name} ${u.email} ${u.phone} ${u.id}`));

  const filteredRequests = admin.mode === "legacy" ? cachedRequests : (tab === "requests" ? admin.page?.items || [] : []) as unknown as typeof requests;
  const filteredUsers = admin.mode === "legacy" ? cachedUsers : (tab === "users" ? admin.page?.items || [] : []) as unknown as typeof users;
  const canShowRecords = admin.mode === "legacy" || admin.mode === "ready";

  async function confirm(reason: string) {
    if (!pendingAction || !store) return;
    setBusy(true);
    setError(null);
    try {
      if (pendingAction.kind === "requests") {
        if (pendingAction.action === "hide") await store.adminSetHidden(pendingAction.id, true, reason);
        else if (pendingAction.action === "unhide") await store.adminSetHidden(pendingAction.id, false);
        else if (pendingAction.action === "delete") await store.adminDeleteRequest(pendingAction.id);
      } else {
        if (pendingAction.action === "verify") await store.adminSetVerified(pendingAction.id, true);
        else if (pendingAction.action === "unverify") await store.adminSetVerified(pendingAction.id, false);
        else if (pendingAction.action === "block") await store.adminSetBlocked(pendingAction.id, true, reason);
        else if (pendingAction.action === "unblock") await store.adminSetBlocked(pendingAction.id, false);
      }
      setPendingAction(null);
      admin.reload();
      toast("ცვლილება შენახულია.");
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`ma-page ${styles.workspace}`}>
      <PageBand eyebrow="MeetAny · ადმინისტრირება" title="პლატფორმის მართვა" />
      <div className="ma-proto-kpis">
        {[
          ["users", "მომხმარებელი", stats.users],
          ["companies", "კომპანია", stats.companies],
          ["verified", "დადასტურებული", stats.verified],
          ["open", "ღია მოთხოვნა", stats.open],
          ["offers", "შეთავაზება", stats.offers],
          ["chosen", "არჩეული შეთავაზება", stats.chosen],
        ].map(([key, label, value]) => (
          <div className="ma-stat" key={key as string}>
            <strong className="ma-stat__value">{value as number}</strong>
            <span className="ma-stat__label">{label as string}</span>
          </div>
        ))}
      </div>
      <nav className="ma-tabs" aria-label="ადმინისტრირების განყოფილებები">
        <Link className="ma-tab" href="/admin/?tab=requests" aria-current={tab === "requests" ? "page" : undefined}>
          მოთხოვნები
        </Link>
        <Link className="ma-tab" href="/admin/?tab=users" aria-current={tab === "users" ? "page" : undefined}>
          მომხმარებლები
        </Link>
        <Link className="ma-tab" href="/admin/?tab=audit" aria-current={tab === "audit" ? "page" : undefined}>მოქმედებების ჟურნალი</Link>
        <Link className="ma-tab" href="/admin/?tab=contacts" aria-current={tab === "contacts" ? "page" : undefined}>კონტაქტები</Link>
      </nav>

      {tab === "contacts" ? <AdminContacts store={store!} kind={searchParams.get("kind") || ""} target={searchParams.get("target") || ""} period={searchParams.get("period") || "month"} cursor={cursor} onChange={setFilter} /> : <>
      {tab !== "audit" ? <AdminFilters tab={tab} query={query} status={status} role={role} onChange={setFilter} /> : null}
      {admin.mode === "legacy" && tab !== "audit" ? <>
        <p className={styles.count} role="status">ნაჩვენებია {tab === "requests" ? filteredRequests.length : filteredUsers.length} / {tab === "requests" ? requests.length : users.length} ჩატვირთული ჩანაწერი.</p>
        <p className={styles.note}>{tab === "requests" ? "ძიება მოიცავს ჩატვირთულ მოთხოვნებს — მაქსიმუმ ბოლო 1 000 ჩანაწერს. ზედა მაჩვენებლები მთელ პლატფორმას ასახავს." : "ძიება მოიცავს ამჟამად ჩატვირთულ მომხმარებლებს. განახლებული მონაცემებისთვის განაახლე გვერდი."}</p>
      </> : null}
      {admin.mode === "ready" && admin.page ? <p className={styles.count} role="status">ამ გვერდზე {admin.page.items.length} ჩანაწერია · ფილტრებით სულ {admin.page.filteredTotal}.</p> : null}
      {admin.mode === "loading" ? <ListSkeleton compact kind="records" label="ჩანაწერები იტვირთება…" /> : null}
      {admin.mode === "error" ? <div role="alert"><p>{admin.error || "ჩანაწერების ჩატვირთვა ვერ მოხერხდა."}</p><button type="button" className="ma-btn ma-btn--secondary" onClick={admin.reload}>ხელახლა ცდა</button>{cursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setFilter("cursor", "")}>პირველი გვერდი</button> : null}</div> : null}
      {tab === "audit" ? admin.mode === "legacy" ? <p className={styles.note}>მოქმედებების ჟურნალისთვის საჭიროა მონაცემთა ბაზის განახლება. წარსული მოქმედებების ისტორია ამ ვერსიაში არ ინახება.</p> : admin.mode === "ready" ? <AdminAuditTable events={(admin.page?.items || []) as unknown as AdminAuditEvent[]} /> : null : null}
      {canShowRecords && tab === "requests" ? (
        <div className="ma-table-wrap">
          <table className="ma-table">
            <caption className="ma-sr-only">მოთხოვნა — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col">მოთხოვნა</th>
                <th scope="col">ავტორი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">შეთავაზებები</th>
                <th scope="col">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? <tr><td colSpan={5}>ამ ფილტრებით მოთხოვნა ვერ მოიძებნა.</td></tr> : null}
              {filteredRequests.map((r) => {
                const owner = store?.userById(r.ownerId);
                const state = admin.mode === "ready" ? r.state : store?.requestState(r);
                const count = admin.mode === "ready" ? r.offerCount ?? 0 : store?.offerCount(r.id) ?? 0;
                return (
                  <tr key={r.id}>
                    <td data-label="მოთხოვნა">
                      <Link className="ma-link" href={`/requests/view/?id=${r.id}`}>
                        {r.title}
                      </Link>
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
      ) : canShowRecords && tab === "users" ? (
        <div className="ma-table-wrap">
          <table className="ma-table">
            <caption className="ma-sr-only">მომხმარებელი — მოდერაცია</caption>
            <thead>
              <tr>
                <th scope="col">მომხმარებელი</th>
                <th scope="col">როლი</th>
                <th scope="col">კონტაქტი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">მოქმედება</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? <tr><td colSpan={5}>ამ ფილტრებით მომხმარებელი ვერ მოიძებნა.</td></tr> : null}
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td data-label="მომხმარებელი">
                    {u.company || u.name}
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
      {admin.mode === "ready" && admin.page ? <nav className={styles.pagination} aria-label="ჩანაწერების გვერდები">
        {cursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setFilter("cursor", "")}>პირველი გვერდი</button> : null}
        {admin.page.hasMore && admin.page.nextCursor ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setFilter("cursor", typeof admin.page!.nextCursor === "string" ? admin.page!.nextCursor : JSON.stringify(admin.page!.nextCursor))}>შემდეგი გვერდი<Icon name="arrow-right" /></button> : null}
      </nav> : null}

      </>}
      <ModerationSheet
        open={!!pendingAction}
        title={
          pendingAction
            ? { hide: "მოთხოვნის დამალვა", unhide: "მოთხოვნის გამოჩენა", delete: "მოთხოვნის წაშლა", verify: "დადასტურება", unverify: "დადასტურების მოხსნა", block: "დაბლოკვა", unblock: "განბლოკვა" }[pendingAction.action] || ""
            : ""
        }
        subject={pendingAction?.label || ""}
        action={pendingAction?.action || ""}
        pending={busy}
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
