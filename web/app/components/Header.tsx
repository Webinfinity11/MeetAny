"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

function activeNav(pathname: string): "requests" | "companies" | "" {
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/companies")) return "companies";
  return "";
}

export function Header() {
  const pathname = usePathname();
  const active = activeNav(pathname);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => dialogRef.current?.showModal();
  const closeMenu = () => dialogRef.current?.close();

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
            <Link
              className="ma-header__link"
              href="/requests/"
              aria-current={active === "requests" ? "page" : undefined}
            >
              მოთხოვნები
            </Link>
            <Link
              className="ma-header__link"
              href="/companies/"
              aria-current={active === "companies" ? "page" : undefined}
            >
              კომპანიები
            </Link>
            <Link className="ma-header__link" href="/#how">
              როგორ მუშაობს
            </Link>
          </nav>
          <div className="ma-header__actions">
            <Link className="ma-btn ma-btn--ghost ma-header__login" href="/account/">
              შესვლა
            </Link>
            <Link className="ma-btn ma-btn--primary ma-header__cta" href="/requests/new/">
              <Icon name="plus" />
              <span className="ma-header__cta-label">მოთხოვნის დამატება</span>
            </Link>
          </div>
          <button
            ref={menuBtnRef}
            type="button"
            className="ma-header__menu-btn"
            aria-label="მენიუ"
            aria-haspopup="dialog"
            aria-expanded="false"
            onClick={openMenu}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <dialog className="ma-mnav" ref={dialogRef} aria-label="მენიუ">
        <div className="ma-mnav__head">
          <Link className="ma-header__brand" href="/" aria-label="MeetAny — მთავარი" onClick={closeMenu}>
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
          <button type="button" className="ma-mnav__close" aria-label="მენიუს დახურვა" onClick={closeMenu}>
            <Icon name="x" />
          </button>
        </div>
        <div className="ma-mnav__body">
          <nav className="ma-mnav__group" aria-label="ნავიგაცია">
            <Link className="ma-mnav__link" href="/requests/" onClick={closeMenu}>
              <Icon name="clipboard-list" />
              მოთხოვნები
            </Link>
            <Link className="ma-mnav__link" href="/companies/" onClick={closeMenu}>
              <Icon name="building-2" />
              კომპანიები
            </Link>
            <Link className="ma-mnav__link" href="/#how" onClick={closeMenu}>
              <Icon name="info" />
              როგორ მუშაობს
            </Link>
          </nav>
          <div className="ma-mnav__group">
            <span className="ma-eyebrow">ანგარიში</span>
            <Link className="ma-mnav__link" href="/account/" onClick={closeMenu}>
              <Icon name="user-round" />
              შესვლა
            </Link>
            <Link className="ma-mnav__link" href="/account/?tab=register&role=company" onClick={closeMenu}>
              <Icon name="store" />
              კომპანიის რეგისტრაცია
            </Link>
          </div>
        </div>
        <div className="ma-mnav__foot">
          <Link
            className="ma-btn ma-btn--primary ma-btn--lg ma-btn--block"
            href="/requests/new/"
            onClick={closeMenu}
          >
            <Icon name="plus" />
            მოთხოვნის დამატება
          </Link>
        </div>
      </dialog>
    </>
  );
}
