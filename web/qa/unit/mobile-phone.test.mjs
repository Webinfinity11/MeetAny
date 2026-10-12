import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMobilePhone } from '../../app/lib/mobile-phone.js';
test('Georgian local and international mobile numbers have one storage format', () => {
  for (const input of ['599770002', '0599770002', '+995 599 770 002', '995599770002']) assert.equal(normalizeMobilePhone(input), '+995 599 770 002');
});
test('A country prefix, incomplete mobile number or landline is not a registration phone', () => {
  for (const input of ['', '+995', '+995 599 770', '5997700029', '+995 32 222 22 22']) assert.equal(normalizeMobilePhone(input), null);
});
