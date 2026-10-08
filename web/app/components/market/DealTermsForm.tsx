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
  return <><p className={styles.note}>ცვლილება ორივე მხარის წინა დადასტურებას აუქმებს. ახალი პირობები ორივემ ხელახლა უნდა დაადასტუროს.</p>
    <form id={id} className={styles.form} onSubmit={submit} onChange={e => { const el = e.target; if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return; setChanged(old => el.value === current[el.name] ? old.filter(n => n !== el.name) : [...new Set([...old, el.name])]); }}><fieldset disabled={pending}><div className={`${styles.formGrid} ${styles.termsModalGrid}`}>
      <label>ჯამური ფასი (₾)<input className="ma-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" required defaultValue={deal.total_price ?? ""}/>{hint("price", current.price ? `₾${current.price}` : "დასაზუსტებელია") }</label>
      <label>მიწოდება (დღე)<input className="ma-input" name="days" type="number" min="0" max="365" step="1" required defaultValue={deal.delivery_days ?? ""}/>{hint("days") }</label>
      <label>რაოდენობა<input className="ma-input" name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={deal.quantity ?? ""}/>{hint("quantity") }</label>
      <label>ერთეული<CustomSelect name="unit" required defaultValue={deal.unit || ""}><option value="" disabled>აირჩიე ერთეული</option>{Object.entries(units).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CustomSelect>{hint("unit") }</label>
      <label>მიწოდების თარიღი (არასავალდებულო)<input className="ma-input" name="date" type="date" defaultValue={deal.delivery_date || ""}/>{hint("date") }</label>
      <label>მიწოდების ადგილი<input className="ma-input" name="place" maxLength={500} required defaultValue={deal.delivery_place || ""}/>{hint("place") }</label>
      <label>გადახდის პირობები<textarea className="ma-textarea" name="payment" maxLength={500} required value={payment} onChange={e => setPayment(e.target.value)}/>{hint("payment") }</label>
      <div className={styles.includeEditor}><span>მოიცავს</span><div className={styles.actions}>{included.map((item, i) => <Button key={i} variant="secondary" aria-label={`${item} — წაშლა`} onClick={() => { setIncluded(old => old.filter((_, j) => j !== i)); setChanged(old => [...new Set([...old, "includes"])]); }}>{item}<Icon name="x"/></Button>)}</div><label>პირობის დამატება<input className="ma-input" value={includeDraft} maxLength={120} onChange={e => setIncludeDraft(e.target.value)}/></label><Button variant="secondary" disabled={!includeDraft.trim() || included.length >= 8} onClick={() => { setIncluded(old => [...old, includeDraft.trim()]); setIncludeDraft(""); setChanged(old => [...new Set([...old, "includes"])]); }}>დამატება</Button>{hint("includes")}</div>
    </div><div className={styles.actions}>{["სრული წინასწარი გადახდა", "გადახდა მიწოდებისას", "30% წინასწარ · 70% მიწოდებისას"].map(term => <Button key={term} variant="secondary" onClick={() => { setPayment(term); setChanged(old => [...new Set([...old, "payment"])]); }}>{term}</Button>)}</div>{commentAvailable ? <label>კომენტარი (არასავალდებულო)<textarea className="ma-textarea" name="comment" maxLength={2000}/></label> : <p className={styles.note}>კომენტარის დამატება ხელმისაწვდომია არსებული მიმოწერისას.</p>}</fieldset>{error ? <p role="alert">{error}</p> : null}<div className={styles.actions}><Button variant="secondary" disabled={pending} onClick={onCancel}>გაუქმება</Button><Button type="submit" loading={pending}><Icon name="send"/>გაგზავნა ჩატში</Button></div></form>
  </>;
}
