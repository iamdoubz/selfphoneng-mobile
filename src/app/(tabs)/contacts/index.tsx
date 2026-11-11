// SPDX-License-Identifier: AGPL-3.0-or-later
// Contacts (spec 13 MB7): my book and the company's, searchable; a contact opens its numbers.
import type { ContactDto } from '@selfphoneng/shared';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useContacts } from '../../../data';
import { Avatar } from '../../../ui/Avatar';
import { Empty } from '../../../ui/List';
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

export default function Contacts() {
  const c = useColors();
  const book = useContacts();
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
            <Avatar name={item.name} size={40} />
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
        refreshControl={
          <RefreshControl refreshing={book.isRefetching} onRefresh={() => void book.refetch()} />
        }
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
  name: { fontSize: 17 },
  sub: { fontSize: 14, marginTop: 2 },
  error: { fontSize: 14, marginHorizontal: space.lg },
  loading: { marginTop: 96 },
});
