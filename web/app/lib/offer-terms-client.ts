import type { DealTermsInput } from './deal-client';
import type { Store } from './market-client';

export type OfferTerms = { paymentTerms: string | null; validUntil: string | null; commercialTerms: string[] };
export type StoredOffer = OfferTerms & { id: string; requestId: string; companyUserId: string; updatedAt: string; body: string; price: number | null; priceType: string; vatIncluded: boolean; deliveryDays: number | null; deliveryIncluded: boolean; status: string; createdAt: string };
export function ownOffer(store: Store, requestId: string): StoredOffer | undefined {
  return store.myOffers().find((o: StoredOffer) => o.requestId === requestId);
}
export function hasOfferTerms(o: StoredOffer): boolean {
  // Missing mapper fields are unknown, not empty: never clear stored terms by guessing.
  return typeof o.updatedAt === 'string' && Object.hasOwn(o, 'paymentTerms') && Object.hasOwn(o, 'validUntil') && Array.isArray(o.commercialTerms);
}
export async function readOwnOffer(store: Store, requestId: string) {
  const actor = store.currentUser()?.id;
  const request = await store.ensureRequest(requestId);
  if (!request || actor !== store.currentUser()?.id) throw new Error('MA901');
  return ownOffer(store, requestId);
}
type ComparableDealTerms = DealTermsInput & { comment?: string };
export function termsEqual(o: OfferTerms, terms: OfferTerms): boolean;
export function termsEqual(o: ComparableDealTerms, terms: ComparableDealTerms): boolean;
export function termsEqual(o: OfferTerms | ComparableDealTerms, terms: OfferTerms | ComparableDealTerms): boolean {
  if ('p_total_price' in o && 'p_total_price' in terms) {
    return o.p_total_price === terms.p_total_price && o.p_quantity === terms.p_quantity && o.p_unit === terms.p_unit
      && o.p_delivery_days === terms.p_delivery_days && o.p_delivery_date === terms.p_delivery_date
      && o.p_delivery_place.trim() === terms.p_delivery_place.trim() && o.p_payment_terms.trim() === terms.p_payment_terms.trim()
      && JSON.stringify(o.p_includes) === JSON.stringify(terms.p_includes) && (o.comment || '').trim() === (terms.comment || '').trim();
  }
  if ('paymentTerms' in o && 'paymentTerms' in terms) {
    return o.paymentTerms === terms.paymentTerms && o.validUntil === terms.validUntil && JSON.stringify(o.commercialTerms) === JSON.stringify(terms.commercialTerms);
  }
  return false;
}
export async function setOfferTerms(store: Store, offer: { id: string; updatedAt: string }, terms: OfferTerms): Promise<StoredOffer> {
  const result = await store.callRpc('set_offer_terms', { p_offer_id: offer.id, p_payment_terms: terms.paymentTerms, p_valid_until: terms.validUntil, p_commercial_terms: terms.commercialTerms, p_expected_updated_at: offer.updatedAt });
  const row = Array.isArray(result) ? result[0] : result;
  return { ...row, requestId: row.request_id, updatedAt: row.updated_at, paymentTerms: row.payment_terms, validUntil: row.valid_until, commercialTerms: row.commercial_terms };
}
