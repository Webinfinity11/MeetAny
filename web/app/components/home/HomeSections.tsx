"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { useMarketStore } from "../../lib/market-client";
import styles from "./HomeSections.module.css";

const steps = [
  ["file-text", "აღწერეთ საჭიროება", "რა, რამდენი, სად და როდის. 4 მოკლე ნაბიჯი, მონახაზი ინახება.", "უფასო"],
  ["inbox", "მიიღეთ შეთავაზებები", "შესაბამისი ვერიფიცირებული კომპანიები გიგზავნიან ფასს, ვადას და პირობებს.", "საშუალოდ 48 სთ"],
  ["scale", "შეადარეთ და აირჩიეთ", "ყველა შეთავაზება ერთ ეკრანზე. კონტაქტი იხსნება მხოლოდ არჩეულთან.", "1 ეკრანი"],
  ["handshake", "გააფორმეთ გარიგება", "შეთანხმებული პირობები, შესრულების კონტროლი და შეფასება დასრულებისას.", "ჩანაწერი რჩება"],
];
export function HomeSections() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <>
    <section className={styles.how} aria-labelledby="home-how-title"><div className="home-wrap"><p className={styles.eyebrow}>როგორ მუშაობს</p><h2 id="home-how-title">ერთი მოთხოვნიდან — დასრულებულ გარიგებამდე</h2><ol className={styles.steps}>{steps.map(([icon, title, text, meta], i) => <li key={title}><div className={styles.stepHead}><span className={styles.stepIcon}><Icon name={icon} /></span>{i < 3 && <span className={styles.connector} />}</div><div><p className={styles.number}>0{i + 1}</p><h3>{title}</h3><p className={styles.stepText}>{text}</p><span className={styles.stepMeta}>{meta}</span></div></li>)}</ol></div></section>
    <section className={`home-wrap ${styles.supplier}`} aria-labelledby="supplier-title"><div className={styles.supplierCopy}><p className={styles.eyebrow}>მომწოდებლებისთვის</p><h2 id="supplier-title">კლიენტები უკვე წერენ, რა სჭირდებათ</h2><p className={styles.supplierLead}>დაარეგისტრირეთ კომპანია, მიიღეთ შესაბამისი მოთხოვნები და გაგზავნეთ შეთავაზება — რეკლამისა და ცივი ზარების გარეშე.</p><ul>{["შეთავაზების გაგზავნა უფასოა", "მოთხოვნები თქვენი დარგისა და ქალაქის მიხედვით", "შეფასებები მხოლოდ რეალური გარიგებებიდან"].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul><div className={styles.supplierActions}><Button size="lg" className={styles.inverse} href={company ? `/companies/view/?id=${encodeURIComponent(me.id)}` : "/account/?tab=register&role=company&entry=home"}>{company ? "ჩემი კომპანიის გვერდი" : "კომპანიის რეგისტრაცია"}</Button><Link href="/how-it-works/#companies">როგორ მუშაობს მომწოდებლისთვის</Link></div></div><div className={styles.supplierPhoto}><Image unoptimized src="/assets/photos/hero-partners.jpg" alt="" width={1200} height={800} loading="lazy" /></div></section>
  </>;
}
