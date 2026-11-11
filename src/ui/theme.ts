// SPDX-License-Identifier: AGPL-3.0-or-later
// Colours as roles, never raw hex in a screen. iPhone: the system's own colours, so light, dark
// and Increase Contrast follow the phone. Android: the same roles in two hand-picked sets.
import { Platform, PlatformColor, useColorScheme, type ColorValue } from 'react-native';

export type Colors = {
  bg: ColorValue;
  card: ColorValue;
  text: ColorValue;
  muted: ColorValue;
  faint: ColorValue;
  separator: ColorValue;
  fill: ColorValue;
  tint: ColorValue;
  green: ColorValue;
  red: ColorValue;
};

const ios: Colors = {
  bg: PlatformColor('systemGroupedBackground'),
  card: PlatformColor('secondarySystemGroupedBackground'),
  text: PlatformColor('label'),
  muted: PlatformColor('secondaryLabel'),
  faint: PlatformColor('tertiaryLabel'),
  separator: PlatformColor('separator'),
  fill: PlatformColor('tertiarySystemFill'),
  tint: PlatformColor('systemBlue'),
  green: PlatformColor('systemGreen'),
  red: PlatformColor('systemRed'),
};

const light: Colors = {
  bg: '#f2f2f7',
  card: '#ffffff',
  text: '#000000',
  muted: '#5c5c63',
  faint: '#8e8e93',
  separator: '#d1d1d6',
  fill: '#e5e5ea',
  tint: '#0a64d8',
  green: '#1f8f3a',
  red: '#d70015',
};

const dark: Colors = {
  bg: '#000000',
  card: '#1c1c1e',
  text: '#ffffff',
  muted: '#aeaeb2',
  faint: '#8e8e93',
  separator: '#38383a',
  fill: '#2c2c2e',
  tint: '#409cff',
  green: '#30d158',
  red: '#ff453a',
};

export function useColors(): Colors {
  const scheme = useColorScheme();
  if (Platform.OS === 'ios') return ios;
  return scheme === 'dark' ? dark : light;
}

/** The in-call screen is dark in both themes, like the phone's own. */
export const call = {
  bg: '#101012',
  text: '#ffffff',
  muted: '#aeaeb2',
  button: 'rgba(255,255,255,0.16)',
  buttonOn: '#ffffff',
  green: '#30d158',
  red: '#ff3b30',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { card: 22, button: 14 };
