import Link from "next/link";
import { dateLabel } from "../../lib/format";
import styles from "./admin.module.css";

export type AdminOffer = {
  id: string; request_id: string; company_id: string; body: string; price: number | string | null;
  price_type: string | null; status: "sent" | "chosen" | "declined"; created_at: string;
  company_name: string | null; request_title: string | null; request_hidden: boolean;
};
const statuses = { sent: "გაგზავნილი", chosen: "არჩეული", declined: "უარყოფილი" };

export function AdminOffersTable({ offers, onDelete }: { offers: AdminOffer[]; onDelete: (offer: AdminOffer) => void }) {
  return <div className="ma-table-wrap"><table className="ma-table">
    <caption className="ma-sr-only">შეთავაზებების მოდერაცია</caption>
    <thead><tr>{["შეთავაზება", "კომპანია", "მოთხოვნა", "სტატუსი", "თარიღი", "მოქმედება"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{offers.map(offer => <tr key={offer.id}>
      <td data-label="შეთავაზება"><p className={styles.excerpt}>{offer.body || "ტექსტი არ არის"}</p><small>{offer.price == null ? "ფასი მითითებული არ არის" : `${Number(offer.price).toLocaleString("ka-GE")} ₾${offer.price_type === "from" ? "-დან" : ""}`}</small></td>
      <td data-label="კომპანია"><Link className="ma-link" href={`/companies/view/?id=${offer.company_id}`}>{offer.company_name || `კომპანია · #${offer.company_id.slice(0, 8)}`}</Link></td>
      <td data-label="მოთხოვნა"><Link className="ma-link" href={`/requests/view/?id=${offer.request_id}`}>{offer.request_title || `მოთხოვნა · #${offer.request_id.slice(0, 8)}`}</Link>{offer.request_hidden ? <small>დამალული მოთხოვნა</small> : null}</td>
      <td data-label="სტატუსი"><span className={`ma-badge ma-badge--${offer.status === "chosen" ? "success" : "neutral"}`}>{statuses[offer.status]}</span></td>
      <td data-label="თარიღი"><time dateTime={offer.created_at}>{dateLabel(offer.created_at)}</time></td>
      <td data-label="მოქმედება"><button type="button" className="ma-btn ma-btn--danger-quiet" disabled={offer.status === "chosen"} aria-describedby={offer.status === "chosen" ? `offer-locked-${offer.id}` : undefined} onClick={() => onDelete(offer)}>წაშლა</button>
        {offer.status === "chosen" ? <small id={`offer-locked-${offer.id}`}>არჩეული შეთავაზება არ იშლება. შეგიძლია მოთხოვნის დამალვა ან წაშლა, ან კომპანიის დაბლოკვა.</small> : null}</td>
    </tr>)}</tbody>
  </table></div>;
}
