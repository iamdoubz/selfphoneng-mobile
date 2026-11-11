// SPDX-License-Identifier: AGPL-3.0-or-later
// Contacts (spec 13 MB7): my book and the company's, searchable; a contact opens its numbers.
// Import copies the phone's own contacts into my book, through the web's importer (11 §3).
import type { ContactDto, ContactImportResult } from '@selfphoneng/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../../api';
import { toVcards } from '../../../contacts/vcard';
import { useContacts } from '../../../data';
import { Avatar } from '../../../ui/Avatar';
import { Empty, usePullRefresh } from '../../../ui/List';
import { space, useColors } from '../../../ui/theme';

const letter = (name: string) => {
  const l = name.trim()[0]?.toUpperCase() ?? '#';
  return /[A-Z]/.test(l) ? l : '#';
};

function matches(c: ContactDto, q: string) {
  const digits = q.replace(/\D/g, '');
  return (
    c.name.toLowerCase().includes(q) ||
    (c.company ?? '').toLowerCase().includes(q) ||
    (digits.length > 1 && c.numbers.some((n) => n.number.replace(/\D/g, '').includes(digits)))
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Reads the phone's contacts, asks the PBX what it would add, and adds them after a yes. */
async function importFromPhone(done: () => void) {
  const { granted, canAskAgain } = await requestPermissionsAsync();
  if (!granted)
    return Alert.alert(
      'No access to your contacts',
      'Allow SelfPhoneNG to read your contacts in the phone’s Settings, then try again.',
      canAskAgain
        ? undefined
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => void Linking.openSettings() },
          ],
    );
  const phone = await Contact.getAllDetails([
    ContactField.FULL_NAME,
    ContactField.COMPANY,
    ContactField.EMAILS,
    ContactField.PHONES,
  ]);
  const text = toVcards(phone.map((p) => ({ ...p, name: p.fullName ?? '' })));
  if (!text) return Alert.alert('No contacts on this phone');
  const send = (commit: boolean) =>
    api<ContactImportResult>('POST', `/api/me/contacts/import${commit ? '?commit=1' : ''}`, {
      files: [{ name: 'phone.vcf', text }],
    });
  const preview = await send(false);
  if (!preview.added)
    return Alert.alert(
      'Nothing new to import',
      `All ${plural(preview.duplicates, 'contact')} on this phone are in SelfPhoneNG already.`,
    );
  Alert.alert(
    `Import ${plural(preview.added, 'contact')}?`,
    [
      'They go in My contacts, which you can see on the web too.',
      preview.duplicates && `${plural(preview.duplicates, 'contact')} already there are skipped.`,
    ]
      .filter(Boolean)
      .join(' '),
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: () =>
          send(true).then(
            (r) => {
              done();
              Alert.alert(`Imported ${plural(r.added, 'contact')}`);
            },
            (e: unknown) =>
              Alert.alert('Import failed', e instanceof Error ? e.message : String(e)),
          ),
      },
    ],
  );
}

export default function Contacts() {
  const c = useColors();
  const book = useContacts();
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const onImport = () => {
    setImporting(true);
    importFromPhone(() => void qc.invalidateQueries({ queryKey: ['contacts'] }))
      .catch((e: unknown) =>
        Alert.alert('Import failed', e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setImporting(false));
  };
  const refresh = usePullRefresh(book.refetch);
  const [search, setSearch] = useState('');
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = (book.data?.items ?? [])
      .filter((x) => !q || matches(x, q))
      .sort((a, b) => a.name.localeCompare(b.name));
    const by = new Map<string, ContactDto[]>();
    for (const x of items) by.set(letter(x.name), [...(by.get(letter(x.name)) ?? []), x]);
    return [...by].map(([title, data]) => ({ title, data }));
  }, [book.data, search]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Contacts',
          // Contrack mode: its own importer, on the web (11 §3.1).
          headerRight:
            book.data?.provider === 'builtin'
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Import contacts from this phone"
                    disabled={importing}
                    hitSlop={8}
                    onPress={onImport}
                  >
                    {importing ? (
                      <ActivityIndicator />
                    ) : (
                      <Text style={[styles.import, { color: c.tint }]}>Import</Text>
                    )}
                  </Pressable>
                )
              : undefined,
          headerSearchBarOptions: {
            placeholder: 'Search',
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={{ backgroundColor: c.bg }}
        sections={sections}
        keyExtractor={(x) => `${x.book}:${x.id}`}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <Text style={[styles.letter, { color: c.muted, backgroundColor: c.bg }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.company ? `${item.name}, ${item.company}` : item.name}
            onPress={() => router.push({ pathname: '/contacts/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.fill }]}
          >
            <Avatar name={item.name} photo={item.photo} size={40} />
            <View style={[styles.rowBody, { borderBottomColor: c.separator }]}>
              <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
                {item.name}
              </Text>
              {!!item.company && (
                <Text numberOfLines={1} style={[styles.sub, { color: c.muted }]}>
                  {item.company}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListHeaderComponent={
          book.error ? (
            <Text style={[styles.error, { color: c.red }]}>{book.error.message}</Text>
          ) : undefined
        }
        ListEmptyComponent={
          book.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <Empty
              icon={{ ios: 'person.crop.circle', android: 'contacts' }}
              title={search ? 'No results' : 'No contacts'}
              body={
                search ? `Nothing matches “${search}”.` : 'Add contacts in SelfPhoneNG on the web.'
              }
            />
          )
        }
        refreshControl={refresh}
      />
    </>
  );
}

const styles = StyleSheet.create({
  letter: {
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, gap: space.md },
  rowBody: {
    flex: 1,
    minHeight: 60,
    justifyContent: 'center',
    paddingRight: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  import: { fontSize: 17 },
  name: { fontSize: 17 },
  sub: { fontSize: 14, marginTop: 2 },
  error: { fontSize: 14, marginHorizontal: space.lg },
  loading: { marginTop: 96 },
});
