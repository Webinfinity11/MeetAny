"use client";
import { useId, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { CustomSelect } from "../ui/CustomSelect";
import { units } from "../../lib/categories";
import { currentDealTerms, dealDate, money, type Deal, type DealTermsInput } from "../../lib/deal-client";
import { termsEqual } from "../../lib/offer-terms-client";
import { useFieldErrors, type FieldErrors } from "./fieldErrors";
import { DeliveryDaysField } from "./offer/DeliveryDaysField";
import { PaymentTermsField } from "./offer/PaymentTermsField";
import styles from "./deals.module.css";

export function DealTermsForm({ deal, defaults, pending, onSubmit, onCancel, commentAvailable = false }: { deal: Deal; defaults?: DealTermsInput; pending: boolean; onSubmit: (args: DealTermsInput, comment: string) => Promise<boolean>; commentAvailable?: boolean; onCancel: () => void }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [initial] = useState(() => currentDealTerms(deal, { totalPrice: defaults?.p_total_price, place: defaults?.p_delivery_place }).terms);
  const initialFields: Record<string, string> = { price: Number.isFinite(initial.p_total_price) ? String(initial.p_total_price) : '', quantity: Number.isFinite(initial.p_quantity) ? String(initial.p_quantity) : '', unit: initial.p_unit, days: Number.isFinite(initial.p_delivery_days) ? String(initial.p_delivery_days) : '', date: initial.p_delivery_date || '', place: initial.p_delivery_place, payment: initial.p_payment_terms, includes: initial.p_includes.join('\n') };
  const shown: Record<string, string> = { ...initialFields, price: Number.isFinite(initial.p_total_price) ? money(initial.p_total_price) : 'შეთანხმებით', unit: units[initial.p_unit] || initial.p_unit, days: initialFields.days ? `${initialFields.days} დღე` : '', date: initial.p_delivery_date ? dealDate(initial.p_delivery_date) : '', includes: initial.p_includes.join(', ') };
  const [changed, setChanged] = useState<string[]>([]);
  const mark = (name: string, value: string) => setChanged(old => value === initialFields[name] ? old.filter(key => key !== name) : [...new Set([...old, name])]);
  const was = (name: string) => changed.includes(name) ? <small className={styles.previous}>იყო: {shown[name] || '—'}</small> : null;
  const [included, setIncluded] = useState(initial.p_includes);
  const [includeDraft, setIncludeDraft] = useState("");
  const [days, setDays] = useState(Number.isFinite(initial.p_delivery_days) ? String(initial.p_delivery_days) : "");
  const [payment, setPayment] = useState(initial.p_payment_terms);
  const [notice, setNotice] = useState("");
  const [discard, setDiscard] = useState(false);
  const v = useFieldErrors();
  const field = (name: string) => `${id}-${name}`;
  function read() {
    const f = new FormData(form.current!);
    const value = (key: string) => String(f.get(key) || "").trim();
    const terms: DealTermsInput = { p_total_price: Number(value("price")), p_quantity: Number(value("quantity")), p_unit: value("unit"), p_delivery_days: Number(days), p_delivery_date: value("date") || null, p_delivery_place: value("place"), p_payment_terms: payment.trim(), p_includes: included };
    return { terms, value, comment: value("comment") };
  }
  function cancel() {
    const { terms, comment } = read();
    if (!termsEqual(initial, { ...terms, comment }) || includeDraft.trim()) setDiscard(true);
    else onCancel();
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const { terms, value, comment } = read();
    const errors: FieldErrors = {};
    const error = (name: string, message: string) => { errors[field(name)] = message; };
    if (!value("price")) error("price", "მიუთითეთ ჯამური ფასი");
    else if (!Number.isFinite(terms.p_total_price) || terms.p_total_price <= 0 || terms.p_total_price > 1e9) error("price", "ჯამური ფასი უნდა იყოს 0-ზე მეტი და არ აღემატებოდეს 1 მილიარდს.");
    if (!days) error("days", "მიუთითეთ მიწოდების ვადა");
    else if (!Number.isInteger(terms.p_delivery_days) || terms.p_delivery_days < 0 || terms.p_delivery_days > 365) error("days", "მიწოდების ვადა 0-დან 365 დღემდე უნდა იყოს.");
    if (!terms.p_delivery_place) error("place", "მიუთითეთ მიწოდების ადგილი");
    if (!payment.trim()) error("payment", "მიუთითეთ გადახდის პირობები");
    if (!value("quantity") || !Number.isFinite(terms.p_quantity) || terms.p_quantity <= 0 || terms.p_quantity > 1e9) error("quantity", "მიუთითეთ დადებითი რაოდენობა");
    if (!Object.hasOwn(units, terms.p_unit)) error("unit", "აირჩიეთ ერთეული");
    if (included.length > 8 || included.some(s => s.length > 120)) error("includes", "მაქსიმუმ 8 პირობა, თითოეული 120 სიმბოლომდე.");
    setNotice("");
    if (!v.check(errors, ["price", "days", "payment", "place", "quantity", "unit", "includes"].map(field))) return;
    if (termsEqual(initial, { ...terms, comment })) { setNotice("ცვლილება არ არის"); return; }
    await onSubmit(terms, comment);
  }
  return <><form ref={form} id={id} className={styles.form} noValidate onSubmit={submit} onChange={e => { setNotice(""); const el = e.target; if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) { v.clear(el.id); if (el.name) mark(el.name, el.value); } }}>
    {Object.keys(v.errors).length ? <div className={styles.errorSummary} role="alert"><p>გადაამოწმეთ მონიშნული ველები:</p><ul>{Object.entries(v.errors).map(([key, message]) => <li key={key}><a href={`#${key}`} onClick={e => { e.preventDefault(); document.getElementById(key)?.focus(); }}>{message}</a></li>)}</ul></div> : null}
    <fieldset disabled={pending} className={styles.termsFields}>
      <p className={styles.note}>* სავალდებულო ველი</p>
      <div className={styles.formGrid}>
        <label htmlFor={field("price")}>ჯამური ფასი *<span className={styles.priceInput}><input {...v.control(field("price"))} className="ma-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" required defaultValue={Number.isFinite(initial.p_total_price) ? initial.p_total_price : ""}/><span>₾</span></span>{v.message(field("price"))}{was("price")}</label>
        <div className="ma-field"><label htmlFor={field("days")}>მიწოდების ვადა *</label><DeliveryDaysField {...v.control(field("days"))} name="days" value={days} onChange={value => { setDays(value); mark("days", value); v.clear(field("days")); setNotice(""); }}/>{v.message(field("days"))}{was("days")}</div>
      </div>
      <div className="ma-field"><label htmlFor={field("payment")}>გადახდა *</label><PaymentTermsField {...v.control(field("payment"))} name="payment" required value={payment} onChange={value => { setPayment(value); mark("payment", value); v.clear(field("payment")); setNotice(""); }}/>{v.message(field("payment"))}{was("payment")}</div>
      <label htmlFor={field("place")}>მიწოდების ადგილი *<input {...v.control(field("place"))} className="ma-input" name="place" maxLength={500} required defaultValue={initial.p_delivery_place}/>{v.message(field("place"))}{was("place")}</label>
      <div className={styles.formGrid}>
        <label htmlFor={field("quantity")}>რაოდენობა *<input {...v.control(field("quantity"))} className="ma-input" name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={Number.isFinite(initial.p_quantity) ? initial.p_quantity : ""}/>{v.message(field("quantity"))}{was("quantity")}</label>
        <label htmlFor={field("unit")}>ერთეული *<CustomSelect {...v.control(field("unit"))} name="unit" required defaultValue={initial.p_unit} onChange={e => { mark("unit", e.target.value); v.clear(field("unit")); }}><option value="" disabled>აირჩიეთ ერთეული</option>{Object.entries(units).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CustomSelect>{v.message(field("unit"))}{was("unit")}</label>
      </div>
      {commentAvailable ? <label><span className={styles.labelLine}>კომენტარი<small>არასავალდებულო</small></span><textarea className={`ma-textarea ${styles.compactComment}`} name="comment" maxLength={2000}/></label> : null}
      <details className={styles.additionalTerms}><summary>თარიღი და დამატებითი პირობები — არასავალდებულო</summary><div className={styles.formGrid}>
        <label>მიწოდების თარიღი<input className="ma-input" name="date" type="date" defaultValue={initial.p_delivery_date || ""}/>{was("date")}</label>
        <div className={styles.includeEditor}><span>მოიცავს</span>{included.length ? <div className={styles.actions}>{included.map((item, i) => <Button key={i} variant="secondary" size="sm" aria-label={`${item} — წაშლა`} onClick={() => { const next = included.filter((_, j) => j !== i); setIncluded(next); mark("includes", next.join("\n")); setNotice(""); }}>{item}<Icon name="x"/></Button>)}</div> : null}
          <div className={styles.includeAdd}><input {...v.control(field("includes"))} className="ma-input" aria-label="პირობის დამატება" placeholder="მაგ. მონტაჟი ადგილზე" value={includeDraft} maxLength={120} onChange={e => setIncludeDraft(e.target.value)}/><Button variant="secondary" disabled={!includeDraft.trim() || included.length >= 8} onClick={() => { const next = [...included, includeDraft.trim()]; setIncluded(next); mark("includes", next.join("\n")); setIncludeDraft(""); setNotice(""); }}>დამატება</Button></div>{v.message(field("includes"))}{was("includes")}</div>
      </div></details>
    </fieldset>
    {notice ? <p role="status">{notice}</p> : null}
    <div className={`${styles.actions} ${styles.modalActions}`}><Button variant="secondary" disabled={pending} onClick={cancel}>დაბრუნება</Button><Button type="submit" loading={pending}><Icon name="send"/>ცვლილების შეთავაზება</Button></div>
  </form><ConfirmSheet id={`${id}-discard`} open={discard} title="ცვლილებები დაიკარგება" confirmLabel="ცვლილებების გაუქმება" cancelLabel="რედაქტირების გაგრძელება" pendingLabel="დახურვა…" pending={pending} onConfirm={onCancel} onCancel={() => setDiscard(false)}><p>შეუნახავი ცვლილებები გაუქმდება. გსურთ დაბრუნება?</p></ConfirmSheet></>;
}
