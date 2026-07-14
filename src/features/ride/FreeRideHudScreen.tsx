import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchRideRecords } from '../../domain/ride/rideApi';
import { rideElapsedMs } from '../../domain/ride/rideQueueModel';
import { formatHudDistance, formatHudDuration } from '../../domain/ride/rideTracking';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { useRideSession } from './useRideSession';

export function FreeRideHudScreen() {
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const ride = useRideSession(accessToken);
  const recordsQuery = useQuery({
    queryKey: ['ride-records', ride.receipt?.rideRecordId],
    queryFn: () => fetchRideRecords(requireAccessToken(accessToken)),
    enabled: accessToken !== null,
  });
  const isTracking = ride.draft?.status === 'RECORDING' || ride.draft?.status === 'PAUSED';
  const needsLogin = accessToken === null;
  const canRetry =
    ride.draft?.status === 'QUEUED' ||
    ride.draft?.status === 'UPLOADING' ||
    ride.draft?.status === 'RETRY_WAIT' ||
    (ride.draft?.status === 'FAILED_USER_ACTION' && accessToken !== null) ||
    (ride.draft?.status === 'FAILED_TERMINAL' && ride.draft.lastErrorCode === 'UNEXPECTED_CLIENT_ERROR');
  const elapsedMs = ride.draft === null ? 0 : rideElapsedMs(ride.draft, ride.nowMs);

  return (
    <GajaScreen>
      <GajaCard title="자유 주행" subtitle="화면 잠금과 네트워크 끊김에도 주행 원본을 먼저 기기에 보존합니다.">
        <View style={styles.badges}>
          <StatusBadge label={accessToken === null ? '로그인 필요' : '로그인됨'} tone={accessToken === null ? 'warning' : 'success'} />
          <StatusBadge label={ride.draft?.status ?? 'READY_TO_START'} tone={statusTone(ride.draft?.status)} />
        </View>
        <Text style={styles.message}>{ride.message}</Text>
        {ride.errorMessage ? <Text style={styles.error}>{ride.errorMessage}</Text> : null}
        {ride.draft?.lastLocationErrorCode ? (
          <Text style={styles.error}>위치 수집 오류: {ride.draft.lastLocationErrorCode}</Text>
        ) : null}
        {needsLogin ? (
          <GajaButton label="로그인하러 가기" onPress={() => router.push('/(tabs)/profile')} />
        ) : null}
        {ride.errorMessage?.includes('항상 허용') ? (
          <GajaButton label="Android 위치 설정 열기" variant="secondary" onPress={() => Linking.openSettings()} />
        ) : null}
      </GajaCard>

      <GajaCard title="주행 상태" subtitle={ride.draft ? '로컬 저장 ID가 생성되었습니다.' : '새 주행을 시작할 수 있습니다.'}>
        <View style={styles.metrics}>
          <Metric label="거리" value={formatHudDistance(ride.draft?.distanceMeters ?? 0)} />
          <Metric label="시간" value={formatHudDuration(elapsedMs)} />
          <Metric label="포인트" value={`${ride.draft?.routePoints.length ?? 0}`} />
        </View>
        {!isTracking && ride.draft === null ? <GajaButton label="주행 시작" onPress={() => void ride.start()} disabled={ride.busy} /> : null}
        {isTracking ? (
          <View style={styles.actions}>
            <GajaButton
              label={ride.draft?.status === 'PAUSED' ? '재개' : '일시정지'}
              variant="secondary"
              onPress={() => void ride.togglePause()}
              disabled={ride.busy}
            />
            <GajaButton label="주행 종료 및 저장" onPress={() => void ride.finish()} disabled={ride.busy} />
          </View>
        ) : null}
        {canRetry ? (
          <GajaButton label="지금 다시 전송" onPress={() => void ride.retry()} disabled={ride.busy} />
        ) : null}
        {ride.draft?.status === 'FAILED_TERMINAL' ? (
          <Text style={styles.error}>자동 재전송을 중단했습니다. 로컬 원본은 삭제하지 않았습니다.</Text>
        ) : null}
      </GajaCard>

      {ride.receipt ? (
        <GajaCard title="최근 저장 완료" subtitle="동일한 로컬 저장 ID로 서버 영수증을 확인했습니다.">
          <StatusBadge label="READY" tone="success" />
          <Text style={styles.meta}>서버 주행 기록 #{ride.receipt.rideRecordId}</Text>
          <Text style={styles.meta}>{ride.receipt.linkedCourseId ? `연결 코스 #${ride.receipt.linkedCourseId}` : '코스화 가능 상태'}</Text>
        </GajaCard>
      ) : null}

      <GajaCard title="서버 저장 기록" subtitle="현재 로그인 계정의 최근 주행 결과입니다.">
        {recordsQuery.isPending ? <Text style={styles.meta}>기록을 불러오는 중입니다.</Text> : null}
        {recordsQuery.error ? <Text style={styles.error}>{recordsQuery.error.message}</Text> : null}
        {recordsQuery.data?.slice(0, 3).map((record) => (
          <View key={record.rideRecordId} style={styles.recordRow}>
            <Text style={styles.meta}>#{record.rideRecordId} · {formatHudDistance(record.distanceM)}</Text>
            <StatusBadge label={record.finalizationStatus} tone={record.finalizationStatus === 'READY' ? 'success' : 'warning'} />
          </View>
        ))}
      </GajaCard>
    </GajaScreen>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function statusTone(status: string | undefined): 'success' | 'warning' | 'danger' {
  if (status === 'RECORDING' || status === 'FINALIZING') {
    return 'success';
  }
  if (status === 'FAILED_TERMINAL' || status === 'FAILED_USER_ACTION') {
    return 'danger';
  }
  return 'warning';
}

function requireAccessToken(accessToken: string | null): string {
  if (accessToken === null) {
    throw new MissingAccessTokenError();
  }
  return accessToken;
}

class MissingAccessTokenError extends Error {
  constructor() {
    super('로그인이 필요합니다.');
    this.name = 'MissingAccessTokenError';
  }
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  message: { color: GajaColors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  error: { color: GajaColors.danger, fontSize: 14, lineHeight: 20 },
  meta: { color: GajaColors.textSecondary, fontSize: 13 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: GajaColors.surfaceMuted, padding: 12, borderRadius: 8 },
  metricLabel: { color: GajaColors.textMuted, fontSize: 12 },
  metricValue: { color: GajaColors.textPrimary, fontSize: 20, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
