"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";
import { dateShort, money } from "./format";

export type DealStage = "selected" | "discuss" | "terms" | "progress" | "complete" | "cancelled";
export type Deal = {
  id: string; request_id: string; offer_id: string; buyer_id: string; supplier_id: string;
  stage: DealStage; revision: number; selected_at: string; discuss_at: string | null; terms_at: string | null;
  progress_at: string | null; complete_at: string | null; cancelled_at: string | null;
  total_price: number | null; quantity: number | null; unit: string | null; delivery_days: number | null;
  delivery_date: string | null; delivery_place: string | null; payment_terms: string | null; includes: string[];
  buyer_confirmed_at: string | null; supplier_confirmed_at: string | null;
  rating: number | null; review: string | null; rated_at: string | null;
  review_details?:{scores:number[];would_again:boolean}|null;
  proposals?: {id:string;actor_id:string;revision:number;previous:Record<string,unknown>;proposed:Record<string,unknown>;status:'pending'|'accepted'|'rejected'|'superseded';created_at:string}[];
  updates?: {id:string;actor_id:string;status:string;body:string;created_at:string}[];
  issues?: {id:string;actor_id:string;reason:string;body:string;status:'open'|'resolved';resolution?:string;created_at:string}[];
  events?: { id: string; actor_id: string; action: string; revision: number; created_at: string }[];
};
export type MyDeal = Deal & { request_title: string; latest_at: string };
export type DealContact = { id: string; name: string; company: string; phone: string | null; email: string | null; contact_position?: string | null };
export type ComparedOffer = {
  id: string; request_id: string; company_id: string; company: string; city: string; verified: boolean;
  price: number | null; price_type: string; total_gel: number | null; best_price: boolean; fastest: boolean;
  delivery_days: number | null; vat_included: boolean; delivery_included: boolean; body: string;
  status: string; eligible: boolean; valid_until: string | null; payment_terms: string | null;
  commercial_terms: string[]; updated_at: string; created_at?: string;
};
export type DealTermsInput = {
  p_total_price: number; p_quantity: number; p_unit: string; p_delivery_days: number;
  p_delivery_date: string | null; p_delivery_place: string; p_payment_terms: string; p_includes: string[];
};
export const dealHref = (id: string) => `/deals/view/?id=${encodeURIComponent(id)}`;
export const compareHref = (id: string) => `/requests/compare/?id=${encodeURIComponent(id)}`;
export const dealActionLabel = (action?: string | null) => ({ update_started:"შეკვეთა მიღებულია",update_producing:"შეკვეთა მზადდება",update_ready:"მზადაა გასაგზავნად",update_delivered:"შეკვეთა მიწოდებულია",issue_opened:"პრობლემა განხილვაშია",issue_resolved:"პრობლემის განხილვა დასრულდა",proposal_rejected:"ცვლილება უარყოფილია",selected: "მომწოდებელი არჩეულია", discuss: "დეტალების განხილვა", propose_terms: "ახალი პირობებია შემოთავაზებული", terms: "პირობები განახლდა", confirm_terms: "პირობები დადასტურდა", progress: "შესრულება დაიწყო", complete: "გარიგება დასრულდა", cancelled: "გარიგება გაუქმდა", rated: "გარიგება შეფასდა" }[action || ""] || "გარიგება განახლდა");
export const flowCode = (error: unknown) => {
  const e = error as { code?: string; message?: string };
  return e?.code || e?.message?.match(/MA\d{3}/)?.[0];
};
export const dealError = (error: unknown) => flowCode(error) === "MA901" ? "გარიგება ვერ მოიძებნა ან მასზე წვდომა არ გაქვთ." : (error as { userMessage?: string })?.userMessage || "მონაცემები ვერ ჩაიტვირთა. სცადეთ ხელახლა.";
export const staleReview = "პირობები შეიცვალა. გადაამოწმეთ განახლებული მონაცემები და შემდეგ ხელახლა დაადასტურეთ მოქმედება.";
export const dealStageLabel = (stage?: DealStage | string | null) => ({ selected: "მომწოდებელი არჩეულია", discuss: "დეტალების განხილვა", terms: "პირობების დადასტურება", progress: "შესრულება მიმდინარეობს", complete: "დასრულებული", cancelled: "გაუქმებული" } as Record<string, string>)[stage || ""] || "";
/** Offer status in the database is sent | chosen | declined; the pending/viewed/selected/not_selected names map to the same labels. */
export const offerStatusLabel = (status?: string | null) => ({ sent: "მოლოდინში", pending: "მოლოდინში", viewed: "ნანახია", chosen: "არჩეული", selected: "არჩეული", declined: "არ შეირჩა", not_selected: "არ შეირჩა" } as Record<string, string>)[status || ""] || "";
export { money };
export const dealDate = (value?: string | null) => dateShort(value) || "დასაზუსტებელია";
export const selectOfferDeal = (store: Store, id: string, updatedAt: string | null): Promise<Deal> => store.mutateRpc("select_offer_deal", { p_offer_id: id, p_expected_updated_at: updatedAt });

