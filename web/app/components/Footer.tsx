"use client";

import Link from "next/link";
import { useMarketStore } from "../lib/market-client";

export function Footer() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  return <footer className="ma-footer">
    <div className="ma-footer__inner ma-container">
      <div className="ma-footer__top">
        <div className="ma-footer__brand"><Link href="/" aria-label="MeetAny — მთავარი"><img src="/assets/meetany-symbol-transparent.png" alt="" width={1496} height={1051} style={{height:28}} /><img src="/assets/meetany-wordmark.png" alt="MeetAny" width={683} height={171} style={{height:22}} /></Link><p>მოძებნე მომწოდებელი, მიიღე შეთავაზებები და დაუკავშირდი სხვა ბიზნესებს.</p><span>საქართველო</span></div>
        <nav className="ma-footer__column" aria-label="მომწოდებლის მოძიება"><h2>მომწოდებელს ეძებ?</h2><Link href="/companies/">კომპანიების კატალოგი</Link><Link href="/requests/new/">მოთხოვნის დამატება</Link><Link href="/#how">როგორ მუშაობს</Link></nav>
        <nav className="ma-footer__column" aria-label="კომპანიებისთვის"><h2>კომპანიებისთვის</h2><Link href="/requests/">ღია მოთხოვნები</Link>{!me ? <Link href="/account/?tab=register&role=company">კომპანიის რეგისტრაცია</Link> : me.role === "company" ? <Link href={`/companies/view/?id=${me.id}`}>ჩემი კომპანიის გვერდი</Link> : null}<Link href="/account/">{me ? "ჩემი ანგარიში" : "ანგარიშში შესვლა"}</Link></nav>
        <nav className="ma-footer__column" aria-label="ინფორმაცია"><h2>ინფორმაცია</h2><Link href="/terms/">წესები და კონფიდენციალურობა</Link></nav>
      </div>
      <div className="ma-footer__bottom"><span>© MeetAny, 2026</span><span>ბიზნესებს შორის კავშირისთვის</span></div>
    </div>
  </footer>;
}
