"use client";

import { useEffect, useState } from "react";
import type { Store } from "./market-client";

export function useRequestDetail(store: Store | undefined, ready: boolean, available: boolean, id: string) {
  const [result, setResult] = useState<{ key: string; error: boolean } | null>(null);
  const revision = store?.dataRevision();
  const actor = store?.currentUser()?.id || "";
  const key = JSON.stringify([id, actor, revision]);
  const ensure = store?.ensureRequest;
  useEffect(() => {
    if (!ready || !available || !ensure) return;
    let cancelled = false;
    ensure(id, {cached: true}).then(() => { if (!cancelled) setResult({ key, error: false }); }, () => { if (!cancelled) setResult({ key, error: true }); });
    return () => { cancelled = true; };
  }, [ready, available, ensure, id, key]);
  return { loading: ready && available && result?.key !== key, error: result?.key === key && result.error };
}
