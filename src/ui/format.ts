// SPDX-License-Identifier: AGPL-3.0-or-later
// Numbers, dates and durations as the phone's own apps show them.

/** 13125551234 or 3125551234 → (312) 555-1234; anything else as it came. */
export function phoneNumber(n: string | null | undefined): string {
  if (!n) return 'Unknown';
  const d = n.replace(/\D/g, '');
  const us = d.length === 11 && d[0] === '1' ? d.slice(1) : d.length === 10 ? d : null;
  // ponytail: North American only, the PBX's own normalizing (00 §8); add others when it does
  return us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : n;
}

/** The key two spellings of one number share: the last 10 digits (or all of a short one). */
export const numberKey = (n: string) => n.replace(/\D/g, '').slice(-10);

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Recents style: 3:22 PM today, Yesterday, Tuesday this week, else 11/2/26. */
export function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  if (now.getTime() - d.getTime() < 6 * 86400_000)
    return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
}

/** 75 → 1:15 */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '#';
}
