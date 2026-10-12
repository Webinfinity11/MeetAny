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
const { onboardWrites, retainOnboardDraft, stepsFor } = context.exports;

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
