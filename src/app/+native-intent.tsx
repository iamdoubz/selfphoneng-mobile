// SPDX-License-Identifier: AGPL-3.0-or-later
// Links from other apps. On Android a tel: number (app.json intentFilters: "Open with
// SelfPhoneNG" on a number in a web page, a text, the system dialer's share) goes to the Keypad,
// filled in. Everything else, such as selfphoneng://pair, as it came.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const tel = /^tel:([^?;]*)/i.exec(path);
    if (!tel) return path;
    const number = decodeURIComponent(tel[1]!).replace(/[^0-9*#+]/g, '');
    return number ? `/keypad?number=${encodeURIComponent(number)}` : '/keypad';
  } catch {
    return '/keypad';
  }
}
