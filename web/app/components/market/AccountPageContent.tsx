"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { MatchingFeed } from "./MatchingFeed";
import { AccountSkeleton } from "./Skeletons";
import { EngagementPanel } from "./EngagementPanels";
import { SavedRequests } from "./SavedRequests";
import { ServiceUnavailable } from "./ServiceUnavailable";
import { AuthForms } from "./AuthForms";
import { Inbox } from "./Inbox";
import { CompanyBusinessPanel } from "./CompanyBusiness";
import { useMarketStore } from "../../lib/market-client";
import { AccountShell } from "./account/AccountShell";
import { Dashboard } from "./account/Dashboard";
import { MyRequests } from "./account/MyRequests";
import { MyOffers } from "./account/MyOffers";
import { MyDeals } from "./account/MyDeals";
import { CompanyProfile, CompanyProfileNav, ProfileForm, PasswordForm } from "./account/Profile";
import { ProfileLayout } from "./account/ProfileLayout";
import { CompanyUpgrade } from "./account/CompanyUpgrade";
import { useAccountNav } from "./account/nav";
import { Notice } from "../ui/Notice";
import { onboardingHref } from "../../lib/auth-redirect";
import { readSeen, type AnyUser, type RequestItem, type OfferItem, type Tab } from "./account/shared";
export function AccountPageContent() {
  const { store, ready, sessionReady, available } = useMarketStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "";
  const tab: Tab = rawTab === "deals" || rawTab === "opportunities" || rawTab === "business" || rawTab === "saved" || rawTab === "messages" || rawTab === "requests" || rawTab === "offers" || rawTab === "notifications" ? rawTab : rawTab === "alerts" ? "notifications" : ["profile", "settings"].includes(rawTab) ? "profile" : "overview";
  const [seen] = useState(readSeen);
  const [now] = useState(() => Date.now());
  const me = ready && available ? store?.currentUser() as AnyUser | null : null;
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
    return { myOffers: store.myOffers(me) as OfferItem[], myRequests };
  }, [store, me]);
  const isCompany = me?.role === "company";
  const requestedSpace = searchParams.get("space");
  const { myRequests = [], myOffers = [] } = data || {};
  // Buying and responding are available to every registered profile. Intent sets the default only.
  const intent = me?.accountIntent;
  const space = tab === "offers" || tab === "opportunities" ? "sell" : tab === "requests" ? "buy"
    : requestedSpace === "buy" || requestedSpace === "sell" ? requestedSpace
    : isCompany && intent !== "buy" ? "sell" : "buy";
  const tabs = useAccountNav(store, me, space);
  // The store can unmount RegisterForm before its async submit finishes. Keep the
  // registration destination in this surviving parent as well, including code verification.
  const registeringCompany = sessionReady && me?.role === "company" && rawTab === "register";
  useEffect(() => {
    // A successful upgrade refreshes the store and unmounts CompanyUpgrade,
    // just as signup unmounts RegisterForm. The surviving parent owns navigation.
    const upgradedCompany = me?.role === "company" && rawTab === "profile" && window.location.hash === "#company-upgrade";
    if (registeringCompany || upgradedCompany) router.replace(onboardingHref("type", searchParams.get("next")));
  }, [registeringCompany, me?.role, rawTab, router, searchParams]);
  if (ready && !available) return <div className="ma-page"><ServiceUnavailable/></div>;
  if (!ready || !sessionReady || me?.role === "admin" || registeringCompany) return <AccountSkeleton admin={me?.role === "admin"}/>;
  if (!me || !store) return <AuthForms initialRole={searchParams.get("role") || ""}/>;
  // Business settings belong to a company; offers belong to either profile type.
  const outOfSpace = !isCompany && tab === "business";
  const activeTab: Tab = outOfSpace ? "overview" : space === "sell" && tab === "requests" ? "overview" : tab;
  const title = activeTab === "overview" ? `გამარჯობა, ${me.company || me.name}` : activeTab === "business" ? "პარამეტრები" : tabs.find(item => item.key === activeTab)?.label || "ანგარიში";
  return <AccountShell tab={activeTab} items={tabs} company={isCompany} space={space} switcher title={title} action={activeTab === "requests" ? <Button variant="secondary" href="/requests/new/"><Icon name="plus"/>მოთხოვნის განთავსება</Button> : activeTab === "offers" ? <Button variant="secondary" href={isCompany ? "/matching/" : "/requests/"}><Icon name="search"/>მოთხოვნების ნახვა</Button> : undefined}>
    {activeTab === "deals" ? <MyDeals key={me.id} store={store} actor={me.id} space={space}/> : null}
    {activeTab === "overview" ? <Dashboard me={me} space={space}/> : null}
    {activeTab === "opportunities" ? <MatchingFeed key={me.id}/> : null}
    {activeTab === "requests" ? <MyRequests key={me.id} requests={myRequests} store={store} me={me} now={now} seen={seen}/> : null}
    {activeTab === "offers" ? <MyOffers key={me.id} offers={myOffers} store={store} me={me}/> : null}
    {activeTab === "saved" ? <div className="account-panel account-saved">{space === "sell" ? <><SavedRequests key={me.id}/><EngagementPanel kind="saved"/></> : <><EngagementPanel kind="saved"/><SavedRequests key={me.id}/></>}</div> : null}
    {activeTab === "notifications" ? <div id="alerts" className="account-panel account-alerts"><EngagementPanel kind="notifications" all={searchParams.get("alerts") === "all"}/></div> : null}
    {activeTab === "messages" ? <div className="account-wide"><Inbox key={me.id} store={store} me={me} space={space}/></div> : null}
    {activeTab === "business" ? <div className="account-main--profile"><CompanyProfileNav active="business"/><CompanyBusinessPanel key={me.id} owner={me.id}/></div> : null}
    {activeTab === "profile" ? <div className="account-main--profile">{me.blocked ? <Notice tone="warning">ანგარიში დაბლოკილია.</Notice> : null}{isCompany ? <CompanyProfile me={me} section={searchParams.get("section") || "details"}/> : <ProfileLayout me={me}><ProfileForm me={me}/><CompanyUpgrade user={me}/><PasswordForm key={me.id}/></ProfileLayout>}</div> : null}
  </AccountShell>;
}
