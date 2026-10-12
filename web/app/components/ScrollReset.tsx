"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Next keeps the scroll position when the new page is already "visible", so a long list → detail
// opened the detail half-way down. A forward navigation to another page (path or ?id) starts at the
// top; back/forward (popstate) and #hash links keep what the browser restores.
export function ScrollReset() {
  const pathname = usePathname();
  const id = useSearchParams().get("id");
  const key = `${pathname}?${id ?? ""}`;
  const previous = useRef<string | null>(null);
  const poppedAt = useRef(0);
  useEffect(() => {
    const onPop = () => { poppedAt.current = Date.now(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useLayoutEffect(() => {
    if (previous.current === null || previous.current === key) { previous.current = key; return; }
    previous.current = key;
    if (Date.now() - poppedAt.current < 1000 || location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [key]);
  return null;
}
