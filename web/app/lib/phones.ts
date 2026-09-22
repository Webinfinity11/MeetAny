"use client";

// Phone is a public column (db/CONTRACT.md "UI: საჯარო ტელეფონი" — profiles_select_public
// RLS policy + a column grant for anon/authenticated). Fetched directly here rather than
// through window.MarketStore (public/market-store.js, kept byte-identical to site/dist) since
// its own PUBLIC_PROFILE column list and list_companies() RPC don't carry phone. A blocked
// profile simply doesn't come back — id absent from the returned map, not an error.
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
