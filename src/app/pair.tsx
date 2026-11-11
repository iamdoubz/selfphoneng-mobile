// SPDX-License-Identifier: AGPL-3.0-or-later
// Pairing (spec 13 §2): scan the QR code from My settings → Mobile app, or type the server and
// code. A selfphoneng://pair?server=…&code=… link opens here filled in, and waits for a tap.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pair } from '../api';
import { useSession } from '../session';
import { Icon } from '../ui/List';
import { radius, space, useColors } from '../ui/theme';

function Button({
  title,
  onPress,
  disabled,
  busy,
  kind = 'filled',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind?: 'filled' | 'plain';
}) {
  const c = useColors();
  const filled = kind === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? c.tint : c.fill },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={filled ? '#ffffff' : (c.tint as string)} />
      ) : (
        <Text style={[styles.buttonText, { color: filled ? '#ffffff' : c.tint }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export default function Pair() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const params = useLocalSearchParams<{ server?: string; code?: string }>();
  const [server, setServer] = useState(params.server ?? '');
  const [code, setCode] = useState(params.code ?? '');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  if (session) return <Redirect href="/" />;

  if (scanning)
    return (
      <View style={styles.full}>
        <CameraView
          style={styles.full}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (!data.startsWith('selfphoneng://pair?')) return;
            const { queryParams } = Linking.parse(data);
            if (typeof queryParams?.code !== 'string') return;
            setServer(String(queryParams.server ?? ''));
            setCode(queryParams.code);
            setScanning(false);
          }}
        />
        <View style={[styles.scanBar, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Cancel" kind="plain" onPress={() => setScanning(false)} />
        </View>
      </View>
    );

  const input = [styles.input, { backgroundColor: c.card, color: c.text }];
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.page}
    >
      <View style={styles.hero}>
        <Icon
          name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner' }}
          size={56}
          color={c.tint}
        />
        <Text style={[styles.lead, { color: c.muted }]}>
          On a computer, open SelfPhoneNG → My settings → Mobile app → Pair a phone, then scan the
          code it shows.
        </Text>
      </View>
      <Button
        title="Scan the QR code"
        onPress={async () => {
          setError('');
          if ((permission?.granted ?? false) || (await requestPermission()).granted)
            setScanning(true);
          else setError('The camera is needed to scan. You can type the server and code instead.');
        }}
      />
      <Text style={[styles.or, { color: c.muted }]}>or type them</Text>
      <Text style={[styles.label, { color: c.muted }]}>SERVER</Text>
      <TextInput
        style={input}
        value={server}
        onChangeText={setServer}
        placeholder="pbx.example.com"
        placeholderTextColor={c.faint as string}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
      />
      <Text style={[styles.label, { color: c.muted }]}>CODE</Text>
      <TextInput
        style={input}
        value={code}
        onChangeText={setCode}
        placeholder="ABCD EFGH JKLM"
        placeholderTextColor={c.faint as string}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {!!error && <Text style={[styles.error, { color: c.red }]}>{error}</Text>}
      <Button
        title="Pair"
        kind="plain"
        busy={busy}
        disabled={!server.trim() || !code.trim()}
        onPress={async () => {
          setBusy(true);
          setError('');
          try {
            await pair(server, code);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md },
  full: { flex: 1 },
  hero: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  lead: { fontSize: 15, lineHeight: 21, textAlign: 'center', paddingHorizontal: space.lg },
  or: { textAlign: 'center', fontSize: 13, marginTop: space.lg },
  label: { fontSize: 13, marginLeft: space.lg, marginTop: space.sm },
  input: { minHeight: 48, borderRadius: radius.button, paddingHorizontal: space.lg, fontSize: 17 },
  error: { fontSize: 14, marginHorizontal: space.sm },
  button: {
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.45 },
  scanBar: { position: 'absolute', left: space.lg, right: space.lg, bottom: 0 },
});
