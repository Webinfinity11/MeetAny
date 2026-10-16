"use client";
import type { Store } from "../../../lib/market-client";
import { useUnreadMessageCount } from "../../../lib/chat-client";
import type { AnyUser, NavItem, Tab } from "./shared";

export type Space = "buy" | "sell";
/** The account sections in one order for /account/ and /matching/: the same names, icons and counts on both. */
export function accountNav(company: boolean, space: Space, counts: Partial<Record<Tab, number | null | undefined>>): NavItem[] {
  const items: NavItem[] = [
    { key: "overview", label: "დაფა", icon: "layout-grid" },
    ...(space === "buy" ? [{ key: "requests" as Tab, label: "ჩემი მოთხოვნები", icon: "file-text" }] : []),
    ...(space === "sell" ? [{ key: "opportunities" as Tab, label: "შესაძლებლობები", icon: "inbox", href: company ? "/matching/" : "/requests/" }, { key: "offers" as Tab, label: "ჩემი შეთავაზებები", icon: "send" }] : []),
    { key: "deals", label: "გარიგებები", icon: "handshake" },
    { key: "saved", label: "შენახული", icon: "bookmark" },
    { key: "messages", label: "მიმოწერები", icon: "message-square" },
    { key: "notifications", label: "შეტყობინებები", icon: "bell" },
    { key: "profile", label: "პარამეტრები", icon: "settings" },
  ];
  // A zero is noise in a menu: only positive counts are shown.
  return items.map(item => ({ ...item, count: counts[item.key] || null }));
}

/** Menu with live counts: requests and sent offers from the store, unread conversations and notifications. */
export function useAccountNav(store: Store | null | undefined, me: AnyUser | null | undefined, space: Space) {
  const unread = useUnreadMessageCount(store || undefined, me?.id, !!me && !me.blocked && me.role !== "admin");
  const company = me?.role === "company";
  const engagement = store?.engagement();
  return accountNav(company, space, me && store ? {
    requests: store.listRequests({ ownerId: me.id, state: "", includeHidden: true }).length,
    offers: store.myOffers(me).length,
    messages: unread,
    notifications: engagement?.status === "ready" ? engagement.unread : null,
  } : {});
}
