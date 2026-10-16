
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

export function AdminOffersTable({ offers, onOpen }: { offers: AdminOffer[]; onOpen: (target: AdminTarget) => void }) {
  return <>
    <div className="ma-table-wrap"><table className={`ma-table ${styles.offersTable}`}>
      <caption className="ma-sr-only">შეთავაზებების მოდერაცია</caption>
      <thead><tr>{["შეთავაზება / მომწოდებელი", "მოთხოვნა", "სტატუსი / თარიღი"].map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col"><span className="ma-sr-only">მოქმედება</span></th></tr></thead>
      <tbody>{offers.map(offer => <tr key={offer.id}>
        <td data-label="შეთავაზება"><div className={styles.offerIdentity}><button type="button" className={styles.rowLink} onClick={() => onOpen({ kind: "offer", id: offer.id })}>{offerPrice(offer)}</button><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: offer.company_id })}>{offer.company_name || `მომწოდებელი · #${offer.company_id.slice(0, 8)}`}</button><p className={styles.excerpt}>{offer.body || "ტექსტი არ არის"}</p></div></td>
        <td data-label="მოთხოვნა"><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "request", id: offer.request_id })}>{offer.request_title || `მოთხოვნა · #${offer.request_id.slice(0, 8)}`}</button>{offer.request_hidden ? <small>დამალული მოთხოვნა</small> : null}</td>
        <td data-label="სტატუსი"><span className={`ma-badge ma-badge--${offer.status === "chosen" ? "success" : "neutral"}`}>{offerStatuses[offer.status]}</span>{offer.expired ? <small className={styles.warningText}>ვადაგასული</small> : null}<small><time dateTime={offer.created_at}>{dateLabel(offer.created_at)}</time></small></td>
        <td data-label="მოქმედება"><Button type="button" variant="secondary" aria-label={`შეთავაზების ნახვა: ${offer.company_name || offer.id.slice(0, 8)}`} onClick={() => onOpen({ kind: "offer", id: offer.id })}>ნახვა</Button></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}
