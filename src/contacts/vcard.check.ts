// SPDX-License-Identifier: AGPL-3.0-or-later
// node src/contacts/vcard.check.ts (and, from the PBX's parser, the same contacts back)
import { toVcards } from './vcard.ts';

const assert = (ok: boolean, what: string) => {
  if (!ok) throw new Error(what);
};

const v = toVcards([
  {
    name: 'Smith, Jane; Jr',
    company: 'Acme\nInc',
    emails: [{ address: '' }, { address: 'jane@example.com' }],
    phones: [
      { label: '_$!<Mobile>!$_', number: '+1 312 555 1234' },
      { number: '100' },
      { number: ' ' },
    ],
  },
  { name: ' ', phones: [] }, // nothing to import: left out
]);
const lines = v.split('\r\n');
assert(lines.filter((l) => l === 'BEGIN:VCARD').length === 1, 'one card');
assert(lines.includes('FN:Smith\\, Jane\\; Jr'), 'FN escaped');
assert(lines.includes('ORG:Acme\\nInc'), 'ORG newline escaped');
assert(lines.includes('EMAIL:jane@example.com'), 'first non-empty email');
assert(lines.includes('item0.TEL:+1 312 555 1234'), 'labelled number');
assert(lines.includes('item0.X-ABLABEL:_$!<Mobile>!$_'), 'its label');
assert(lines.includes('TEL:100'), 'unlabelled number');
assert(lines.filter((l) => l.includes('TEL')).length === 2, 'blank number dropped');
assert(toVcards([{ name: '', company: 'Acme' }]).includes('FN:Acme'), 'company as name');
console.log('vcard ok');
