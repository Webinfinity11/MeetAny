import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authMode, authLoginCopy, safeNext} from '../../app/lib/auth-redirect.js';
test('company role and an offer return path do not imply registration', () => {
 const url = new URL('https://meetany.local/account/?role=company&next=/offers/new/?requestId=x');
 assert.equal(authMode(url.searchParams.get('tab')), 'login');
 assert.equal(authMode('register'), 'register');
 assert.equal(authMode('reset'), 'reset');
 assert.equal(authMode('unknown'), 'login');
 assert.equal(safeNext(url.searchParams.get('next')), '/offers/new/?requestId=x');
});
test('offer copy preserves text context with a 120 character limit', () => {
 assert.equal(authLoginCopy('offer', 'სათაური', '/').title, 'შედით, რომ გაგზავნოთ შეთავაზება');
 assert.equal(authLoginCopy('offer', '<script>', '/').lead, '<script>');
 assert.equal(authLoginCopy('offer', 'ა'.repeat(121)).lead.length, 120);
 assert.equal(authLoginCopy('other', 'სათაური').lead, 'კეთილი იყოს თქვენი დაბრუნება.');
 assert.equal(authLoginCopy(null, null).title, 'შესვლა');
});
