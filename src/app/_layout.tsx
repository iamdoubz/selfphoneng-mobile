// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useSession } from '../session';

const queryClient = new QueryClient();

export default function RootLayout() {
  const loaded = useSession((s) => s.loaded);
  // The splash screen stays up while secure storage is read.
  if (!loaded) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'SelfPhoneNG' }} />
        <Stack.Screen name="pair" options={{ title: 'Pair this phone' }} />
      </Stack>
    </QueryClientProvider>
  );
}
