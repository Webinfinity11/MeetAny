"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { openChat } from "../ChatPopup";
import type { Store } from "../../../lib/market-client";
import { categories, cities } from "../../../lib/categories";
import { Filters } from "./Filters";
import { RequestPhoto, Status, requestHref, type RequestItem, type OfferItem, type AnyUser } from "./shared";
import { useAccountDeals } from "./MyDeals";
import { dealHref, compareHref } from "../../../lib/deal-client";
import { toast } from "../../Toasts";
import { useConversationList } from "../../../lib/chat-client";
export function MyRequests({ requests, store, me, now, seen }: { requests: RequestItem[]; store: Store; me: AnyUser; now: number; seen: Record<string, string> }) {
  const deals = useAccountDeals(store, me.id);
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const { current: conversations } = useConversationList(store, me.blocked ? undefined : me.id);
  const requestState = (request: RequestItem): string => {
    const notice = deals?.items.find(item => item.request_id === request.id);
    return !request.hidden && ["complete", "rated"].includes(notice?.deal_action || "") ? "complete" : store.requestState(request);
  };
  const stateLabel = (state: string) => ({ open: "ღია", chosen: "არჩეული", complete: "დასრულებული", expired: "ვადაგასული" }[state] || store.stateLabels[state] || state);
  const states = [...new Set(requests.map(request => requestState(request)))];
  const visible = requests.filter(request => filter === "all" || requestState(request) === filter);
  async function extend(id: string) {
    if (pending) return;
    setPending(id);
    try { await store.extendRequest(id); toast("ვადა გაგრძელდა 7 დღით."); }
    catch (err) { toast((err as { userMessage?: string }).userMessage || "ვერ შესრულდა."); }
    finally { setPending(null); }
  }
  return <section className="account-records" aria-label="ჩემი მოთხოვნები">
    <Filters label="მოთხოვნის სტატუსი" value={filter} onChange={setFilter} items={[{ key: "all", label: "ყველა", count: requests.length }, ...states.map(key => ({ key, label: stateLabel(key), count: requests.filter(request => requestState(request) === key).length }))]}/>
    {visible.length ? <ul className="account-rows account-request-list">{visible.map(request => {
      const state = requestState(request);
      const count = store.offerCount(request.id) ?? 0;
      const fresh = (store.visibleOffers(request.id, me) as OfferItem[]).filter(offer => offer.status === "sent" && (!seen[request.id] || Date.parse(offer.createdAt) > Date.parse(seen[request.id]))).length;
      const left = state === "open" ? store.daysLeft(request, now) : null;
      const chosen = (store.visibleOffers(request.id, me) as OfferItem[]).find(offer => offer.id === request.chosenOfferId && offer.status === "chosen");
      const conversation = conversations?.items?.find(item => item.requestId === request.id && item.companyId === chosen?.companyUserId);
      const deal = deals?.items.find(item => item.request_id === request.id);
      const partner = chosen ? store.userById(chosen.companyUserId) : null;
      const canExtend = (state === "open" && left != null && left <= 7) || state === "expired";
      return <li className="account-request-card" data-highlight={fresh > 0 || undefined} key={request.id}>
        <div className="account-item-heading"><RequestPhoto request={request}/><div><h2><Link href={requestHref(request.id)} title={request.title}>{request.title}</Link></h2><p>{[request.quantity != null ? `${request.quantity} ${store.units[request.unit || ""] || ""}` : categories[request.category], cities[request.city] || request.city].filter(Boolean).join(" · ")}</p></div></div>
        <Status tone={state === "open" ? "success" : state === "chosen" ? "dark" : "neutral"}>{stateLabel(state)}</Status>
        <span className="account-request-count"><span><Icon name="inbox"/>{count} შეთავაზება{fresh ? <strong> (+{fresh} ახალი)</strong> : null}</span>{partner ? <span className="account-request-partner">{partner.company || partner.name}</span> : null}</span>
        {deal?.deal_id && ["chosen", "complete"].includes(state) ? <Button variant="secondary" href={dealHref(deal.deal_id)}>{state === "chosen" ? "გარიგება" : "შეფასება"}</Button> : chosen && !me.blocked && !request.hidden ? <Button variant="secondary" onClick={() => openChat({ companyId: chosen.companyUserId, requestId: request.id, conversation })}>ჩატი</Button> : canExtend ? <Button variant="secondary" loading={pending === request.id} disabled={!!pending} onClick={() => void extend(request.id)}>გაგრძელება</Button> : state === "open" && count ? <Button href={compareHref(request.id)}>შეთავაზებების შედარება</Button> : <Button variant="secondary" href={requestHref(request.id)}>მოთხოვნის ნახვა</Button>}

      </li>;
    })}</ul> : <div className="account-empty-state"><p className="account-empty-state__title">{requests.length ? "ამ სტატუსით მოთხოვნა არ არის" : "მოთხოვნა ჯერ არ გაქვს"}</p><p className="account-empty">აღწერე, რა გჭირდება — კომპანიები შეთავაზებებს გამოგიგზავნიან.</p></div>}
  </section>;
}
