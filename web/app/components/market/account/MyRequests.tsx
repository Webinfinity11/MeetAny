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
import { readRequestDraft } from "../../../lib/request-draft";
import { toast } from "../../Toasts";
import { useConversationList } from "../../../lib/chat-client";

export function MyRequests({ requests, store, me, now, seen }: { requests: RequestItem[]; store: Store; me: AnyUser; now: number; seen: Record<string, string> }) {
  const deals = useAccountDeals(store, me.id);
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  // Account content mounts after the client session check, like the request form.
  const [draft] = useState(readRequestDraft);
  const { current: conversations } = useConversationList(store, me.blocked ? undefined : me.id);
  const requestState = (request: RequestItem): string => {
    const notice = deals?.items.find(item => item.request_id === request.id);
    const state = store.requestState(request, now);
    return state === "closed" || (!request.hidden && ["complete", "rated"].includes(notice?.deal_action || "")) ? "complete" : state;
  };
  const labels: Record<string, string> = { open: "აქტიური", chosen: "არჩეული", complete: "დასრულებული", draft: "მონახაზი", expired: "ვადაგასული", hidden: "დამალული" };
  const filters = ["open", "chosen", "complete", "draft", "expired", "hidden"].map(key => ({ key, label: labels[key], count: key === "draft" ? Number(!!draft) : requests.filter(request => requestState(request) === key).length })).filter(item => item.count > 0);
  const visible = requests.filter(request => filter === "all" || requestState(request) === filter);
  const showDraft = draft && (filter === "all" || filter === "draft");
  const meta = (quantity: number | string | null | undefined, unit: string | null | undefined, category: string, city: string) => [quantity != null && quantity !== "" ? `${new Intl.NumberFormat("en-US").format(Number(quantity))} ${store.units[unit || ""] || ""}` : categories[category], cities[city] || city].filter(Boolean).join(" · ");
  async function extend(id: string) {
    if (pending) return;
    setPending(id);
    try { await store.extendRequest(id); toast("ვადა გაგრძელდა 7 დღით."); }
    catch (err) { toast((err as { userMessage?: string }).userMessage || "ვერ შესრულდა."); }
    finally { setPending(null); }
  }
  return <section className="account-records" aria-label="ჩემი მოთხოვნები">
    <Filters label="მოთხოვნის სტატუსი" value={filter} onChange={setFilter} items={[{ key: "all", label: "ყველა", count: requests.length + Number(!!draft) }, ...filters]}/>
    {visible.length || showDraft ? <ul className="account-rows account-request-list">
      {showDraft ? <li className="account-request-card">
        <div className="account-item-heading"><span className="account-draft-photo"><Icon name="file-text"/></span><div><h2><Link href="/requests/new/?draft=1">{draft.title.trim() || "დაუსრულებელი მოთხოვნა"}</Link></h2><p>{meta(draft.quantity, draft.unit, draft.category, draft.city)}</p></div></div>
        <div className="account-request-summary"><Status tone="muted">მონახაზი</Status><span className="account-request-count"><Icon name="inbox"/>0 შეთავაზება</span></div>
        <Button variant="secondary" href="/requests/new/?draft=1">გაგრძელება</Button>
      </li> : null}
      {visible.map(request => {
        const state = requestState(request);
        const count = store.offerCount(request.id) ?? 0;
        const offers = store.visibleOffers(request.id, me) as OfferItem[];
        const fresh = state === "open" ? offers.filter(offer => offer.status === "sent" && (!seen[request.id] || Date.parse(offer.createdAt) > Date.parse(seen[request.id]))).length : 0;
        const chosen = offers.find(offer => offer.id === request.chosenOfferId && offer.status === "chosen");
        const conversation = conversations?.items?.find(item => item.requestId === request.id && item.companyId === chosen?.companyUserId);
        const deal = deals?.items.find(item => item.request_id === request.id);
        const partner = chosen ? store.userById(chosen.companyUserId) : null;
        const reviewing = state === "open" && count > 0;
        const tone = reviewing ? "info" : state === "open" ? "success" : state === "chosen" ? "dark" : state === "hidden" ? "muted" : "neutral";
        return <li className="account-request-card" data-highlight={fresh > 0 || undefined} key={request.id}>
          <div className="account-item-heading"><RequestPhoto request={request}/><div><h2><Link href={requestHref(request.id)} title={request.title}>{request.title}</Link></h2><p>{meta(request.quantity, request.unit, request.category, request.city)}</p></div></div>
          <div className="account-request-summary">
            <Status tone={tone}>{reviewing ? "შეთავაზებების განხილვა" : state === "chosen" ? "მომწოდებელი არჩეულია" : labels[state] || store.stateLabels[state]}</Status>
            <span className="account-request-count">{partner && ["chosen", "complete"].includes(state) ? <><Icon name="building-2"/><span className="account-request-partner" title={partner.company || partner.name}>{partner.company || partner.name}</span></> : <><Icon name="inbox"/>{count} შეთავაზება{fresh ? <strong>+{fresh}</strong> : null}</>}</span>
          </div>
          {state === "complete" && deal?.deal_id ? <Button variant="secondary" href={dealHref(deal.deal_id)}>შეფასება</Button>
            : state === "chosen" && chosen && !me.blocked && !request.hidden ? <Button variant="secondary" onClick={() => openChat({ companyId: chosen.companyUserId, requestId: request.id, conversation })}>ჩატი</Button>
            : state === "expired" ? <Button variant="secondary" loading={pending === request.id} disabled={!!pending} onClick={() => void extend(request.id)}>ვადის გაგრძელება</Button>
            : reviewing ? <Button href={compareHref(request.id)}>შეთავაზებების შედარება</Button>
            : <Button variant="secondary" href={requestHref(request.id)}>მოთხოვნის ნახვა</Button>}
        </li>;
      })}
    </ul> : <div className="account-empty-state"><p className="account-empty-state__title">{requests.length || draft ? "ამ სტატუსით მოთხოვნა არ არის" : "მოთხოვნა ჯერ არ გაქვს"}</p><p className="account-empty">აღწერე, რა გჭირდება — კომპანიები შეთავაზებებს გამოგიგზავნიან.</p></div>}
  </section>;
}
