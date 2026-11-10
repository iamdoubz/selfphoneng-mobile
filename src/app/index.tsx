// SPDX-License-Identifier: AGPL-3.0-or-later
// Home: who this phone is paired as, and the phone (MB4). History, voicemail, contacts and
// settings come in MB5–MB8.
import type { MeDto } from '@selfphoneng/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { api, signOut } from '../api';
import { Phone } from '../calls/Phone';
import { stopPhone } from '../calls/native';
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
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.name}>{session.name}</Text>
      <Text>{session.email}</Text>
      <Text style={styles.muted}>{session.server}</Text>
      {me.data?.extension && (
        <Text>
          Extension {me.data.extension.number} ({me.data.extension.name})
        </Text>
      )}
      {me.error && <Text style={styles.error}>{me.error.message}</Text>}
      {me.data?.extension && <Phone />}
      <Text style={styles.muted}>
        Calls ring here only while the app is open. For calls you can’t miss, forward unanswered
        calls to your mobile number in My settings.
      </Text>
      <Button
        title={leaving ? 'Signing out…' : 'Sign out'}
        disabled={leaving}
        onPress={async () => {
          setLeaving(true);
          // Unregister first: the token it needs is gone after signing out.
          await stopPhone().catch(() => {});
          await signOut().catch(() => {});
          qc.clear();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 12 },
  name: { fontSize: 22, fontWeight: '600' },
  muted: { color: '#71717a' },
  error: { color: '#b91c1c' },
});
