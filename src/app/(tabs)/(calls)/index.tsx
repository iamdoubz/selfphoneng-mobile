// SPDX-License-Identifier: AGPL-3.0-or-later
// Calls (spec 13 MB5): my call history as the web's Calls page has it; tap one to call back.
import type { ListResponse, MyCallDto } from '@selfphoneng/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../../api';
import { dial } from '../../../calls/Phone';
import { useNames } from '../../../data';
import { duration, phoneNumber, when } from '../../../ui/format';
import { Empty, Icon, usePullRefresh } from '../../../ui/List';
import { space, useColors } from '../../../ui/theme';

const other = (c: MyCallDto) => (c.myRole === 'out' ? c.toNumber : c.fromNumber);

function Segments({ value, onChange }: { value: boolean; onChange: (missed: boolean) => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="tablist" style={[styles.segments, { backgroundColor: c.fill }]}>
      {(['All', 'Missed'] as const).map((label) => {
        const on = (label === 'Missed') === value;
        return (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(label === 'Missed')}
            style={[styles.segment, on && { backgroundColor: c.card }]}
          >
            <Text style={[styles.segmentText, { color: c.text }, on && styles.segmentOn]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CallRow({
  call,
  name,
  onError,
}: {
  call: MyCallDto;
  name: string | null;
  onError: (m: string) => void;
}) {
  const c = useColors();
  const number = other(call);
  const missed = call.missedByMe;
  const what = missed
    ? 'Missed'
    : call.myRole === 'out'
      ? call.answeredAt
        ? `Outgoing · ${duration(call.talkSeconds)}`
        : 'Outgoing · no answer'
      : `Incoming · ${duration(call.talkSeconds)}`;
  const title = name ?? phoneNumber(number);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${what}, ${when(call.startedAt)}. Call back`}
      accessibilityHint={number ? undefined : 'The number is unknown'}
      disabled={!number}
      onPress={() =>
        number &&
        dial(number).catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)))
      }
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.fill }]}
    >
      <View style={styles.dir}>
        {call.myRole === 'out' && (
          <Icon
            name={{ ios: 'phone.arrow.up.right.fill', android: 'call_made' }}
            size={13}
            color={c.faint}
          />
        )}
      </View>
      <View style={[styles.rowBody, { borderBottomColor: c.separator }]}>
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.name, { color: missed ? c.red : c.text }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.sub, { color: c.muted }]}>
            {name && number ? `${phoneNumber(number)} · ${what}` : what}
          </Text>
        </View>
        <Text style={[styles.time, { color: c.muted }]}>{when(call.startedAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function Calls() {
  const c = useColors();
  const names = useNames();
  const [missed, setMissed] = useState(false);
  const [error, setError] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['calls'],
    queryFn: ({ pageParam }) =>
      api<ListResponse<MyCallDto>>(
        'GET',
        `/api/me/calls?limit=50${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: 60_000,
  });
  const refresh = usePullRefresh(q.refetch);
  const all = q.data?.pages.flatMap((p) => p.items) ?? [];
  const items = missed ? all.filter((x) => x.missedByMe) : all;
  return (
    <>
      <Stack.Screen options={{ title: 'Calls' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.bg }}
        data={items}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <CallRow
            call={item}
            name={(item.myRole === 'in' ? item.fromName : null) ?? names(other(item))}
            onError={setError}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Segments value={missed} onChange={setMissed} />
            {!!(error || q.error) && (
              <Text style={[styles.error, { color: c.red }]}>{error || q.error?.message}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <Empty
              icon={{ ios: 'clock', android: 'history' }}
              title={missed ? 'No missed calls' : 'No calls yet'}
              body="Calls to and from your extension show here."
            />
          )
        }
        ListFooterComponent={
          q.isFetchingNextPage ? <ActivityIndicator style={styles.more} /> : undefined
        }
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        refreshControl={refresh}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  segments: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segment: {
    flex: 1,
    minHeight: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 14 },
  segmentOn: { fontWeight: '600' },
  error: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingLeft: space.sm },
  dir: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingRight: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  sub: { fontSize: 14 },
  time: { fontSize: 15 },
  loading: { marginTop: 96 },
  more: { margin: space.lg },
});
