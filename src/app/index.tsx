// SPDX-License-Identifier: AGPL-3.0-or-later
// Home: who this phone is paired as. Calls, voicemail, contacts and settings come in MB4–MB8.
import type { MeDto } from '@selfphoneng/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { api, signOut } from '../api';
import { useSession } from '../session';

export default function Home() {
  const session = useSession((s) => s.session);
  const qc = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDto>('GET', '/api/me'),
    enabled: !!session,
  });
  if (!session) return <Redirect href="/pair" />;
  return (
    <View style={styles.page}>
      <Text style={styles.name}>{session.name}</Text>
      <Text>{session.email}</Text>
      <Text style={styles.muted}>{session.server}</Text>
      {me.data?.extension && (
        <Text>
          Extension {me.data.extension.number} ({me.data.extension.name})
        </Text>
      )}
      {me.error && <Text style={styles.error}>{me.error.message}</Text>}
      <Text style={styles.muted}>
        Calls ring here only while the app is open. For calls you can’t miss, forward unanswered
        calls to your mobile number in My settings.
      </Text>
      <Button
        title={leaving ? 'Signing out…' : 'Sign out'}
        disabled={leaving}
        onPress={async () => {
          setLeaving(true);
          await signOut().catch(() => {});
          qc.clear();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 12 },
  name: { fontSize: 22, fontWeight: '600' },
  muted: { color: '#71717a' },
  error: { color: '#b91c1c' },
});
