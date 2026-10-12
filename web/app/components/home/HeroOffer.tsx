import { Icon } from "../Icon";
import { Badge } from "../ui/Badge";
import styles from "./HomeSections.module.css";

// Schematic offers: no company names or prices, so they never read as real figures next to the live counters.
export const heroOffers = [
  { id: "a", price: 72, delivery: "ხვალიდან", status: "new" },
  { id: "b", price: 54, delivery: "3 კვირაში", status: "viewed" },
  { id: "c", price: 86, delivery: "5 დღეში", status: "selected" },
  { id: "d", price: 64, delivery: "1 კვირაში", status: "new" },
  { id: "e", price: 46, delivery: "2 კვირაში", status: "viewed" },
] as const;
// Illustration only: private offers are never requested or exposed by this component.
export function HeroOffer({ offer: o }: { offer: typeof heroOffers[number] }) {
  return <article className={styles.offer} aria-hidden="true">
    <div className={styles.offerCompany}><span className="home-live-initials">{o.id.toUpperCase()}</span><div><strong>მომწოდებელი {o.id.toUpperCase()}<Icon name="badge-check" /></strong><p>ვერიფიცირებული კომპანია</p></div></div>
    <div className={styles.offerPrice}><div className={styles.offerBar}><p>ფასი</p><span style={{ width: `${o.price}%` }} /></div><Badge status={o.status === "selected" ? "success" : o.status === "new" ? "info" : "neutral"}>{o.status === "new" ? "ახალი" : o.status === "viewed" ? "ნანახია" : "არჩეული"}</Badge></div>
    <p className={styles.delivery}><Icon name="clock" />მიწოდება {o.delivery}</p>
  </article>;
}
