import { termsEqual, type OfferTerms, type StoredOffer } from '../../../lib/offer-terms-client';
export type PendingTerms = { id: string; updatedAt: string; terms: OfferTerms };
type Draft = Record<string, unknown> & { pendingTerms?: PendingTerms };
type DraftStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export const offerDraftKey = (root: string, offer?: Pick<StoredOffer, 'id' | 'updatedAt'>) => offer ? `${root}.${offer.id}.${offer.updatedAt}` : root;
/** A withdrawn offer can be sent again without retyping. Only text/terms are copied, never file IDs. */
export function retainWithdrawnOffer(storage: DraftStorage, owner: string, requestId: string, offer: Partial<StoredOffer>) {
  const root = `meetany.offerDraft.${owner}.${requestId}`;
  storage.setItem(root, JSON.stringify({ body: offer.body || '', price: offer.price == null ? '' : String(offer.price), priceType: offer.priceType || 'total',
    vatIncluded: !!offer.vatIncluded, deliveryIncluded: !!offer.deliveryIncluded, deliveryDays: offer.deliveryDays == null ? '' : String(offer.deliveryDays),
    paymentTerms: offer.paymentTerms || '', validUntil: offer.validUntil || '', commercialTerms: offer.commercialTerms?.join('\n') || '' }));
}
export function readOfferDraft(storage: DraftStorage, root: string, offer?: StoredOffer): { key: string; draft: Draft; stale: boolean } {
  const key = offerDraftKey(root, offer);
  let draft: Draft = {}, stale = false;
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k && (k === root || k.startsWith(`${root}.`)));
  for (const oldKey of keys) {
    let saved: Draft;
    try { saved = JSON.parse(storage.getItem(oldKey) || '{}'); if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('invalid draft'); }
    catch { storage.removeItem(oldKey); continue; }
    // RPC 1 may already have committed. Retain the existing RPC 2 recovery path.
    const partial = saved.pendingTerms;
    const recoverable = !storage.getItem(key) && offer && partial?.id === offer.id && partial.terms && Array.isArray(partial.terms.commercialTerms)
      && (offer.updatedAt === partial.updatedAt || termsEqual(offer, partial.terms));
    if (oldKey === key || recoverable) draft = saved;
    else { stale = true; storage.removeItem(oldKey); }
    if (recoverable && oldKey !== key) { storage.setItem(key, JSON.stringify(saved)); storage.removeItem(oldKey); }
  }
  return { key, draft, stale };
}
