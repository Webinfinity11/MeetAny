"use client";

import Link from "next/link";
import styles from "./Footer.module.css";
import { Logo } from "./Logo";
import { useMarketStore } from "../lib/market-client";

export function Footer() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.top}>
        <div className={styles.brand}><Link href="/" aria-label="MeetAny — მთავარი"><Logo inverted/></Link><p>ბიზნესი წერს, რა სჭირდება — სხვა ბიზნესები აგზავნიან შეთავაზებებს.</p></div>
        <nav className={styles.column} aria-label="მყიდველებისთვის"><h2>მყიდველებისთვის</h2><Link href="/requests/new/">მოთხოვნის განთავსება</Link><Link href="/companies/">კომპანიები</Link><Link href="/how-it-works/">როგორ მუშაობს</Link></nav>
        <nav className={styles.column} aria-label="მომწოდებლებისთვის"><h2>მომწოდებლებისთვის</h2><Link href="/requests/">შესაძლებლობები</Link>{me?.role === "company" ? <Link href={`/companies/view/?id=${encodeURIComponent(me.id)}`}>ჩემი კომპანიის გვერდი</Link> : <Link href="/account/?tab=register&role=company">კომპანიის რეგისტრაცია</Link>}<Link href={me?.role === "company" ? "/onboarding/?step=verify" : "/how-it-works/#trust-title"}>ვერიფიკაცია</Link></nav>
        <nav className={styles.column} aria-label="ინფორმაცია"><h2>ინფორმაცია</h2><Link href="/terms/">წესები და კონფიდენციალურობა</Link><Link href="/terms/">კონტაქტი</Link></nav>
      </div>
    </div>
    <div className={styles.bottom}><div className={styles.inner}><span>© 2026 MeetAny · საქართველო</span><span>ბიზნესებს შორის კავშირისთვის</span></div></div>
  </footer>;
}
