// SPDX-License-Identifier: AGPL-3.0-or-later
// The paired server and this phone's device token (spec 13 §2), kept in the phone's secure storage.
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type Session = { server: string; token: string; name: string; email: string };

const KEY = 'session';

export const useSession = create<{
  loaded: boolean;
  session: Session | null;
  set: (s: Session | null) => Promise<void>;
}>((setState) => ({
  loaded: false,
  session: null,
  set: async (session) => {
    if (session) await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(KEY);
    setState({ session });
  },
}));

SecureStore.getItemAsync(KEY).then(
  (v) => useSession.setState({ loaded: true, session: v ? (JSON.parse(v) as Session) : null }),
  () => useSession.setState({ loaded: true }),
);
