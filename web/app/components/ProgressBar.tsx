"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Mounted by loading.tsx and the client data fallbacks, removed when content is ready.
// No timer or guessed percentage: this also works before hydration and across root layouts.
export function ProgressBar() {
  return <div className="ma-progress" aria-hidden="true"><span /></div>;
}

function NavigationListener() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const next = new URL(link.href, location.href);
      if (next.origin !== location.origin || (next.pathname === location.pathname && next.search === location.search)) return;
      setPending(true);
    };
    // A full root-layout navigation may restore this document from the back-forward cache.
    const finish = () => setPending(false);
    document.addEventListener("click", start, true);
    window.addEventListener("pageshow", finish);
    window.addEventListener("popstate", finish);
    return () => {
      document.removeEventListener("click", start, true);
      window.removeEventListener("pageshow", finish);
      window.removeEventListener("popstate", finish);
    };
  }, []);
  return pending ? <div className="ma-navigation-progress"><ProgressBar /></div> : null;
}

function NavigationState() {
  const pathname = usePathname();
  const search = useSearchParams();
  // Reset only after the destination commits; also covers query-only navigation.
  return <NavigationListener key={`${pathname}?${search.toString()}`} />;
}

export function NavigationProgress() {
  // This boundary wraps only the invisible observer, never the SSR page content.
  return <Suspense fallback={null}><NavigationState /></Suspense>;
}
