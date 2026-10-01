"use client";
import { Button } from "../ui/Button";


import { useEffect, useState } from "react";
import { Sheet } from "../ui/Sheet";
import type { Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { isTestAccount } from "../../lib/admin-helpers";
import styles from "./admin.module.css";

export type AdminTarget = { kind: "user" | "request"; id: string } | null;
type Action = { kind: "requests" | "users"; action: string; id: string; label: string };

type User = { id: string; role: string; name: string; company?: string; email?: string; phone?: string; city?: string; industry?: string;
  about?: string; verified?: boolean; blocked?: boolean; blocked_reason?: string; created_at?: string };
type Offer = { id: string; request_id?: string; request_title?: string; body: string; price?: number | null; status: string; created_at: string; company_id?: string };
type Request = { id: string; title: string; body?: string; category: string; city: string; createdAt: string; expiresAt?: string; ownerId: string;
  hidden: boolean; hiddenReason?: string };

const stateLabel: Record<string, string> = { open: "ღია", chosen: "არჩეული", expired: "ვადაგასული", closed: "დახურული" };

/** Side drawer with everything about one user or one request, and its moderation actions. */
export function AdminDetail({ store, target, v2, onClose, onOpen, onAction }: {
  store: Store; target: AdminTarget; v2: boolean;
  onClose: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: Action) => void;
}) {
  // Results are keyed by the user and data revision, so a new target never shows the previous one.
  const [loaded, setLoaded] = useState<{ key: string; user: User | null; offers: Offer[] | null; error: boolean } | null>(null);
  const revision = store.dataRevision();
  const key = target?.kind === "user" ? `${target.id}:${revision}` : "";

  useEffect(() => {
    if (target?.kind !== "user") return;
    let cancelled = false;
    store.adminSearchUsers({ p_q: target.id, p_limit: 1 }).then(async (page: { items: User[] }) => {
      const found = page.items.find(u => u.id === target.id) || null;
      if (cancelled) return;
      setLoaded({ key, user: found, offers: null, error: false });
      if (found?.role === "company" && v2) {
        // A failed offers read leaves the profile visible; the list then shows as empty.
        const list = await store.adminSearchOffers({ p_q: found.company || found.name, p_limit: 20 }).catch(() => ({ items: [] }));
        if (!cancelled) setLoaded({ key, user: found, offers: (list.items as Offer[]).filter(o => !o.company_id || o.company_id === found.id), error: false });
      }
    }).catch(() => { if (!cancelled) setLoaded({ key, user: null, offers: null, error: true }); });
    return () => { cancelled = true; };
  }, [store, target, v2, key]);
  const current = loaded?.key === key ? loaded : null;
  const user = current?.user || null, offers = current?.offers || null, error = !!current?.error;

  const request: Request | null = target?.kind === "request" ? store.getRequest(target.id) : null;
  const owner: User | null = request ? store.userById(request.ownerId) : null;
  const userRequests: Request[] = target?.kind === "user"
    ? (store.listRequests({ state: "", includeHidden: true }) as Request[]).filter(r => r.ownerId === target.id) : [];

  const title = target?.kind === "request" ? "მოთხოვნა" : "მომხმარებელი";
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (target?.kind === "user") {
    if (error) body = <p className={styles.note}>მონაცემები ვერ ჩაიტვირთა.</p>;
    else if (!user) body = <p className={styles.note}>იტვირთება…</p>;
    else {
      const label = user.company || user.name;
      body = <div className={styles.detail}>
        <div className={styles.detailHead}>
          <h3>{label}</h3>
          <p>{user.role === "company" ? "კომპანია" : user.role === "admin" ? "ადმინი" : "კლიენტი"}{user.industry ? ` · ${categories[user.industry] || user.industry}` : ""}</p>
          <div className={styles.detailBadges}>
            {user.blocked ? <span className="ma-badge ma-badge--danger">დაბლოკილი</span>
              : user.role === "company" && user.verified ? <span className="ma-badge ma-badge--success">დადასტურებული</span>
              : <span className="ma-badge ma-badge--info">აქტიური</span>}
            {isTestAccount(user) ? <span className="ma-badge ma-badge--neutral">სატესტო</span> : null}
          </div>
          {user.blocked && user.blocked_reason ? <p className={styles.note}>მიზეზი: {user.blocked_reason}</p> : null}
        </div>
        <dl className={styles.detailFacts}>
          <dt>სახელი</dt><dd>{user.name}</dd>
          <dt>ტელეფონი</dt><dd>{user.phone ? <a href={`tel:${user.phone.replace(/[^+\d]/g, "")}`}>{user.phone}</a> : "—"}</dd>
          <dt>ელფოსტა</dt><dd>{user.email ? <a href={`mailto:${user.email}`}>{user.email}</a> : "—"}</dd>
          <dt>ქალაქი</dt><dd>{cities[user.city || ""] || user.city || "—"}</dd>
          <dt>რეგისტრაცია</dt><dd>{user.created_at ? dateLabel(user.created_at) : "—"}</dd>
        </dl>
        {user.about ? <p className={styles.detailText}>{user.about}</p> : null}
        <section className={styles.detailList}>
          <h4>მოთხოვნები <span>{userRequests.length}</span></h4>
          {userRequests.length ? <ul>{userRequests.slice(0, 8).map(r => <li key={r.id}>
            <button type="button" onClick={() => onOpen({ kind: "request", id: r.id })}>{r.title}</button>
            <small>{r.hidden ? "დამალული" : stateLabel[store.requestState(r)] || ""} · {store.offerCount(r.id)} შეთავაზება</small>
          </li>)}</ul> : <p className={styles.note}>მოთხოვნები არ აქვს.</p>}
        </section>
        {user.role === "company" && v2 ? <section className={styles.detailList}>
          <h4>გაგზავნილი შეთავაზებები <span>{offers?.length ?? "…"}</span></h4>
          {offers?.length ? <ul>{offers.slice(0, 8).map(o => <li key={o.id}>
            {o.request_id ? <button type="button" onClick={() => onOpen({ kind: "request", id: o.request_id! })}>{o.request_title || "მოთხოვნა"}</button> : <span>{o.request_title || "მოთხოვნა"}</span>}
            <small>{o.status === "chosen" ? "არჩეული" : "გაგზავნილი"} · {o.price ? `${o.price} ₾` : "ფასი შეთანხმებით"} · {dateLabel(o.created_at)}</small>
          </li>)}</ul> : offers ? <p className={styles.note}>შეთავაზებები არ აქვს.</p> : null}
        </section> : null}
      </div>;
      footer = <div className={styles.detailActions}>
        {user.role === "company" ? <Button variant="ghost" href={`/companies/view/?id=${user.id}`} target="_blank">საჯარო გვერდი</Button> : null}
        {user.role === "company" ? <Button type="button" variant="secondary" onClick={() => onAction({ kind: "users", action: user.verified ? "unverify" : "verify", id: user.id, label })}>{user.verified ? "დადასტურების მოხსნა" : "დადასტურება"}</Button> : null}
        {user.role !== "admin" ? <Button type="button" variant="danger-quiet" onClick={() => onAction({ kind: "users", action: user.blocked ? "unblock" : "block", id: user.id, label })}>{user.blocked ? "განბლოკვა" : "დაბლოკვა"}</Button> : null}
      </div>;
    }
  } else if (target?.kind === "request") {
    if (!request) body = <p className={styles.note}>მოთხოვნა ვერ მოიძებნა — შესაძლოა წაშლილია.</p>;
    else {
      const state = request.hidden ? "დამალული" : stateLabel[store.requestState(request)] || "";
      body = <div className={styles.detail}>
        <div className={styles.detailHead}>
          <h3>{request.title}</h3>
          <p>{categories[request.category] || request.category} · {cities[request.city] || request.city}</p>
          <div className={styles.detailBadges}><span className={`ma-badge ma-badge--${request.hidden ? "warning" : store.requestState(request) === "open" ? "success" : "neutral"}`}>{state}</span></div>
          {request.hidden && request.hiddenReason ? <p className={styles.note}>მიზეზი: {request.hiddenReason}</p> : null}
        </div>
        {request.body ? <p className={styles.detailText}>{request.body}</p> : null}
        <dl className={styles.detailFacts}>
          <dt>ავტორი</dt><dd>{owner ? <button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: owner.id })}>{owner.company || owner.name}</button> : "—"}</dd>
          <dt>შეთავაზებები</dt><dd>{store.offerCount(request.id)}</dd>
          <dt>გამოქვეყნდა</dt><dd>{dateLabel(request.createdAt)}</dd>
          {request.expiresAt ? <><dt>ვადა</dt><dd>{dateLabel(request.expiresAt)}</dd></> : null}
        </dl>
      </div>;
      footer = <div className={styles.detailActions}>
        <Button variant="ghost" href={`/requests/view/?id=${request.id}`} target="_blank">საჯარო გვერდი</Button>
        <Button type="button" variant="secondary" onClick={() => onAction({ kind: "requests", action: request.hidden ? "unhide" : "hide", id: request.id, label: request.title })}>{request.hidden ? "გამოჩენა" : "დამალვა"}</Button>
        <Button type="button" variant="danger-quiet" onClick={() => onAction({ kind: "requests", action: "delete", id: request.id, label: request.title })}>წაშლა</Button>
      </div>;
    }
  }

  return <Sheet open={!!target} onClose={onClose} title={title} footer={footer} className={styles.drawer}>{body}</Sheet>;
}
