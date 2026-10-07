"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";

export type DealStage = "selected" | "discuss" | "terms" | "progress" | "complete" | "cancelled";
export type Deal = {
  id: string; request_id: string; offer_id: string; buyer_id: string; supplier_id: string;
  stage: DealStage; revision: number; selected_at: string; discuss_at: string | null; terms_at: string | null;
  progress_at: string | null; complete_at: string | null; cancelled_at: string | null;
  total_price: number | null; quantity: number | null; unit: string | null; delivery_days: number | null;
  delivery_date: string | null; delivery_place: string | null; payment_terms: string | null; includes: string[];
  buyer_confirmed_at: string | null; supplier_confirmed_at: string | null;
  rating: number | null; review: string | null; rated_at: string | null;
  events?: { id: string; actor_id: string; action: string; revision: number; created_at: string }[];
};
export type DealContact = { id: string; name: string; company: string; phone: string | null; email: string | null };
export type ComparedOffer = {
  id: string; request_id: string; company_id: string; company: string; city: string; verified: boolean;
  price: number | null; price_type: string; total_gel: number | null; best_price: boolean; fastest: boolean;
  delivery_days: number | null; vat_included: boolean; delivery_included: boolean; body: string;
  status: string; eligible: boolean; valid_until: string | null; payment_terms: string | null;
  commercial_terms: string[]; updated_at: string;
};
export type DealTermsInput = {
  p_total_price: number; p_quantity: number; p_unit: string; p_delivery_days: number;
  p_delivery_date: string | null; p_delivery_place: string; p_payment_terms: string; p_includes: string[];
};
export const dealHref = (id: string) => `/deals/view/?id=${encodeURIComponent(id)}`;
export const compareHref = (id: string) => `/requests/compare/?id=${encodeURIComponent(id)}`;
export const dealActionLabel = (action?: string | null) => ({ selected: "მომწოდებელი არჩეულია", discuss: "დეტალების განხილვა", propose_terms: "ახალი პირობებია შემოთავაზებული", terms: "პირობები განახლდა", confirm_terms: "პირობები დადასტურდა", progress: "შესრულება დაიწყო", complete: "გარიგება დასრულდა", cancelled: "გარიგება გაუქმდა", rated: "გარიგება შეფასდა" }[action || ""] || "გარიგება განახლდა");
export const flowCode = (error: unknown) => {
  const e = error as { code?: string; message?: string };
  return e?.code || e?.message?.match(/MA\d{3}/)?.[0];
};
export const dealError = (error: unknown) => flowCode(error) === "MA901" ? "გარიგება ვერ მოიძებნა ან მასზე წვდომა არ გაქვს." : (error as { userMessage?: string })?.userMessage || "მონაცემები ვერ ჩაიტვირთა. სცადე ხელახლა.";
export const staleReview = "პირობები შეიცვალა. განახლებული მონაცემები გადაამოწმე და შემდეგ ხელახლა დაადასტურე მოქმედება.";
export const money = (value: number | null | undefined) => value == null ? "შეთანხმებით" : `₾${new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 2 }).format(value)}`;
export const dealDate = (value?: string | null) => {
  if (!value) return "დასაზუსტებელია";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", day: "numeric", month: "numeric" }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  const months = ["იანვ.", "თებ.", "მარტი", "აპრ.", "მაისი", "ივნ.", "ივლ.", "აგვ.", "სექტ.", "ოქტ.", "ნოემ.", "დეკ."];
  return `${parts.day} ${months[Number(parts.month) - 1]}`;
};
export const selectOfferDeal = (store: Store, id: string, updatedAt: string | null): Promise<Deal> => store.mutateRpc("select_offer_deal", { p_offer_id: id, p_expected_updated_at: updatedAt });

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
  const reload = useCallback(async () => {
    const deal: Deal = await call("get_deal", { p_deal_id: id });
    if (alive.current) setState({ deal });
    return deal;
  }, [call, id]);
  useEffect(() => {
    alive.current = true;
    let active = true;
    void call("get_deal", { p_deal_id: id }).then((deal: Deal) => { if (active) setState({ deal }); }, (error: unknown) => { if (active) setState({ error: dealError(error), denied: flowCode(error) === "MA901" }); });
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
    if (flight.current || !state.deal || review) return false;
    flight.current = true; setPending(true); setNotice("");
    try {
      await mutate(name, { ...args, p_deal_id: id, p_expected_revision: state.deal.revision });
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
