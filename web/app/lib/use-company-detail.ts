"use client";

import { useEffect, useState } from "react";
import type { Store } from "./market-client";
import { isUuid } from "./ids";

export function useCompanyDetail(store: Store | undefined, ready: boolean, available: boolean, id: string) {
  const [result, setResult] = useState<{ key: string; error: boolean } | null>(null);
  const key = JSON.stringify([id, store?.dataRevision()]);
  const ensure = store?.ensureCompany;
  useEffect(() => {
    // A malformed id is "not found" on the page; sending it would only earn a 400 from the API.
    if (!ready || !available || !ensure || !isUuid(id)) return;
    let cancelled = false;
    ensure(id, {cached: true}).then(() => { if (!cancelled) setResult({ key, error: false }); }, () => { if (!cancelled) setResult({ key, error: true }); });
    return () => { cancelled = true; };
  }, [ready, available, ensure, id, key]);
  return { loading: ready && available && isUuid(id) && result?.key !== key, error: result?.key === key && result.error };
}
