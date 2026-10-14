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

test('complete tokens wrap into two rows before showing an overflow count', async () => {
 const { visibleTokenCount } = await import('../../app/components/ui/combobox-selection.js');
 assert.equal(visibleTokenCount([120,120,120,120],260,8,40),4);
 assert.equal(visibleTokenCount([240,240],260,8,40),2);
 assert.equal(visibleTokenCount([240,240,240],260,8,40),1);
 assert.equal(visibleTokenCount([90,90,90,90,90],260,8,40),4);
 assert.equal(visibleTokenCount([400,90],260,8,40),2);
 assert.equal(visibleTokenCount([],260,8,40),0);
});
