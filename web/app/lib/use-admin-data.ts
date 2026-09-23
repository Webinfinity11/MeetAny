"use client";

import { useCallback, useEffect, useState } from "react";
import type { Store } from "./market-client";

export type AdminPage = {
  items: Record<string, unknown>[];
  nextCursor: { created_at: string; id: string; asOf: string } | null;
  hasMore: boolean;
  filteredTotal: number;
  asOf: string;
};

type Result = { key: string; page: AdminPage | null; error: string | null };
export function useAdminData({ store, enabled, tab, query, status, role, cursor }: {
  store: Store | undefined; enabled: boolean; tab: "requests" | "users" | "audit";
  query: string; status: string; role: string; cursor: string;
}) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const supported = enabled && Number(store?.stats()?.adminApiVersion) >= 1;
  const key = JSON.stringify([tab, query, status, role, cursor, revision, store?.dataRevision(), store?.currentUser()?.id]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!supported || !store) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const p_cursor = cursor ? JSON.parse(cursor) : null;
        const pagination = { p_cursor, p_limit: 25 };
        const raw = await (tab === "requests" ? store.adminSearchRequests({ ...pagination, p_q: query || null, p_state: status || null })
          : tab === "users" ? store.adminSearchUsers({ ...pagination, p_q: query || null, p_role: role || null,
            p_blocked: status === "blocked" ? true : ["active", "verified"].includes(status) ? false : null,
            p_verified: status === "verified" ? true : null })
          : store.adminListAudit(pagination));
        const page: AdminPage = { ...raw, items: raw.items.map((r: Record<string, unknown>) => tab === "audit" ? r : tab === "users" ? {
          ...r, createdAt: r.created_at, blockedReason: r.blocked_reason, verifiedAt: r.verified_at, serviceCities: r.service_cities,
        } : {
          ...r, createdAt: r.created_at, ownerId: r.owner_id, ownerName: r.owner_name, ownerCompany: r.owner_company,
          offerCount: r.offer_count, hiddenReason: r.hidden_reason, expiresAt: r.expires_at, chosenOfferId: r.chosen_offer_id,
        }) };
        if (!cancelled) setResult({ key, page, error: null });
      } catch (err) {
        if (!cancelled) setResult({ key, page: null, error: (err as { userMessage?: string }).userMessage || "ჩანაწერები ვერ ჩაიტვირთა. სცადე ხელახლა." });
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [supported, store, key, tab, query, status, role, cursor]);
  const current = result?.key === key ? result : null;
  const mode: "legacy" | "loading" | "ready" | "error" = !supported ? "legacy" : !current ? "loading" : current.error ? "error" : "ready";
  return { mode, page: current?.page || null, error: current?.error || null, reload };
}
