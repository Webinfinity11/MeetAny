
import { Button } from "../ui/Button";
import { dateLabel } from "../../lib/format";
import { adminMoney } from "../../lib/admin-helpers";
import type { AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

export type AdminOffer = {
  id: string; request_id: string; company_id: string; body: string; price: number | string | null;
  price_type: string | null; status: "sent" | "chosen" | "declined" | "withdrawn"; created_at: string;
  company_name: string | null; request_title: string | null; request_hidden: boolean;
  vat_included?: boolean | null; delivery_days?: number | null; delivery_included?: boolean | null; payment_terms?: string | null;
  valid_until?: string | null; commercial_terms?: string[] | null; expired?: boolean; deal_id?: string | null;
};
export const offerStatuses: Record<string, string> = { sent: "გაგზავნილი", chosen: "არჩეული", declined: "არ შეირჩა", withdrawn: "გაუქმებული" };
/** "1 920 ₾" for the whole offer, "120 ₾ / ერთეული" per unit; no price is "შეთანხმებით". */
export const offerPrice = (offer: Pick<AdminOffer, "price" | "price_type">) =>
  offer.price == null ? "შეთანხმებით" : `${adminMoney(offer.price)}${offer.price_type === "unit" ? " / ერთეული" : offer.price_type === "from" ? "-დან" : ""}`;

export function AdminOffersTable({ offers, onDelete, onOpen }: { offers: AdminOffer[]; onDelete: (offer: AdminOffer) => void; onOpen: (target: AdminTarget) => void }) {
  const anyChosen = offers.some(offer => offer.status === "chosen");
  return <>
    {anyChosen ? <p className={styles.note}>არჩეული შეთავაზება არ იშლება: მის ნაცვლად დამალეთ მოთხოვნა, გააუქმეთ გარიგება ან დაბლოკეთ კომპანია.</p> : null}
    <div className="ma-table-wrap"><table className={`ma-table ${styles.offersTable}`}>
      <caption className="ma-sr-only">შეთავაზებების მოდერაცია</caption>
      <colgroup><col className={styles.colWide} /><col /><col /><col /><col className={styles.colDate} /><col className={styles.colAction} /></colgroup>
      <thead><tr>{["შეთავაზება", "კომპანია", "მოთხოვნა", "სტატუსი", "თარიღი"].map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col"><span className="ma-sr-only">მოქმედება</span></th></tr></thead>
      <tbody>{offers.map(offer => <tr key={offer.id}>
        <td data-label="შეთავაზება"><button type="button" className={styles.rowLink} onClick={() => onOpen({ kind: "offer", id: offer.id })}>{offerPrice(offer)}</button><p className={styles.excerpt}>{offer.body || "ტექსტი არ არის"}</p></td>
        <td data-label="კომპანია"><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: offer.company_id })}>{offer.company_name || `კომპანია · #${offer.company_id.slice(0, 8)}`}</button></td>
        <td data-label="მოთხოვნა"><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "request", id: offer.request_id })}>{offer.request_title || `მოთხოვნა · #${offer.request_id.slice(0, 8)}`}</button>{offer.request_hidden ? <small>დამალული მოთხოვნა</small> : null}</td>
        <td data-label="სტატუსი"><span className={`ma-badge ma-badge--${offer.status === "chosen" ? "success" : "neutral"}`}>{offerStatuses[offer.status]}</span>{offer.expired ? <small>ვადაგასული</small> : null}</td>
        <td data-label="თარიღი"><time dateTime={offer.created_at} className={styles.nowrap}>{dateLabel(offer.created_at)}</time></td>
        <td data-label="მოქმედება">{offer.status === "chosen"
          ? <Button type="button" variant="secondary" onClick={() => onOpen({ kind: "offer", id: offer.id })}>დეტალების ნახვა</Button>
          : <Button type="button" variant="danger-quiet" onClick={() => onDelete(offer)}>წაშლა…</Button>}</td>
      </tr>)}</tbody>
    </table></div>
  </>;
}
