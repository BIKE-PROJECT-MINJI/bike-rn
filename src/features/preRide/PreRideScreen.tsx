import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchCourseDetail, fetchCourseRoutePoints } from '../../domain/course/courseService';
import { createRideParty, fetchRideParties, joinRideParty, leaveRideParty } from '../../domain/party/partyService';
import type { RidePartyUiModel } from '../../domain/party/partyModels';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { RoutePreviewMap } from '../../shared/ui/RoutePreviewMap';
import { ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';
import { GajaColors } from '../../shared/design/tokens';

export function PreRideScreen({ courseId }: { courseId: number }) {
  const queryClient = useQueryClient();
  const courseQuery = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => fetchCourseDetail(courseId),
    enabled: courseId > 0,
  });
  const routePointsQuery = useQuery({
    queryKey: ['course-route-points', courseId],
    queryFn: () => fetchCourseRoutePoints(courseId),
    enabled: courseId > 0,
  });
  const authSessionQuery = useQuery({ queryKey: ['auth-session', 'pre-ride'], queryFn: loadAuthSession });
  const accessToken = authSessionQuery.data?.accessToken ?? null;
  const partiesQuery = useQuery({
    queryKey: ['ride-parties', courseId],
    queryFn: () => fetchRideParties(courseId, accessToken),
    enabled: courseId > 0 && Boolean(accessToken),
  });
  const invalidateParties = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ride-parties', courseId] });
  };
  const createPartyMutation = useMutation({
    mutationFn: () => createRideParty(courseId, `${courseQuery.data?.title ?? '코스'} 같이 타기`, accessToken),
    onSuccess: invalidateParties,
  });
  const joinPartyMutation = useMutation({
    mutationFn: (partyId: number) => joinRideParty(partyId, accessToken),
    onSuccess: invalidateParties,
  });
  const leavePartyMutation = useMutation({
    mutationFn: (partyId: number) => leaveRideParty(partyId, accessToken),
    onSuccess: invalidateParties,
  });
  const routePoints = routePointsQuery.data ?? [];
  const firstPoint = routePoints[0];
  const lastPoint = routePoints.at(-1);
  const hasRoute = routePoints.length >= 2;
  const partyError = createPartyMutation.error ?? joinPartyMutation.error ?? leavePartyMutation.error ?? partiesQuery.error;

  return (
    <GajaScreen>
      <GajaCard title="출발 전 확인" subtitle="코스 상세 로드가 실패하면 시작을 차단합니다.">
        {courseQuery.isPending ? <LoadingStateView message="코스 정보를 확인하는 중입니다." /> : null}
        {courseQuery.error ? (
          <ErrorStateView title="코스 로드 실패" message={courseQuery.error.message} onRetry={() => courseQuery.refetch()} />
        ) : null}
        {courseQuery.data ? (
          <>
            <StatusBadge label="foreground 주행" tone="success" />
            <GajaCard title={courseQuery.data.title} subtitle={`${courseQuery.data.distanceKm} km · ${courseQuery.data.estimatedDurationMin}분`}>
              {courseQuery.data.difficulty ? (
                <>
                  <StatusBadge label={`난이도 ${courseQuery.data.difficulty.label} · ${courseQuery.data.difficulty.score}점`} tone={courseQuery.data.difficulty.level === 'HARD' ? 'warning' : 'success'} />
                  <Text style={styles.routeSummaryBody}>{courseQuery.data.difficulty.summary}</Text>
                </>
              ) : null}
            </GajaCard>
          </>
        ) : null}
        {routePointsQuery.isPending ? <LoadingStateView message="코스 경로를 불러오는 중입니다." /> : null}
        {routePointsQuery.error ? (
          <ErrorStateView title="코스 경로 실패" message={routePointsQuery.error.message} onRetry={() => routePointsQuery.refetch()} />
        ) : null}
        {routePointsQuery.data ? (
          <>
            <View style={styles.routeSummary}>
              <Text style={styles.routeSummaryTitle}>실제 GPX 경로점 {routePoints.length}개 로드됨</Text>
              {firstPoint && lastPoint ? (
                <Text style={styles.routeSummaryBody}>
                  출발 {formatCoordinate(firstPoint.latitude)}, {formatCoordinate(firstPoint.longitude)} · 도착 {formatCoordinate(lastPoint.latitude)},{' '}
                  {formatCoordinate(lastPoint.longitude)}
                </Text>
              ) : null}
            </View>
            <RoutePreviewMap
              series={[
                {
                  id: `course-${courseId}`,
                  label: '코스 경로',
                  tone: 'course',
                  points: routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
                },
              ]}
            />
          </>
        ) : null}
        <GajaCard title="파티" subtitle="이 코스를 같이 탈 최소 파티를 만들고 참여 상태를 확인합니다.">
          {!accessToken ? <StatusBadge label="로그인 필요" tone="warning" /> : null}
          {accessToken ? (
            <>
              <GajaButton
                label={createPartyMutation.isPending ? '파티 생성 중' : '파티 만들기'}
                variant="secondary"
                disabled={!courseQuery.data || createPartyMutation.isPending}
                onPress={() => createPartyMutation.mutate()}
              />
              {partiesQuery.isPending ? <LoadingStateView message="파티를 확인하는 중입니다." /> : null}
              {partiesQuery.data?.length === 0 ? <Text style={styles.routeSummaryBody}>아직 열린 파티가 없습니다.</Text> : null}
              {partiesQuery.data?.map((party) => (
                <PartyRow
                  key={party.id}
                  party={party}
                  busy={joinPartyMutation.isPending || leavePartyMutation.isPending}
                  onJoin={() => joinPartyMutation.mutate(party.id)}
                  onLeave={() => leavePartyMutation.mutate(party.id)}
                />
              ))}
            </>
          ) : (
            <Text style={styles.routeSummaryBody}>내 정보 탭에서 로그인하면 파티를 만들거나 참여할 수 있습니다.</Text>
          )}
          {partyError ? <Text style={styles.error}>{partyError.message}</Text> : null}
        </GajaCard>
        <GajaButton
          label="이 코스로 주행 시작"
          disabled={!courseQuery.data || !hasRoute}
          onPress={() => {
            const course = courseQuery.data;
            if (!course || !hasRoute) {
              return;
            }
            router.push({ pathname: '/ride/free', params: { courseId: String(course.id), courseTitle: course.title } });
          }}
        />
      </GajaCard>
    </GajaScreen>
  );
}

