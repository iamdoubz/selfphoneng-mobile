// SPDX-License-Identifier: AGPL-3.0-or-later
import { StyleSheet, Text, View } from 'react-native';
import { initials } from './format';

/** Initials on a grey disc, as Contacts shows someone without a photo. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View
      accessible={false}
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The same grey in both themes, as the system's avatar gradient is.
  disc: { backgroundColor: '#8e8e93', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#ffffff', fontWeight: '600' },
});
