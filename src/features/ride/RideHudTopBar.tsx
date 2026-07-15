import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { RideDraft } from '../../domain/ride/rideQueueModel';
import type { CurrentWeather } from '../../domain/weather/currentWeather';
import { GajaColors } from '../../shared/design/tokens';
import { latestRidePoint } from './rideHudModel';
import { presentRideWeather } from './weatherPresentation';

type RideHudTopBarProps = {
  readonly draft: RideDraft | null;
  readonly topInset: number;
  readonly title?: string;
  readonly weather: CurrentWeather | null;
  readonly weatherLoading: boolean;
  readonly weatherError: Error | null;
  readonly headingDeg: number | null;
};

export function RideHudTopBar({
  draft,
  topInset,
  title = 'GAJA',
  weather,
  weatherLoading,
  weatherError,
  headingDeg,
}: RideHudTopBarProps) {
  const latestPoint = latestRidePoint(draft);
  const accuracy = latestPoint?.accuracyM;
  const weatherPresentation = presentRideWeather(weather, weatherLoading, weatherError);
  return (
    <View pointerEvents="box-none" style={[styles.root, { paddingTop: topInset + 8 }]}>
      <View style={styles.statusRow}>
        <View style={styles.brand}>
          <Ionicons name="navigate-circle" size={28} color={GajaColors.primary} />
          <Text numberOfLines={1} style={styles.brandText}>{title}</Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons name="location" size={18} color={GajaColors.primary} />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statusText}>{accuracy === null || accuracy === undefined ? 'GPS 확인 중' : `GPS ±${Math.round(accuracy)}m`}</Text>
        </View>
        <View style={styles.statusItem}>
          <Ionicons name="save-outline" size={18} color={GajaColors.primary} />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statusText}>기기에 저장 중</Text>
        </View>
      </View>
      <View style={styles.weatherRow}>
        <Ionicons name={weather?.weather?.precipType && weather.weather.precipType !== 'NONE' ? 'rainy-outline' : 'cloud-outline'} size={24} color={GajaColors.textPrimary} />
        <View style={styles.weatherCopy}>
          <Text style={styles.weatherTitle}>{weatherPresentation.title}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.weatherMeta}>{weatherPresentation.meta}</Text>
        </View>
        <View style={styles.northBadge}>
          <Ionicons name="compass-outline" size={22} color={GajaColors.textPrimary} />
          <Text style={styles.northText}>{headingDeg === null ? '지도 북쪽' : `진행 ${Math.round(headingDeg)}°`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomColor: GajaColors.border, borderBottomWidth: 1 },
  statusRow: { height: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { maxWidth: '38%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { flexShrink: 1, color: GajaColors.textPrimary, fontSize: 15, fontWeight: '900' },
  statusItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  statusText: { color: GajaColors.textPrimary, fontSize: 12, fontWeight: '700' },
  weatherRow: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopColor: GajaColors.border, borderTopWidth: 1 },
  weatherCopy: { flex: 1, gap: 2 },
  weatherTitle: { color: GajaColors.textPrimary, fontSize: 15, fontWeight: '800' },
  weatherMeta: { color: GajaColors.textMuted, fontSize: 11 },
  northBadge: { alignItems: 'center', gap: 1 },
  northText: { color: GajaColors.textMuted, fontSize: 10, fontWeight: '700' },
});
