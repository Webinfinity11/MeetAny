"use client";
import { AdminOfferEditPanel } from "./AdminOfferEditPanel";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import type { Store } from "../../lib/market-client";
import { dateLabel } from "../../lib/format";
import { FileAttachments } from "./FileAttachments";
import { offerPrice, offerStatuses, type AdminOffer } from "./AdminOffersTable";
import type { AdminAction, AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

/** One offer with its full terms, files and links to the company, the request and the deal. Read-only except delete. */
export function AdminOfferDetail({ store, id, revision, onClose, onOpen, onAction }: {
  store: Store; id: string; revision: number; onClose: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void;
}) {
  const [state, setState] = useState<{ key: string; offer?: AdminOffer | null; error?: boolean }>({ key: "" });
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = `${id}:${revision}:${retry}`;
  const search = store.adminSearchOffers;
  useEffect(() => {
    let active = true;
    search({ p_q: id, p_limit: 5 }).then((page: { items: AdminOffer[] }) => { if (active) setState({ key, offer: page.items.find(o => o.id === id) || null }); },
      () => { if (active) setState({ key, error: true }); });
    return () => { active = false; };
  }, [search, id, key]);
  const current = state.key === key ? state : null;
  const offer = current?.offer;
  let body: React.ReactNode;
  if (!current) body = <p className={styles.note} role="status">შეთავაზება იტვირთება…</p>;
  else if (current.error) body = <div role="alert"><p className={styles.note}>შეთავაზება ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={() => setRetry(n => n + 1)}>ხელახლა ცდა</Button></div>;
  else if (!offer) body = <p className={styles.note} role="status">შეთავაზება ვერ მოიძებნა — შესაძლოა წაშლილია.</p>;
  else body = <div className={styles.detail}>
    <div className={styles.detailHead}>
      <h3>{offerPrice(offer)}</h3>
      <p>{offer.company_name || "მომწოდებელი"} · {dateLabel(offer.created_at)}</p>
      <div className={styles.detailBadges}><span className={`ma-badge ma-badge--${offer.status === "chosen" ? "success" : "neutral"}`}>{offerStatuses[offer.status]}</span>{offer.expired ? <span className="ma-badge ma-badge--warning">ვადაგასული</span> : null}</div>
    </div>
    {offer.body ? <p className={styles.detailText}>{offer.body}</p> : null}
    <dl className={styles.detailFacts}>
      <dt>მომწოდებელი</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: offer.company_id })}>{offer.company_name || "მომწოდებელი"}</button></dd>
      <dt>მოთხოვნა</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "request", id: offer.request_id })}>{offer.request_title || "მოთხოვნა"}</button>{offer.request_hidden ? " · დამალული" : ""}</dd>
      {offer.deal_id ? <><dt>გარიგება</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "deal", id: offer.deal_id! })}>გარიგების ნახვა</button></dd></> : null}
      {offer.vat_included != null ? <><dt>დღგ</dt><dd>{offer.vat_included ? "ფასში შედის" : "ფასში არ შედის"}</dd></> : null}
      {offer.delivery_days != null ? <><dt>მიწოდება</dt><dd>{offer.delivery_days} დღეში{offer.delivery_included ? ", მიწოდება შედის ფასში" : ""}</dd></> : null}
      {offer.payment_terms ? <><dt>გადახდა</dt><dd>{offer.payment_terms}</dd></> : null}
      {offer.valid_until ? <><dt>მოქმედების ვადა</dt><dd>{dateLabel(offer.valid_until)}</dd></> : null}
      {offer.commercial_terms?.length ? <><dt>პირობები</dt><dd>{offer.commercial_terms.join(", ")}</dd></> : null}
    </dl>
    <FileAttachments store={store} kind="offer" target={offer.id} label="ფაილები" />
  </div>;
  if (editing && offer) body = <AdminOfferEditPanel store={store} offer={offer} onSaved={() => {setEditing(false);setRetry(n => n + 1);}} onCancel={() => setEditing(false)}/>;
  const footer = offer && !editing ? <div className={styles.detailActions}>
    <Button type="button" onClick={() => setEditing(true)}>რედაქტირება</Button>
    <Button type="button" variant="secondary" onClick={() => onOpen({ kind: "request", id: offer.request_id })}>მოთხოვნის ნახვა</Button>
    {offer.deal_id ? <Button type="button" variant="secondary" onClick={() => onOpen({ kind: "deal", id: offer.deal_id! })}>გარიგების ნახვა</Button> : <span />}
    <div className={styles.dangerZone}>
      <Button type="button" variant="danger-quiet" disabled={offer.status === "chosen"} aria-describedby={offer.status === "chosen" ? "offer-delete-locked" : undefined}
        onClick={() => onAction({ kind: "offers", action: "deleteOffer", id: offer.id, label: `${offer.company_name || "მომწოდებელი"} · ${offer.request_title || ""}` })}>შეთავაზების წაშლა…</Button>
      {offer.status === "chosen" ? <small id="offer-delete-locked">არჩეული შეთავაზება არ იშლება.</small> : null}
    </div>
  </div> : null;
  return <Sheet open onClose={onClose} title="შეთავაზება" footer={footer} className={styles.drawer}>{body}</Sheet>;
}
