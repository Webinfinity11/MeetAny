"use client";
import { useId, useState } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { units } from "../../lib/categories";
import { dealDate, money, type Deal, type DealTermsInput } from "../../lib/deal-client";
import styles from "./deals.module.css";

const payments = ["50% წინასწარ · 50% მიწოდებისას", "30% წინასწარ · 70% მიწოდებისას", "100% მიწოდებისას", "100% წინასწარ"];

export function DealTermsForm({ deal, defaults, pending, onSubmit, onCancel, commentAvailable = false }: { deal: Deal; defaults?: DealTermsInput; pending: boolean; onSubmit: (args: DealTermsInput, comment: string) => Promise<boolean>; commentAvailable?: boolean; onCancel: () => void }) {
  const id = useId();
  const price = deal.total_price ?? (defaults && defaults.p_total_price > 0 ? defaults.p_total_price : null);
  const place = deal.delivery_place || defaults?.p_delivery_place || "";
  // What the deal says now, as the form shows it, and as a person reads it.
  const current: Record<string, string> = { price: price == null ? "" : String(price), quantity: String(deal.quantity ?? ""), unit: deal.unit || "", days: String(deal.delivery_days ?? ""), date: deal.delivery_date || "", place, payment: deal.payment_terms || "", includes: deal.includes.join("\n") };
  const shown: Record<string, string> = { price: price == null ? "შეთანხმებით" : money(price), quantity: current.quantity || "—", unit: units[current.unit] || current.unit || "—", days: current.days ? `${current.days} დღე` : "—", date: current.date ? dealDate(current.date) : "—", place: place || "—", payment: current.payment || "—", includes: deal.includes.join(", ") || "—" };
  const [changed, setChanged] = useState<string[]>([]);
  const was = (name: string) => changed.includes(name) ? <small className={styles.previous}>იყო: {shown[name]}</small> : null;
  const [included, setIncluded] = useState(deal.includes);
  const [includeDraft, setIncludeDraft] = useState("");
  const [paymentChoice, setPaymentChoice] = useState(payments.includes(deal.payment_terms || "") ? deal.payment_terms! : deal.payment_terms ? "სხვა" : payments[0]);
  const [payment, setPayment] = useState(deal.payment_terms || payments[0]);
  const [error, setError] = useState("");
  const mark = (name: string, value: string) => setChanged(old => value === current[name] ? old.filter(n => n !== name) : [...new Set([...old, name])]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = (key: string) => String(f.get(key) || "").trim();
    if (included.length > 8 || included.some(s => s.length > 120)) { setError("მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე."); return; }
    if (!value("days")) { setError("აირჩიეთ მიწოდების ვადა."); return; }
    if (!value("place") || !value("payment")) { setError("შეავსეთ მიწოდების ადგილი და გადახდის პირობები."); return; }
    setError("");
    await onSubmit({ p_total_price: Number(value("price")), p_quantity: Number(value("quantity")), p_unit: value("unit"), p_delivery_days: Number(value("days")), p_delivery_date: value("date") || null, p_delivery_place: value("place"), p_payment_terms: value("payment"), p_includes: included }, value("comment"));
  }
  return <form id={id} className={styles.form} onSubmit={submit} onChange={e => { const el = e.target; if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && el.name) mark(el.name, el.value); }}>
    <fieldset disabled={pending} className={styles.termsFields}>
      <div className={styles.formGrid}>
        <label>ჯამური ფასი<span className={styles.priceInput}><input className="ma-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" required defaultValue={current.price}/><span>₾</span></span>{was("price")}</label>
        <label>მიწოდების ვადა<CustomSelect name="days" required defaultValue={current.days}><option value="" disabled>აირჩიეთ ვადა</option>{[...new Set([3, 5, 7, 8, 10, 14, 21, 30, ...(deal.delivery_days != null ? [deal.delivery_days] : [])])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n} დღე</option>)}</CustomSelect>{was("days")}</label>
      </div>
      <label>გადახდა<CustomSelect value={paymentChoice} onChange={e => { setPaymentChoice(e.target.value); if (e.target.value !== "სხვა") { setPayment(e.target.value); mark("payment", e.target.value); } }}>{[...payments, "სხვა"].map(term => <option key={term} value={term}>{term}</option>)}</CustomSelect>{paymentChoice === "სხვა" ? <input aria-label="გადახდის სხვა პირობები" className="ma-input" name="payment" maxLength={500} required value={payment} onChange={e => setPayment(e.target.value)}/> : <input type="hidden" name="payment" value={payment}/>}{was("payment")}</label>
      <label>მიწოდების ადგილი<input className="ma-input" name="place" maxLength={500} required defaultValue={place}/>{was("place")}</label>
      {commentAvailable ? <label><span className={styles.labelLine}>კომენტარი<small>არასავალდებულო</small></span><textarea className={`ma-textarea ${styles.compactComment}`} name="comment" maxLength={2000}/></label> : null}
      <details className={styles.additionalTerms} onInvalidCapture={e => { e.currentTarget.open = true; }}><summary>რაოდენობა, თარიღი და დამატებითი პირობები</summary><div className={styles.formGrid}>
        <label>რაოდენობა<input className="ma-input" name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={current.quantity}/>{was("quantity")}</label>
        <label>ერთეული<CustomSelect name="unit" required defaultValue={current.unit}><option value="" disabled>აირჩიეთ ერთეული</option>{Object.entries(units).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CustomSelect>{was("unit")}</label>
        <label>მიწოდების თარიღი<small>არასავალდებულო</small><input className="ma-input" name="date" type="date" defaultValue={current.date}/>{was("date")}</label>
        <div className={styles.includeEditor}><span>მოიცავს</span>{included.length ? <div className={styles.actions}>{included.map((item, i) => <Button key={i} variant="secondary" size="sm" aria-label={`${item} — წაშლა`} onClick={() => { const next = included.filter((_, j) => j !== i); setIncluded(next); mark("includes", next.join("\n")); }}>{item}<Icon name="x"/></Button>)}</div> : null}
          <div className={styles.includeAdd}><input className="ma-input" aria-label="პირობის დამატება" placeholder="მაგ. მონტაჟი ადგილზე" value={includeDraft} maxLength={120} onChange={e => setIncludeDraft(e.target.value)}/><Button variant="secondary" disabled={!includeDraft.trim() || included.length >= 8} onClick={() => { const next = [...included, includeDraft.trim()]; setIncluded(next); setIncludeDraft(""); mark("includes", next.join("\n")); }}>დამატება</Button></div>{was("includes")}</div>
      </div></details>
    </fieldset>
    {error ? <p className="ma-field__error" role="alert">{error}</p> : null}
    <div className={`${styles.actions} ${styles.modalActions}`}><Button variant="secondary" disabled={pending} onClick={onCancel}>დაბრუნება</Button><Button type="submit" loading={pending}><Icon name="send"/>ცვლილების შეთავაზება</Button></div>
  </form>;
}
