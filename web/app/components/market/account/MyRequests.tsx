"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { openChat } from "../ChatPopup";
import type { Store } from "../../../lib/market-client";
import { categories, cities } from "../../../lib/categories";
import { Filters } from "./Filters";
import { RequestPhoto, Status, requestHref, type RequestItem, type OfferItem, type AnyUser } from "./shared";
import { useAccountDeals } from "./MyDeals";
import { dealHref, compareHref } from "../../../lib/deal-client";
import { clearRequestDraft, deleteServerDraft, loadServerDraft, readRequestDraft, type RequestDraft } from "../../../lib/request-draft";
import { toast, toastError } from "../../Toasts";
import { EmptyState } from "../../ui/Structure";
import { dateShort, formatNumber } from "../../../lib/format";
import { ListSkeleton } from "../Skeletons";
import { useConversationList } from "../../../lib/chat-client";
import styles from "./account.module.css";

export function MyRequests({ requests, store, me, now, seen }: { requests: RequestItem[]; store: Store; me: AnyUser; now: number; seen: Record<string, string> }) {
  const deals = useAccountDeals(store, me.id);
  const params = useSearchParams();
  const router = useRouter();
  const filter = params.get("filter") || "all";
  const setFilter = (value: string) => { const next = new URLSearchParams(params.toString()); next.set("filter", value); router.replace(`/account/?${next}`, { scroll: false }); };
  const [pending, setPending] = useState<string | null>(null);
  // Account content mounts after the client session check, like the request form.
  const [localDraft, setLocalDraft] = useState(readRequestDraft);
  const [serverDraft, setServerDraft] = useState<RequestDraft | null>(null);
  // The list waits for the server draft so the draft row never pushes the list down after paint (CLS).
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftPending, setDraftPending] = useState(false);
  const draft = serverDraft || localDraft;
  useEffect(() => {
    let cancelled = false;
    loadServerDraft(store).then(found => { if (!cancelled) setServerDraft(found); }).catch(() => undefined).finally(() => { if (!cancelled) setDraftLoaded(true); });
    return () => { cancelled = true; };
  }, [store]);
  const { current: conversations } = useConversationList(store, me.blocked ? undefined : me.id);
  const requestState = (request: RequestItem): string => {
    const deal = deals?.items.find(item => item.request_id === request.id);
    const state = store.requestState(request, now);
    if (request.hidden) return state;
    // Only a completed deal makes a request "completed"; a closed request without one stays closed.
    return deal?.stage === "complete" ? "complete" : deal?.stage === "cancelled" && state === "chosen" ? "cancelled" : state;
  };
  const labels: Record<string, string> = { open: "ღია", chosen: "არჩეული", complete: "დასრულებული", closed: "დახურული", cancelled: "გარიგება გაუქმდა", draft: "მონახაზი", expired: "ვადაგასული", hidden: "დამალული" };
  const filters = ["open", "chosen", "complete", "closed", "cancelled", "draft", "expired", "hidden"].map(key => ({ key, label: labels[key], count: key === "draft" ? Number(!!draft) : requests.filter(request => requestState(request) === key).length })).filter(item => item.count > 0);
  const hasNewOffers = (request: RequestItem) => requestState(request) === "open" && (store.visibleOffers(request.id, me) as OfferItem[]).some(offer => offer.status === "sent" && !offer.viewedAt);
  filters.push({ key: "new-offers", label: "ახალი შეთავაზებები", count: requests.filter(hasNewOffers).length });
  const visible = requests.filter(request => filter === "all" || (filter === "new-offers" ? hasNewOffers(request) : requestState(request) === filter));
  const showDraft = draft && (filter === "all" || filter === "draft");
  const meta = (quantity: number | string | null | undefined, unit: string | null | undefined, category: string, city: string) => [quantity != null && quantity !== "" ? `${formatNumber(Number(quantity))} ${store.units[unit || ""] || ""}` : categories[category], cities[city] || city].filter(Boolean).join(" · ");
  async function removeDraft() {
    if (draftPending) return;
    setDraftPending(true);
    try { await deleteServerDraft(store); clearRequestDraft(); setServerDraft(null); setLocalDraft(null); if (filter === "draft") setFilter("all"); toast("მონახაზი წაიშალა."); }
    catch (err) { toastError((err as { userMessage?: string }).userMessage || "ვერ შესრულდა."); }
    finally { setDraftPending(false); }
  }
  async function extend(id: string) {
    if (pending) return;
    setPending(id);
    try {
      const updated = await store.extendRequest(id);
      const expires = dateShort(updated?.expiresAt);
      toast(expires ? `შეთავაზებების მიღება: ${expires}.` : "მიღების ვადა განახლდა.");
    }
    catch (err) { toastError((err as { userMessage?: string }).userMessage || "ვერ შესრულდა."); }
    finally { setPending(null); }
  }
  if (!draftLoaded) return <section className="account-records" aria-label="ჩემი მოთხოვნები" aria-busy="true"><ListSkeleton compact label="მოთხოვნები იტვირთება…"/></section>;
  return <section className="account-records" aria-label="ჩემი მოთხოვნები">
    <Filters label="მოთხოვნის სტატუსი" value={filter} onChange={setFilter} items={[{ key: "all", label: "ყველა", count: requests.length + Number(!!draft) }, ...filters]}/>
    {visible.length || showDraft ? <ul className="account-rows account-request-list">
      {showDraft ? <li className="account-request-card">
        <div className="account-item-heading"><span className="account-draft-photo"><Icon name="file-text"/></span><Link className={`${styles.cardLink} ${styles.recordIdentity}`} href="/requests/new/?draft=1"><h2>{draft.title.trim() || "დაუსრულებელი მოთხოვნა"}</h2><p>{meta(draft.quantity, draft.unit, draft.category, draft.city)}</p></Link></div>
        <div className="account-request-summary"><Status tone="muted">მონახაზი</Status><span className="account-request-count"><Icon name="inbox"/>0 შეთავაზება</span></div>
        <div className={styles.draftActions}>
          <Button variant="secondary" href="/requests/new/?draft=1">გაგრძელება</Button>
          <Button variant="danger-quiet" loading={draftPending} onClick={() => void removeDraft()}><Icon name="trash-2"/>წაშლა</Button>
        </div>
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
        const tone = reviewing ? "info" : state === "open" ? "success" : state === "chosen" ? "dark" : state === "hidden" || state === "cancelled" ? "muted" : "neutral";
        return <li className="account-request-card" data-highlight={fresh > 0 || undefined} key={request.id}>
          <div className="account-item-heading"><RequestPhoto request={request}/><Link className={`${styles.cardLink} ${styles.recordIdentity}`} href={requestHref(request.id)} title={request.title}><h2>{request.title}</h2><p>{meta(request.quantity, request.unit, request.category, request.city)}</p></Link></div>
          <div className="account-request-summary">
            <Status tone={tone}>{reviewing ? "შეთავაზებების განხილვა" : state === "chosen" ? "მომწოდებელი არჩეულია" : labels[state] || store.stateLabels[state]}</Status>
            <span className="account-request-count">{partner && ["chosen", "complete"].includes(state) ? <><Icon name="building-2"/><span className="account-request-partner" title={partner.company || partner.name}>{partner.company || partner.name}</span></> : <><Icon name="inbox"/>{count} შეთავაზება{fresh ? <strong>+{fresh}</strong> : null}</>}</span>
          </div>
          {state === "complete" && deal ? <Button variant="secondary" href={dealHref(deal.id)}>{deal.rating == null ? "გარიგების შეფასება" : "გარიგების ნახვა"}</Button>
            : state === "chosen" && chosen && !me.blocked && !request.hidden ? <Button variant="secondary" onClick={() => openChat({ companyId: chosen.companyUserId, requestId: request.id, conversation })}><Icon name="message-square"/>მიწერა</Button>
            : state === "expired" ? <Button variant="secondary" loading={pending === request.id} disabled={!!pending} onClick={() => void extend(request.id)}>ვადის გაგრძელება</Button>
            : reviewing ? <Button href={compareHref(request.id)}>შეთავაზებების შედარება</Button>
            : <Button variant="secondary" href={requestHref(request.id)}>მოთხოვნის ნახვა</Button>}
        </li>;
      })}
    </ul> : requests.length || draft ? <EmptyState icon="file-text" text="ამ სტატუსით მოთხოვნა არ არის." action={<Button variant="secondary" onClick={() => setFilter("all")}>ყველა მოთხოვნის ნახვა</Button>}/> : <EmptyState icon="file-text" title="მოთხოვნები ჯერ არ გაქვთ" text="აღწერეთ, რა გჭირდებათ — მომწოდებლები შეთავაზებებს გამოგიგზავნიან." action={<Button href="/requests/new/"><Icon name="plus"/>მოთხოვნის განთავსება</Button>}/>}
  </section>;
}
