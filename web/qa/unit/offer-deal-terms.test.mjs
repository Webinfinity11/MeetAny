import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, imports = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {}, require: name => { assert.ok(imports[name], name); return imports[name]; } };
  vm.runInNewContext(source, context);
  return context.exports;
}
const termsApi = load('../../app/lib/offer-terms-client.ts');
const { termsEqual } = termsApi;
const { readOfferDraft, offerDraftKey } = load('../../app/components/market/offer/offer-draft.ts', { '../../../lib/offer-terms-client': termsApi });
const { paymentPreset, paymentPresets } = load('../../app/components/market/offer/payment-presets.ts');
const offerTerms = { paymentTerms: '30% ავანსი', validUntil: '2026-11-01', commercialTerms: ['მონტაჟი'] };
const dealTerms = { p_total_price: 1250, p_quantity: 10, p_unit: 'pcs', p_delivery_days: 6, p_delivery_date: '2026-11-01', p_delivery_place: 'თბილისი', p_payment_terms: 'მიწოდებისას', p_includes: ['მონტაჟი'] };
test('offer comparison retains exact semantics, including nulls and ordered commercial terms', () => {
  assert.equal(termsEqual(offerTerms, { ...offerTerms }), true);
  for (const patch of [{ paymentTerms: null }, { validUntil: null }, { commercialTerms: [] }, { paymentTerms: '30% ავანსი ' }]) assert.equal(termsEqual(offerTerms, { ...offerTerms, ...patch }), false);
  assert.equal(termsEqual({ paymentTerms: null, validUntil: null, commercialTerms: [] }, { paymentTerms: null, validUntil: null, commercialTerms: [] }), true);
});
test('unchanged deal terms do not require a new revision; insignificant outer whitespace is ignored', () => {
  assert.equal(termsEqual(dealTerms, { ...dealTerms, p_includes: [...dealTerms.p_includes], comment: '' }), true);
  assert.equal(termsEqual(dealTerms, { ...dealTerms, p_delivery_place: ' თბილისი ', comment: '  ' }), true);
});
for (const [key, value] of Object.entries({ p_total_price: 1260, p_quantity: 11, p_unit: 'kg', p_delivery_days: 7, p_delivery_date: null, p_delivery_place: 'ბათუმი', p_payment_terms: 'წინასწარ', p_includes: ['შეფუთვა'], comment: 'გთხოვთ გადაამოწმოთ' })) {
  test(`deal comparison detects a real change in ${key}`, () => assert.equal(termsEqual(dealTerms, { ...dealTerms, [key]: value }), false));
}
const root = 'meetany.offerDraft.actor.request';
const offer = { ...offerTerms, id: 'offer', updatedAt: '2026-10-13T12:00:00Z' };
function storage(entries) {
  const data = new Map(entries);
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] || null, getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
test('editing draft is restored only for its exact offer and server revision', () => {
  const key = offerDraftKey(root, offer);
  assert.ok(key.includes(offer.id) && key.includes(offer.updatedAt));
  const s = storage([[key, JSON.stringify({ body: 'შეუნახავი ცვლილება', price: '1500' })]]);
  const restored = readOfferDraft(s, root, offer);
  assert.equal(restored.draft.body, 'შეუნახავი ცვლილება');
  assert.equal(restored.stale, false);
  const changed = readOfferDraft(s, root, { ...offer, updatedAt: '2026-10-13T13:00:00Z' });
  assert.equal(changed.stale, true);
  assert.equal(changed.draft.body, undefined);
  assert.equal(s.data.size, 0);
});
test('new draft survives reload and another request draft is untouched', () => {
  const s = storage([[root, JSON.stringify({ body: 'ახალი შეთავაზება' })], ['meetany.offerDraft.actor.other', '{}']]);
  assert.equal(readOfferDraft(s, root).draft.body, 'ახალი შეთავაზება');
  assert.equal(s.data.size, 2);
});
test('partial save recovery survives RPC 1 revision changes without re-sending the main offer', () => {
  const partial = { id: offer.id, updatedAt: offer.updatedAt, terms: offerTerms };
  const s = storage([[root + '.offer.old', JSON.stringify({ body: 'დრაფტი', pendingTerms: partial })]]);
  const restored = readOfferDraft(s, root, offer);
  assert.equal(restored.draft.pendingTerms.id, offer.id);
  assert.equal(restored.stale, false);
  assert.equal(s.data.size, 1);
  assert.ok(s.data.has(offerDraftKey(root, offer)));
});
test('a conflicting partial draft is discarded instead of overwriting newer terms', () => {
  const s = storage([[root + '.offer.old', JSON.stringify({ pendingTerms: { id: offer.id, updatedAt: 'old', terms: { ...offerTerms, paymentTerms: 'სხვა' } } })]]);
  assert.equal(readOfferDraft(s, root, offer).stale, true);
  assert.equal(s.data.size, 0);
});
test('malformed drafts do not prevent form loading', () => {
  const s = storage([[root, '{']]);
  assert.equal(readOfferDraft(s, root).draft.body, undefined);
  assert.equal(s.data.size, 0);
});
test('known payment aliases select one preset; additional conditions stay custom', () => {
  assert.equal(paymentPreset('30% ავანსი, 70% მიწოდებისას'), paymentPresets[1]);
  assert.equal(paymentPreset('30%–70%'), paymentPresets[1]);
  assert.equal(paymentPreset('30% ავანსი, 70% მიწოდებიდან 30 დღეში'), undefined);
});

test('a current revision draft takes precedence over older partial-save recovery', () => {
  const key = offerDraftKey(root, offer);
  const s = storage([[key, JSON.stringify({ body: 'current draft' })], [root + '.offer.old', JSON.stringify({ body: 'older draft', pendingTerms: { id: offer.id, updatedAt: offer.updatedAt, terms: offerTerms } })]]);
  assert.equal(readOfferDraft(s, root, offer).draft.body, 'current draft');
  assert.equal(JSON.parse(s.getItem(key)).body, 'current draft');
});
