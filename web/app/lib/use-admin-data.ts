"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";
import { adminUserFilterParams } from "./admin-user-filters";

export type AdminPage = {
  items: Record<string, unknown>[];
  nextCursor: { created_at: string; id: string; asOf: string } | null;
  hasMore: boolean;
  filteredTotal: number;
  asOf: string;
};

export function adminErrorMessage(err: unknown, fallback = "ჩანაწერები ვერ ჩაიტვირთა. სცადე ხელახლა.") {
  const error = err as { code?: string; userMessage?: string };
  if (error?.code === "MA002") return "ანგარიში დაბლოკილია. ადმინისტრირების მოქმედებები მიუწვდომელია.";
  if (error?.code === "MA003") return "ადმინისტრატორის უფლება აღარ გაქვს. გადაამოწმე, რომ სწორი ანგარიშით ხარ შესული.";
  if (error?.code === "MA207") return "არჩეული შეთავაზება არ იშლება. გამოიყენე მოთხოვნის დამალვა ან წაშლა, ან კომპანიის დაბლოკვა.";
  if (error?.code === "MA304") return "მიუთითე წაშლის მიზეზი — 3–500 სიმბოლო.";
  return error?.userMessage || fallback;
}

type Result = { key: string; page: AdminPage | null; error: string | null };

// admin_list_audit returns ids only: name them from the store cache, then by id through the
// admin search RPCs (both match the id). Unresolved ids (deleted records) stay unnamed.
async function auditLabels(store: Store, items: Record<string, unknown>[]) {
  const labels = new Map<string, string>();
  const userLabel = (u: { name?: string; company?: string } | null | undefined) => u?.company || u?.name || "";
  const me = store.currentUser();
  const wanted = new Map<string, "user" | "request">();
  for (const r of items) {
    wanted.set(String(r.actor_id), "user");
    wanted.set(String(r.target_id), r.target_type === "request" ? "request" : "user");
  }
  await Promise.all([...wanted].map(async ([id, kind]) => {
    const cached = kind === "request" ? store.getRequest(id)?.title : userLabel(me?.id === id ? me : store.userById(id));
    if (cached) { labels.set(id, cached); return; }
    try {
      const found = await (kind === "request" ? store.adminSearchRequests({ p_q: id, p_limit: 1 }) : store.adminSearchUsers({ p_q: id, p_limit: 1 }));
      const row = found?.items?.find((x: Record<string, unknown>) => x.id === id);
      const label = kind === "request" ? row?.title : userLabel(row);
      if (label) labels.set(id, String(label));
    } catch { /* fall back to the short id */ }
  }));
  return labels;
}
export function useAdminData({ store, enabled, tab, query, status, role, cursor }: {
  store: Store | undefined; enabled: boolean; tab: "requests" | "users" | "offers" | "audit";
  query: string; status: string; role: string; cursor: string;
}) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const version = Number(store?.stats()?.adminApiVersion) || 0;
  // Offers need the v2 database and the store method that calls it.
  const supported = enabled && (tab === "offers" ? version >= 2 && typeof store?.adminSearchOffers === "function" : version >= 1);
  const latestStore = useRef(store);
  useEffect(() => { latestStore.current = store; }, [store]);
  const key = JSON.stringify([tab, query, status, role, cursor, version, store?.currentUser()?.id]);
  const fetchKey = JSON.stringify([key, revision, store?.dataRevision()]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const store = latestStore.current;
    if (!supported || !store) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const p_cursor = cursor ? JSON.parse(cursor) : null;
        const pagination = { p_cursor, p_limit: 25 };
        const raw = await (tab === "requests" ? store.adminSearchRequests({ ...pagination, p_q: query || null, p_state: status || null })
          : tab === "users" ? store.adminSearchUsers({ ...pagination, p_q: query || null, ...adminUserFilterParams(status, role) })
          : tab === "offers" ? store.adminSearchOffers({ ...pagination, p_q: query || null, p_status: status || null })
          : store.adminListAudit(pagination));
        // v2 audit rows carry names from the server; v1 rows are named here.
        const named = raw.items.some((r: Record<string, unknown>) => "actor_name" in r);
        const labels = tab === "audit" && !named ? await auditLabels(store, raw.items) : null;
        const page: AdminPage = { ...raw, items: raw.items.map((r: Record<string, unknown>) => labels ? {
          ...r, actor_name: labels.get(String(r.actor_id)) || null, target_name: labels.get(String(r.target_id)) || null,
        } : tab === "audit" || tab === "offers" ? r : tab === "users" ? {
          ...r, createdAt: r.created_at, blockedReason: r.blocked_reason, verifiedAt: r.verified_at, serviceCities: r.service_cities,
        } : {
          ...r, createdAt: r.created_at, ownerId: r.owner_id, ownerName: r.owner_name, ownerCompany: r.owner_company,
          offerCount: r.offer_count, hiddenReason: r.hidden_reason, expiresAt: r.expires_at, chosenOfferId: r.chosen_offer_id,
        }) };
        if (!cancelled) setResult(previous => previous?.key === key && !previous.error && JSON.stringify(previous.page) === JSON.stringify(page) ? previous : { key, page, error: null });
      } catch (err) {
        if (!cancelled) setResult(previous => ({ key, page: previous?.key === key ? previous.page : null, error: adminErrorMessage(err) }));
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [supported, key, fetchKey, tab, query, status, role, cursor]);
  const current = result?.key === key ? result : null;
  const mode: "legacy" | "loading" | "ready" | "error" = !supported ? "legacy" : !current ? "loading" : current.page ? "ready" : "error";
  return { mode, page: current?.page || null, error: current?.error || null, reload };
}

