// SPDX-License-Identifier: AGPL-3.0-or-later
// The phone's contacts as vCard 3.0 text for the PBX's importer (POST /api/me/contacts/import,
// spec 11 §3), which dedupes, labels the numbers and shows what it would add before it does.

export type PhoneContact = {
  name: string;
  company?: string | null;
  emails?: { address?: string }[];
  phones?: { label?: string; number?: string }[];
};

/** RFC 6350 §3.4: backslash, comma, semicolon and newlines. */
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

export function toVcards(list: PhoneContact[]): string {
  const cards: string[] = [];
  for (const c of list) {
    const phones = (c.phones ?? []).filter((p) => p.number?.trim());
    const name = c.name.trim() || c.company?.trim() || '';
    if (!name && !phones.length) continue; // the importer would call it an error
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(name)}`];
    if (c.company?.trim()) lines.push(`ORG:${esc(c.company.trim())}`);
    const email = c.emails?.find((e) => e.address?.trim())?.address?.trim();
    if (email) lines.push(`EMAIL:${esc(email)}`);
    phones.forEach((p, i) => {
      // The label as the phone has it ("mobile", iOS's "_$!<Mobile>!$_"): the importer reads
      // Apple's X-ABLABEL and tidies it the same way. None → "other".
      const number = esc(p.number!.trim());
      if (!p.label?.trim()) lines.push(`TEL:${number}`);
      else lines.push(`item${i}.TEL:${number}`, `item${i}.X-ABLABEL:${esc(p.label.trim())}`);
    });
    lines.push('END:VCARD');
    cards.push(lines.join('\r\n'));
  }
  return cards.join('\r\n');
}
