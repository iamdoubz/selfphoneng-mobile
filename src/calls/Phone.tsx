// SPDX-License-Identifier: AGPL-3.0-or-later
// The phone (spec 13 MB4): the keypad tab, and the call in progress over every tab. Incoming
// calls also show on the system's own call screen.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { duration, phoneNumber } from '../ui/format';
import { Icon, type IconName } from '../ui/List';
import { call as dark, space, useColors } from '../ui/theme';
import { phone, type CallInfo } from './engine';
import { callActions } from './native';

/** Why the phone couldn't start (no extension, the browser softphone off, offline). */
export const usePhoneError = create<{ error: string }>(() => ({ error: '' }));

export const usePhone = () => useSyncExternalStore(phone.subscribe, () => phone.state);

export const STATUS = {
  off: 'Off',
  connecting: 'Connecting…',
  registered: 'Ready',
  error: 'Not connected',
} as const;

const KEYS: [string, string][] = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Starts a call; the call screen takes over from here. */
export function dial(number: string): Promise<void> {
  return callActions.dial(number.replace(/[^0-9*#+]/g, ''));
}

function Pad({
  onKey,
  onLong,
  onDark,
}: {
  onKey: (k: string) => void;
  onLong?: (k: string) => void;
  onDark?: boolean;
}) {
  const c = useColors();
  return (
    <View style={styles.pad}>
      {KEYS.map(([k, letters]) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k}
          onPress={() => onKey(k)}
          onLongPress={onLong && (() => onLong(k))}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: onDark ? dark.button : c.fill },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.digit, { color: onDark ? dark.text : c.text }]}>{k}</Text>
          {!!letters && (
            <Text style={[styles.letters, { color: onDark ? dark.muted : c.muted }]}>
              {letters}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function Round({
  icon,
  label,
  color,
  iconColor = '#ffffff',
  onPress,
  disabled,
  size = 76,
}: {
  icon: IconName;
  label: string;
  color: ColorValue;
  iconColor?: ColorValue;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Icon name={icon} size={size * 0.4} color={iconColor} />
    </Pressable>
  );
}

/** The Keypad tab. */
export function Keypad() {
  const c = useColors();
  const state = usePhone();
  const startError = usePhoneError((s) => s.error);
  const [number, setNumber] = useState('');
  const [dialError, setError] = useState('');
  // A tel: link from another app (+native-intent): filled in, waiting for a tap, never dialed.
  const linked = useLocalSearchParams<{ number?: string }>().number;
  const [seen, setSeen] = useState<string>();
  if (linked && linked !== seen) {
    setSeen(linked);
    setNumber(linked.replace(/[^0-9*#+]/g, ''));
  }
  const error = dialError || startError;
  const ready = state.reg === 'registered';
  return (
    <View style={[styles.keypad, { backgroundColor: c.bg }]}>
      <View style={styles.display}>
        <Text
          accessibilityLabel={number ? `Number ${number}` : 'No number yet'}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.number, { color: c.text }]}
        >
          {number}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: error || state.error ? c.red : c.muted }]}
        >
          {error || (state.error ? `${STATUS[state.reg]}: ${state.error}` : STATUS[state.reg])}
        </Text>
      </View>
      <Pad
        onKey={(k) => setNumber(number + k)}
        onLong={(k) => k === '0' && setNumber(number + '+')}
      />
      <View style={styles.callRow}>
        <View style={styles.side} />
        <Round
          icon={{ ios: 'phone.fill', android: 'call' }}
          label="Call"
          color={c.green}
          disabled={!number || !ready}
          onPress={() => {
            setError('');
            dial(number).then(
              () => setNumber(''),
              (e: unknown) => setError(message(e)),
            );
          }}
        />
        <View style={styles.side}>
          {!!number && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              hitSlop={16}
              onPress={() => setNumber(number.slice(0, -1))}
              onLongPress={() => setNumber('')}
            >
              <Icon
                name={{ ios: 'delete.left.fill', android: 'backspace' }}
                size={28}
                color={c.faint}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Toggle({
  icon,
  label,
  on,
  onPress,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.toggle}>
      <Round
        icon={icon}
        label={label}
        color={on ? dark.buttonOn : dark.button}
        iconColor={on ? dark.bg : dark.text}
        onPress={onPress}
      />
      <Text style={styles.toggleLabel}>{label}</Text>
    </View>
  );
}

/** The call in progress, over the whole app. */
export function CallScreen({ call, name }: { call: CallInfo; name: string | null }) {
  const insets = useSafeAreaInsets();
  const [speaker, setSpeaker] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [tones, setTones] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const run = (p: Promise<unknown>) => void p.catch((e: unknown) => setError(message(e)));
  const who = call.remoteName ?? name;
  const what =
    call.state === 'incoming'
      ? 'Incoming call'
      : call.state === 'calling'
        ? 'Calling…'
        : call.held
          ? 'On hold'
          : duration(((now - (call.answeredAt ?? now)) / 1000) | 0);
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.call,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <View style={styles.who}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.callName}>
          {keypad && tones ? tones : (who ?? phoneNumber(call.remote))}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.callState}>
          {who && !keypad ? `${phoneNumber(call.remote)} · ${what}` : what}
        </Text>
        {!!error && <Text style={styles.callError}>{error}</Text>}
      </View>
      {call.state === 'active' &&
        (keypad ? (
          <Pad
            onDark
            onKey={(k) => {
              setTones(tones + k);
              run(callActions.dtmf(call.id, k));
            }}
          />
        ) : (
          <View style={styles.grid}>
            <Toggle
              icon={{ ios: 'mic.slash.fill', android: 'mic_off' }}
              label="Mute"
              on={call.muted}
              onPress={() => run(callActions.mute(call.id, !call.muted))}
            />
            <Toggle
              icon={{ ios: 'circle.grid.3x3.fill', android: 'dialpad' }}
              label="Keypad"
              on={false}
              onPress={() => setKeypad(true)}
            />
            <Toggle
              icon={{ ios: 'speaker.wave.2.fill', android: 'volume_up' }}
              label="Speaker"
              on={speaker}
              onPress={() => {
                run(Promise.resolve(callActions.speaker(!speaker)));
                setSpeaker(!speaker);
              }}
            />
            <Toggle
              icon={{ ios: 'pause.fill', android: 'pause' }}
              label="Hold"
              on={call.held}
              onPress={() => run(callActions.hold(call.id, !call.held))}
            />
          </View>
        ))}
      <View style={styles.endRow}>
        {call.state === 'incoming' ? (
          <>
            <Round
              icon={{ ios: 'phone.down.fill', android: 'call_end' }}
              label="Decline"
              color={dark.red}
              onPress={() => run(callActions.hangup(call.id))}
            />
            <Round
              icon={{ ios: 'phone.fill', android: 'call' }}
              label="Answer"
              color={dark.green}
              onPress={() => run(callActions.answer(call.id))}
            />
          </>
        ) : (
          <>
            {keypad && (
              <Text onPress={() => setKeypad(false)} style={styles.hide} accessibilityRole="button">
                Hide
              </Text>
            )}
            <Round
              icon={{ ios: 'phone.down.fill', android: 'call_end' }}
              label="End call"
              color={dark.red}
              onPress={() => run(callActions.hangup(call.id))}
            />
            {keypad && <View style={styles.hideSpacer} />}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: { flex: 1, justifyContent: 'flex-end', paddingBottom: 120, gap: space.xl },
  display: { alignItems: 'center', paddingHorizontal: space.xl, gap: space.xs, minHeight: 72 },
  number: { fontSize: 38, fontWeight: '400', fontVariant: ['tabular-nums'], minHeight: 46 },
  status: { fontSize: 14 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 24,
    rowGap: 16,
    width: 3 * 78 + 2 * 24,
    alignSelf: 'center',
  },
  key: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 34, fontWeight: '400', lineHeight: 38 },
  letters: { fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  pressed: { opacity: 0.45 },
  callRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
  side: { width: 78, alignItems: 'center' },
  round: { alignItems: 'center', justifyContent: 'center' },
  call: { backgroundColor: dark.bg, justifyContent: 'space-between', paddingHorizontal: space.xl },
  who: { alignItems: 'center', gap: space.sm },
  callName: { color: dark.text, fontSize: 34, fontWeight: '500' },
  callState: { color: dark.muted, fontSize: 17, fontVariant: ['tabular-nums'] },
  callError: { color: dark.red, fontSize: 15, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 56,
    rowGap: 28,
    width: 2 * 76 + 56,
    alignSelf: 'center',
  },
  toggle: { alignItems: 'center', gap: space.sm, width: 76 },
  toggleLabel: { color: dark.text, fontSize: 13 },
  endRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  hide: { color: dark.text, fontSize: 17, width: 76, textAlign: 'center' },
  hideSpacer: { width: 76 },
});
