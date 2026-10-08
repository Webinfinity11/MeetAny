"use client";
import { useId, useState } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { units } from "../../lib/categories";
import type { Deal, DealTermsInput } from "../../lib/deal-client";
import styles from "./deals.module.css";

export function DealTermsForm({ deal, pending, onSubmit, onCancel, commentAvailable = false }: { deal: Deal; pending: boolean; onSubmit: (args: DealTermsInput, comment: string) => Promise<boolean>; commentAvailable?: boolean; onCancel: () => void }) {
  const id = useId();
  const [changed, setChanged] = useState<string[]>([]);
  const current: Record<string, string> = {price: String(deal.total_price ?? ""), quantity: String(deal.quantity ?? ""), unit: deal.unit || "", days: String(deal.delivery_days ?? ""), date: deal.delivery_date || "", place: deal.delivery_place || "", payment: deal.payment_terms || "", includes: deal.includes.join("\n")};
  const hint = (name: string, display?: string) => <small className={styles.previous} data-changed={changed.includes(name)}>{changed.includes(name) ? "შეცვლილია · " : ""}ახლა: {display || current[name] || "დასაზუსტებელია"}</small>;
  const [included, setIncluded] = useState(deal.includes);
  const [includeDraft, setIncludeDraft] = useState("");
  const payments = ["50% წინასწარ · 50% მიწოდებისას", "30% წინასწარ · 70% მიწოდებისას", "100% მიწოდებისას", "100% წინასწარ"];
  const [paymentChoice, setPaymentChoice] = useState(payments.includes(deal.payment_terms || "") ? deal.payment_terms! : "სხვა");
  const [payment, setPayment] = useState(deal.payment_terms || "");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = (key: string) => String(f.get(key) || "").trim();
    const includes = included;
    if (includes.length > 8 || includes.some(s => s.length > 120)) { setError("მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე."); return; }
    if (!value("place") || !value("payment")) { setError("შეავსე ადგილი და გადახდის პირობები."); return; }
    setError("");
    await onSubmit({ p_total_price: Number(value("price")), p_quantity: Number(value("quantity")), p_unit: value("unit"), p_delivery_days: Number(value("days")), p_delivery_date: value("date") || null, p_delivery_place: value("place"), p_payment_terms: value("payment"), p_includes: includes }, value("comment"));
  }
  return <>
    <form id={id} className={styles.form} onSubmit={submit} onChange={e => { const el = e.target; if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return; setChanged(old => el.value === current[el.name] ? old.filter(n => n !== el.name) : [...new Set([...old, el.name])]); }}><fieldset disabled={pending} className={styles.termsFields}><div className={`${styles.formGrid} ${styles.termsModalGrid}`}>
      <label>ფასი<span className={styles.priceInput}><input className="ma-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" required defaultValue={deal.total_price ?? ""}/><span>₾</span></span>{hint("price", current.price ? `₾${current.price}` : "დასაზუსტებელია")}</label>
      <label>მიწოდება<CustomSelect name="days" required defaultValue={current.days}><option value="" disabled>აირჩიე</option>{[...new Set([3, 5, 7, 8, 10, 14, 21, 30, ...(deal.delivery_days != null ? [deal.delivery_days] : [])])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n} დღე</option>)}</CustomSelect><small className={styles.previous}>{deal.delivery_days != null ? `ახლა: ${deal.delivery_days} დღე` : "უცვლელი"}</small></label>
    </div><label>გადახდა<CustomSelect value={paymentChoice} onChange={e => { setPaymentChoice(e.target.value); if (e.target.value !== "სხვა") setPayment(e.target.value); }}>{[...payments, "სხვა"].map(term => <option key={term} value={term}>{term}</option>)}</CustomSelect>{paymentChoice === "სხვა" ? <input aria-label="გადახდის სხვა პირობები" className="ma-input" name="payment" maxLength={500} required value={payment} onChange={e => setPayment(e.target.value)}/> : <input type="hidden" name="payment" value={payment}/>}</label>
    {commentAvailable ? <label><span className={styles.labelLine}>კომენტარი<small>არასავალდებულო</small></span><textarea className="ma-textarea" name="comment" maxLength={2000}/></label> : null}
    <details className={styles.additionalTerms} onInvalidCapture={e => { e.currentTarget.open = true; }}><summary>დამატებითი პირობები</summary><div className={styles.formGrid}>
      <label>რაოდენობა<input className="ma-input" name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={deal.quantity ?? ""}/>{hint("quantity") }</label>
      <label>ერთეული<CustomSelect name="unit" required defaultValue={deal.unit || ""}><option value="" disabled>აირჩიე ერთეული</option>{Object.entries(units).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CustomSelect>{hint("unit") }</label>
      <label>მიწოდების თარიღი (არასავალდებულო)<input className="ma-input" name="date" type="date" defaultValue={deal.delivery_date || ""}/>{hint("date") }</label>
      <label>მიწოდების ადგილი<input className="ma-input" name="place" maxLength={500} required defaultValue={deal.delivery_place || ""}/>{hint("place") }</label>

      <div className={styles.includeEditor}><span>მოიცავს</span><div className={styles.actions}>{included.map((item, i) => <Button key={i} variant="secondary" aria-label={`${item} — წაშლა`} onClick={() => { setIncluded(old => old.filter((_, j) => j !== i)); setChanged(old => [...new Set([...old, "includes"])]); }}>{item}<Icon name="x"/></Button>)}</div><label>პირობის დამატება<input className="ma-input" value={includeDraft} maxLength={120} onChange={e => setIncludeDraft(e.target.value)}/></label><Button variant="secondary" disabled={!includeDraft.trim() || included.length >= 8} onClick={() => { setIncluded(old => [...old, includeDraft.trim()]); setIncludeDraft(""); setChanged(old => [...new Set([...old, "includes"])]); }}>დამატება</Button>{hint("includes")}</div>
    </div></details></fieldset>{error ? <p role="alert">{error}</p> : null}<div className={`${styles.actions} ${styles.modalActions}`}><Button variant="secondary" disabled={pending} onClick={onCancel}>გაუქმება</Button><Button type="submit" loading={pending}><Icon name="send"/>გაგზავნა ჩატში</Button></div></form>
  </>;
}
