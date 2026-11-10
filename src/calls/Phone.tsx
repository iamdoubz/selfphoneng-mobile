// SPDX-License-Identifier: AGPL-3.0-or-later
// The phone on the home screen (spec 13 MB4): its status, a dial pad, and the call in progress.
// Incoming calls also show on the system's own call screen.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { phone, type CallInfo } from './engine';
import { callActions, startPhone, stopPhone } from './native';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const STATUS = {
  off: 'Off',
  connecting: 'Connecting…',
  registered: 'Ready',
  error: 'Not connected',
};

function Key({
  label,
  onPress,
  tone = 'plain',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'go' | 'stop' | 'on';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.key, styles[tone], (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.keyText, tone !== 'plain' && styles.keyTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Pad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={styles.pad}>
      {KEYS.map((k) => (
        <Key key={k} label={k} onPress={() => onKey(k)} />
      ))}
    </View>
  );
}

const clock = (from: number, now: number) => {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Call({ call }: { call: CallInfo }) {
  const [speaker, setSpeaker] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const run = (p: Promise<unknown>) =>
    void p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  const what =
    call.state === 'incoming'
      ? 'Incoming call'
      : call.state === 'calling'
        ? 'Calling…'
        : call.held
          ? 'On hold'
          : clock(call.answeredAt ?? now, now);
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{call.remoteName ?? call.remote}</Text>
      {call.remoteName && <Text style={styles.muted}>{call.remote}</Text>}
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {what}
      </Text>
      {call.state === 'active' && (
        <View style={styles.row}>
          <Key
            label={call.muted ? 'Unmute' : 'Mute'}
            tone={call.muted ? 'on' : 'plain'}
            onPress={() => run(callActions.mute(call.id, !call.muted))}
          />
          <Key
            label={call.held ? 'Resume' : 'Hold'}
            tone={call.held ? 'on' : 'plain'}
            onPress={() => run(callActions.hold(call.id, !call.held))}
          />
          <Key
            label="Speaker"
            tone={speaker ? 'on' : 'plain'}
            onPress={() => {
              callActions.speaker(!speaker);
              setSpeaker(!speaker);
            }}
          />
          <Key label="Keypad" tone={keypad ? 'on' : 'plain'} onPress={() => setKeypad(!keypad)} />
        </View>
      )}
      {keypad && call.state === 'active' && (
        <Pad onKey={(k) => run(callActions.dtmf(call.id, k))} />
      )}
      <View style={styles.row}>
        {call.state === 'incoming' && (
          <Key label="Answer" tone="go" onPress={() => run(callActions.answer(call.id))} />
        )}
        <Key
          label={call.state === 'incoming' ? 'Decline' : 'Hang up'}
          tone="stop"
          onPress={() => run(callActions.hangup(call.id))}
        />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Phone() {
  const state = useSyncExternalStore(phone.subscribe, () => phone.state);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    startPhone().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => void stopPhone();
  }, []);

  if (state.call) return <Call call={state.call} />;
  return (
    <View style={styles.card}>
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        Phone: {STATUS[state.reg]}
        {state.error ? ` (${state.error})` : ''}
      </Text>
      <TextInput
        style={styles.number}
        value={number}
        onChangeText={(v) => setNumber(v.replace(/[^0-9*#+]/g, ''))}
        placeholder="Number"
        accessibilityLabel="Number to call"
        keyboardType="phone-pad"
        autoCorrect={false}
      />
      <Pad onKey={(k) => setNumber(number + k)} />
      <View style={styles.row}>
        <Key
          label="Call"
          tone="go"
          disabled={!number || state.reg !== 'registered'}
          onPress={() => {
            setError('');
            callActions.dial(number).then(
              () => setNumber(''),
              (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
            );
          }}
        />
        <Key label="Delete" disabled={!number} onPress={() => setNumber(number.slice(0, -1))} />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, paddingVertical: 12 },
  name: { fontSize: 22, fontWeight: '600' },
  muted: { color: '#52525b' },
  error: { color: '#b91c1c' },
  number: {
    borderWidth: 1,
    borderColor: '#a1a1aa',
    borderRadius: 6,
    padding: 10,
    fontSize: 22,
    textAlign: 'center',
  },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  plain: { backgroundColor: '#e4e4e7' },
  on: { backgroundColor: '#1d4ed8' },
  go: { backgroundColor: '#15803d' },
  stop: { backgroundColor: '#b91c1c' },
  dim: { opacity: 0.5 },
  keyText: { fontSize: 18, fontWeight: '500', color: '#18181b' },
  keyTextOn: { color: '#ffffff' },
});
