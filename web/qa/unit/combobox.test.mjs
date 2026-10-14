import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleSelection, creationValue } from '../../app/components/ui/combobox-selection.js';
test('selection respects limits and allows removal at the limit', () => {
 assert.deepEqual(toggleSelection(['a','b'],'c',2),['a','b']);
 assert.deepEqual(toggleSelection(['a','b'],'a',2),['b']);
});
test('exclusive city clears other cities, and a city replaces the exclusive value', () => {
 assert.deepEqual(toggleSelection(['tbilisi','batumi'],'georgia',2,'georgia'),['georgia']);
 assert.deepEqual(toggleSelection(['georgia'],'tbilisi',1,'georgia'),['tbilisi']);
});
test('creation trims text and rejects duplicate labels, values and oversized text', () => {
 const options=[{label:'თბილისი',value:'tbilisi'}];
 assert.equal(creationValue(' თბილისი ',options,[],120),'');
 assert.equal(creationValue('TBILISI',options,[],120),'');
 assert.equal(creationValue(' new ',options,[],120),'new');
 assert.equal(creationValue('NEW',options,['new'],120),'');
 assert.equal(creationValue('abcd',options,[],3),'');
 assert.equal(creationValue(' ',options,[],120),'');
});
