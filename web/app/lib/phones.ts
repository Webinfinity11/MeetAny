"use client";

import { useEffect, useState } from "react";

// Contact rule (owner, 2026-10-07; migration 20261007-contact-visibility): profiles.phone is no longer a
// public column, so there is nothing to fetch here. The contact of a chosen company is read through the
// contact_for_request / get_deal_contact RPCs by the parties of a selected offer (design step 6).
export async function fetchPhones(ids: string[]): Promise<Record<string, string>> {
  void ids;
  return {};
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
