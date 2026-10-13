import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSources, onScale } from '../../scripts/lint-design.mjs';
const check = (tokens = '', css = '', tsx = '', options = {}) => lintSources(new Map([
  ['app/styles/tokens.css', `:root { ${tokens} }`],
  ['app/sample.module.css', css],
  ['app/sample.tsx', tsx],
]), options);

test('სკალა: 4px 64-მდე, შემდეგ 8px; ახალი გამონაკლისი ვერ გაივლის', () => {
  for (const n of [0, 4, 44, 64, 72, 96, 1200]) assert.equal(onScale(n), true);
  for (const n of [-4, 1, 42, 65, 68, 76, 1.5]) assert.equal(onScale(n), false);
  for (const name of ['space-new', 'size-new', 'btn-h-new', 'field-h-new']) {
    assert.equal(check(`--${name}:42px;`).length, 1);
    assert.equal(check(`--${name}:44px;`).length, 0);
  }
});
test('ბმულები და calc მოწმდება; არარსებული და ციკლური ბმულები ვერ გაივლის', () => {
  assert.deepEqual(check('--control:44px;--btn-h:var(--control);--size-new:calc(var(--btn-h) + 8px);'), []);
  assert.equal(check('--source:42px;--size-new:var(--source);').length, 1);
  assert.equal(check('--size-new:var(--missing);').length, 1);
  assert.equal(check('--size-a:var(--size-b);--size-b:var(--size-a);').length, 2);
  assert.equal(check('--size-new:1rem;').length, 1);
});
test('რადიუსები ფიქსირებული სიით და ძველი გამონაკლისი ზუსტი მნიშვნელობით', () => {
  assert.deepEqual(check('--radius-new:12px;--radius-circle:50%;'), []);
  assert.equal(check('--radius-new:20px;').length, 1);
  assert.deepEqual(check('--size-42:42px;'), []);
  assert.equal(check('--size-42:43px;').length, 1);
  assert.equal(check('--size-new:42px;').length, 1);
  assert.equal(check('--size-42:42px;', '', '', {allowLegacy:false}).length, 1);
  assert.equal(check('--theme-radius:10px;--radius-xs:calc(var(--theme-radius) * .6);').length, 1);
});
test('ნედლი px calc-ში ყველა განლაგების თვისებაზე იძლევა ფაილსა და ხაზს', () => {
  for (const prop of ['min-height','height','width','padding','padding-inline','margin','margin-top','gap','row-gap']) {
    const errors = check('', `.tile {\n${prop}:calc(100% - 3px);\n}`);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^app\/sample.module.css:2:.*calc/);
  }
  assert.deepEqual(check('--space-2:8px;', '.tile {padding:calc(var(--space-2) + env(safe-area-inset-bottom))}'), []);
});
test('კონტროლის სიმაღლე სკალაზე და მინიმუმ 44px; შიდა ხატულა და ფსევდოელემენტი ცალკეა', () => {
  const tokens = '--control:44px;--btn-h:var(--control);--field-h:44px;--size-20:20px;--size-44:44px;--size-68:68px;';
  assert.deepEqual(check(tokens.replace('--size-68:68px;', ''), '.ma-btn {height:var(--btn-h)} input {min-height:var(--field-h)} button .icon, button::after {height:var(--size-20)}'), []);
  const errors = check(tokens, 'button {height:var(--size-20)} .ma-input {height:var(--size-68)} [role="button"] {height:var(--size-20)}');
  assert.equal(errors.length, 4);
});
test('TSX inline რიცხვები იკრძალება; Image props და SVG ნებადართულია', () => {
  const errors = check('', '', 'const A = () => <div style={{height: 44, "width": -8}} />;');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^app\/sample.tsx:1:/);
  assert.deepEqual(check('', '', 'const A = () => <><Image width={96} height={48}/><svg style={{width:24}}><rect style={{height:16}} /></svg><div style={{width:"var(--size-44)"}} /></>;'), []);
  assert.equal(check('', '', 'const A = () => <Image style={{height:48}} width={96} height={48}/>;').length, 1);
});
test('არსებული gradient, ნედლი ფერი და Button წესები შენარჩუნებულია', () => {
  assert.equal(check('', '.tile {background:linear-gradient(red, blue)}').length, 1);
  assert.equal(check('', '.tile {color:#fff}').length, 1);
  assert.deepEqual(check('', '.tile {mask-image:linear-gradient(black, transparent)}'), []);
  assert.equal(check('', '', 'const A = () => <button className="ma-btn"/>;').length, 1);
});
