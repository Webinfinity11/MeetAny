import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../app/lib/onboarding-client.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, require: () => ({ categories: {} }) };
vm.runInNewContext(source, context);
const { onboardWrites, retainOnboardDraft, stepsFor, serializeOnboardDraft, restoreOnboardDraft, onboardDraftKey, onboardDraftLifetime } = context.exports;

test('returning to an unfinished later step does not submit its invalid hidden draft', () => {
  assert.deepEqual([...onboardWrites('type', ['details', 'profile'])], ['type']);
  assert.deepEqual([...onboardWrites('details', ['type', 'details', 'profile', 'provide'])], ['type', 'details']);
});

test('leaving onboarding includes later drafts so navigation cannot discard them', () => {
  assert.deepEqual([...onboardWrites('type', ['details', 'profile', 'provide'], true)], ['type', 'details', 'profile', 'provide']);
});

test('saving an earlier step keeps later legal, profile and product drafts', () => {
  const saved = { profile: { account_intent: 'buy', registration_code: '123', founded_year: 2020, about: 'Saved', offers: [], verified: true }, products: [] };
  const draft = { profile: { ...saved.profile, account_intent: 'sell', registration_code: 'x', founded_year: 9999, about: 'Unfinished', offers: ['Installation'], verified: false }, products: [{ name: '', photoUrl: '', note: 'Draft' }] };
  const result = retainOnboardDraft(saved, draft, ['details', 'profile', 'provide']);
  assert.equal(result.profile.registration_code, 'x');
  assert.equal(result.profile.founded_year, 9999);
  assert.equal(result.profile.about, 'Unfinished');
  assert.equal(result.products, draft.products);
  assert.equal(result.profile.account_intent, 'buy');
  assert.equal(result.profile.verified, true);
  assert.equal(saved.profile.registration_code, '123');
  assert.equal(retainOnboardDraft(saved, draft, []).products, saved.products);
});

