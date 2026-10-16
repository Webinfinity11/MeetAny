import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../../app/components/market/AdminDeals.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the actual loading effect and error view, including a copied URL.
// Timers run immediately; the RPC is the only external dependency replaced.
async function renderDeals(cursor, response = { items: [], stageCounts: {}, filteredTotal: 0 }) {
  const states = [], calls = [], changes = [];
  let index = 0, effects = true;
  const jsx = (type, props) => ({ type, props });
  const context = { exports: {}, window: { setTimeout: fn => { fn(); return 1; }, clearTimeout() {} }, require: name => {
    if (name === 'react') return {
      useState(initial) { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useEffect(fn) { if (effects) fn(); },
    };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name.endsWith('/admin-deals')) return {
      dealStages: ['selected', 'cancelled'], dealStageLabels: {},
      async listAdminDeals(_store, args) { calls.push(args); if (response instanceof Error) throw response; return response; },
    };
    if (name.endsWith('/use-admin-data')) return { adminErrorMessage: () => 'ჩანაწერები ვერ ჩაიტვირთა.' };
    if (name.endsWith('/AdminState')) return { AdminState: 'AdminState' };
    if (name.endsWith('.css')) return { default: {} };
    return {};
  } };
  vm.runInNewContext(compiled, context);
  const props = { store: {}, revision: 0, stage: 'cancelled', query: 'QA', cursor, onChange: (...args) => changes.push(args) };
  context.exports.AdminDeals(props);
  await new Promise(resolve => setImmediate(resolve));
  effects = false; index = 0;
  const tree = context.exports.AdminDeals(props);
  const find = value => !value || typeof value !== 'object' ? null : value.type === 'AdminState' ? value : Object.values(value).map(find).find(Boolean);
  return { state: states[0], calls, changes, errorView: find(tree) };
}

test('malformed deal cursor settles into a recoverable error without an RPC or uncaught exception', async () => {
  const result = await renderDeals('{bad');
  assert.equal(result.calls.length, 0);
  assert.match(result.state.error, /ბმული არასწორია/);
  assert.equal(result.errorView.props.error, true);
  result.errorView.props.onFirst();
  assert.deepEqual(result.changes, [['cursor', '']]);
});

test('a valid cursor preserves the selected stage and query when loading its page', async () => {
  const cursor = { id: 'record', created_at: '2026-10-16T10:00:00Z', asOf: '2026-10-16T11:00:00Z' };
  const result = await renderDeals(JSON.stringify(cursor));
  assert.deepEqual(JSON.parse(JSON.stringify(result.calls)), [{ p_stage: 'cancelled', p_query: 'QA', p_cursor: cursor }]);
  assert.ok(result.state.page);
  assert.equal(result.state.error, undefined);
});

test('a server-rejected cursor also offers first-page recovery, while ordinary errors retain retry', async () => {
  const bad = await renderDeals('{}', new Error('invalid cursor'));
  assert.equal(bad.errorView.props.error, true);
  assert.equal(typeof bad.errorView.props.onRetry, 'function');
  assert.equal(typeof bad.errorView.props.onFirst, 'function');
  const initial = await renderDeals('', new Error('offline'));
  assert.equal(initial.errorView.props.onFirst, undefined);
  assert.equal(typeof initial.errorView.props.onRetry, 'function');
});
