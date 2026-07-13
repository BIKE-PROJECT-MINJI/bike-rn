import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { activeElapsedMs, formatHudDistance, formatHudDuration, initialRideTrackingState, pauseRide, resumeRide } from '../../domain/ride/rideTracking';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { StatusBadge } from '../../shared/ui/GajaCard';
import { GajaFullScreen } from '../../shared/ui/GajaScreen';

export function FreeRideHudScreen() {
  const params = useLocalSearchParams<{ courseId?: string; courseTitle?: string }>();
  const [trackingState, setTrackingState] = useState(() => initialRideTrackingState(Date.now()));
  const nowMs = useMemo(() => Date.now(), []);
  const rideTitle = params.courseTitle ? `코스 주행 · ${params.courseTitle}` : '자유 주행';

  return (
    <GajaFullScreen>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.mapSurface}>
          <View style={styles.recordedRouteLine} />
          <Text style={styles.mapLabel}>recorded route</Text>
        </View>
      </View>
      <View style={styles.topDock}>
        <Text style={styles.rideTitle}>{rideTitle}</Text>
        <StatusBadge label={trackingState.status === 'ACTIVE' ? '주행 중' : '일시정지'} tone={trackingState.status === 'ACTIVE' ? 'success' : 'warning'} />
        <Text style={styles.permission}>Web smoke에서는 foreground 위치 수집을 실행하지 않습니다.</Text>
      </View>
      <View style={styles.hud}>
        <View style={styles.metricRow}>
          <Metric label="거리" value={formatHudDistance(trackingState.distanceMeters)} />
          <Metric label="시간" value={formatHudDuration(activeElapsedMs(trackingState, nowMs))} />
          <Metric label="포인트" value={`${trackingState.trackedPoints.length}`} />
        </View>
        <View style={styles.actions}>
          <GajaButton
            label={trackingState.status === 'ACTIVE' ? '일시정지' : '재개'}
            variant="secondary"
            onPress={() => setTrackingState((state) => (state.status === 'ACTIVE' ? pauseRide(state, Date.now()) : resumeRide(state, Date.now())))}
          />
          <GajaButton label="종료" onPress={() => router.back()} />
        </View>
      </View>
    </GajaFullScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topDock: {
    gap: 8,
    left: 20,
    position: 'absolute',
    right: 20,
    top: 54,
  },
  permission: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    color: GajaColors.textPrimary,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rideTitle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    color: GajaColors.textPrimary,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hud: {
    backgroundColor: 'rgba(10,47,34,0.94)',
    borderRadius: 22,
    bottom: 34,
    gap: 14,
    left: 20,
    padding: 16,
    position: 'absolute',
    right: 20,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: '#BFE3CB',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  mapSurface: {
    backgroundColor: GajaColors.surfaceMuted,
    flex: 1,
  },
  mapLabel: {
    color: GajaColors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    left: 24,
    position: 'absolute',
    top: 130,
  },
  recordedRouteLine: {
    backgroundColor: GajaColors.primary,
    borderRadius: 999,
    height: 6,
    left: 48,
    position: 'absolute',
    top: 180,
    transform: [{ rotateZ: '-0.35rad' }],
    width: 260,
  },
});
