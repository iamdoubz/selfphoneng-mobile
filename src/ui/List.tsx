// SPDX-License-Identifier: AGPL-3.0-or-later
// Inset grouped lists, as in the phone's Settings: a rounded card of rows with hairlines between.
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Children, Fragment, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, space, useColors } from './theme';

export type IconName = SymbolViewProps['name'];

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
}) {
  return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
}

export function Section({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.section, style]}>
      {title && (
        <Text accessibilityRole="header" style={[styles.title, { color: c.muted }]}>
          {title}
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: c.card }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.hairline, { backgroundColor: c.separator }]} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text>}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  value,
  right,
  left,
  onPress,
  tone = 'plain',
  chevron,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  tone?: 'plain' | 'tint' | 'danger';
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const color = tone === 'danger' ? c.red : tone === 'tint' ? c.tint : c.text;
  const body = (
    <>
      {left}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.rowSub, { color: c.muted }]}>{subtitle}</Text>}
      </View>
      {!!value && (
        <Text numberOfLines={1} style={[styles.value, { color: c.muted }]}>
          {value}
        </Text>
      )}
      {right}
      {chevron && (
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={c.faint} />
      )}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.fill }]}
    >
      {body}
    </Pressable>
  );
}

/** A coloured rounded square behind an icon, as Settings rows have. */
export function Badge({ name, color }: { name: IconName; color: ColorValue }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Icon name={name} size={16} color="#ffffff" />
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={44} color={c.faint} />
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {!!body && <Text style={[styles.emptyBody, { color: c.muted }]}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginTop: space.xl },
  title: {
    fontSize: 13,
    textTransform: 'uppercase',
    marginHorizontal: space.lg,
    marginBottom: space.sm,
  },
  card: { borderRadius: radius.card, overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  footer: { fontSize: 13, lineHeight: 18, marginHorizontal: space.lg, marginTop: space.sm },
  row: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    paddingVertical: space.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17 },
  rowSub: { fontSize: 14 },
  value: { fontSize: 17, maxWidth: '55%' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: 96, paddingHorizontal: space.xxl },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: space.sm },
  emptyBody: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
