"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import styles from "./HomeSections.module.css";

export function HomeSupplier() {
  return <section className={`home-wrap ${styles.supplier}`} aria-labelledby="supplier-title"><div className={styles.supplierCopy}><p className={styles.eyebrow}>მომწოდებლებისთვის</p><h2 id="supplier-title">კლიენტები უკვე წერენ, რა სჭირდებათ</h2><p className={styles.supplierLead}>იპოვეთ შესაბამისი მოთხოვნა და გაგზავნეთ შეთავაზება.</p><ul>{["შეთავაზების გაგზავნა უფასოა", "მოთხოვნები თქვენი დარგისა და ქალაქის მიხედვით", "შეფასებები მხოლოდ დასრულებული გარიგებებიდან"].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul><div className={styles.supplierActions}><Button size="lg" className={styles.inverse} href="/requests/">მოთხოვნების ნახვა</Button><Link href="/how-it-works/#suppliers">როგორ მუშაობს მომწოდებლისთვის</Link></div></div><div className={styles.supplierPhoto}><Image src="/assets/photos/warehouse-team.jpg" alt="" fill sizes="(max-width: 1023px) 100vw, 560px" loading="lazy" /></div></section>;
}
