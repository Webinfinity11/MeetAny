// Admin view of deals: list rows, stage words and the stage changes an admin may force.
import type { Store } from "./market-client";

export type AdminDealStage = "selected" | "discuss" | "terms" | "progress" | "complete" | "cancelled";
export type AdminDealRow = {
  id: string; request_id: string; offer_id: string; buyer_id: string; supplier_id: string; stage: AdminDealStage;
  revision: number; total_price: number | null; rating: number | null; created_at: string; updated_at: string;
  request_title: string; request_hidden: boolean; buyer_name: string; supplier_name: string;
  offer_price: number | null; offer_price_type: string | null; open_issue: boolean; issues: number;
};
export type AdminDealPage = { items: AdminDealRow[]; hasMore: boolean; nextCursor: unknown; filteredTotal: number; stageCounts: Record<string, number> };

/** Same words as the deal screens (PLAN §1.4). */
export const dealStageLabels: Record<AdminDealStage, string> = {
  selected: "მომწოდებელი არჩეულია", discuss: "დეტალების განხილვა", terms: "პირობების დადასტურება",
  progress: "შესრულება მიმდინარეობს", complete: "დასრულებული", cancelled: "გაუქმებული",
};
export const dealStageTone = (stage: string) => stage === "complete" ? "success" : stage === "cancelled" ? "neutral" : "info";
export const dealStages = Object.keys(dealStageLabels) as AdminDealStage[];
export const issueReasons: Record<string, string> = { quality: "ხარისხი", quantity: "რაოდენობა", late: "დაგვიანება", other: "სხვა" };
export const issueOutcomes: Record<string, string> = { resolved: "მოგვარდა", rejected: "საფუძველს მოკლებულია", cancelled: "გარიგება გაუქმდა" };

/** Stages an admin may move a deal to: any other stage while it runs; finished deals stay finished. */
export function forcedStages(deal: { stage: string; buyer_confirmed_at?: string | null; supplier_confirmed_at?: string | null }) {
  if (deal.stage === "complete" || deal.stage === "cancelled") return [];
  const confirmed = !!deal.buyer_confirmed_at && !!deal.supplier_confirmed_at;
  return dealStages.filter(stage => stage !== deal.stage && (confirmed || (stage !== "progress" && stage !== "complete")));
}

export const listAdminDeals = (store: Store, args: { p_stage?: string | null; p_query?: string | null; p_cursor?: unknown; p_limit?: number }): Promise<AdminDealPage> =>
  store.callRpc("admin_list_deals", { p_stage: args.p_stage || null, p_query: args.p_query || null, p_cursor: args.p_cursor || null, p_limit: args.p_limit || 25 });
