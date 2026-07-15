import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchCourseDetail, fetchCourseRoutePoints } from '../../domain/course/courseService';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { RoutePreviewMap } from '../../shared/ui/RoutePreviewMap';
import { ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';
import { GajaColors } from '../../shared/design/tokens';
import { CoursePartySection } from './CoursePartySection';
import { evaluatePreStart } from './preRidePolicyGate';

export function PreRideScreen({ courseId }: { courseId: number }) {
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
  const startGateMutation = useMutation({ mutationFn: () => evaluatePreStart(courseId) });
  const routePoints = routePointsQuery.data ?? [];
  const firstPoint = routePoints[0];
  const lastPoint = routePoints.at(-1);
  const hasRoute = routePoints.length >= 2;
  const startEligible = startGateMutation.data?.startGateStatus === 'ELIGIBLE';

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
        <CoursePartySection
          courseId={courseId}
          courseTitle={courseQuery.data?.title ?? null}
          accessToken={accessToken}
          onConfirmRide={(partyId) => requestRideStart(partyId)}
        />
        <GajaButton
          label={startGateMutation.isPending ? '출발 위치 확인 중' : startEligible ? '이 코스로 주행 시작' : '출발 위치 확인'}
          disabled={!courseQuery.data || !hasRoute || startGateMutation.isPending}
          onPress={() => {
            const course = courseQuery.data;
            if (!course || !hasRoute) {
              return;
            }
            if (!startEligible) {
              startGateMutation.mutate();
              return;
            }
            requestRideStart();
          }}
        />
        {startGateMutation.data ? (
          <View style={styles.startGate}>
            <StatusBadge
              label={startGateLabel(startGateMutation.data.startGateStatus)}
              tone={startEligible ? 'success' : 'warning'}
            />
            <Text style={styles.routeSummaryBody}>{startGateMutation.data.defaultMessage}</Text>
          </View>
        ) : null}
        {startGateMutation.error ? <Text style={styles.error}>{startGateMutation.error.message}</Text> : null}
      </GajaCard>
    </GajaScreen>
  );

  function requestRideStart(partyId?: number) {
    const course = courseQuery.data;
    if (!course || !hasRoute) {
      return;
    }
    const navigate = () => router.push({
      pathname: '/ride/free',
      params: {
        courseId: String(course.id),
        courseTitle: course.title,
        ...(partyId === undefined ? {} : { partyId: String(partyId) }),
      },
    });
    if (startEligible) {
      navigate();
      return;
    }
    startGateMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.startGateStatus === 'ELIGIBLE') {
          navigate();
        }
      },
    });
  }
}

function startGateLabel(status: string): string {
  switch (status) {
    case 'ELIGIBLE':
      return '출발 가능';
    case 'BLOCKED':
      return '출발점에서 멀리 있음';
    default:
      return 'GPS 확인 필요';
  }
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
  error: {
    color: GajaColors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  startGate: { gap: 6 },
});
