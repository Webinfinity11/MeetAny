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
          </div>
          <nav className="ma-footer__nav" aria-label="ქვედა ნავიგაცია">
            <Link href="/requests/">მოთხოვნები</Link>
            <Link href="/companies/">კომპანიები</Link>
            <Link href="/#how">როგორ მუშაობს</Link>
          </nav>
        </div>
        <div className="ma-footer__bottom">
          <span>© MeetAny, 2026</span>
          <nav className="ma-footer__legal" aria-label="ინფორმაცია">
            <Link href="/terms/#contact">კონტაქტი</Link>
            <Link href="/terms/">წესები და კონფიდენციალურობა</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
