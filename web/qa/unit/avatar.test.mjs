import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarInitials } from '../../app/lib/avatar-initials.js';

test('quotes and punctuation never count as letters', () => {
  assert.equal(avatarInitials('შპს „ხის სახლი“'), 'ხს');
  assert.equal(avatarInitials('"Alpha" Wood'), 'AW');
  assert.equal(avatarInitials('«ბეტა»'), 'ბე');
  assert.equal(avatarInitials('„“ — ! Wood-Line'), 'WO');
  assert.equal(avatarInitials("'ok'"), 'OK');
});

test('legal forms are skipped, with or without punctuation', () => {
  assert.equal(avatarInitials('შპს. მეტალი'), 'მე');
  assert.equal(avatarInitials('ი/მ გიორგი ბერიძე'), 'გბ');
  assert.equal(avatarInitials('Acme LLC.'), 'AC');
});

test('Georgian stays mkhedruli, Latin is upper-cased', () => {
  assert.equal(avatarInitials('ნიკა ბერიძე'), 'ნბ');
  assert.equal(avatarInitials('ᲜᲘᲙᲐ ᲑᲔᲠᲘᲫᲔ'), 'ნბ');
  assert.equal(avatarInitials('émile zola'), 'ÉZ');
  assert.equal(avatarInitials('wood'), 'WO');
});

test('names without letters fall back to a question mark', () => {
  for (const name of ['', '   ', '„“', '123', null, undefined]) assert.equal(avatarInitials(name), '?');
});
