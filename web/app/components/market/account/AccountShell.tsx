"use client";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "../../Icon";
import type { NavItem, Tab } from "./shared";
import styles from "./account.module.css";
const NARROW = "(max-width:1023px)";
const subscribeNarrow = (change: () => void) => { const media = matchMedia(NARROW); media.addEventListener("change", change); return () => media.removeEventListener("change", change); };
export function AccountTabs({ tab, items, company, space = company && tab !== "requests" ? "sell" : "buy", switcher = company }: { tab: Tab; items: NavItem[]; company: boolean; space?: "buy" | "sell"; switcher?: boolean }) {
  const list = useRef<HTMLElement>(null);
  // Below 1024px the menu is a horizontal tab row: the shared scroll row adds the edge fade and snap.
  const narrow = useSyncExternalStore(subscribeNarrow, () => matchMedia(NARROW).matches, () => false);
  useEffect(() => {
    const nav = list.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const reveal = () => { if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2; };
    reveal();
    const observer = new ResizeObserver(reveal); observer.observe(nav);
    return () => observer.disconnect();
  }, [tab]);
  return <aside className={styles.sidebar} aria-label="ანგარიში">{switcher ? <div className={styles.spaces}><Link href="/account/?space=buy&tab=overview" aria-current={space === "buy" ? "page" : undefined}>ყიდვა</Link><Link href="/account/?space=sell&tab=overview" aria-current={space === "sell" ? "page" : undefined}>გაყიდვა</Link></div> : null}<nav ref={list} className={`${styles.nav}${narrow ? " ma-scroll-row" : ""}`} aria-label="ანგარიშის განყოფილებები">{items.map(item => <Link key={item.key} href={item.href || (item.key === "opportunities" ? "/matching/" : `/account/?space=${space}&tab=${item.key}`)} aria-current={(tab === item.key || (tab === "business" && item.key === "profile")) ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.count ? <small>{item.count}</small> : null}</Link>)}</nav></aside>;
}
export function AccountShell({ tab, items, company, space, switcher, title, lead, action, children }: { tab: Tab; items: NavItem[]; company: boolean; space: "buy" | "sell"; switcher?: boolean; title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return <div className={`ma-page account-page ${styles.shell} account-shell${tab === "messages" ? " account-shell--messages" : ""}`}><AccountTabs tab={tab} items={items} company={company} space={space} switcher={switcher}/><div className={styles.main}><header className={styles.heading}><div><h1>{title}</h1>{lead ? <p>{lead}</p> : null}</div>{action}</header>{children}</div></div>;
}
