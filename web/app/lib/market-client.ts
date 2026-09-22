"use client";

import { useEffect, useState } from "react";

// window.MarketStore is set by public/market-store.js (site/dist/market-store.js, unchanged),
// loaded via SiteScripts with strategy="beforeInteractive" — see components/SiteScripts.tsx.
// It is a plain synchronous-getter object; typed loosely (its own file is the source of truth
// for the real shapes) so this file doesn't drift out of sync with that source.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Store = Record<string, any>;

declare global {
  interface Window {
    MarketStore?: Store;
  }
}

export function useMarketStore(): { store: Store | undefined; ready: boolean; available: boolean } {
  // Starts undefined on both server and the first client render (matching the SSR HTML) even
  // though window.MarketStore may already exist by then — it is only read inside this effect,
  // never during render, so hydration never has something to disagree about.
  const [store, setStore] = useState<Store | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const attach = () => {
      const s = window.MarketStore;
      if (!s) return false;
      setStore({ ...s });
      unsub = s.subscribe(() => setStore({ ...s }));
      s.ready().then(() => setStore({ ...s }));
      return true;
    };
    if (!attach()) poll = setInterval(() => attach() && clearInterval(poll), 50);
    return () => {
      unsub?.();
      if (poll) clearInterval(poll);
    };
  }, []);

  return { store, ready: !!store?.isReady(), available: !!store?.isAvailable() };
}
