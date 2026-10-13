"use client";
import { useId, useState } from "react";
import type { Store } from "../../lib/market-client";
import { adminErrorMessage } from "../../lib/use-admin-data";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import styles from "./admin-edit.module.css";
import type { AdminOffer } from "./AdminOffersTable";

export function AdminOfferEditPanel({store, offer, onSaved, onCancel}: {store: Store; offer: AdminOffer; onSaved: () => void; onCancel: () => void}) {
  const id = useId();
  const [priceType, setPriceType] = useState(offer.price_type || "negotiable");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className={styles.form} onSubmit={async event => {
    event.preventDefault(); if (pending) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    const terms = value("commercial_terms").split("\n").map(v => v.trim()).filter(Boolean);
    const values: Record<string, unknown> = {body:value("body"),price_type:priceType,price:priceType === "negotiable" ? null : Number(value("price")),vat_included:priceType !== "negotiable" && data.has("vat_included"),delivery_days:value("delivery_days") === "" ? null : Number(value("delivery_days")),delivery_included:data.has("delivery_included"),payment_terms:value("payment_terms") || null,valid_until:value("valid_until") || null,commercial_terms:terms};
    const patch = Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(offer[key as keyof AdminOffer])));
    if (!Object.keys(patch).length) {setError("შეცვალეთ სულ მცირე ერთი ველი.");return;}
    setPending(true); setError(null);
    try {await store.mutateRpc("admin_edit_offer", {p_id:offer.id,p_patch:patch,p_reason:value("reason")});onSaved();}
    catch (err) {setError(adminErrorMessage(err));}
    finally {setPending(false);}
  }}>
    <fieldset className={styles.fieldset} disabled={pending}><legend>შეთავაზების პირობები</legend>
      <div className={styles.field}><label htmlFor={`${id}-body`}>შეთავაზების ტექსტი</label><textarea id={`${id}-body`} name="body" className="ma-textarea" required minLength={10} maxLength={2000} defaultValue={offer.body}/></div>
      <div className={styles.field}><label htmlFor={`${id}-type`}>ფასის ტიპი</label><CustomSelect id={`${id}-type`} value={priceType} onChange={e => setPriceType(e.target.value)}><option value="negotiable">შეთანხმებით</option><option value="total">ჯამური ფასი</option><option value="unit">ერთეულის ფასი</option></CustomSelect></div>
      {priceType !== "negotiable" ? <><div className={styles.field}><label htmlFor={`${id}-price`}>ფასი (₾)</label><input id={`${id}-price`} name="price" className="ma-input" type="number" required min="0.01" max="1000000000" step="0.01" defaultValue={offer.price ?? ""}/></div><label className="ma-check"><input type="checkbox" name="vat_included" defaultChecked={!!offer.vat_included}/>დღგ შედის ფასში</label></> : null}
      <div className={styles.field}><label htmlFor={`${id}-days`}>მიწოდების დღეები</label><input id={`${id}-days`} name="delivery_days" className="ma-input" type="number" min="0" max="365" defaultValue={offer.delivery_days ?? ""}/></div>
      <label className="ma-check"><input type="checkbox" name="delivery_included" defaultChecked={!!offer.delivery_included}/>მიწოდება შედის ფასში</label>
      <div className={styles.field}><label htmlFor={`${id}-payment`}>გადახდის პირობები</label><textarea id={`${id}-payment`} name="payment_terms" className="ma-textarea" maxLength={500} defaultValue={offer.payment_terms || ""}/></div>
      <div className={styles.field}><label htmlFor={`${id}-until`}>მოქმედების ვადა</label><input id={`${id}-until`} name="valid_until" className="ma-input" type="date" defaultValue={offer.valid_until?.slice(0,10) || ""}/></div>
      <div className={styles.field}><label htmlFor={`${id}-terms`}>კომერციული პირობები — თითო სტრიქონზე ერთი</label><textarea id={`${id}-terms`} name="commercial_terms" className="ma-textarea" defaultValue={offer.commercial_terms?.join("\n") || ""}/></div>
      <div className={styles.field}><label htmlFor={`${id}-reason`}>ცვლილების მიზეზი</label><textarea id={`${id}-reason`} name="reason" className="ma-textarea" required minLength={3} maxLength={500}/></div>
      {error ? <p role="alert" className="ma-field__error">{error}</p> : null}
    </fieldset>
    <footer className={styles.actions}><Button type="submit" loading={pending}>შენახვა</Button><Button type="button" disabled={pending} variant="secondary" onClick={onCancel}>გაუქმება</Button></footer>
  </form>;
}