function PartyRow({
  party,
  busy,
  onJoin,
  onLeave,
}: {
  party: RidePartyUiModel;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const seatLabel = `${party.joinedCount}/${party.capacity}명`;
  return (
    <View style={styles.partyRow}>
      <View style={styles.partyText}>
        <Text style={styles.routeSummaryTitle}>{party.title}</Text>
        <Text style={styles.routeSummaryBody}>{seatLabel}</Text>
      </View>
      {party.currentUserHost ? <StatusBadge label="호스트" tone="success" /> : null}
      {!party.currentUserMember ? (
        <GajaButton label="참여" variant="secondary" disabled={busy || party.joinedCount >= party.capacity} onPress={onJoin} />
      ) : null}
      {party.currentUserMember && !party.currentUserHost ? <GajaButton label="나가기" variant="secondary" disabled={busy} onPress={onLeave} /> : null}
    </View>
  );
}

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

const styles = StyleSheet.create({
  routeSummary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GajaColors.border,
    padding: 12,
    gap: 4,
  },
  routeSummaryTitle: {
    color: GajaColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  routeSummaryBody: {
    color: GajaColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  partyRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GajaColors.border,
    padding: 12,
    gap: 8,
  },
  partyText: {
    gap: 4,
  },
  error: {
    color: GajaColors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
});
