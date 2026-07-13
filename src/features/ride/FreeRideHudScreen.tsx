import { useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { fetchCourseRoutePoints } from '../../domain/course/courseService';
import { toRidePolicyLocation } from '../../domain/ride/ridePolicyModels';
import { evaluateRidePolicy } from '../../domain/ride/ridePolicyService';
import { activeElapsedMs, appendRideSample, formatHudDistance, formatHudDuration, initialRideTrackingState, pauseRide, resumeRide } from '../../domain/ride/rideTracking';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { StatusBadge } from '../../shared/ui/GajaCard';
import { GajaFullScreen } from '../../shared/ui/GajaScreen';

export function FreeRideHudScreen() {
  const params = useLocalSearchParams<{ courseId?: string; courseTitle?: string }>();
  const courseId = Number(params.courseId ?? 0);
  const [trackingState, setTrackingState] = useState(() => initialRideTrackingState(Date.now()));
  const [permissionMessage, setPermissionMessage] = useState('위치 권한을 확인하는 중입니다.');
  const [latestAccuracyM, setLatestAccuracyM] = useState(30);
  const [nowMs, setNowMs] = useState(Date.now());
  const lastEvaluatedPointOrderRef = useRef(0);
  const rideTitle = params.courseTitle ? `코스 주행 · ${params.courseTitle}` : '자유 주행';
  const courseRouteQuery = useQuery({
    queryKey: ['ride-course-route-points', courseId],
    queryFn: () => fetchCourseRoutePoints(courseId),
    enabled: courseId > 0,
  });
  const ridePolicyMutation = useMutation({
    mutationFn: (request: Parameters<typeof evaluateRidePolicy>[1]) => evaluateRidePolicy(courseId, request),
  });

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let disposed = false;

    async function startLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPermissionMessage('위치 권한이 없어 지도와 속도 기능이 제한됩니다.');
        return;
      }
      setPermissionMessage('foreground 위치 수집 중');
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 2000 },
        (location) => {
          if (disposed) {
            return;
          }
          setLatestAccuracyM(location.coords.accuracy ?? 30);
          setTrackingState((state) =>
            appendRideSample(state, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              recordedAtMs: location.timestamp,
            }),
          );
        },
      );
    }

    startLocation();
    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    const lastPoint = trackingState.trackedPoints.at(-1);
    if (courseId <= 0 || !lastPoint || ridePolicyMutation.isPending || lastPoint.pointOrder === lastEvaluatedPointOrderRef.current) {
      return;
    }
    lastEvaluatedPointOrderRef.current = lastPoint.pointOrder;
    const trace = trackingState.trackedPoints.slice(-80).map((point) => toRidePolicyLocation(point, latestAccuracyM));
    ridePolicyMutation.mutate({
      phase: 'ACTIVE',
      location: toRidePolicyLocation(lastPoint, latestAccuracyM),
      trace,
    });
  }, [courseId, latestAccuracyM, ridePolicyMutation, trackingState.trackedPoints]);

  const region = useMemo(() => {
    const last = trackingState.lastAcceptedSample;
    return {
      latitude: last?.latitude ?? 37.5665,
      longitude: last?.longitude ?? 126.978,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [trackingState.lastAcceptedSample]);

  const polyline = trackingState.trackedPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const coursePolyline = (courseRouteQuery.data ?? []).map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const policy = ridePolicyMutation.data;
  const guidanceTone = policy?.overallState.includes('OFF_ROUTE') || policy?.offRouteStatus === 'WARNING' ? 'warning' : 'success';

  return (
    <GajaFullScreen>
      <MapView style={StyleSheet.absoluteFill} region={region} showsUserLocation>
        {coursePolyline.length > 1 ? <Polyline coordinates={coursePolyline} strokeColor={GajaColors.routeOrange} strokeWidth={6} /> : null}
        {polyline.length > 1 ? <Polyline coordinates={polyline} strokeColor={GajaColors.routeBlue} strokeWidth={5} /> : null}
      </MapView>
      <View style={styles.topDock}>
        <Text style={styles.rideTitle}>{rideTitle}</Text>
        <StatusBadge label={trackingState.status === 'ACTIVE' ? '주행 중' : '일시정지'} tone={trackingState.status === 'ACTIVE' ? 'success' : 'warning'} />
        <Text style={styles.permission}>{permissionMessage}</Text>
        {courseId > 0 ? (
          <Text style={styles.permission}>
            코스 경로 {courseRouteQuery.data?.length ?? 0}개 · 내 경로 {trackingState.trackedPoints.length}개
          </Text>
        ) : null}
      </View>
      <View style={styles.hud}>
        {courseId > 0 ? (
          <View style={styles.guidance}>
            <StatusBadge label={policy?.overallState ?? '코스 안내 준비'} tone={guidanceTone} />
            <Text style={styles.guidanceText}>{policy?.defaultMessage ?? '현재 위치를 받으면 코스 이탈과 완주 상태를 계산합니다.'}</Text>
          </View>
        ) : null}
        <View style={styles.metricRow}>
          <Metric label="거리" value={formatHudDistance(trackingState.distanceMeters)} />
          <Metric label="시간" value={formatHudDuration(activeElapsedMs(trackingState, nowMs))} />
          <Metric label="포인트" value={`${trackingState.trackedPoints.length}`} />
        </View>
        {courseId > 0 ? (
          <View style={styles.metricRow}>
            <Metric label="진행률" value={policy?.progressPercent === null || policy?.progressPercent === undefined ? '-' : `${policy.progressPercent}%`} />
            <Metric label="남은거리" value={policy?.remainingDistanceM === null || policy?.remainingDistanceM === undefined ? '-' : formatHudDistance(policy.remainingDistanceM)} />
            <Metric label="이탈거리" value={policy?.offRouteDistanceM === null || policy?.offRouteDistanceM === undefined ? '-' : `${policy.offRouteDistanceM} m`} />
          </View>
        ) : null}
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
    position: 'absolute',
    left: 20,
    right: 20,
    top: 54,
    gap: 8,
  },
  permission: {
    color: GajaColors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: '700',
  },
  rideTitle: {
    color: GajaColors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: '900',
  },
  hud: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 34,
    backgroundColor: 'rgba(10,47,34,0.94)',
    borderRadius: 22,
    padding: 16,
    gap: 14,
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
  guidance: {
    gap: 8,
  },
  guidanceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
});
