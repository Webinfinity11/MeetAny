import type { Store } from './market-client';

export type MatchingItem = { id: string; city: string; score: number; match?: 'exact' | 'similar'; notified?: boolean; reasons?: { category?: string; city?: string; keywords?: string[]; deals?: number; rating?: number }; title?: string; category?: string; created_at?: string; company?: string; industry?: string; verified?: boolean };
export const matchingPageSize = 12;
export const validRequestId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function listMatching(store: Store, requestId: string | null, city: string, offset: number, limit = matchingPageSize): Promise<MatchingItem[]> {
  return store.callRpc('list_matching', { p_request_id: requestId, p_city: city || null, p_limit: limit, p_offset: offset });
}
/** Suppliers alerted on publishing (db rule meetany_private.matching_suppliers): the category's verified providers, or the same group's when there are none. */
export async function countMatchingSuppliers(store: Pick<Store, 'callRpc'>, category: string): Promise<number> {
  const count = await store.callRpc('count_matching_suppliers', { p_category: category });
  if (typeof count !== 'number') throw new Error('count unavailable');
  return count;
}
export function flowError(error: unknown) {
  const e = error as { code?: string; message?: string; userMessage?: string };
  const code = `${e?.code || ''} ${e?.message || ''}`;
  if (/MA901|MA001|MA002|MA801/.test(code)) return 'ამ ინფორმაციის ნახვის ან მოქმედების უფლება არ გაქვთ. შეამოწმეთ ანგარიში და კომპანიის დადასტურება.';
  if (/MA904/.test(code)) return 'შეთავაზება შეიცვალა. განაახლეთ მონაცემები და გადაამოწმეთ პირობები.';
  if (/MA903|MA203/.test(code)) return 'მოთხოვნა აღარ არის ღია. შეთავაზების შეცვლა შეუძლებელია.';
  return e?.userMessage || 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.';
}
