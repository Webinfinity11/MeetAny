import type { Store } from './market-client';

export type MatchingItem = { id: string; city: string; score: number; title?: string; category?: string; created_at?: string; company?: string; industry?: string; verified?: boolean };
export const matchingPageSize = 12;
export const validRequestId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function listMatching(store: Store, requestId: string | null, city: string, offset: number): Promise<MatchingItem[]> {
  return store.callRpc('list_matching', { p_request_id: requestId, p_city: city || null, p_limit: matchingPageSize, p_offset: offset });
}
export function flowError(error: unknown) {
  const e = error as { code?: string; message?: string; userMessage?: string };
  const code = `${e?.code || ''} ${e?.message || ''}`;
  if (/MA901|MA001|MA002|MA801/.test(code)) return 'ამ ინფორმაციის ნახვის ან მოქმედების უფლება არ გაქვთ. შეამოწმეთ ანგარიში და კომპანიის დადასტურება.';
  if (/MA904/.test(code)) return 'შეთავაზება შეიცვალა. განაახლეთ მონაცემები და გადაამოწმეთ პირობები.';
  if (/MA903|MA203/.test(code)) return 'მოთხოვნა აღარ არის ღია. შეთავაზების შეცვლა შეუძლებელია.';
  return e?.userMessage || 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.';
}
