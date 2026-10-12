"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { useMarketStore } from "../../lib/market-client";
import styles from "./HomeSections.module.css";

const steps = [
  ["file-text", "აღწერე საჭიროება", "მიუთითე რა, რამდენი, სად და როდის გჭირდება."],
  ["inbox", "მიიღე შეთავაზებები", "მომწოდებლები გიგზავნიან ფასს, ვადას და პირობებს."],
  ["scale", "შეადარე და აირჩიე", "შეადარე პირობები და დაუკავშირდი არჩეულ კომპანიას."],
  ["handshake", "შეათანხმე გარიგება", "შეინახე პირობები და შეაფასე შესრულება."],
];
export function HomeSections() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <>
    <section className={styles.how} aria-labelledby="home-how-title"><div className="home-wrap"><h2 id="home-how-title">როგორ მუშაობს</h2><ol className={styles.steps}>{steps.map(([icon, title, text], i) => <li key={title}><div className={styles.stepHead}><span className={styles.stepIcon}><Icon name={icon} /></span>{i < 3 && <span className={styles.connector} />}</div><div><p className={styles.number}>0{i + 1}</p><h3>{title}</h3><p className={styles.stepText}>{text}</p></div></li>)}</ol></div></section>
    <section className={`home-wrap ${styles.supplier}`} aria-labelledby="supplier-title"><div className={styles.supplierCopy}><p className={styles.eyebrow}>მომწოდებლებისთვის</p><h2 id="supplier-title">კლიენტები უკვე წერენ, რა სჭირდებათ</h2><p className={styles.supplierLead}>დაარეგისტრირეთ კომპანია, მიიღეთ შესაბამისი მოთხოვნები და გაგზავნეთ შეთავაზება — რეკლამისა და ცივი ზარების გარეშე.</p><ul>{["შეთავაზების გაგზავნა უფასოა", "მოთხოვნები თქვენი დარგისა და ქალაქის მიხედვით", "შეფასებები მხოლოდ რეალური გარიგებებიდან"].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul><div className={styles.supplierActions}><Button size="lg" className={styles.inverse} href={company ? `/companies/view/?id=${encodeURIComponent(me.id)}` : "/account/?tab=register&role=company&entry=home"}>{company ? "ჩემი კომპანიის გვერდი" : "კომპანიის რეგისტრაცია"}</Button><Link href="/how-it-works/#companies">როგორ მუშაობს მომწოდებლისთვის</Link></div></div><div className={styles.supplierPhoto}><Image unoptimized src="/assets/photos/hero-partners.jpg" alt="" width={1200} height={800} loading="lazy" /></div></section>
  </>;
}
