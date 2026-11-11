// SPDX-License-Identifier: AGPL-3.0-or-later
// The app once paired: the phone's own tab bar, the phone registered while the app is open, and
// the call in progress over whichever tab is showing.
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { CallScreen, usePhone, usePhoneError } from '../../calls/Phone';
import { startPhone, stopPhone } from '../../calls/native';
import { unheard, useMe, useNames, useVoicemail } from '../../data';
import { useSession } from '../../session';
import { useColors } from '../../ui/theme';

export default function TabsLayout() {
  const session = useSession((s) => s.session);
  const c = useColors();
  const me = useMe();
  const vm = useVoicemail();
  const names = useNames();
  const { call } = usePhone();
  const hasExtension = !!me.data?.extension;

  useEffect(() => {
    if (!hasExtension) return;
    usePhoneError.setState({ error: '' });
    startPhone().catch((e: unknown) =>
      usePhoneError.setState({ error: e instanceof Error ? e.message : String(e) }),
    );
    return () => void stopPhone();
  }, [hasExtension]);

  if (!session) return <Redirect href="/pair" />;
  const newMessages = vm.data?.items.filter(unheard).length ?? 0;
  return (
    <View style={styles.full}>
      <NativeTabs tintColor={c.tint}>
        <NativeTabs.Trigger name="(calls)">
          <NativeTabs.Trigger.Label>Calls</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="history" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="contacts">
          <NativeTabs.Trigger.Label>Contacts</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            md="contacts"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="keypad">
          <NativeTabs.Trigger.Label>Keypad</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'circle.grid.3x3', selected: 'circle.grid.3x3.fill' }}
            md="dialpad"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="voicemail">
          <NativeTabs.Trigger.Label>Voicemail</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="recordingtape" md="voicemail" />
          {newMessages > 0 && (
            <NativeTabs.Trigger.Badge>{String(newMessages)}</NativeTabs.Trigger.Badge>
          )}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            md="settings"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
      {call && <CallScreen call={call} name={names(call.remote)} />}
    </View>
  );
}

const styles = StyleSheet.create({ full: { flex: 1 } });