test('the onboarding steps follow the account intent', () => {
  assert.deepEqual([...stepsFor('buy')], ['type', 'details', 'profile', 'need', 'verify', 'review']);
  assert.deepEqual([...stepsFor('sell')], ['type', 'details', 'profile', 'provide', 'verify', 'review']);
  assert.deepEqual([...stepsFor('both')], ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']);
  assert.equal(stepsFor(undefined).length, 7);
});

test('writes only cover the steps of the current intent', () => {
  const steps = stepsFor('buy');
  assert.deepEqual([...onboardWrites('need', ['details', 'provide', 'need'], false, steps)], ['details', 'need']);
  assert.deepEqual([...onboardWrites('type', ['provide', 'need'], true, steps)], ['type', 'need']);
});

const persisted = { profile: { id: 'company-a', account_intent: 'both', about: 'Saved', company: 'Company', industry: 'food', business_tags: [], certificates: [], name: 'Owner', legal_name: 'Legal', verified: true, provide_categories: ['food'], offers: ['Service'], logo_url: 'server.jpg' }, products: [{ name: 'Saved product', photoUrl: 'server.jpg', note: '' }] };
const draft = { profile: { ...persisted.profile, about: 'Draft', name: 'Draft owner', verified: false, logo_url: 'draft.jpg' }, products: [{ name: 'Draft product', photoUrl: 'uploaded.jpg', note: 'Note', file: { secret: 'binary' } }] };
const now = 100000000;

test('serialize includes only dirty fields and product strings, without files or server flags', () => {
  const profile = JSON.parse(serializeOnboardDraft(draft, ['profile'], now));
  assert.deepEqual(Object.keys(profile.profile).sort(), ['about', 'business_tags', 'certificates', 'company', 'industry']);
  assert.equal(profile.products, undefined);
  const products = JSON.parse(serializeOnboardDraft(draft, new Set(['provide']), now));
  assert.deepEqual(products.products, [{ name: 'Draft product', photoUrl: 'uploaded.jpg', note: 'Note' }]);
  assert.equal(products.profile.verified, undefined);
  assert.equal(onboardDraftKey('company-a'), 'onboard-draft:company-a');
});

test('restore never overwrites a step without dirty changes or server-owned media and flags', () => {
  const raw = serializeOnboardDraft(draft, ['profile'], now);
  const result = restoreOnboardDraft(persisted, raw, now + 1);
  assert.equal(result.profile.about, 'Draft');
  assert.equal(result.profile.name, 'Owner');
  assert.equal(result.profile.verified, true);
  assert.equal(result.profile.logo_url, 'server.jpg');
  assert.equal(result.products, persisted.products);
  assert.equal(persisted.profile.about, 'Saved');
});

test('expired, foreign, future, malformed and identical drafts are ignored', () => {
  const raw = serializeOnboardDraft(draft, ['profile'], now);
  assert.equal(restoreOnboardDraft(persisted, raw, now + onboardDraftLifetime), persisted);
  assert.equal(restoreOnboardDraft(persisted, raw, now - 1), persisted);
  assert.equal(restoreOnboardDraft(persisted, raw.replace('company-a', 'company-b'), now), persisted);
  for (const value of [null, '{', '{}', 'null']) assert.equal(restoreOnboardDraft(persisted, value, now), persisted);
  assert.equal(restoreOnboardDraft(persisted, serializeOnboardDraft(persisted, ['profile'], now), now), persisted);
  assert.equal(restoreOnboardDraft(persisted, raw, now + onboardDraftLifetime - 1).profile.about, 'Draft');
});

test('type categories and products restore while saved steps can be removed independently', () => {
  const changed = { ...draft, profile: { ...draft.profile, provide_categories: ['beverages'] } };
  const result = restoreOnboardDraft(persisted, serializeOnboardDraft(changed, ['type', 'provide', 'profile'], now), now);
  assert.deepEqual([...result.profile.provide_categories], ['beverages']);
  assert.equal(result.products[0].name, 'Draft product');
  const remaining = restoreOnboardDraft(persisted, serializeOnboardDraft(result, ['provide'], now), now);
  assert.equal(remaining.profile.about, 'Saved');
  assert.equal(remaining.products[0].name, 'Draft product');
});

test('invalid editable data and injected non-dirty properties do not replace persisted values', () => {
  const value = JSON.parse(serializeOnboardDraft(draft, ['profile'], now));
  Object.assign(value.profile, { about: {}, name: 'Injected owner', verified: false, business_tags: [3] });
  value.dirtySteps.push('__proto__');
  assert.equal(restoreOnboardDraft(persisted, JSON.stringify(value), now), persisted);
});

const { validateOnboardStep, saveOnboardStep } = context.exports;
const optionalProfile = { ...persisted.profile, city: 'tbilisi', address: null, markets: [], languages: [], legal_name: null, registration_code: null, legal_form: null, employee_band: null, founded_year: null, contact_position: null, website: null, need_categories: [], offers: [], seeks: [], about: '' };
test('progressive profiling allows blank optional legal and profile fields', () => {
  assert.equal(validateOnboardStep('details', optionalProfile, []), '');
  assert.equal(validateOnboardStep('profile', optionalProfile, []), '');
  assert.ok(validateOnboardStep('details', { ...optionalProfile, name: '' }, []));
  assert.ok(validateOnboardStep('details', { ...optionalProfile, city: '' }, []));
  assert.ok(validateOnboardStep('details', { ...optionalProfile, legal_name: 'x' }, []));
  assert.ok(validateOnboardStep('details', { ...optionalProfile, founded_year: 9999 }, []));
  assert.ok(validateOnboardStep('profile', { ...optionalProfile, about: 'x'.repeat(1001) }, []));
});
test('products allow 100 rows and optional photos; empty rows do not block continuation', () => {
  const products = Array.from({ length: 100 }, (_, i) => ({ name: 'Product ' + i, note: '' }));
  assert.equal(validateOnboardStep('provide', optionalProfile, products), '');
  assert.equal(validateOnboardStep('provide', optionalProfile, [{ name: '', note: '' }]), '');
  assert.ok(validateOnboardStep('provide', optionalProfile, [...products, { name: 'Extra', note: '' }]));
  assert.ok(validateOnboardStep('provide', { ...optionalProfile, offers: ['Product 1'] }, products));
});
test('draft round-trip retains imported product code, unit, price and optional photo', () => {
  const model = { profile: optionalProfile, products: [{ name: 'Imported', note: '', code: '00012', unit: 'kg', price: 0, photoUrl: null }] };
  const restored = restoreOnboardDraft(persisted, serializeOnboardDraft(model, ['provide'], now), now);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.products)), model.products);
});
test('save filters blank products and normalizes optional strings to null', async () => {
  let productsWritten;
  const row = { ...optionalProfile, role: 'company', blocked: false, verification_documents_status: 'not_submitted' };
  const calls = [];
  const store = {
    callRpc: async (name, args) => { calls.push({ name, args }); return name === 'set_matching_categories' ? { provide: [], need: [] } : row; },
    updateProfile: async () => row,
    setMyProducts: async products => { productsWritten = products; return products; },
    companyProducts: async () => productsWritten || [],
  };
  // The module fixture has an empty category registry.
  row.provide_categories = [];
  await saveOnboardStep(store, 'details', { ...row, legal_name: '   ', registration_code: '', website: '' }, []);
  const args = calls.find(call => call.name === 'set_onboarding_details').args;
  assert.equal(args.p_legal_name, null);
  assert.equal(args.p_registration_code, null);
  assert.equal(args.p_website, null);
  const product = { name: 'Saved product', note: '', code: '001', unit: 'pcs', price: 10 };
  await saveOnboardStep(store, 'provide', row, [{ name: ' ', note: 'Unfinished' }, product]);
  assert.deepEqual(productsWritten, [product]);
});

test('verification requirements use true as fulfilled and reject malformed RPC responses', async () => {
  const { readVerificationRequirements } = context.exports;
  const requirements = { legal_name: true, registration_code: false, registration_document: true, tax_document: false };
  assert.equal(await readVerificationRequirements({ callRpc: async name => { assert.equal(name, 'verification_requirements'); return requirements; } }), requirements);
  await assert.rejects(readVerificationRequirements({ callRpc: async () => ({ legal_name: true }) }));
});
