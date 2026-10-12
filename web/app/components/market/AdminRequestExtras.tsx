"use client";
import { useEffect, useId, useState } from "react";
import { Button } from "../ui/Button";
import { toast } from "../Toasts";
import type { Store } from "../../lib/market-client";
import { adminMoney } from "../../lib/admin-helpers";
import { formatNumber } from "../../lib/format";
import { adminErrorMessage } from "../../lib/use-admin-data";
import { FileAttachments } from "./FileAttachments";
import { offerPrice, offerStatuses, type AdminOffer } from "./AdminOffersTable";
import type { AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

type Preferences = {
  specification?: string; design?: string; supplierTypes?: string[]; certificates?: string; verifiedOnly?: boolean; flexibility?: number;
  budgetType?: "range" | "exact" | "negotiable"; budgetMin?: number; budgetMax?: number; budgetPrivate?: boolean;
  payment?: string; vatInvoice?: boolean; deferredPayment?: boolean;
};
const supplierTypes: Record<string, string> = { manufacturer: "მწარმოებელი", distributor: "დისტრიბუტორი", service: "მომსახურება" };
const designs: Record<string, string> = { ready: "დიზაინი მზადაა", needed: "დიზაინი საჭიროა", none: "დიზაინი არ სჭირდება" };

export function budgetLabel(p: Preferences) {
  const value = p.budgetType === "exact" && p.budgetMin != null ? adminMoney(p.budgetMin)
    : p.budgetType === "range" && p.budgetMin != null ? `${formatNumber(Number(p.budgetMin))}–${adminMoney(p.budgetMax ?? p.budgetMin)}` : "შეთანხმებით";
  return p.budgetPrivate && p.budgetType && p.budgetType !== "negotiable" ? `${value} · მომწოდებლებს არ უჩანს` : value;
}

/** What the buyer added beyond the basics: budget and preferences (editable), files and the offers received. */
export function AdminRequestExtras({ store, requestId, v2, onOpen }: { store: Store; requestId: string; v2: boolean; onOpen: (target: AdminTarget) => void }) {
  const [prefs, setPrefs] = useState<{ data?: Preferences; error?: boolean }>({});
  const [offers, setOffers] = useState<{ items?: AdminOffer[]; error?: boolean }>({});
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const { callRpc, adminSearchOffers } = store;
  useEffect(() => {
    let active = true;
    callRpc("request_preferences", { p_request_id: requestId }).then((data: Preferences) => { if (active) setPrefs({ data: data || {} }); }, () => { if (active) setPrefs({ error: true }); });
    return () => { active = false; };
  }, [callRpc, requestId, revision]);
  useEffect(() => {
    if (!v2) return;
    let active = true;
    adminSearchOffers({ p_q: requestId, p_limit: 20 }).then((page: { items: AdminOffer[] }) => { if (active) setOffers({ items: page.items.filter(o => o.request_id === requestId) }); }, () => { if (active) setOffers({ error: true }); });
    return () => { active = false; };
  }, [adminSearchOffers, requestId, v2]);
  const p = prefs.data;
  const facts: [string, string][] = p ? [
    ["ბიუჯეტი", budgetLabel(p)],
    ...(p.specification ? [["სპეციფიკაცია", p.specification] as [string, string]] : []),
    ...(p.supplierTypes?.length ? [["მომწოდებელი", p.supplierTypes.map(t => supplierTypes[t] || t).join(", ")] as [string, string]] : []),
    ...(p.design ? [["დიზაინი", designs[p.design] || p.design] as [string, string]] : []),
    ...(p.certificates ? [["სერტიფიკატები", p.certificates] as [string, string]] : []),
    ...(p.payment ? [["გადახდა", p.payment] as [string, string]] : []),
    ...(p.flexibility ? [["ვადის მოქნილობა", `${p.flexibility} დღე`] as [string, string]] : []),
    ...([p.verifiedOnly && "მხოლოდ ვერიფიცირებული", p.vatInvoice && "ანგარიშ-ფაქტურა", p.deferredPayment && "გადავადებული გადახდა"].filter(Boolean).length
      ? [["პირობები", [p.verifiedOnly && "მხოლოდ ვერიფიცირებული", p.vatInvoice && "ანგარიშ-ფაქტურა", p.deferredPayment && "გადავადებული გადახდა"].filter(Boolean).join(", ")] as [string, string]] : []),
  ] : [];
  return <>
    <section className={styles.detailList} aria-label="ბიუჯეტი და პირობები">
      <h4>ბიუჯეტი და პირობები{p && !editing ? <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>შეცვლა</Button> : null}</h4>
      {prefs.error ? <p className={styles.note}>პირობები ვერ ჩაიტვირთა.</p> : !p ? <p className={styles.note} role="status">იტვირთება…</p>
        : editing ? <PreferencesForm store={store} requestId={requestId} initial={p} onDone={() => { setEditing(false); setRevision(n => n + 1); }} onCancel={() => setEditing(false)} />
        : <dl className={styles.detailFacts}>{facts.map(([dt, dd]) => <div key={dt} className={styles.factRow}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>}
    </section>
    <FileAttachments store={store} kind="request" target={requestId} label="ფაილები" />
    {v2 ? <section className={styles.detailList}>
      <h4>შეთავაზებები <span>{offers.items ? offers.items.length : offers.error ? "—" : "…"}</span></h4>
      {offers.error ? <p className={styles.note}>შეთავაზებები ვერ ჩაიტვირთა.</p> : offers.items?.length ? <ul>{offers.items.map(o => <li key={o.id}>
        <button type="button" onClick={() => onOpen({ kind: "offer", id: o.id })}>{o.company_name || "კომპანია"} · {offerPrice(o)}</button>
        <small>{offerStatuses[o.status]}{o.expired ? " · ვადაგასული" : ""}</small>
      </li>)}</ul> : offers.items ? <p className={styles.note}>შეთავაზებები ჯერ არ არის.</p> : null}
    </section> : null}
  </>;
}

function PreferencesForm({ store, requestId, initial, onDone, onCancel }: { store: Store; requestId: string; initial: Preferences; onDone: () => void; onCancel: () => void }) {
  const id = useId();
  const [type, setType] = useState(initial.budgetType || "negotiable");
  const [min, setMin] = useState(initial.budgetMin == null ? "" : String(initial.budgetMin));
  const [max, setMax] = useState(initial.budgetMax == null ? "" : String(initial.budgetMax));
  const [hidden, setHidden] = useState(!!initial.budgetPrivate);
  const [specification, setSpecification] = useState(initial.specification || "");
  const [payment, setPayment] = useState(initial.payment || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Preferences = { ...initial, budgetType: type, budgetPrivate: hidden, specification: specification.trim(), payment: payment.trim() };
    delete next.budgetMin; delete next.budgetMax;
    if (type !== "negotiable") next.budgetMin = Number(min);
    if (type === "range") next.budgetMax = Number(max);
    if (type !== "negotiable" && !(Number(min) > 0)) { setError("მიუთითეთ ბიუჯეტის თანხა."); return; }
    if (type === "range" && !(Number(max) >= Number(min))) { setError("მაქსიმუმი მინიმუმზე ნაკლები ვერ იქნება."); return; }
    setBusy(true); setError("");
    try { await store.mutateRpc("admin_set_request_preferences", { p_request_id: requestId, p_preferences: next }); toast("ბიუჯეტი და პირობები შენახულია."); onDone(); }
    catch (err) { setError(adminErrorMessage(err, "პირობები ვერ შეინახა. სცადეთ ხელახლა.")); }
    finally { setBusy(false); }
  }
  return <form className={styles.inlineForm} onSubmit={save}>
    <div className={styles.inlineGrid}>
      <label htmlFor={`${id}-type`}>ბიუჯეტი<select id={`${id}-type`} className="ma-select" value={type} onChange={e => setType(e.target.value as Preferences["budgetType"] & string)} disabled={busy}>
        <option value="negotiable">შეთანხმებით</option><option value="exact">ზუსტი თანხა</option><option value="range">დიაპაზონი</option></select></label>
      {type !== "negotiable" ? <label htmlFor={`${id}-min`}>{type === "range" ? "მინიმუმი, ₾" : "თანხა, ₾"}<input id={`${id}-min`} className="ma-input" type="number" min="1" step="0.01" value={min} onChange={e => setMin(e.target.value)} disabled={busy} required /></label> : null}
      {type === "range" ? <label htmlFor={`${id}-max`}>მაქსიმუმი, ₾<input id={`${id}-max`} className="ma-input" type="number" min="1" step="0.01" value={max} onChange={e => setMax(e.target.value)} disabled={busy} required /></label> : null}
    </div>
    {type !== "negotiable" ? <label className={styles.checkLine}><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} disabled={busy} /> ბიუჯეტი მომწოდებლებს არ უჩანს</label> : null}
    <label htmlFor={`${id}-spec`}>სპეციფიკაცია<textarea id={`${id}-spec`} className="ma-textarea" rows={3} maxLength={2000} value={specification} onChange={e => setSpecification(e.target.value)} disabled={busy} /></label>
    <label htmlFor={`${id}-pay`}>გადახდის პირობები<input id={`${id}-pay`} className="ma-input" maxLength={500} value={payment} onChange={e => setPayment(e.target.value)} disabled={busy} /></label>
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
    <div className={styles.inlineActions}><Button type="submit" variant="primary" size="sm" loading={busy}>პირობების შენახვა</Button><Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>დაბრუნება</Button></div>
  </form>;
}
