"use client";

import { useEffect, useMemo, useState } from "react";
import { createMarketStore } from "./market-store";

// The shared data layer refreshes its cache after authentication and every mutation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Store = Record<string, any>;
export type PublicSnapshot = NonNullable<Parameters<typeof createMarketStore>[0]>["initial"];
let singleton: Store | undefined;
// One timer for all consumers. Poll the small engagement payload every 10 s;
// reload catalog data only on a changed notice, tab return, or the 30 s fallback.
let watchers = 0;
let stopWatching: (() => void) | undefined;
function watchMarket(source: Store) {
  watchers++;
  if (watchers === 1) {
    let timer: number | undefined, busy = false, stopped = false;
    let lastFull = Date.now();
    const signature = () => {
      const state = source.engagement();
      if (state?.status !== "ready") return null;
      return JSON.stringify([state.owner, state.unread,
        state.notifications.items.map((n: { id: string }) => n.id)]);
    };
    let previous = signature();
    void source.ready().then(() => { if (!stopped) previous = signature(); });
    const update = async (returned = false) => {
      if (stopped || busy || document.visibilityState !== "visible" || !source.isReady()) return;
      busy = true;
      try {
        if (returned || Date.now() - lastFull >= 30000) {
          await source.revalidate();
          lastFull = Date.now();
        } else if (source.currentUser() && !source.currentUser().blocked) {
          await source.refreshEngagement();
          const next = signature();
          if (!stopped && document.visibilityState === "visible" && next !== null && previous !== null && next !== previous) {
            await source.refresh();
            lastFull = Date.now();
          }
        }
        const current = signature();
        if (current !== null) previous = current;
      } finally { busy = false; }
    };
    const start = () => {
      if (timer === undefined && document.visibilityState === "visible") {
        timer = window.setInterval(() => { void update(); }, 10000);
      }
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        window.clearInterval(timer); timer = undefined;
      } else { start(); void update(true); }
    };
    const focus = () => { start(); void update(true); };
    start();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    stopWatching = () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }
  return () => { if (--watchers === 0) { stopWatching?.(); stopWatching = undefined; } };
}
export function getMarketStore(initial?: PublicSnapshot): Store {
  singleton ??= createMarketStore({initial});
  singleton.seedPublic(initial);
  return singleton;
}
export function useMarketStore(initial?: PublicSnapshot): { store: Store | undefined; ready: boolean; sessionReady: boolean; available: boolean } {
  const preview = useMemo(() => initial ? createMarketStore({initial, background: false}) : undefined, [initial]);
  const [store, setStore] = useState<Store>();
  useEffect(() => {
    const existing = !!singleton;
    const source = getMarketStore(initial);
    const update = () => setStore({ ...source });
    const unsubscribe = source.subscribe(update);
    const unwatch = watchMarket(source);
    // Catalog navigation can restore an old router payload. Keep authenticated data
    // and fetch current API data instead of overwriting it with that public seed,
    // unless a load is already running or has just finished (the header's first load).
    if (existing && initial !== undefined) void source.revalidate();
    source.ready().then(update);
    update();
    return () => { unsubscribe(); unwatch(); };
  }, [initial]);
  const current = store?.isReady() ? store : preview || store;
  return { store: current, ready: !!current?.isReady(), sessionReady: !!current?.isSessionReady(), available: current ? !!current.isAvailable() : true };
}
