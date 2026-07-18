import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';

export function HomeHeader() {
  return (
    <View style={styles.root}>
      <View style={styles.brandRow}>
        <Ionicons name="navigate-circle" size={32} color="#00A84F" accessibilityElementsHidden />
        <Text style={styles.brand}>GAJA</Text>
        <View style={styles.location}>
          <Ionicons name="location" size={18} color={GajaColors.primary} />
          <Text numberOfLines={1} style={styles.locationText}>현재 위치</Text>
        </View>
      </View>
      <View style={styles.contextRow}>
        <Ionicons name="cloud-outline" size={26} color={GajaColors.textPrimary} />
        <View style={styles.contextCopy}>
          <Text style={styles.contextTitle}>날씨 확인 중</Text>
          <Text style={styles.contextMeta}>주행은 바로 시작할 수 있어요</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, paddingTop: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: GajaColors.textPrimary, fontSize: 22, fontWeight: '900' },
  location: { flex: 1, marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { flex: 1, color: GajaColors.textPrimary, fontSize: 14, fontWeight: '700' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextCopy: { gap: 2 },
  contextTitle: { color: GajaColors.textPrimary, fontSize: 17, fontWeight: '800' },
  contextMeta: { color: GajaColors.textMuted, fontSize: 12 },
});
