import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import type { RidePartyUiModel } from '../../domain/party/partyModels';
import {
  fetchRidePartiesByScope,
  joinRideParty,
  leaveRideParty,
  reportRideParty,
  type RidePartyBrowseScope,
  type RidePartyReportReason,
} from '../../domain/party/partyService';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { EmptyStateView, ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';

export function PartyLandingScreen() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<RidePartyBrowseScope>('ALL');
  const sessionQuery = useQuery({ queryKey: ['auth-session', 'party'], queryFn: loadAuthSession });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const partiesQuery = useQuery({
    queryKey: ['ride-parties-browse', scope],
    queryFn: () => fetchRidePartiesByScope(scope, requireAccessToken(accessToken)),
    enabled: accessToken !== null,
    refetchInterval: 5_000,
  });
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ride-parties-browse'] });
  };
  const joinMutation = useMutation({ mutationFn: (partyId: number) => joinRideParty(partyId, accessToken), onSuccess: invalidate });
  const leaveMutation = useMutation({ mutationFn: (partyId: number) => leaveRideParty(partyId, accessToken), onSuccess: invalidate });
  const reportMutation = useMutation({
    mutationFn: (input: { readonly partyId: number; readonly reason: RidePartyReportReason }) =>
      reportRideParty(input.partyId, input.reason, requireAccessToken(accessToken)),
    onSuccess: invalidate,
  });
  const busy = joinMutation.isPending || leaveMutation.isPending || reportMutation.isPending;
  const mutationError = joinMutation.error ?? leaveMutation.error ?? reportMutation.error;

  return (
    <GajaScreen>
      <View style={styles.header}>
        <Text style={styles.title}>파티</Text>
        <Text style={styles.subtitle}>함께 탈 파티를 찾고, 참여한 파티는 한곳에서 관리합니다.</Text>
      </View>
      <View accessibilityRole="tablist" style={styles.scopeControl}>
        <ScopeButton label="전체 파티" selected={scope === 'ALL'} onPress={() => setScope('ALL')} />
        <ScopeButton label="내 파티" selected={scope === 'MINE'} onPress={() => setScope('MINE')} />
      </View>
      {accessToken === null ? (
        <GajaCard title="로그인이 필요합니다" subtitle="파티 참여와 위치 공유는 인증된 사용자만 이용할 수 있습니다.">
          <GajaButton label="마이에서 로그인" onPress={() => router.push('/(tabs)/profile')} />
        </GajaCard>
      ) : null}
      {partiesQuery.isPending && accessToken !== null ? <LoadingStateView message="파티를 불러오는 중입니다." /> : null}
      {partiesQuery.error ? (
        <ErrorStateView title="파티를 불러오지 못했어요" message={partiesQuery.error.message} onRetry={() => partiesQuery.refetch()} />
      ) : null}
      {partiesQuery.data?.map((party) => (
        <PartyBrowseCard
          key={party.id}
          party={party}
          busy={busy}
          onJoin={() => joinMutation.mutate(party.id)}
          onLeave={() => leaveMutation.mutate(party.id)}
          onOpenCourse={() => router.push(`/pre-ride/${party.courseId}`)}
          onReport={() => confirmReport(party, (reason) => reportMutation.mutate({ partyId: party.id, reason }))}
        />
      ))}
      {partiesQuery.data?.length === 0 ? (
        <EmptyStateView
          title={scope === 'MINE' ? '참여 중인 파티가 없어요' : '현재 모집 중인 파티가 없어요'}
          message="코스 상세에서 새 파티를 만들 수 있습니다."
        />
      ) : null}
      {mutationError ? <Text style={styles.error}>{mutationError.message}</Text> : null}
    </GajaScreen>
  );
}

function ScopeButton({ label, selected, onPress }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.scopeButton, selected ? styles.scopeSelected : null]}>
      <Text style={[styles.scopeText, selected ? styles.scopeTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function PartyBrowseCard({ party, busy, onJoin, onLeave, onOpenCourse, onReport }: {
  readonly party: RidePartyUiModel;
  readonly busy: boolean;
  readonly onJoin: () => void;
  readonly onLeave: () => void;
  readonly onOpenCourse: () => void;
  readonly onReport: () => void;
}) {
  return (
    <GajaCard title={party.title} subtitle={`${party.joinedCount}/${party.capacity}명 · 코스 #${party.courseId}`}>
      <View style={styles.statusRow}>
        <Ionicons name="people" size={20} color={GajaColors.routeBlue} />
        <StatusBadge label={party.status === 'RIDING' ? '주행 중' : '모집 중'} tone={party.status === 'RIDING' ? 'warning' : 'success'} />
        {party.currentUserHost ? <StatusBadge label="호스트" tone="success" /> : null}
      </View>
      <GajaButton label="코스와 파티 상세" variant="secondary" onPress={onOpenCourse} />
      {!party.currentUserMember && party.status === 'OPEN' ? (
        <GajaButton label="참여하기" disabled={busy || party.joinedCount >= party.capacity} onPress={onJoin} />
      ) : null}
      {party.currentUserMember && !party.currentUserHost && party.status === 'OPEN' ? (
        <GajaButton label="파티 나가기" variant="secondary" disabled={busy} onPress={onLeave} />
      ) : null}
      {!party.currentUserHost ? <GajaButton label="신고" variant="secondary" disabled={busy} onPress={onReport} /> : null}
    </GajaCard>
  );
}

function confirmReport(party: RidePartyUiModel, report: (reason: RidePartyReportReason) => void): void {
  Alert.alert(`${party.title} 신고`, '신고 사유를 선택해 주세요.', [
    { text: '취소', style: 'cancel' },
    { text: '스팸/상업성', onPress: () => report('SPAM_OR_COMMERCIAL') },
    { text: '위협/괴롭힘', style: 'destructive', onPress: () => report('HARASSMENT_OR_THREAT') },
  ]);
}

function requireAccessToken(accessToken: string | null): string {
  if (accessToken === null) {
    throw new PartyAuthenticationError();
  }
  return accessToken;
}

class PartyAuthenticationError extends Error {
  constructor() {
    super('파티 기능을 이용하려면 로그인이 필요합니다.');
    this.name = 'PartyAuthenticationError';
  }
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { color: GajaColors.textPrimary, fontSize: 28, fontWeight: '900' },
  subtitle: { color: GajaColors.textSecondary, fontSize: 14, lineHeight: 20 },
  scopeControl: { minHeight: 44, flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: GajaColors.border, overflow: 'hidden' },
  scopeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: GajaColors.surface },
  scopeSelected: { backgroundColor: GajaColors.primary },
  scopeText: { color: GajaColors.textSecondary, fontSize: 14, fontWeight: '800' },
  scopeTextSelected: { color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  error: { color: GajaColors.danger, fontSize: 13, lineHeight: 19 },
});
