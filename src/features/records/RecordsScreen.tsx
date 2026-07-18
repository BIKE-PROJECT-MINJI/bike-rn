import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchRideRecords } from '../../domain/ride/rideApi';
import type { RideDraft } from '../../domain/ride/rideQueueModel';
import { canManuallyRetryRide } from '../../domain/ride/rideQueueModel';
import { RIDE_ROUTE_QUALITY_REJECTED_ERROR_CODE } from '../../domain/ride/rideRouteQuality';
import { RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE } from '../../domain/ride/rideRetryPolicy';
import { useRideSyncCoordinator } from '../../domain/ride/RideSyncContext';
import { formatHudDistance, formatHudDuration } from '../../domain/ride/rideTracking';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { EmptyStateView, ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';
import { buildRideQualityNotice } from './rideQualityNotice';

export function RecordsScreen() {
  const rideSync = useRideSyncCoordinator();
  const sessionQuery = useQuery({ queryKey: ['auth-session', 'records'], queryFn: loadAuthSession });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const userId = sessionQuery.data?.userId ?? null;
  const recordsQuery = useQuery({
    queryKey: ['ride-records', 'records-tab', userId],
    queryFn: () => fetchRideRecords(requireAccessToken(accessToken)),
    enabled: accessToken !== null,
  });
  const hasNothing = rideSync.pendingDrafts.length === 0 && (recordsQuery.data?.length ?? 0) === 0;

  return (
    <GajaScreen>
      <View style={styles.header}>
        <Text style={styles.title}>기록</Text>
        <Text style={styles.subtitle}>기기에 보관된 원본과 서버 처리 상태를 함께 확인합니다.</Text>
      </View>
      {rideSync.legacyRecovery.totalCount > 0 ? (
        <GajaCard
          title="이전 버전 주행 보존 중"
          subtitle={`계정을 확인할 수 없는 기록 ${rideSync.legacyRecovery.totalCount}건이 기기에 보존되어 있습니다.`}
        >
          <Text style={styles.pendingMeta}>좌표와 상세 내용은 표시하거나 서버로 전송하지 않습니다.</Text>
          {rideSync.legacyRecovery.activeDraftCount > 0 ? (
            <GajaButton
              label={rideSync.syncing ? '정리 중' : '이전 주행 종료하고 원본 보존'}
              variant="secondary"
              disabled={accessToken === null || userId === null || rideSync.syncing}
              onPress={() => confirmLegacyRideQuarantine(() => void rideSync.quarantineLegacyRides())}
            />
          ) : null}
        </GajaCard>
      ) : null}
      {rideSync.pendingDrafts.map((draft) => (
        <PendingRideCard
          key={draft.clientRideId}
          draft={draft}
          retrying={rideSync.syncing}
          canRetry={accessToken !== null && canManuallyRetryRide(draft)}
          retryLabel={draft.lastErrorCode === RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE ? '지금 다시 시도' : '로그인 확인 후 다시 저장'}
          onRetry={() => void rideSync.syncById(draft.clientRideId)}
        />
      ))}
      {!accessToken ? (
        <GajaCard title="서버 기록을 보려면 로그인해 주세요">
          <GajaButton label="마이로 이동" onPress={() => router.push('/(tabs)/profile')} />
        </GajaCard>
      ) : null}
      {recordsQuery.isPending && accessToken ? <LoadingStateView message="저장된 기록을 불러오는 중입니다." /> : null}
      {recordsQuery.error ? <ErrorStateView title="기록을 불러오지 못했어요" message={recordsQuery.error.message} onRetry={() => recordsQuery.refetch()} /> : null}
      {recordsQuery.data?.map((record) => {
        const qualityNotice = buildRideQualityNotice(record.qualityStatus);
        return (
          <GajaCard key={record.rideRecordId} title={`주행 기록 #${record.rideRecordId}`} subtitle={`${formatHudDistance(record.distanceM)} · ${formatHudDuration(record.durationSec * 1000)}`}>
            <StatusBadge label={record.finalizationStatus} tone={record.finalizationStatus === 'READY' ? 'success' : record.finalizationStatus === 'FAILED' ? 'danger' : 'warning'} />
            {qualityNotice ? <StatusBadge label={qualityNotice.label} tone={qualityNotice.tone} /> : null}
            {qualityNotice ? <Text style={styles.pendingMeta}>{qualityNotice.message}</Text> : null}
          </GajaCard>
        );
      })}
      {hasNothing && !recordsQuery.isPending ? <EmptyStateView title="아직 기록이 없어요" message="자유주행을 시작하면 기기에 먼저 안전하게 저장됩니다." /> : null}
    </GajaScreen>
  );
}

function confirmLegacyRideQuarantine(onConfirm: () => void): void {
  Alert.alert(
    '이전 버전 주행을 보존할까요?',
    '계정을 확인할 수 없어 서버에는 보내지 않습니다. 진행 중 상태를 종료해 재개할 수 없게 하고, 좌표 원본은 기기에 격리 보존합니다.',
    [
      { text: '취소', style: 'cancel' },
      { text: '보존', onPress: onConfirm },
    ],
  );
}

function PendingRideCard({
  draft,
  retrying,
  canRetry,
  retryLabel,
  onRetry,
}: {
  readonly draft: RideDraft;
  readonly retrying: boolean;
  readonly canRetry: boolean;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  const tone = draft.status === 'FAILED_TERMINAL' || draft.status === 'FAILED_USER_ACTION' ? 'danger' : 'warning';
  return (
    <GajaCard title="기기 보관 기록" subtitle={`${formatHudDistance(draft.distanceMeters)} · ${draft.routePoints.length}개 위치`}>
      <View style={styles.pendingRow}>
        <Ionicons name="phone-portrait-outline" size={20} color={GajaColors.primary} />
        <StatusBadge label={draft.status} tone={tone} />
      </View>
      <Text style={styles.pendingMeta}>
        {draft.lastErrorCode === RIDE_ROUTE_QUALITY_REJECTED_ERROR_CODE
          ? 'GPS 품질 기준을 통과하지 못해 코스로 만들 수 없습니다. 원본 주행은 기기에 보관됩니다.'
          : '서버 처리가 끝날 때까지 원본을 지우지 않습니다.'}
      </Text>
      {canRetry ? (
        <GajaButton
          label={retrying ? '다시 저장 중' : retryLabel}
          variant="secondary"
          disabled={retrying}
          onPress={onRetry}
        />
      ) : null}
    </GajaCard>
  );
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
  header: { gap: 6 },
  title: { color: GajaColors.textPrimary, fontSize: 28, fontWeight: '900' },
  subtitle: { color: GajaColors.textSecondary, fontSize: 14, lineHeight: 20 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingMeta: { color: GajaColors.textMuted, fontSize: 12, lineHeight: 18 },
});
