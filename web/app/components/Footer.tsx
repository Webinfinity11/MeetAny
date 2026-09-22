import Link from "next/link";

export function Footer() {
  return (
    <footer className="ma-footer">
      <div className="ma-footer__inner ma-container">
        <div className="ma-footer__top">
          <div className="ma-footer__brand">
            <Link href="/" aria-label="MeetAny — მთავარი">
              <img
                src="/assets/meetany-symbol-transparent.png"
                alt=""
                width={1496}
                height={1051}
                style={{ height: 24 }}
              />
              <img
                src="/assets/meetany-wordmark.png"
                alt="MeetAny"
                width={683}
                height={171}
                style={{ height: 19 }}
              />
            </Link>
            <p>დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ.</p>
          </div>
          <nav className="ma-footer__nav" aria-label="ქვედა ნავიგაცია">
            <Link href="/#how">ჩვენ შესახებ</Link>
            <Link href="/requests/">მოთხოვნები</Link>
            <Link href="/companies/">კომპანიები</Link>
            <Link href="/terms/">წესები და კონფიდენციალურობა</Link>
            <Link href="/terms/#contact">კონტაქტი</Link>
          </nav>
        </div>
        <div className="ma-footer__bottom">
          <span>© MeetAny, 2026</span>
          <span>საქართველო · ქართული</span>
        </div>
      </div>
    </footer>
  );
}