export type ContactRow = {
  id: string; actor_id: string | null; actor_name: string | null; actor_company: string | null;
  target_kind: "company" | "request"; target_id: string; target_name: string | null; target_exists: boolean;
  kind: "reveal" | "call"; source: string; created_at: string;
};
export type ContactStats = {
  totals: Record<string, { reveals: number; calls: number }>;
  companies: ContactTop[]; requests: ContactTop[];
};
type ContactTop = Pick<ContactRow, "target_kind" | "target_id" | "target_name" | "target_exists"> & { reveals: number; calls: number };
type MessageStats = { totals: Record<string, { conversations: number; messages: number }> };
type ContactResult = { key: string; filterKey: string; page: AdminPage | null; rows: ContactRow[]; stats: ContactStats | null; messageStats: MessageStats | null; error: string | null };

export function useAdminContacts({ store, kind, target, period, cursor }: {
  store: Store; kind: string; target: string; period: string; cursor: string;
}) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ContactResult | null>(null);
  const filterKey = JSON.stringify([kind, target, period, revision, store.currentUser()?.id]);
  const key = JSON.stringify([filterKey, cursor]);
  const contactEvents=store.adminContactEvents,contactStats=store.adminContactStats,loadMessageStats=store.adminMessageStats;
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const p_cursor = cursor ? JSON.parse(cursor) : null;
        // Keep the date window fixed while traversing the insertion-bound cursor.
        const at = p_cursor?.asOf ? new Date(p_cursor.asOf).getTime() : Date.now();
        const boundary = period === "day" ? Math.floor((at + 4 * 3600000) / 86400000) * 86400000 - 4 * 3600000
          : at - (period === "week" ? 7 : 30) * 86400000;
        const from = p_cursor?.from || new Date(boundary).toISOString();
        const [page, stats, messageStats] = await Promise.all([
          contactEvents({ p_cursor, p_kind: kind || null, p_target_kind: target || null, p_from: from, p_limit: 25 }),
          contactStats({ p_period: period }),
          loadMessageStats(),
        ]);
        if (page.nextCursor) page.nextCursor = { ...page.nextCursor, from };
        if (!cancelled) setResult(previous => {
          const append = cursor && previous?.filterKey === filterKey && JSON.stringify(previous.page?.nextCursor) === cursor;
          return { key, filterKey, page, stats, messageStats, error: null, rows: append ? [...previous.rows, ...page.items] : page.items };
        });
      } catch (err) {
        if (!cancelled) setResult({ key, filterKey, page: null, rows: [], stats: null, messageStats: null, error: adminErrorMessage(err, "კონტაქტების ჩატვირთვა ვერ მოხერხდა.") });
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [contactEvents, contactStats, loadMessageStats, kind, target, period, cursor, key, filterKey]);
  const current = result?.key === key ? result : null;
  return { ...current, loading: !current, reload: () => setRevision(value => value + 1) };
}
