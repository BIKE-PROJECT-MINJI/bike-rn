import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GajaColors, GajaRadius, GajaSpacing } from '../design/tokens';

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  onPress?: () => void;
}>;

export function GajaCard({ title, subtitle, children, onPress }: CardProps) {
  const body = (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
        onPress={onPress}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const backgroundColor =
    tone === 'success' ? '#DBF5E5' : tone === 'warning' ? '#FFF1D6' : tone === 'danger' ? '#FFE1DE' : GajaColors.surfaceMuted;
  const color =
    tone === 'success' ? GajaColors.primary : tone === 'warning' ? GajaColors.warning : tone === 'danger' ? GajaColors.danger : GajaColors.textSecondary;
  return <Text style={[styles.badge, { backgroundColor, color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GajaColors.surface,
    borderRadius: GajaRadius.card,
    borderWidth: 1,
    borderColor: GajaColors.border,
    padding: GajaSpacing.card,
    gap: 10,
  },
  title: {
    color: GajaColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: GajaColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: GajaRadius.pill,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
  },
});
