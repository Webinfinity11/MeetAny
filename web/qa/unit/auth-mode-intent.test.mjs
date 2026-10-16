import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authMode, authLoginCopy, safeNext, safeOnboardingNext, onboardingHref} from '../../app/lib/auth-redirect.js';
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

test('company setup retains the safe original task through every step', () => {
 const target = '/offers/new/?requestId=abc&context=desk#details';
 for (const step of ['type', 'details', 'profile', 'provide', 'need', 'verify', 'review']) {
  const url = new URL(onboardingHref(step, target), 'https://meetany.local');
  assert.equal(url.pathname, '/onboarding/');
  assert.equal(url.searchParams.get('step'), step);
  assert.equal(url.searchParams.get('next'), target);
  assert.equal(safeOnboardingNext(url.searchParams.get('next')), target);
 }
});
test('setup continuation rejects external URLs and self loops, including encoded paths', () => {
 for (const value of ['https://evil.test/', '//evil.test/', '/\\evil.test/', 'javascript:alert(1)', '/onboarding/', '/onboarding/?step=review', '/%6fnboarding/?step=type', '/onboarding/?next=%2Fonboarding%2F']) {
  assert.equal(safeOnboardingNext(value), null, value);
  assert.equal(onboardingHref('type', value), '/onboarding/?step=type', value);
 }
 assert.equal(safeOnboardingNext('/onboarding/?next=%2Frequests%2Fnew%2F'), '/requests/new/');
 assert.equal(safeOnboardingNext('/onboarding/?next=https%3A%2F%2Fevil.test'), null);
});
