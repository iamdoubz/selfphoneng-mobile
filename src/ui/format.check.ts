// SPDX-License-Identifier: AGPL-3.0-or-later
// node src/ui/format.check.ts
import { duration, initials, numberKey, phoneNumber, when } from './format.ts';

// No node types in this project: a two-line assert.
const assert = {
  equal: (a: unknown, b: unknown) => {
    if (a !== b) throw new Error(`${String(a)} !== ${String(b)}`);
  },
  match: (a: string, re: RegExp) => {
    if (!re.test(a)) throw new Error(`${a} !~ ${re}`);
  },
};

assert.equal(phoneNumber('13125551234'), '(312) 555-1234');
assert.equal(phoneNumber('3125551234'), '(312) 555-1234');
assert.equal(phoneNumber('100'), '100');
assert.equal(phoneNumber('+442071234567'), '+442071234567');
assert.equal(phoneNumber(null), 'Unknown');
assert.equal(numberKey('+1 (312) 555-1234'), numberKey('3125551234'));
assert.equal(duration(75), '1:15');
assert.equal(duration(-3), '0:00');
assert.equal(initials('Daniel  Doubet'), 'DD');
assert.equal(initials('cher'), 'C');
assert.equal(initials(' '), '#');
const now = new Date(2026, 10, 10, 15, 0);
assert.equal(when(new Date(2026, 10, 9, 9, 0).toISOString(), now), 'Yesterday');
assert.match(when(new Date(2026, 10, 10, 9, 5).toISOString(), now), /9:05/);
assert.match(when(new Date(2026, 9, 1).toISOString(), now), /10\/1\/26/);
console.log('format ok');
