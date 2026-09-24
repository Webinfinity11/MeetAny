"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NotificationBell } from "./market/EngagementPanels";
import { ChatUnreadLink } from "./market/ChatPopup";
import { Icon } from "./Icon";
import { useMarketStore } from "../lib/market-client";
import { toast } from "./Toasts";
import { NavigationProgress } from "./ProgressBar";

export function Header() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const pathname = usePathname();
  const mobile = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const links = me ? [
    ...(me.role === "admin" ? [["shield-check", "ადმინი", "/admin/"]] : []),
    ["clipboard-list", "ჩემი მოთხოვნები", "/account/?tab=requests"],
    ...(me.role === "company" ? [["send", "ჩემი შეთავაზებები", "/account/?tab=offers"], ["building-2", "საჯარო პროფილი", `/companies/view/?id=${me.id}`]] : []),
    ["bookmark", "შენახული კომპანიები", "/account/?tab=saved"],
    ["bell", "შეტყობინებები", "/account/?tab=notifications"],
    ["message-square", "მიმოწერები", "/account/?tab=messages"],
    ["user-round", "პროფილი", "/account/?tab=profile"],
    ["plus", "მოთხოვნის დამატება", "/requests/new/"],
  ] : [["user-round", "შესვლა", "/account/"], ["store", "კომპანიის რეგისტრაცია", "/account/?tab=register&role=company"]];
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!dropdown.current?.contains(e.target as Node)) setAccountOpen(false); };
    document.addEventListener("pointerdown", close);
    const media = matchMedia("(min-width:1024px)");
    const resize = () => { if (media.matches) mobile.current?.close(); };
    media.addEventListener("change", resize);
    return () => { document.removeEventListener("pointerdown", close); media.removeEventListener("change", resize); };
  }, []);
  async function logout() {
    if (pending) return;
    setPending(true);
    try { await store?.logout(); setAccountOpen(false); mobile.current?.close(); toast("ანგარიშიდან გამოხვედი."); }
    catch (err) { toast((err as {userMessage?: string}).userMessage || "გასვლა ვერ შესრულდა."); }
    finally { setPending(false); }
  }
  const brand = <Link className="ma-header__brand" href="/" aria-label="MeetAny — მთავარი"><img className="ma-header__symbol" src="/assets/meetany-symbol-transparent.png" alt="" width={1496} height={1051}/><img className="ma-header__wordmark" src="/assets/meetany-wordmark.png" alt="MeetAny" width={683} height={171}/></Link>;
  const nav = (cls: string) => [["requests", "მოთხოვნები", "/requests/"], ["companies", "კომპანიები", "/companies/"], ["how", "როგორ მუშაობს", "/#how"]].map(([id, title, href]) => <Link key={id} className={cls} href={href} aria-current={pathname.startsWith(`/${id}/`) ? "page" : undefined}>{title}</Link>);
  const add = <Link className="ma-btn ma-btn--primary ma-header__cta" aria-label="მოთხოვნის დამატება" href="/requests/new/"><Icon name="plus"/><span className="ma-header__cta-label">მოთხოვნის დამატება</span><span className="ma-header__cta-short" aria-hidden="true">დამატება</span></Link>;
  return <>
    <NavigationProgress />
    <header className="ma-header"><div className="ma-header__inner ma-container">
      {brand}<nav className="ma-header__nav" aria-label="მთავარი ნავიგაცია">{nav("ma-header__link")}</nav>
      <div className="ma-header__actions">
        <NotificationBell/>
        <ChatUnreadLink/>
        {!me ? <Link className="ma-btn ma-btn--ghost ma-header__login" href="/account/">შესვლა</Link> : null}{add}
        {me ? <div ref={dropdown} className="ma-menu ma-header__account" onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget)) setAccountOpen(false);}} onKeyDown={e => {
          if (e.key === "Escape") {setAccountOpen(false); dropdown.current?.querySelector<HTMLButtonElement>("button")?.focus();}
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault(); setAccountOpen(true);
            requestAnimationFrame(() => {const items = Array.from(dropdown.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []); const index = items.indexOf(document.activeElement as HTMLElement); const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length; items[next]?.focus();});
          }
        }}>
          <button className="ma-menu__trigger" aria-haspopup="menu" aria-controls="ma-account-menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><Icon name="user-round"/><span>ჩემი ანგარიში</span><Icon name="chevron-down"/></button>
          <div className="ma-menu__list" id="ma-account-menu" role="menu" hidden={!accountOpen}>
            {links.map(([icon, title, href]) => <Link key={href} className="ma-menu__item" role="menuitem" href={href} onClick={() => setAccountOpen(false)}><Icon name={icon}/>{title}</Link>)}
            <button className="ma-menu__item ma-menu__item--danger" role="menuitem" disabled={pending} onClick={logout}>გასვლა</button>
          </div>
        </div> : null}
      </div>
      <button ref={opener} className="ma-header__menu-btn" aria-label="მენიუ" aria-haspopup="dialog" aria-controls="ma-mnav" aria-expanded={menuOpen} onClick={() => {mobile.current?.showModal(); setMenuOpen(true);}}><Icon name="menu"/></button>
    </div></header>
    <dialog ref={mobile} id="ma-mnav" className="ma-mnav" aria-label="მენიუ" onClose={() => {setMenuOpen(false); opener.current?.focus();}} onClick={e => {if ((e.target as HTMLElement).closest("a")) mobile.current?.close();}}>
      <div className="ma-mnav__head">{brand}<button className="ma-mnav__close" aria-label="მენიუს დახურვა" onClick={() => mobile.current?.close()}><Icon name="x"/></button></div>
      <div className="ma-mnav__body"><nav className="ma-mnav__group" aria-label="ნავიგაცია">{nav("ma-mnav__link")}</nav>
        <div className="ma-mnav__group"><span className="ma-eyebrow">{me ? "ჩემი ანგარიში" : "ანგარიში"}</span>{links.map(([icon, title, href]) => <Link key={href} className="ma-mnav__link" href={href}><Icon name={icon}/>{title}</Link>)}{me ? <button className="ma-mnav__link" disabled={pending} onClick={logout}>გასვლა</button> : null}</div>
      </div><div className="ma-mnav__foot">{add}</div>
    </dialog>
  </>;
}
