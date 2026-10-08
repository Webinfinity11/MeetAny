"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "../../Icon";
import type { NavItem, Tab } from "./shared";
import styles from "./account.module.css";
export function AccountTabs({ tab, items, company, space = company && tab !== "requests" ? "sell" : "buy" }: { tab: Tab; items: NavItem[]; company: boolean; space?: "buy" | "sell" }) {
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = list.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const reveal = () => { if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2; };
    reveal();
    const observer = new ResizeObserver(reveal); observer.observe(nav);
    return () => observer.disconnect();
  }, [tab]);
  return <aside className={styles.sidebar} aria-label="ანგარიში"><div className={styles.spaces}>{company ? <><Link href="/account/?space=buy&tab=requests" aria-current={space === "buy" ? "page" : undefined}>ყიდვა</Link><Link href="/account/?space=sell&tab=overview" aria-current={space === "sell" ? "page" : undefined}>გაყიდვა</Link></> : <strong>ყიდვა</strong>}</div><nav ref={list} className={styles.nav} aria-label="ანგარიშის განყოფილებები">{items.map(item => <Link key={item.key} href={`/account/?space=${space}&tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.count != null ? <small>{item.count}</small> : null}</Link>)}</nav></aside>;
}
export function AccountShell({ tab, items, company, space, title, lead, action, children }: { tab: Tab; items: NavItem[]; company: boolean; space: "buy" | "sell"; title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  const full = tab === "messages";
  return <div className={`ma-page account-page ${styles.shell} ${full ? styles.full : ""}`}>{!full ? <AccountTabs tab={tab} items={items} company={company} space={space}/> : null}<div className={styles.main}>{!full && tab !== "notifications" ? <header className={styles.heading}><div><h1>{title}</h1>{lead ? <p>{lead}</p> : null}</div>{action}</header> : null}{children}</div></div>;
}
