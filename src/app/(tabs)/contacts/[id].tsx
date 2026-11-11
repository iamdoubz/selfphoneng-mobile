// SPDX-License-Identifier: AGPL-3.0-or-later
// One contact: tap a number to call it. Editing stays on the web (and in Contrack).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dial } from '../../../calls/Phone';
import { useContacts } from '../../../data';
import { Avatar } from '../../../ui/Avatar';
import { phoneNumber } from '../../../ui/format';
import { Empty, Icon, Row, Section } from '../../../ui/List';
import { space, useColors } from '../../../ui/theme';

export default function Contact() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = useContacts().data?.items.find((x) => x.id === id);
  const [error, setError] = useState('');
  if (!contact)
    return (
      <Empty
        icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_off' }}
        title="Not found"
      />
    );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
      <View style={styles.head}>
        <Avatar name={contact.name} size={96} />
        <Text style={[styles.name, { color: c.text }]}>{contact.name}</Text>
        {!!contact.company && (
          <Text style={[styles.company, { color: c.muted }]}>{contact.company}</Text>
        )}
        {!!error && <Text style={[styles.error, { color: c.red }]}>{error}</Text>}
      </View>
      {contact.numbers.length > 0 && (
        <Section>
          {contact.numbers.map((n, i) => (
            <Row
              key={i}
              title={phoneNumber(n.number)}
              subtitle={n.label || 'phone'}
              tone="tint"
              accessibilityLabel={`Call ${n.label || ''} ${n.number}`}
              right={
                <Icon name={{ ios: 'phone.fill', android: 'call' }} size={18} color={c.tint} />
              }
              onPress={() =>
                dial(n.number).catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : String(e)),
                )
              }
            />
          ))}
        </Section>
      )}
      {!!contact.email && (
        <Section>
          <Row
            title={contact.email}
            subtitle="email"
            tone="tint"
            onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
          />
        </Section>
      )}
      {!!contact.notes && (
        <Section title="Notes">
          <Row title={contact.notes} />
        </Section>
      )}
      <Text style={[styles.footer, { color: c.muted }]}>
        {contact.book === 'company' ? 'Company contact' : 'My contact'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.xs, paddingTop: space.lg },
  name: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: space.md,
    textAlign: 'center',
    paddingHorizontal: space.lg,
  },
  company: { fontSize: 17 },
  error: { fontSize: 14, marginTop: space.sm },
  footer: { fontSize: 13, textAlign: 'center', marginVertical: space.xl },
});
