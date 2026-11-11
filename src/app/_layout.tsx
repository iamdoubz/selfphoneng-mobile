// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '../session';
import { useColors } from '../ui/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  const loaded = useSession((s) => s.loaded);
  const c = useColors();
  // The splash screen stays up while secure storage is read.
  if (!loaded) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="pair"
          options={{
            headerShown: true,
            title: 'Pair this phone',
            headerLargeTitle: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg as string },
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
