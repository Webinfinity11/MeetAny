"use client";
import { Button } from "../ui/Button";
import { useEffect, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../Icon";
import type { Store } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { accountIntentLabels, companyStatus } from "../../lib/admin-helpers";
import { listAdminDeals, dealStageLabels, type AdminDealPage } from "../../lib/admin-deals";
import { AdminVerification } from "./VerificationDocuments";
import { AdminEditPanel } from "./AdminEditPanel";
import { AdminRequestExtras } from "./AdminRequestExtras";
import { AdminOfferDetail } from "./AdminOfferDetail";
import { AdminDealDetail } from "./AdminDealDetail";
import { offerPrice, offerStatuses } from "./AdminOffersTable";
import type { ModerationChoice } from "./ModerationSheet";
import styles from "./admin.module.css";

export type AdminTarget = { kind: "user" | "request" | "offer" | "deal"; id: string } | null;
/** One moderation request: what, on which record, shown to the admin as `label`. */
export type AdminAction = {
  reviewBody?: string;
  kind: "requests" | "users" | "offers" | "photos" | "reports" | "reviews" | "deals" | "issues";
  action: string; id: string; label: string; ids?: string[]; url?: string; choice?: ModerationChoice;
};

type User = { id: string; role: string; name: string; company?: string; email?: string; phone?: string; city?: string; industry?: string;
  about?: string; verified?: boolean; blocked?: boolean; blocked_reason?: string; created_at?: string; account_intent?: string | null;
  verification_documents_status?: string; legal_name?: string | null; registration_code?: string | null; legal_form?: string | null;
  website?: string | null; founded_year?: number | null; employee_band?: string | null };
type Offer = { id: string; request_id?: string; request_title?: string; body: string; price?: number | null; price_type?: string | null; status: string; created_at: string; company_id?: string };
type Request = { id: string; title: string; body?: string; category: string; city: string; createdAt: string; expiresAt?: string; ownerId: string;
  hidden: boolean; hiddenReason?: string };

const stateLabel: Record<string, string> = { open: "ღია", chosen: "მომწოდებელი არჩეულია", expired: "ვადაგასული", closed: "დახურული" };

/** Side drawer with everything about one account, request, offer or deal, and its moderation actions. */
export function AdminDetail({ store, target, v2, revision = 0, onClose, onOpen, onAction }: {
  store: Store; target: AdminTarget; v2: boolean; revision?: number;
  onClose: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void;
}) {
  if (target?.kind === "offer") return <AdminOfferDetail store={store} id={target.id} revision={revision} onClose={onClose} onOpen={onOpen} onAction={onAction} />;
  if (target?.kind === "deal") return <AdminDealDetail store={store} id={target.id} revision={revision} onClose={onClose} onOpen={onOpen} onAction={onAction} />;
  return <AccountOrRequest store={store} target={target} v2={v2} revision={revision} onClose={onClose} onOpen={onOpen} onAction={onAction} />;
}

function AccountOrRequest({ store, target, v2, revision, onClose, onOpen, onAction }: {
  store: Store; target: AdminTarget; v2: boolean; revision: number;
  onClose: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void;
}) {
  // Results are keyed by the target and data revision, so a new target never shows the previous one.
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState<"close" | "cancel" | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const editing = target ? editTarget === `${target.kind}:${target.id}` : false;
  const requestClose = () => { if (editing && dirty) setDiscard("close"); else {setEditTarget(null);setDirty(false);onClose();} };
  const requestCancel = () => {if(dirty)setDiscard("cancel");else setEditTarget(null);};
  const [loaded, setLoaded] = useState<{ key: string; user: User | null; offers: Offer[] | null; error: boolean; offersError: boolean } | null>(null);
  const [requestLoaded, setRequestLoaded] = useState<{ key: string; request: Request | null; error: boolean } | null>(null);
  const [deals, setDeals] = useState<{ key: string; page: AdminDealPage | null }>({ key: "", page: null });
  const [loadRevision, setLoadRevision] = useState(0);
  const retry = () => setLoadRevision(value => value + 1);
  const {adminSearchUsers, adminSearchOffers, ensureRequest} = store;
  const dataRevision = `${store.dataRevision()}:${revision}`;
  const key = target?.kind === "user" ? `${target.id}:${dataRevision}` : "";
  const requestKey = target?.kind === "request" ? `${target.id}:${dataRevision}` : "";
  const dealsKey = target && (target.kind === "user" || target.kind === "request") ? `${target.kind}:${target.id}:${dataRevision}` : "";

  useEffect(() => {
    if (target?.kind !== "user") return;
    let cancelled = false;
    adminSearchUsers({ p_q: target.id, p_limit: 1 }).then(async (page: { items: User[] }) => {
      const found = page.items.find(u => u.id === target.id) || null;
      if (cancelled) return;
      setLoaded(previous => ({ key, user: found, offers: previous?.key === key ? previous.offers : null, error: false, offersError: false }));
      if (found?.role === "company" && v2) {
        try {
          const list = await adminSearchOffers({ p_q: found.id, p_limit: 20 });
          if (!cancelled) setLoaded({ key, user: found, offers: (list.items as Offer[]).filter(o => o.company_id === found.id), error: false, offersError: false });
        } catch {
          if (!cancelled) setLoaded(previous => ({ key, user: found, offers: previous?.key === key ? previous.offers : null, error: false, offersError: true }));
        }
      }
    }).catch(() => { if (!cancelled) setLoaded({ key, user: null, offers: null, error: true, offersError: false }); });
    return () => { cancelled = true; };
  }, [adminSearchUsers, adminSearchOffers, target, v2, key, loadRevision]);
  useEffect(() => {
    if (target?.kind !== "request") return;
    let cancelled = false;
    ensureRequest(target.id, {cached: true}).then((request: Request | null) => {
      if (!cancelled) setRequestLoaded({key: requestKey, request, error: false});
    }).catch(() => {if (!cancelled) setRequestLoaded(previous => ({key: requestKey, request: previous?.key === requestKey ? previous.request : null, error: true}));});
    return () => {cancelled = true;};
  }, [ensureRequest, target, requestKey, loadRevision]);
  // Deals of an account (as buyer or supplier) or of a request: the search matches party and request ids.
  useEffect(() => {
    if (!dealsKey || !target) return;
    let cancelled = false;
    listAdminDeals(store, { p_query: target.id, p_limit: 8 }).then(page => { if (!cancelled) setDeals({ key: dealsKey, page }); }, () => { if (!cancelled) setDeals({ key: dealsKey, page: null }); });
    return () => { cancelled = true; };
  }, [store, target, dealsKey, loadRevision]);
  const current = loaded?.key === key ? loaded : null;
  const user = current?.user || null, offers = current?.offers || null, error = !!current?.error;
  const dealPage = deals.key === dealsKey ? deals.page : null;

  const currentRequest = requestLoaded?.key === requestKey ? requestLoaded : null;
  const request: Request | null = target?.kind === "request" ? store.getRequest(target.id) || currentRequest?.request || null : null;
  const owner: User | null = request ? store.userById(request.ownerId) : null;
  const userRequests: Request[] = target?.kind === "user"
    ? (store.listRequests({ state: "", includeHidden: true }) as Request[]).filter(r => r.ownerId === target.id) : [];
  const requestDeal = target?.kind === "request" ? dealPage?.items.find(d => d.request_id === target.id) || null : null;

  const kindTitle = target?.kind === "request" ? "მოთხოვნა" : user?.role === "company" ? "კომპანია" : "ანგარიში";
  const title = editing ? `რედაქტირება · ${target?.kind === "request" ? request?.title || kindTitle : user?.company || user?.name || kindTitle}` : kindTitle;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  const dealList = (empty: string) => <section className={styles.detailList}>
    <h4>გარიგებები <span>{dealPage ? dealPage.filteredTotal : "…"}</span>{dealPage?.stageCounts?.complete ? <small>{dealPage.stageCounts.complete} დასრულებული</small> : null}</h4>
    {dealPage?.items.length ? <ul>{dealPage.items.map(d => <li key={d.id}>
      <button type="button" onClick={() => onOpen({ kind: "deal", id: d.id })}>{d.request_title}</button>
      <small>{dealStageLabels[d.stage]}{d.open_issue ? " · ღია პრობლემა" : ""} · {d.buyer_name} → {d.supplier_name}</small>
    </li>)}</ul> : dealPage ? <p className={styles.note}>{empty}</p> : null}
  </section>;

  if (target?.kind === "user") {
    if (error) body = <div role="alert"><p className={styles.note}>მონაცემები ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div>;
    else if (!user) body = <p className={styles.note} role="status">{current ? "ანგარიში ვერ მოიძებნა — შესაძლოა წაშლილია." : "იტვირთება…"}</p>;
    else {
      const label = user.company || user.name;
      const status = companyStatus(user);
      const company = user.role === "company";
      body = <div className={styles.detail}>
        <div className={styles.detailHead}>
          <h3>{label}</h3>
          <p>{company ? "კომპანია" : user.role === "admin" ? "ადმინი" : "კლიენტი"}{user.industry ? ` · ${categories[user.industry] || user.industry}` : ""}</p>
          <div className={styles.detailBadges}><span className={`ma-badge ma-badge--${status.tone}`}>{status.label}</span>
            {company ? <a className={styles.externalLink} href={`/companies/view/?id=${user.id}`} target="_blank" rel="noreferrer">საჯარო გვერდი<Icon name="external-link" /></a> : null}</div>
          {user.blocked && user.blocked_reason ? <p className={styles.note}>დაბლოკვის მიზეზი: {user.blocked_reason}</p> : null}
        </div>
        <dl className={styles.detailFacts}>
          <dt>სახელი</dt><dd>{user.name}</dd>
          <dt>ტელეფონი</dt><dd>{user.phone ? <a href={`tel:${user.phone.replace(/[^+\d]/g, "")}`}>{user.phone}</a> : "—"}</dd>
          <dt>ელფოსტა</dt><dd>{user.email ? <a href={`mailto:${user.email}`}>{user.email}</a> : "—"}</dd>
          <dt>ქალაქი</dt><dd>{cities[user.city || ""] || user.city || "—"}</dd>
          {user.account_intent ? <><dt>მიზანი</dt><dd>{accountIntentLabels[user.account_intent] || user.account_intent}</dd></> : null}
          <dt>რეგისტრაცია</dt><dd>{user.created_at ? dateLabel(user.created_at) : "—"}</dd>
          {company && user.legal_form ? <><dt>სამართლებრივი ფორმა</dt><dd>{user.legal_form}</dd></> : null}
          {company && user.website ? <><dt>ვებგვერდი</dt><dd><a href={user.website} target="_blank" rel="noreferrer">{user.website.replace(/^https?:\/\//, "")}</a></dd></> : null}
          {company && user.founded_year ? <><dt>დაარსდა</dt><dd>{user.founded_year}</dd></> : null}
          {company && user.employee_band ? <><dt>თანამშრომლები</dt><dd>{user.employee_band}</dd></> : null}
        </dl>
        {company ? <AdminVerification key={`${user.id}:${dataRevision}`} store={store} id={user.id} verified={!!user.verified} label={label} onAction={onAction} /> : null}
        {user.about ? <p className={styles.detailText}>{user.about}</p> : null}
        {dealList("გარიგებები ჯერ არ არის.")}
        <section className={styles.detailList}>
          <h4>მოთხოვნები <span>{userRequests.length}</span></h4>
          {userRequests.length ? <ul>{userRequests.slice(0, 8).map(r => <li key={r.id}>
            <button type="button" onClick={() => onOpen({ kind: "request", id: r.id })}>{r.title}</button>
            <small>{r.hidden ? "დამალული" : stateLabel[store.requestState(r)] || ""} · {store.offerCount(r.id)} შეთავაზება</small>
          </li>)}</ul> : <p className={styles.note}>მოთხოვნები არ აქვს.</p>}
          {userRequests.length > 8 ? <p className={styles.note}>ნაჩვენებია 8 ბოლო მოთხოვნა.</p> : null}
        </section>
        {company && v2 ? <section className={styles.detailList}>
          <h4>ბოლო შეთავაზებები <span>{offers ? Math.min(offers.length, 8) : current?.offersError ? "—" : "…"}</span></h4>
          {current?.offersError ? <div role="alert"><p className={styles.note}>შეთავაზებები ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div> : null}
          {offers?.length ? <ul>{offers.slice(0, 8).map(o => <li key={o.id}>
            <button type="button" onClick={() => onOpen({ kind: "offer", id: o.id })}>{o.request_title || "მოთხოვნა"}</button>
            <small>{offerStatuses[o.status] || ""} · {offerPrice({ price: o.price ?? null, price_type: o.price_type ?? null })} · {dateLabel(o.created_at)}</small>
          </li>)}</ul> : offers && !current?.offersError ? <p className={styles.note}>შეთავაზებები არ აქვს.</p> : null}
        </section> : null}
      </div>;
      if (editing) body = <AdminEditPanel store={store} row={{...user}} kind="user" onDirtyChange={setDirty} onDone={() => {setDirty(false);setEditTarget(null);setLoaded(null);}} onCancel={requestCancel} />;
      footer = editing ? null : <div className={styles.detailActions}>
        <Button type="button" variant="primary" onClick={() => setEditTarget(`user:${user.id}`)}>რედაქტირება</Button>
        {company && !user.blocked ? <Button type="button" variant="secondary" onClick={() => onAction({ kind: "users", action: user.verified ? "unverify" : "verify", id: user.id, label })}>{user.verified ? "ვერიფიკაციის მოხსნა…" : "ვერიფიცირება…"}</Button> : <span />}
        {user.role !== "admin" ? <div className={styles.dangerZone}><Button type="button" variant="danger-quiet" onClick={() => onAction({ kind: "users", action: user.blocked ? "unblock" : "block", id: user.id, label })}>{user.blocked ? "ანგარიშის განბლოკვა…" : "ანგარიშის დაბლოკვა…"}</Button></div> : null}
      </div>;
    }
  } else if (target?.kind === "request") {
    if (!request) body = currentRequest?.error ? <div role="alert"><p className={styles.note}>მოთხოვნა ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div> : <p className={styles.note} role="status">{currentRequest ? "მოთხოვნა ვერ მოიძებნა — შესაძლოა წაშლილია." : "მოთხოვნა იტვირთება…"}</p>;
    else {
      const state = request.hidden ? "დამალული" : stateLabel[store.requestState(request)] || "";
      body = <div className={styles.detail}>
        {currentRequest?.error ? <div role="alert"><p className={styles.note}>განახლება ვერ მოხერხდა.</p><Button variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div> : null}
        <div className={styles.detailHead}>
          <h3>{request.title}</h3>
          <p>{categories[request.category] || request.category} · {cities[request.city] || request.city}</p>
          <div className={styles.detailBadges}><span className={`ma-badge ma-badge--${request.hidden ? "warning" : store.requestState(request) === "open" ? "success" : "neutral"}`}>{state}</span>
            <a className={styles.externalLink} href={`/requests/view/?id=${request.id}`} target="_blank" rel="noreferrer">საჯარო გვერდი<Icon name="external-link" /></a></div>
          {request.hidden && request.hiddenReason ? <p className={styles.note}>დამალვის მიზეზი: {request.hiddenReason}</p> : null}
        </div>
        {request.body ? <p className={styles.detailText}>{request.body}</p> : null}
        <dl className={styles.detailFacts}>
          <dt>ავტორი</dt><dd>{owner ? <button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: owner.id })}>{owner.company || owner.name}</button> : "—"}</dd>
          <dt>გამოქვეყნდა</dt><dd>{dateLabel(request.createdAt)}</dd>
          {request.expiresAt ? <><dt>ვადა</dt><dd>{dateLabel(request.expiresAt)}</dd></> : null}
          {requestDeal ? <><dt>გარიგება</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "deal", id: requestDeal.id })}>{dealStageLabels[requestDeal.stage]}</button></dd></> : null}
        </dl>
        <AdminRequestExtras key={`${request.id}:${dataRevision}`} store={store} requestId={request.id} v2={v2} onOpen={onOpen} />
      </div>;
      if (editing) body = <AdminEditPanel store={store} row={{...request}} kind="request" onDirtyChange={setDirty} onDone={() => {setDirty(false);setEditTarget(null);}} onCancel={requestCancel} />;
      const locked = !!requestDeal;
      footer = editing ? null : <div className={styles.detailActions}>
        <Button type="button" variant="primary" onClick={() => setEditTarget(`request:${request.id}`)}>რედაქტირება</Button>
        <Button type="button" variant="secondary" onClick={() => onAction({ kind: "requests", action: request.hidden ? "unhide" : "hide", id: request.id, label: request.title })}>{request.hidden ? "გამოჩენა…" : "დამალვა…"}</Button>
        <div className={styles.dangerZone}>
          <Button type="button" variant="danger-quiet" disabled={locked || !dealPage} aria-describedby={locked ? "request-delete-locked" : undefined} onClick={() => onAction({ kind: "requests", action: "delete", id: request.id, label: request.title })}>მოთხოვნის წაშლა…</Button>
          {locked ? <small id="request-delete-locked">მოთხოვნას გარიგება აქვს და არ იშლება — გამოიყენეთ დამალვა.</small> : null}
        </div>
      </div>;
    }
  }

  return <><Sheet open={!!target} onClose={requestClose} title={title} footer={footer} className={styles.drawer}>{body}</Sheet><Sheet open={!!discard} onClose={() => setDiscard(null)} title="შეუნახავი ცვლილებები" footer={<><Button variant="secondary" type="button" onClick={() => setDiscard(null)}>რედაქტირების გაგრძელება</Button><Button variant="danger-quiet" type="button" onClick={() => {const intent=discard;setDiscard(null);setDirty(false);setEditTarget(null);if(intent==="close")onClose();}}>ცვლილებების გაუქმება</Button></>}><p>ცვლილებები ჯერ არ შენახულა.</p></Sheet></>;
}
