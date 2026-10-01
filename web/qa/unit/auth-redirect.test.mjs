import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../../app/lib/auth-redirect.js';
test('next preserves local filters and anchors',()=>{
 assert.equal(safeNext('/companies/?type=distributors#distribution'),'/companies/?type=distributors#distribution');
});
test('next rejects remote and browser-normalized remote paths',()=>{
 for(const value of [null,'https://evil.example','//evil.example','/\\evil.example','/\n/evil.example','/\t/evil.example','javascript:alert(1)'])assert.equal(safeNext(value),null);
});
