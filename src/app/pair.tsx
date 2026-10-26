// SPDX-License-Identifier: AGPL-3.0-or-later
// Pairing (spec 13 §2): scan the QR code from My settings → Mobile app, or type the server and
// code. A selfphoneng://pair?server=…&code=… link opens here filled in, and waits for a tap.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { pair } from '../api';
import { useSession } from '../session';

export default function Pair() {
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
        <Button title="Cancel" onPress={() => setScanning(false)} />
      </View>
    );

  return (
    <View style={styles.page}>
      <Text>
        On a computer, open SelfPhoneNG → My settings → Mobile app → Pair a phone, then scan the
        code it shows.
      </Text>
      <Button
        title="Scan the QR code"
        onPress={async () => {
          setError('');
          if ((permission?.granted ?? false) || (await requestPermission()).granted)
            setScanning(true);
          else setError('The camera is needed to scan. You can type the server and code instead.');
        }}
      />
      <Text style={styles.label}>Server</Text>
      <TextInput
        style={styles.input}
        value={server}
        onChangeText={setServer}
        placeholder="pbx.example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.label}>Code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="ABCD EFGH JKLM"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button
        title={busy ? 'Pairing…' : 'Pair'}
        disabled={busy || !server.trim() || !code.trim()}
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
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 12 },
  full: { flex: 1 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 6, padding: 10, fontSize: 16 },
  error: { color: '#b91c1c' },
});
