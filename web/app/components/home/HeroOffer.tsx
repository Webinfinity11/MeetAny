import { Icon } from "../Icon";
import styles from "./HomeSections.module.css";

export const heroOffers = [
  { company: "CleanPro", initials: "CP", request: "ოფისის დასუფთავება", price: "₾950 / თვე", delivery: "1 ოქტომბრიდან", status: "new" },
  { company: "Studio Forma", initials: "SF", request: "ბრენდის იდენტობა", price: "₾2,100", delivery: "3 კვირაში", status: "viewed" },
  { company: "BuildLine", initials: "BL", request: "საოფისე რემონტი", price: "₾21,500", delivery: "6 კვირაში", status: "selected" },
  { company: "Spotless Georgia", initials: "SG", request: "ოფისის დასუფთავება", price: "₾1,080 / თვე", delivery: "ხვალიდან", status: "new" },
  { company: "StaffHub", initials: "SH", request: "სეზონური პერსონალი", price: "₾9,600 / 2 თვე", delivery: "5 დღეში", status: "viewed" },
] as const;
// Illustration only: private offers are never requested or exposed by this component.
export function HeroOffer({ offer: o }: { offer: typeof heroOffers[number] }) {
  return <article className={styles.offer} aria-hidden="true"><div className={styles.offerCompany}><span className="home-live-initials">{o.initials}</span><div><strong>{o.company}<Icon name="badge-check" /></strong><p>{o.request}</p></div></div><div className={styles.offerPrice}><div><p>შეთავაზება</p><strong>{o.price}</strong></div><span className={styles[o.status]}>{o.status === "new" ? "ახალი" : o.status === "viewed" ? "ნანახი" : "არჩეული"}</span></div><p className={styles.delivery}><Icon name="clock" />მიწოდება {o.delivery}</p></article>;
}
