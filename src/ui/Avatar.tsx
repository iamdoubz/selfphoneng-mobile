// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../session';
import { initials } from './format';

/**
 * A person's or contact's photo (spec 11 §8, `/api/photos/…` with the device token), or their
 * initials on a grey disc, as Contacts shows someone without one (and while it loads).
 */
export function Avatar({
  name,
  photo,
  size = 40,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const session = useSession((s) => s.session);
  const [failed, setFailed] = useState<string | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const src = photo && session && failed !== photo ? photo : null;
  return (
    <View accessible={false} style={[styles.disc, round]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
      {src && session && (
        <Image
          // Photo URLs change with each upload, so the system's image cache can keep them.
          source={{
            uri: session.server + src,
            headers: { authorization: `Bearer ${session.token}` },
          }}
          onError={() => setFailed(src)}
          style={[StyleSheet.absoluteFill, round]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The same grey in both themes, as the system's avatar gradient is.
  disc: {
    backgroundColor: '#8e8e93',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { color: '#ffffff', fontWeight: '600' },
});