/** Supplier progress, in order. The first step is the deal entering progress; the rest are supplier updates. */
export const progressSteps = [
  { key: "confirmed", label: "შეკვეთა დადასტურდა" },
  { key: "started", label: "წარმოება დაიწყო" },
  { key: "producing", label: "მზადდება" },
  { key: "ready", label: "მზადაა გასაგზავნად" },
  { key: "delivered", label: "მიწოდებულია" },
] as const;
export const progressStatusLabel = (status?: string | null) => progressSteps.find(step => step.key === status)?.label || "";
/** Each step's date, or null while it has not happened. Later updates also complete the steps before them. */
export function progressTimeline(deal: Deal) {
  const reached: (string | null)[] = progressSteps.map((step, i) => i === 0 ? deal.progress_at : (deal.updates || []).filter(u => u.status === step.key).map(u => u.created_at).sort()[0] || null);
  // A completed deal was delivered: the buyer confirmed receipt even if the supplier skipped the last updates.
  if (deal.stage === "complete" && !reached[reached.length - 1]) reached[reached.length - 1] = deal.complete_at;
  for (let i = reached.length - 2; i >= 0; i--) if (!reached[i] && reached[i + 1]) reached[i] = reached[i + 1];
  return progressSteps.map((step, i) => ({ ...step, at: reached[i] }));
}

/** The deal's current terms with gaps filled from the chosen offer and request; missing lists what still needs agreeing. */
export function currentDealTerms(deal: Deal, fallback: { totalPrice?: number | null; place?: string | null } = {}) {
  const terms: DealTermsInput = {
    p_total_price: Number(deal.total_price ?? fallback.totalPrice ?? NaN), p_quantity: Number(deal.quantity ?? NaN), p_unit: deal.unit || "",
    p_delivery_days: Number(deal.delivery_days ?? NaN), p_delivery_date: deal.delivery_date, p_delivery_place: (deal.delivery_place || fallback.place || "").trim(),
    p_payment_terms: (deal.payment_terms || "").trim(), p_includes: deal.includes || [],
  };
  const missing = [
    !(terms.p_total_price > 0) ? "ფასი" : "", !(terms.p_quantity > 0) || !terms.p_unit ? "რაოდენობა" : "",
    !Number.isInteger(terms.p_delivery_days) ? "მიწოდების ვადა" : "", !terms.p_delivery_place ? "მიწოდების ადგილი" : "", !terms.p_payment_terms ? "გადახდის პირობები" : "",
  ].filter(Boolean);
  return { terms, missing };
}

/** The deal recorded for one of the actor's requests, found by reading only. undefined while loading, null when none exists. */
export function useRequestDeal(store: Store | null | undefined, requestId: string, enabled: boolean) {
  const [found, setFound] = useState<{ key: string; id: string | null }>();
  const key = enabled && store && requestId ? requestId : "";
  useEffect(() => {
    if (!key || !store) return;
    let active = true;
    void listMyDeals(store).then(items => { if (active) setFound({ key, id: items.find(d => d.request_id === key)?.id || null }); }, () => { if (active) setFound({ key, id: null }); });
    return () => { active = false; };
  }, [store, key]);
  return !key ? null : found?.key === key ? found.id : undefined;
}

/** Every deal the actor takes part in, newest activity first. */
export const listMyDeals = async (store: Store): Promise<MyDeal[]> => {
  const items = await store.callRpc("list_my_deals");
  if (!Array.isArray(items)) throw new Error("Invalid deal list");
  return items;
};

/** Results belong to the actor and route. Refreshing after a write never silently retries it. */
export function useDeal(store: Store, id: string, actor: string) {
  const call = store.callRpc;
  const mutate = store.mutateRpc;
  const [state, setState] = useState<{ deal?: Deal; error?: string; denied?: boolean }>({});
  const [pending, setPending] = useState(false);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState("");
  const flight = useRef(false);
  const alive = useRef(true);
  // Chained writes (agree, then confirm) must use the revision the previous write produced, not the one rendered.
  const latest = useRef<Deal | undefined>(undefined);
  const reload = useCallback(async () => {
    const deal: Deal = await call("get_deal", { p_deal_id: id });
    latest.current = deal;
    if (alive.current) setState({ deal });
    return deal;
  }, [call, id]);
  useEffect(() => {
    alive.current = true;
    let active = true;
    void call("get_deal", { p_deal_id: id }).then((deal: Deal) => { if (active) { latest.current = deal; setState({ deal }); } }, (error: unknown) => { if (active) setState({ error: dealError(error), denied: flowCode(error) === "MA901" }); });
    return () => { active = false; alive.current = false; };
  }, [call, id, actor]);
  async function refresh() {
    if (flight.current) return;
    flight.current = true; setPending(true);
    try { await reload(); }
    catch (error) { setState({ error: dealError(error), denied: flowCode(error) === "MA901" }); }
    finally { flight.current = false; if (alive.current) setPending(false); }
  }
  async function write(name: string, args: Record<string, unknown> = {}) {
    const deal = latest.current || state.deal;
    if (flight.current || !deal || review) return false;
    flight.current = true; setPending(true); setNotice("");
    try {
      await mutate(name, { ...args, p_deal_id: id, p_expected_revision: deal.revision });
      await reload();
      return true;
    } catch (error) {
      // Any failed write may have committed before a connection was lost: reread before allowing another.
      try { await reload(); }
      catch (readError) { if (alive.current) setState({ error: dealError(readError), denied: flowCode(readError) === "MA901" }); }
      if (alive.current) { setReview(true); setNotice(flowCode(error) === "MA904" ? staleReview : dealError(error)); }
      return false;
    } finally { flight.current = false; if (alive.current) setPending(false); }
  }
  return { ...state, pending, review, notice, refresh, write, reviewed: () => { setReview(false); setNotice(""); } };
}
