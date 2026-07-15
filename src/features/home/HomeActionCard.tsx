import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';

type HomeActionCardProps = {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly accent: 'green' | 'blue';
  readonly onPress: () => void;
};

export function HomeActionCard({ title, description, actionLabel, icon, accent, onPress }: HomeActionCardProps) {
  const accentColor = accent === 'green' ? GajaColors.primary : GajaColors.routeBlue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${actionLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconFrame, { backgroundColor: accent === 'green' ? '#E1F5E8' : '#E7EFFF' }]}>
        <Ionicons name={icon} size={30} color={accentColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={[styles.action, { backgroundColor: accentColor }]}>
        <Text style={styles.actionLabel}>{actionLabel}</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 238,
    justifyContent: 'space-between',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GajaColors.border,
    backgroundColor: GajaColors.surface,
  },
  pressed: { opacity: 0.78 },
  iconFrame: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: 8 },
  title: { fontSize: 20, fontWeight: '900', lineHeight: 26 },
  description: { color: GajaColors.textSecondary, fontSize: 13, lineHeight: 19 },
  action: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  actionLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
