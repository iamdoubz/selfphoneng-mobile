// SPDX-License-Identifier: AGPL-3.0-or-later
// Each tab's own stack, for its large title (and the screens it pushes, like a contact).
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useColors } from './theme';

export function TabStack() {
  const c = useColors();
  const ios = Platform.OS === 'ios';
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        // iPhone: content scrolls under a see-through bar, as the system apps do. Lists set
        // contentInsetAdjustmentBehavior="automatic" so nothing starts hidden behind it.
        headerTransparent: ios,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: ios ? undefined : { backgroundColor: c.bg as string },
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}
