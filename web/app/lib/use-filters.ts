"use client";
import { useSearchParams } from "next/navigation";

// Native history is integrated with Next's search params, including browser back/forward.
export function useFilters(path: string) {
  const params = useSearchParams();
  const get = (key: string, fallback = "") => params.get(key) || fallback;
  const set = (values: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    const query = next.toString();
    window.history.pushState(null, "", path + (query ? `?${query}` : ""));
  };
  return {get, set};
}
