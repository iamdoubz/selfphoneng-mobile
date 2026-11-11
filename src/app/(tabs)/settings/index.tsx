// SPDX-License-Identifier: AGPL-3.0-or-later
// Settings: who this phone is paired as, the phone's state, Do Not Disturb, and Sign out.
// Forwarding, voicemail PIN and greetings are MB8; until then they're shown, and set on the web.
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { signOut } from '../../../api';
import { STATUS, usePhone, usePhoneError } from '../../../calls/Phone';
import { stopPhone } from '../../../calls/native';
import { useMe, useUpdateMe } from '../../../data';
import { useSession } from '../../../session';
import { Avatar } from '../../../ui/Avatar';
import { phoneNumber } from '../../../ui/format';
import { Badge, Row, Section } from '../../../ui/List';
import { space, useColors } from '../../../ui/theme';

const forward = (n: string | null | undefined) => (n ? phoneNumber(n) : 'Off');

export default function Settings() {
  const c = useColors();
  const qc = useQueryClient();
  const session = useSession((s) => s.session);
  const me = useMe();
  const update = useUpdateMe();
  const { reg } = usePhone();
  const startError = usePhoneError((s) => s.error);
  const [leaving, setLeaving] = useState(false);
  if (!session) return null;
  const m = me.data;

  const leave = () =>
    Alert.alert('Sign out?', 'This phone stops ringing and leaves your devices on the web.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          // Unregister first: the token it needs is gone after signing out.
          await stopPhone().catch(() => {});
          await signOut().catch(() => {});
          qc.clear();
        },
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Section>
        <Row
          left={<Avatar name={session.name} size={56} />}
          title={session.name}
          subtitle={session.email}
        />
      </Section>
      {(me.error || update.error) && (
        <Text style={[styles.error, { color: c.red }]}>{(me.error ?? update.error)?.message}</Text>
      )}

      <Section
        title="Phone"
        footer="Calls ring here only while the app is open. For calls you can’t miss, forward unanswered calls to your mobile number."
      >
        <Row
          left={<Badge name={{ ios: 'phone.fill', android: 'call' }} color={c.green} />}
          title="Extension"
          value={m ? `${m.extension.number} · ${m.extension.name}` : '…'}
        />
        <Row
          left={
            <Badge
              name={{ ios: 'antenna.radiowaves.left.and.right', android: 'cell_tower' }}
              color={c.tint}
            />
          }
          title="Status"
          value={startError ? STATUS.error : STATUS[reg]}
          subtitle={startError || undefined}
        />
        <Row
          left={<Badge name={{ ios: 'moon.fill', android: 'do_not_disturb_on' }} color="#5e5ce6" />}
          title="Do Not Disturb"
          right={
            <Switch
              accessibilityLabel="Do Not Disturb"
              value={m?.dnd ?? false}
              disabled={!m || update.isPending}
              onValueChange={(dnd) => update.mutate({ dnd })}
            />
          }
        />
      </Section>

      <Section title="Forwarding" footer="Change these in My settings on the web.">
        <Row title="Always" value={forward(m?.cfu)} />
        <Row title="When busy" value={forward(m?.cfb)} />
        <Row title="When not answered" value={forward(m?.cfna)} />
      </Section>

      <Section title="Voicemail">
        <Row
          left={<Badge name={{ ios: 'envelope.fill', android: 'mail' }} color={c.tint} />}
          title="Email me new messages"
          right={
            <Switch
              accessibilityLabel="Email me new voicemail"
              value={m?.voicemailEmail ?? false}
              disabled={!m || update.isPending}
              onValueChange={(voicemailEmail) => update.mutate({ voicemailEmail })}
            />
          }
        />
      </Section>

      <Section title="Server">
        <Row title={session.server.replace(/^https:\/\//, '')} />
      </Section>

      <Section style={styles.last}>
        <Row
          title={leaving ? 'Signing out…' : 'Sign out'}
          tone="danger"
          onPress={leaving ? undefined : leave}
        />
      </Section>
      <View style={styles.bottom} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, marginHorizontal: space.xxl, marginTop: space.sm },
  last: { marginTop: space.xxl },
  bottom: { height: space.xxl },
});
