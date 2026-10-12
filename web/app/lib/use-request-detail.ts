"use client";

import { useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";
import { isUuid } from "./ids";

export function useRequestDetail(store: Store | undefined, ready: boolean, available: boolean, id: string) {
  const [result, setResult] = useState<{ key: string; error: boolean } | null>(null);
  const revision = store?.dataRevision();
  const actor = store?.currentUser()?.id || "";
  const key = JSON.stringify([id, actor, revision]);
  const ensure = store?.ensureRequest;
  const marked = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || !available || !ensure || !isUuid(id)) return;
    let cancelled = false;
    ensure(id, {cached: true}).then(async () => {
      if (cancelled) return;
      setResult({ key, error: false });
      // The author opening a request marks its sent offers as viewed, once per request and session.
      const me = store?.currentUser();
      const mark = `${me?.id}:${id}`;
      if (!store || !me || me.blocked || marked.current.has(mark) || store.getRequest(id)?.ownerId !== me.id) return;
      if (!store.visibleOffers(id, me).some((offer: { status: string; viewedAt?: string | null }) => offer.status === "sent" && !offer.viewedAt)) return;
      marked.current.add(mark);
      try {
        await store.callRpc("mark_request_offers_viewed", { p_request_id: id });
        await ensure(id);
      } catch { /* viewed marks are best effort */ }
    }, () => { if (!cancelled) setResult({ key, error: true }); });
    return () => { cancelled = true; };
  }, [ready, available, ensure, store, id, key]);
  return { loading: ready && available && isUuid(id) && result?.key !== key, error: result?.key === key && result.error };
}
