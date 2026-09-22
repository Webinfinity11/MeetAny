// Static markup matching scripts/shell.html exactly (same data-shell/data-nav/data-market
// attributes). shell.js (loaded by SiteScripts) owns all interactivity: the mobile menu dialog,
// dropdown menus, active-nav, and re-rendering the actions/menu slots from MarketStore on
// sign-in/out. Keeping this a plain server component avoids a second, conflicting set of
// listeners on the same buttons.
import Link from "next/link";
import { Icon } from "./Icon";

export function Header() {
  return (
    <>
      <header className="ma-header" data-shell="header">
        <div className="ma-header__inner ma-container">
          <Link className="ma-header__brand" href="/" aria-label="MeetAny — მთავარი">
            <img
              className="ma-header__symbol"
              src="/assets/meetany-symbol-transparent.png"
              alt=""
              width={1496}
              height={1051}
            />
            <img
              className="ma-header__wordmark"
              src="/assets/meetany-wordmark.png"
              alt="MeetAny"
              width={683}
              height={171}
            />
          </Link>
          <nav className="ma-header__nav" aria-label="მთავარი ნავიგაცია">
            <Link className="ma-header__link" data-nav="requests" href="/requests/" suppressHydrationWarning>
              მოთხოვნები
            </Link>
            <Link className="ma-header__link" data-nav="companies" href="/companies/" suppressHydrationWarning>
              კომპანიები
            </Link>
            <Link className="ma-header__link" data-nav="how" href="/#how">
              როგორ მუშაობს
            </Link>
          </nav>
          <div className="ma-header__actions" data-shell-slot="actions">
            <Link className="ma-btn ma-btn--ghost ma-header__login" href="/account/" data-market="login">
              შესვლა
            </Link>
            <Link className="ma-btn ma-btn--primary ma-header__cta" href="/requests/new/" data-market="new-request">
              <Icon name="plus" />
              <span className="ma-header__cta-label">მოთხოვნის დამატება</span>
            </Link>
          </div>
          <button
            type="button"
            className="ma-header__menu-btn"
            aria-label="მენიუ"
            aria-haspopup="dialog"
            aria-controls="ma-mnav"
            aria-expanded="false"
            data-shell="menu-open"
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <dialog className="ma-mnav" id="ma-mnav" aria-label="მენიუ">
        <div className="ma-mnav__head">
          <Link className="ma-header__brand" href="/" aria-label="MeetAny — მთავარი">
            <img
              className="ma-header__symbol"
              src="/assets/meetany-symbol-transparent.png"
              alt=""
              width={1496}
              height={1051}
            />
            <img
              className="ma-header__wordmark"
              src="/assets/meetany-wordmark.png"
              alt="MeetAny"
              width={683}
              height={171}
            />
          </Link>
          <button type="button" className="ma-mnav__close" aria-label="მენიუს დახურვა" data-shell="menu-close">
            <Icon name="x" />
          </button>
        </div>
        <div className="ma-mnav__body">
          <nav className="ma-mnav__group" aria-label="ნავიგაცია">
            <Link className="ma-mnav__link" data-nav="requests" href="/requests/" suppressHydrationWarning>
              <Icon name="clipboard-list" />
              მოთხოვნები
            </Link>
            <Link className="ma-mnav__link" data-nav="companies" href="/companies/" suppressHydrationWarning>
              <Icon name="building-2" />
              კომპანიები
            </Link>
            <Link className="ma-mnav__link" data-nav="how" href="/#how">
              <Icon name="info" />
              როგორ მუშაობს
            </Link>
          </nav>
          <div className="ma-mnav__group" data-shell-slot="menu-account">
            <span className="ma-eyebrow">ანგარიში</span>
            <Link className="ma-mnav__link" href="/account/" data-market="login">
              <Icon name="user-round" />
              შესვლა
            </Link>
            <Link className="ma-mnav__link" href="/account/?tab=register&role=company" data-market="register-company">
              <Icon name="store" />
              კომპანიის რეგისტრაცია
            </Link>
          </div>
        </div>
        <div className="ma-mnav__foot" data-shell-slot="menu-foot">
          <Link className="ma-btn ma-btn--primary ma-btn--lg ma-btn--block" href="/requests/new/" data-market="new-request">
            <Icon name="plus" />
            მოთხოვნის დამატება
          </Link>
        </div>
      </dialog>
    </>
  );
}
