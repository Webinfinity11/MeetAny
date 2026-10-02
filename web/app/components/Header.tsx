"use client";
import { Button } from "./ui/Button";


import { trapDialogFocus } from "./ui/dialog-focus";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NotificationBell } from "./market/EngagementPanels";
import { ChatUnreadLink } from "./market/ChatPopup";
import { groupOf } from "../lib/categories";
import { Icon } from "./Icon";
import { useMarketStore } from "../lib/market-client";
import { toast } from "./Toasts";

const subscribeNothing = () => () => {};
function readRoleHint(): string {
  try { return localStorage.getItem("meetany.headerRole") || "guest"; } catch { return "guest"; }
}

export function Header() {
  const { store, ready: dataReady } = useMarketStore();
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    if (!store) return;
    let active = true;
    store?.ready().then(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, [store]);
  const ready = dataReady && sessionReady;
  const me = ready ? store?.currentUser() : null;
  // The header must not pop in: the last known role (guest/client/company/admin) is remembered and
  // drawn before the session check finishes, so buttons keep their place on every load.
  const hint = useSyncExternalStore(subscribeNothing, readRoleHint, () => null);
  const liveRole = ready ? ((me?.role as string | undefined) || "guest") : null;
  useEffect(() => {
    if (!liveRole) return;
    try { localStorage.setItem("meetany.headerRole", liveRole); } catch {}
  }, [liveRole]);
  const role = liveRole || hint;
  const pathname = usePathname();
  const mobile = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isAdmin = role === "admin";
  const accountLabel = isAdmin ? "ადმინი" : role === "company" ? "ჩემი კომპანია" : "ჩემი ანგარიში";
  const focusEdge = useRef<"first" | "last" | null>(null);
  // Messages and notifications live once, as the badged icons in the header bar (visible at every width).
  const links = !me ? [["user-round", "შესვლა", "/account/"], ["store", "კომპანიის რეგისტრაცია", "/account/?tab=register&role=company&entry=header"]]
    : isAdmin ? [["shield-check", "ადმინის პანელი", "/admin/"]]
    : me.role === "company" ? [
      ["search", "შესაბამისი მოთხოვნები", "/account/?tab=opportunities"],
      ["send", "ჩემი შეთავაზებები", "/account/?tab=offers"],
      ["clipboard-list", "ჩემი მოთხოვნები", "/account/?tab=requests"],
      ["bookmark", "შენახული კომპანიები", "/account/?tab=saved"],
      ["eye", "ხილვადობის პაკეტები", "/account/?tab=business"],
      ["building-2", "კომპანიის პროფილი", "/account/?tab=profile"],
      ["external-link", "საჯარო პროფილი", `/companies/view/?id=${me.id}`],
    ] : [
      ["clipboard-list", "ჩემი მოთხოვნები", "/account/?tab=requests"],
      ["bookmark", "შენახული კომპანიები", "/account/?tab=saved"],
      ["user-round", "პროფილი", "/account/?tab=profile"],
    ];
  // The account sidebar already exposes the working sections; don't repeat it in this menu.
  const desktopLinks = me && !isAdmin && pathname.startsWith("/account")
    ? [["settings", "ანგარიშის პარამეტრები", "/account/?tab=profile"],
      ...(me.role === "company" ? [["external-link", "საჯარო პროფილი", `/companies/view/?id=${me.id}`]] : [])]
    : links;
  // The drawer is a route chooser, not a second copy of the account sidebar.
  const mobileLinks = !me ? links : isAdmin ? links : [
    [isCompanyRole(me.role) ? "building-2" : "clipboard-list", isCompanyRole(me.role) ? "ჩემი კომპანია" : "ჩემი მოთხოვნები", "/account/"],
    ["message-square", "მიმოწერები", "/account/?tab=messages"],
    ["settings", "პროფილის პარამეტრები", "/account/?tab=profile"],
  ];
  useLayoutEffect(() => {
    if (!accountOpen || !focusEdge.current) return;
    const items = dropdown.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items?.length) items[focusEdge.current === "last" ? items.length - 1 : 0].focus();
    focusEdge.current = null;
  }, [accountOpen]);
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
  const nav = (cls: string) => (isAdmin ? [["admin", "პლატფორმის მართვა", "/admin/"]] : [["companies", "კომპანიები", "/companies/"], ["requests", "მოთხოვნები", "/requests/"], ["ideas", "ბიზნესიდეები", "/ideas/"]]).map(([id, title, href]) => <Link key={id} className={cls} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>{title}</Link>);
  const isCompany = role === "company";
  const add = <Button variant="accent" className="ma-header__cta" aria-label={isCompany ? "მოთხოვნების ნახვა" : "მოთხოვნის დამატება"} href={isCompany ? `/requests/?category=${encodeURIComponent(groupOf[me?.industry || ""] || me?.industry || "")}` : "/requests/new/"}><Icon name={isCompany ? "search" : "plus"}/><span className="ma-header__cta-label">{isCompany ? "მოთხოვნების ნახვა" : "მოთხოვნის დამატება"}</span><span className="ma-header__cta-short" aria-hidden="true">{isCompany ? "მოთხოვნები" : "დამატება"}</span></Button>;
  return <>
    <header className="ma-header"><div className="ma-header__inner ma-container">
      {brand}<nav className="ma-header__nav" aria-label="მთავარი ნავიგაცია">{nav("ma-header__link")}</nav>
      <div className="ma-header__actions">
        {role && role !== "guest" && !isAdmin ? <div className="ma-header__updates">{me ? <><NotificationBell/><ChatUnreadLink/></> : <><span className="ma-header__slot" aria-hidden="true" /><span className="ma-header__slot" aria-hidden="true" /></>}</div> : null}
        {role === "guest" ? <Button variant="ghost" className="ma-header__login" href="/account/">შესვლა</Button> : null}{!isAdmin ? add : null}
        {me ? <div ref={dropdown} className="ma-menu ma-header__account" onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget)) setAccountOpen(false);}} onKeyDown={e => {
          if (e.key === "Escape") {e.preventDefault(); e.stopPropagation(); setAccountOpen(false); dropdown.current?.querySelector<HTMLButtonElement>("button")?.focus();}
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!accountOpen) { focusEdge.current = e.key === "ArrowUp" || e.key === "End" ? "last" : "first"; setAccountOpen(true); return; }
            const items = Array.from(dropdown.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
            items[next]?.focus();
          }
        }}>
          <button className="ma-menu__trigger" aria-label={accountLabel} aria-haspopup="menu" aria-controls="ma-account-menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><Icon name={isAdmin ? "shield-check" : me.role === "company" ? "building-2" : "user-round"}/><span>{accountLabel}</span><Icon name="chevron-down"/></button>
          <div className="ma-menu__list" id="ma-account-menu" role="menu" hidden={!accountOpen}>
            {desktopLinks.map(([icon, title, href]) => <Link key={href} className="ma-menu__item" role="menuitem" href={href} onClick={() => setAccountOpen(false)}><Icon name={icon}/>{title}</Link>)}
            <button className="ma-menu__item ma-menu__item--danger" role="menuitem" disabled={pending} onClick={logout}><Icon name="log-out"/>გასვლა</button>
          </div>
        </div> : role && role !== "guest" ? <div className="ma-menu ma-header__account">
          {/* Same trigger as the live menu, drawn from the remembered role until the session is known. */}
          <button className="ma-menu__trigger" type="button" aria-label={accountLabel} aria-busy="true" tabIndex={-1}><Icon name={isAdmin ? "shield-check" : role === "company" ? "building-2" : "user-round"}/><span>{accountLabel}</span><Icon name="chevron-down"/></button>
        </div> : null}
      </div>
      <button ref={opener} className="ma-header__menu-btn" aria-label="მენიუ" aria-haspopup="dialog" aria-controls="ma-mnav" aria-expanded={menuOpen} onClick={() => {mobile.current?.showModal(); setMenuOpen(true);}}><Icon name="menu"/></button>
    </div></header>
    <dialog onKeyDown={trapDialogFocus} ref={mobile} id="ma-mnav" className="ma-mnav" aria-label="მენიუ" onClose={() => {setMenuOpen(false); opener.current?.focus();}} onClick={e => {if ((e.target as HTMLElement).closest("a")) mobile.current?.close();}}>
      <div className="ma-mnav__head">{brand}<button className="ma-mnav__close" aria-label="მენიუს დახურვა" onClick={() => mobile.current?.close()}><Icon name="x"/></button></div>
      <div className="ma-mnav__body"><nav className="ma-mnav__group" aria-label="ნავიგაცია">{nav("ma-mnav__link")}</nav>
        <div className="ma-mnav__group"><span className="ma-eyebrow">სამუშაო სივრცე</span>{mobileLinks.map(([icon, title, href]) => <Link key={href} className="ma-mnav__link" href={href}><Icon name={icon}/>{title}</Link>)}</div>
      </div>{me ? <div className="ma-mnav__foot"><Button variant="ghost" disabled={pending} onClick={logout}><Icon name="log-out"/>ანგარიშიდან გასვლა</Button></div> : !isAdmin ? <div className="ma-mnav__foot">{add}</div> : null}
    </dialog>
  </>;
}

const isCompanyRole = (role: string) => role === "company";
