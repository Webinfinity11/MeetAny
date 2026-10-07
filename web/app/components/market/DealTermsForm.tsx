"use client";
import { useState } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { units } from "../../lib/categories";
import type { Deal, DealTermsInput } from "../../lib/deal-client";
import styles from "./deals.module.css";

export function DealTermsForm({ deal, pending, onSubmit, onCancel }: { deal: Deal; pending: boolean; onSubmit: (args: DealTermsInput) => Promise<boolean>; onCancel: () => void }) {
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = (key: string) => String(f.get(key) || "").trim();
    const includes = value("includes").split("\n").map(s => s.trim()).filter(Boolean);
    if (includes.length > 8 || includes.some(s => s.length > 120)) { setError("მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე."); return; }
    if (!value("place") || !value("payment")) { setError("შეავსე ადგილი და გადახდის პირობები."); return; }
    setError("");
    await onSubmit({ p_total_price: Number(value("price")), p_quantity: Number(value("quantity")), p_unit: value("unit"), p_delivery_days: Number(value("days")), p_delivery_date: value("date") || null, p_delivery_place: value("place"), p_payment_terms: value("payment"), p_includes: includes });
  }
  return <section className={styles.card}><h2>პირობების შეთავაზება</h2><p className={styles.note}>ცვლილება ორივე მხარის წინა დადასტურებას აუქმებს. ახალი პირობები ორივემ ხელახლა უნდა დაადასტუროს.</p>
    <form className={styles.form} onSubmit={submit}><fieldset disabled={pending}><div className={styles.formGrid}>
      <label>ჯამური ფასი (₾)<input className="ma-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" required defaultValue={deal.total_price ?? ""}/></label>
      <label>რაოდენობა<input className="ma-input" name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={deal.quantity ?? ""}/></label>
      <label>ერთეული<CustomSelect name="unit" required defaultValue={deal.unit || ""}><option value="" disabled>აირჩიე ერთეული</option>{Object.entries(units).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CustomSelect></label>
      <label>მიწოდება (დღე)<input className="ma-input" name="days" type="number" min="0" max="365" step="1" required defaultValue={deal.delivery_days ?? ""}/></label>
      <label>მიწოდების თარიღი (არასავალდებულო)<input className="ma-input" name="date" type="date" defaultValue={deal.delivery_date || ""}/></label>
      <label>მიწოდების ადგილი<input className="ma-input" name="place" maxLength={500} required defaultValue={deal.delivery_place || ""}/></label>
      <label>გადახდის პირობები<textarea className="ma-textarea" name="payment" maxLength={500} required defaultValue={deal.payment_terms || ""}/></label>
      <label>მოიცავს (თითო პირობა ახალ ხაზზე)<textarea className="ma-textarea" name="includes" defaultValue={deal.includes.join("\n")}/></label>
    </div></fieldset>{error ? <p role="alert">{error}</p> : null}<div className={styles.actions}><Button type="submit" loading={pending}>პირობების გაგზავნა</Button><Button variant="secondary" disabled={pending} onClick={onCancel}>უკან</Button></div></form>
  </section>;
}
