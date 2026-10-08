"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { MatchingFeed } from "./MatchingFeed";
import { AccountSkeleton } from "./Skeletons";
import { EngagementPanel } from "./EngagementPanels";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { AuthForms } from "./AuthForms";
import { Inbox } from "./Inbox";
import { CompanyBusinessPanel } from "./CompanyBusiness";
import { useMarketStore } from "../../lib/market-client";
import { useUnreadMessageCount } from "../../lib/chat-client";
import { AccountShell } from "./account/AccountShell";
export { AccountTabs } from "./account/AccountShell";
import { Dashboard } from "./account/Dashboard";
import { MyRequests } from "./account/MyRequests";
import { MyOffers } from "./account/MyOffers";
import { MyDeals } from "./account/MyDeals";
import { CompanyProfile, ProfileForm, PasswordForm } from "./account/Profile";
import { readSeen, type AnyUser, type RequestItem, type OfferItem, type Tab, type NavItem } from "./account/shared";
export function AccountPageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "";
  const tab: Tab = rawTab === "deals" || rawTab === "opportunities" || rawTab === "business" || rawTab === "saved" || rawTab === "messages" || rawTab === "requests" || rawTab === "offers" || rawTab === "notifications" ? rawTab : rawTab === "alerts" ? "notifications" : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";
  const [seen] = useState(readSeen);
  const [now] = useState(() => Date.now());
  const me = ready && available ? store?.currentUser() as AnyUser | null : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && me.role !== "admin");
  useEffect(() => { if (me?.role === "admin") router.replace("/admin/"); }, [me?.role, router]);
  useEffect(() => {
    if (!me?.id) return;
    let next = "";
    try { next = sessionStorage.getItem("meetany.chatReturn") || ""; sessionStorage.removeItem("meetany.chatReturn"); } catch {}
    if (!next) return;
    const url = new URL(next, window.location.origin);
    if (url.origin === window.location.origin && ["/companies/view/", "/requests/view/"].includes(url.pathname)) router.replace(url.pathname + url.search + url.hash);
  }, [me?.id, router]);
  const data = useMemo(() => {
    if (!store || !me) return null;
    const myRequests = store.listRequests({ ownerId: me.id, state: "", includeHidden: true }) as RequestItem[];
    if (me.role === "company") {
      return { myOffers: store.myOffers(me) as OfferItem[], myRequests };
    }
    return { myOffers: [] as OfferItem[], myRequests };
  }, [store, me]);
  if (ready && !available) return <div className="ma-page"><ServiceUnavailable/></div>;
  if (!ready || me?.role === "admin") return <AccountSkeleton admin={me?.role === "admin"}/>;
  if (!me || !store) return <AuthForms initialRole={searchParams.get("role") || ""}/>;
  const isCompany = me.role === "company";
  const requestedSpace = searchParams.get("space");
  const space = !isCompany || tab === "requests" || (requestedSpace === "buy" && !["offers", "opportunities", "overview"].includes(rawTab)) ? "buy" : "sell";
  const activeTab: Tab = !rawTab && space === "buy" ? "requests" : !isCompany && ["overview", "opportunities", "offers", "business"].includes(tab) ? "requests" : tab;
  const { myRequests = [], myOffers = [] } = data || {};
  const engagement = store.engagement();
  const tabs: NavItem[] = [
    ...(space === "sell" ? [{ key: "overview" as Tab, label: "მიმოხილვა", icon: "layout-grid" }, { key: "opportunities" as Tab, label: "შესაძლებლობები", icon: "inbox" }, { key: "offers" as Tab, label: "ჩემი შეთავაზებები", icon: "send", count: myOffers.length }] : [{ key: "requests" as Tab, label: "ჩემი მოთხოვნები", icon: "file-text", count: myRequests.length }]),
    { key: "deals", label: "გარიგებები", icon: "handshake" },
    { key: "messages", label: "მესიჯები", icon: "message-square", count: unread },
    { key: "notifications", label: "შეტყობინებები", icon: "bell", count: engagement?.status === "ready" ? engagement.unread : null },
    { key: "profile", label: isCompany ? "კომპანიის პროფილი" : "პროფილი", icon: isCompany ? "building-2" : "user-round" },
  ];
  const title = activeTab === "overview" ? `გამარჯობა, ${me.company || me.name}` : activeTab === "saved" ? "შენახული" : activeTab === "business" ? "ხილვადობის პაკეტები" : tabs.find(item => item.key === activeTab)?.label || "ანგარიში";
  return <AccountShell tab={activeTab} items={tabs} company={isCompany} space={space} title={title} lead={activeTab === "overview" ? "თქვენი პროფილით შერჩეული შესაძლებლობები." : undefined} action={activeTab === "requests" ? <Button href="/requests/new/"><Icon name="plus"/>ახალი მოთხოვნა</Button> : activeTab === "offers" ? <Button variant="secondary" href="/matching/"><Icon name="search"/>ახალი შესაძლებლობები</Button> : undefined}>
    {activeTab === "deals" ? <MyDeals key={me.id} store={store} actor={me.id}/> : null}
    {activeTab === "overview" ? <Dashboard me={me}/> : null}
    {activeTab === "opportunities" ? <MatchingFeed key={me.id}/> : null}
    {activeTab === "requests" ? <MyRequests key={me.id} requests={myRequests} store={store} me={me} now={now} seen={seen}/> : null}
    {activeTab === "offers" ? <MyOffers key={me.id} offers={myOffers} store={store} me={me}/> : null}
    {activeTab === "saved" ? <div className="account-panel"><EngagementPanel kind="saved"/></div> : null}
    {activeTab === "notifications" ? <div id="alerts" className="account-panel account-alerts"><EngagementPanel kind="notifications" all={searchParams.get("alerts") === "all"}/></div> : null}
    {activeTab === "messages" ? <div className="account-wide"><Inbox key={me.id} store={store} me={me}/></div> : null}
    {activeTab === "business" ? <CompanyBusinessPanel key={me.id} owner={me.id}/> : null}
    {activeTab === "profile" ? <div className="account-main--profile">{me.blocked ? <p className="ma-field__error" role="status">ანგარიში დაბლოკილია.</p> : null}{isCompany ? <CompanyProfile me={me} section={searchParams.get("section") || "details"}/> : <><ProfileForm me={me}/><PasswordForm key={me.id}/></>}</div> : null}
  </AccountShell>;
}
