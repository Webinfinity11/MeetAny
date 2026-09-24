"use client";

import { useEffect, useState } from "react";

// Public phone projection only. Never request email or select=* for profiles.
export async function fetchPhones(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  try {
    const res = await fetch(`/api/db/profiles?select=id,phone&id=in.(${unique.map(encodeURIComponent).join(",")})`);
    if (!res.ok) return {};
    const rows: { id: string; phone: string }[] = await res.json();
    return Object.fromEntries(rows.map((r) => [r.id, r.phone]));
  } catch {
    return {};
  }
}

export async function fetchPhone(id: string): Promise<string | null> {
  if (!id) return null;
  const map = await fetchPhones([id]);
  return map[id] || null;
}

// The store's public profiles already carry the phone; fetch only when it is not cached.
// Key the response to its owner so client-side navigation cannot show a previous contact.
export function usePublicPhone(store: { userById?: (id: string) => { phone?: string | null } | null } | undefined, id: string | undefined): string | null {
  const known = id ? store?.userById?.(id)?.phone || null : null;
  const [result, setResult] = useState<{ id: string; phone: string | null } | null>(null);
  useEffect(() => {
    if (!id || known) return;
    let cancelled = false;
    fetchPhone(id).then(phone => {
      if (!cancelled) setResult({ id, phone });
    });
    return () => { cancelled = true; };
  }, [id, known]);
  return known || (result && result.id === id ? result.phone : null);
}
