// SPDX-License-Identifier: AGPL-3.0-or-later
// Voicemail (spec 13 MB6): the list, play (which marks it heard), the transcript, call back, delete.
import type { VoicemailDto } from '@selfphoneng/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../../api';
import { dial } from '../../../calls/Phone';
import { unheard, useNames, useVoicemail } from '../../../data';
import { useSession } from '../../../session';
import { duration, phoneNumber, when } from '../../../ui/format';
import { Empty, Icon } from '../../../ui/List';
import { radius, space, useColors } from '../../../ui/theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Mounted only for the open message, so one player at a time. */
function Player({ vm, onError }: { vm: VoicemailDto; onError: (m: string) => void }) {
  const c = useColors();
  const qc = useQueryClient();
  const session = useSession((s) => s.session)!;
  const player = useAudioPlayer({
    uri: `${session.server}/api/me/voicemail/${vm.id}/audio`,
    headers: { authorization: `Bearer ${session.token}` },
  });
  const status = useAudioPlayerStatus(player);
  const total = status.duration || vm.durationS;
  const at = Math.min(status.currentTime, total);
  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);
  const toggle = () => {
    if (status.playing) return player.pause();
    player.play();
    if (unheard(vm))
      api('PATCH', `/api/me/voicemail/${vm.id}`, { folder: 'Old' }).then(
        () => qc.invalidateQueries({ queryKey: ['voicemail'] }),
        (e: unknown) => onError(message(e)),
      );
  };
  return (
    <View style={styles.player}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
        hitSlop={12}
        onPress={toggle}
      >
        <Icon
          name={
            status.playing
              ? { ios: 'pause.circle.fill', android: 'pause_circle' }
              : { ios: 'play.circle.fill', android: 'play_circle' }
          }
          size={40}
          color={c.tint}
        />
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.bar, { backgroundColor: c.fill }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: c.tint, width: `${total ? (at / total) * 100 : 0}%` },
            ]}
          />
        </View>
        <View style={styles.times}>
          <Text style={[styles.time, { color: c.muted }]}>{duration(at)}</Text>
          <Text style={[styles.time, { color: c.muted }]}>-{duration(total - at)}</Text>
        </View>
      </View>
    </View>
  );
}

function Message({
  vm,
  name,
  open,
  onOpen,
}: {
  vm: VoicemailDto;
  name: string | null;
  open: boolean;
  onOpen: () => void;
}) {
  const c = useColors();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const title = name ?? phoneNumber(vm.callerNumber);
  const remove = () =>
    Alert.alert('Delete this voicemail?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          api('DELETE', `/api/me/voicemail/${vm.id}`).then(
            () => qc.invalidateQueries({ queryKey: ['voicemail'] }),
            (e: unknown) => setError(message(e)),
          ),
      },
    ]);
  return (
    <View style={[styles.item, { backgroundColor: c.card }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${unheard(vm) ? 'New. ' : ''}${title}, ${when(vm.receivedAt)}, ${duration(vm.durationS)}`}
        onPress={onOpen}
        style={styles.head}
      >
        <View style={[styles.dot, { backgroundColor: unheard(vm) ? c.tint : 'transparent' }]} />
        <View style={styles.headText}>
          <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
            {title}
          </Text>
          <Text numberOfLines={open ? undefined : 1} style={[styles.sub, { color: c.muted }]}>
            {name && vm.callerNumber ? `${phoneNumber(vm.callerNumber)} · ` : ''}
            {vm.transcript && !open ? vm.transcript : duration(vm.durationS)}
          </Text>
        </View>
        <Text style={[styles.when, { color: c.muted }]}>{when(vm.receivedAt)}</Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Player vm={vm} onError={setError} />
          {!!vm.transcript && (
            <Text style={[styles.transcript, { color: c.text }]}>{vm.transcript}</Text>
          )}
          {!!error && <Text style={[styles.error, { color: c.red }]}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!vm.callerNumber}
              onPress={() =>
                vm.callerNumber && dial(vm.callerNumber).catch((e: unknown) => setError(message(e)))
              }
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: c.fill },
                (pressed || !vm.callerNumber) && styles.pressed,
              ]}
            >
              <Icon name={{ ios: 'phone.fill', android: 'call' }} size={16} color={c.tint} />
              <Text style={[styles.actionText, { color: c.tint }]}>Call back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: c.fill },
                pressed && styles.pressed,
              ]}
            >
              <Icon name={{ ios: 'trash.fill', android: 'delete' }} size={16} color={c.red} />
              <Text style={[styles.actionText, { color: c.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Voicemail() {
  const c = useColors();
  const q = useVoicemail();
  const names = useNames();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Stack.Screen options={{ title: 'Voicemail' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.list}
        data={q.data?.items ?? []}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Message
            vm={item}
            name={item.callerName ?? names(item.callerNumber)}
            open={open === item.id}
            onOpen={() => setOpen(open === item.id ? null : item.id)}
          />
        )}
        ListHeaderComponent={
          q.error ? (
            <Text style={[styles.error, { color: c.red }]}>{q.error.message}</Text>
          ) : undefined
        }
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <Empty
              icon={{ ios: 'recordingtape', android: 'voicemail' }}
              title="No voicemail"
              body="Messages people leave you show here."
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  item: { borderRadius: radius.card, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  sub: { fontSize: 14 },
  when: { fontSize: 15 },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { flex: 1, gap: space.xs },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  transcript: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.45 },
  error: { fontSize: 14 },
  loading: { marginTop: 96 },
});
