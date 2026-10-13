"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { useMarketStore } from "../../lib/market-client";
import styles from "./HomeSections.module.css";

export function HomeSupplier() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <section className={`home-wrap ${styles.supplier}`} aria-labelledby="supplier-title"><div className={styles.supplierCopy}><p className={styles.eyebrow}>მომწოდებლებისთვის</p><h2 id="supplier-title">კლიენტები უკვე წერენ, რა სჭირდებათ</h2><p className={styles.supplierLead}>დაარეგისტრირეთ კომპანია, მიიღეთ შესაბამისი მოთხოვნები და გაგზავნეთ შეთავაზება — რეკლამისა და ცივი ზარების გარეშე.</p><ul>{["შეთავაზების გაგზავნა უფასოა", "მოთხოვნები თქვენი დარგისა და ქალაქის მიხედვით", "შეფასებები მხოლოდ დასრულებული გარიგებებიდან"].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul><div className={styles.supplierActions}><Button size="lg" className={styles.inverse} href={company ? `/companies/view/?id=${encodeURIComponent(me.id)}` : "/account/?tab=register&role=company&entry=home"}>{company ? "ჩემი კომპანიის გვერდი" : "კომპანიის რეგისტრაცია"}</Button><Link href="/how-it-works/#suppliers">როგორ მუშაობს მომწოდებლისთვის</Link></div></div><div className={styles.supplierPhoto}><Image src="/assets/photos/warehouse-team.jpg" alt="" fill sizes="(max-width: 1023px) 100vw, 560px" loading="lazy" /></div></section>;
}
