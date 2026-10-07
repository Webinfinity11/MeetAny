"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useMarketStore } from "../lib/market-client";

export function Footer() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  return <footer className="ma-footer">
    <div className="ma-footer__inner ma-container">
      <div className="ma-footer__top">
        <div className="ma-footer__brand"><Link href="/" aria-label="MeetAny — მთავარი"><Logo inverted/></Link><p>ბიზნესი წერს, რა სჭირდება — სხვა ბიზნესები აგზავნიან შეთავაზებებს.</p></div>
        <nav className="ma-footer__column" aria-label="მყიდველებისთვის"><h2>მყიდველებისთვის</h2><Link href="/requests/new/">მოთხოვნის განთავსება</Link><Link href="/companies/">კომპანიები</Link><Link href="/how-it-works/">როგორ მუშაობს</Link></nav>
        <nav className="ma-footer__column" aria-label="მომწოდებლებისთვის"><h2>მომწოდებლებისთვის</h2><Link href="/requests/">შესაძლებლობები</Link>{!me ? <Link href="/account/?tab=register&role=company">კომპანიის რეგისტრაცია</Link> : me.role === "company" ? <Link href={`/companies/view/?id=${me.id}`}>ჩემი კომპანიის გვერდი</Link> : null}{me?.role === "company" ? <Link href="/account/?tab=business">Premium / VIP</Link> : null}<Link href="/account/">{me ? "ჩემი ანგარიში" : "ანგარიშში შესვლა"}</Link></nav>
        <nav className="ma-footer__column" aria-label="ინფორმაცია"><h2>ინფორმაცია</h2><Link href="/terms/">წესები და კონფიდენციალურობა</Link><Link href="/ideas/">ბიზნესიდეები</Link></nav>
      </div>
    </div>
    <div className="ma-footer__bottom"><div className="ma-container"><span>© 2026 MeetAny · საქართველო</span><span>ბიზნესებს შორის კავშირისთვის</span></div></div>
  </footer>;
}
