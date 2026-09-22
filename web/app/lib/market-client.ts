"use client";

import { useEffect, useState } from "react";
import { createMarketStore } from "./market-store";

// The shared data layer refreshes its cache after authentication and every mutation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Store = Record<string, any>;
let singleton: Store | undefined;
export function getMarketStore(): Store {
  singleton ??= createMarketStore();
  return singleton;
}
export function useMarketStore(): { store: Store | undefined; ready: boolean; available: boolean } {
  const [store, setStore] = useState<Store>();
  useEffect(() => {
    const source = getMarketStore();
    const update = () => setStore({ ...source });
    const unsubscribe = source.subscribe(update);
    source.ready().then(update);
    update();
    return unsubscribe;
  }, []);
  return { store, ready: !!store?.isReady(), available: store ? !!store.isAvailable() : true };
}
