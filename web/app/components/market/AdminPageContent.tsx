"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { PageBand } from "./PageBand";
import { SectionHead } from "./SectionHead";
import { ModerationSheet } from "./ModerationSheet";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";

type PendingAction = { kind: "requests" | "users"; action: string; id: string; label: string } | null;

export function AdminPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "users" ? "users" : "requests";
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = ready && available ? store?.currentUser() : null;

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

  if (!ready || !available) {
    return (
      <div className="ma-page" aria-busy="true">
        <p role="status">იტვირთება…</p>
      </div>
    );
  }

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

  async function confirm() {
    if (!pendingAction || !store) return;
    setBusy(true);
    setError(null);
    try {
      if (pendingAction.kind === "requests") {
        if (pendingAction.action === "hide") await store.adminSetHidden(pendingAction.id, true, "ადმინის მიერ დამალული");
        else if (pendingAction.action === "unhide") await store.adminSetHidden(pendingAction.id, false);
        else if (pendingAction.action === "delete") await store.adminDeleteRequest(pendingAction.id);
      } else {
        if (pendingAction.action === "verify") await store.adminSetVerified(pendingAction.id, true);
        else if (pendingAction.action === "unverify") await store.adminSetVerified(pendingAction.id, false);
        else if (pendingAction.action === "block") await store.adminSetBlocked(pendingAction.id, true, "ადმინის მიერ დაბლოკილი");
        else if (pendingAction.action === "unblock") await store.adminSetBlocked(pendingAction.id, false);
      }
      setPendingAction(null);
    } catch (err) {
      setError((err as { userMessage?: string })?.userMessage || "ვერ შესრულდა.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ma-page">
      <PageBand eyebrow="MeetAny · საქმიანი კავშირები" title="ადმინ-პანელი" description="მოთხოვნების მოდერაცია და მომხმარებლების მართვა." />
      <SectionHead eyebrow="ადმინისტრირება" title="პლატფორმის მიმოხილვა" />
      <div className="ma-proto-kpis">
        {[
          ["users", "მომხმარებელი", stats.users],
          ["companies", "კომპანია", stats.companies],
          ["verified", "დადასტურებული", stats.verified],
          ["open", "ღია მოთხოვნა", stats.open],
          ["offers", "შეთავაზება", stats.offers],
          ["chosen", "არჩეული გარიგება", stats.chosen],
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
      </nav>

      {tab === "requests" ? (
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
              {requests.map((r) => {
                const owner = store?.userById(r.ownerId);
                const state = store?.requestState(r);
                const count = store?.offerCount(r.id) ?? 0;
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
                      {owner?.company || owner?.name || "—"}
                      <small>{owner?.phone || ""}</small>
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
      ) : (
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
              {users.map((u) => (
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
      )}

      <ModerationSheet
        open={!!pendingAction}
        title={
          pendingAction
            ? { hide: "მოთხოვნის დამალვა", unhide: "მოთხოვნის გამოჩენა", delete: "მოთხოვნის წაშლა", verify: "დადასტურება", unverify: "დადასტურების მოხსნა", block: "დაბლოკვა", unblock: "განბლოკვა" }[pendingAction.action] || ""
            : ""
        }
        subject={pendingAction?.label || ""}
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
