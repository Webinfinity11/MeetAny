"use client";

import { useEffect, useMemo, useState } from "react";
import { createMarketStore } from "./market-store";

// The shared data layer refreshes its cache after authentication and every mutation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Store = Record<string, any>;
export type PublicSnapshot = NonNullable<Parameters<typeof createMarketStore>[0]>["initial"];
let singleton: Store | undefined;
export function getMarketStore(initial?: PublicSnapshot): Store {
  singleton ??= createMarketStore({initial});
  singleton.seedPublic(initial);
  return singleton;
}
export function useMarketStore(initial?: PublicSnapshot): { store: Store | undefined; ready: boolean; available: boolean } {
  const preview = useMemo(() => initial ? createMarketStore({initial, background: false}) : undefined, [initial]);
  const [store, setStore] = useState<Store>();
  useEffect(() => {
    const existing = !!singleton;
    const source = getMarketStore(initial);
    const update = () => setStore({ ...source });
    const unsubscribe = source.subscribe(update);
    // Catalog navigation can restore an old router payload. Keep authenticated data
    // and fetch current API data instead of overwriting it with that public seed,
    // unless a load is already running or has just finished (the header's first load).
    if (existing && initial !== undefined) void source.revalidate();
    source.ready().then(update);
    update();
    return unsubscribe;
  }, [initial]);
  const current = store?.isReady() ? store : preview || store;
  return { store: current, ready: !!current?.isReady(), available: current ? !!current.isAvailable() : true };
}
