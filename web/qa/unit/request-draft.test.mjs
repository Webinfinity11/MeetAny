import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../app/lib/request-draft.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const empty = { title: '', category: '', city: 'tbilisi', addressNote: '', quantity: '', unit: 'piece', neededByText: '', body: '' };
const key = 'meetany.requestDraft';
function setup(blocked = false) {
  const data = new Map();
  const storage = {
    getItem(name) { if (blocked) throw new Error('blocked'); return data.get(name) ?? null; },
    setItem(name, value) { if (blocked) throw new Error('blocked'); data.set(name, value); },
    removeItem(name) { if (blocked) throw new Error('blocked'); data.delete(name); },
  };
  const context = { exports: {}, sessionStorage: storage, Date };
  vm.runInNewContext(source, context);
  return { api: context.exports, data };
}
test('untouched form defaults do not create an unfinished request', () => {
  const { api, data } = setup();
  api.saveRequestDraft(empty);
  assert.equal(api.readRequestDraft(), null);
  assert.equal(data.size, 0);
  data.set(key, JSON.stringify({ ...empty, at: Date.now() }));
  assert.equal(api.readRequestDraft(), null);
});
test('meaningful content survives navigation, and erasing it clears the draft', () => {
  const { api, data } = setup();
  api.saveRequestDraft({ ...empty, body: 'გვჭირდება 10 მაგიდა' });
  assert.equal(api.readRequestDraft()?.body, 'გვჭირდება 10 მაგიდა');
  api.saveRequestDraft({ ...empty, title: '  ', body: '\n' });
  assert.equal(data.has(key), false);
});
test('expired and malformed drafts are ignored', () => {
  const { api, data } = setup();
  for (const raw of ['{', JSON.stringify({ ...empty, title: 'მაგიდები', at: Date.now() - 31 * 60_000 }), JSON.stringify({ ...empty, title: 42, at: Date.now() })]) {
    data.set(key, raw);
    assert.equal(api.readRequestDraft(), null);
  }
});
test('disabled storage does not break the request form', () => {
  const { api } = setup(true);
  assert.doesNotThrow(() => api.saveRequestDraft({ ...empty, title: 'მაგიდები' }));
  assert.doesNotThrow(() => api.clearRequestDraft());
  assert.equal(api.readRequestDraft(), null);
});
test('specification and budget-only drafts survive navigation without legacy text', () => {
 const {api}=setup();
 for(const preferences of [{specification:'მუხა, 120 × 80 სმ'},{budgetType:'range',budgetMin:100,budgetMax:200},{supplierTypes:['manufacturer']}]) {
  api.saveRequestDraft({...empty,preferences});
  assert.deepEqual(JSON.parse(JSON.stringify(api.readRequestDraft().preferences)),preferences);
 }
 api.saveRequestDraft({...empty,preferences:{budgetType:'negotiable',flexibility:0}});
 assert.equal(api.readRequestDraft(),null);
});
