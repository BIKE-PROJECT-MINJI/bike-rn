import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Text } from 'react-native';
import { requestAiRoutePlan } from '../../src/domain/airoute/aiRouteService';
import type { AuthSession } from '../../src/domain/auth/authModels';
import { fetchCourseRoutePoints } from '../../src/domain/course/courseService';
import { apiRequest } from '../../src/shared/api/apiClient';
import { GajaCard } from '../../src/shared/ui/GajaCard';
import { GajaScreen } from '../../src/shared/ui/GajaScreen';
import { RoutePreviewMap, type RoutePreviewSeries } from '../../src/shared/ui/RoutePreviewMap';
import { ErrorStateView, LoadingStateView } from '../../src/shared/ui/StateViews';

const QA_COURSE_ID = 1;
const QA_PASSWORD = 'Password123!';

export default function RouteSourcesQaScreen() {
  const smokeEmail = useMemo(() => `rn-route-smoke-${Date.now()}@example.com`, []);
  const courseRouteQuery = useQuery({
    queryKey: ['qa-course-route', QA_COURSE_ID],
    queryFn: () => fetchCourseRoutePoints(QA_COURSE_ID),
  });
  const aiRouteQuery = useQuery({
    queryKey: ['qa-ai-route', smokeEmail],
    queryFn: async () => {
      const session = await registerSmokeUser(smokeEmail);
      return requestAiRoutePlan(
        {
          lat: 37.4812,
          lon: 126.9527,
          destinationLat: 37.5404,
          destinationLon: 127.0692,
          destinationLabel: '건대입구',
          rideStyle: 'SCENIC',
        },
        session.accessToken,
      );
    },
  });

  const series: RoutePreviewSeries[] = [];
  if (courseRouteQuery.data) {
    series.push({
      id: 'qa-course-route',
      label: '코스 경로',
      tone: 'course',
      points: courseRouteQuery.data.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    });
  }
  if (aiRouteQuery.data) {
    series.push({
      id: 'qa-ai-route',
      label: 'AI route',
      tone: 'ai',
      points: aiRouteQuery.data.routePoints.map((point) => ({ latitude: point.lat, longitude: point.lon })),
    });
  }

  return (
    <GajaScreen>
      <GajaCard title="Route source QA" subtitle="Ngrok smoke에서 코스 경로와 AI route source 분리를 확인합니다.">
        {courseRouteQuery.isPending || aiRouteQuery.isPending ? <LoadingStateView message="QA 경로를 불러오는 중입니다." /> : null}
        {courseRouteQuery.error ? <ErrorStateView title="코스 경로 실패" message={courseRouteQuery.error.message} onRetry={() => courseRouteQuery.refetch()} /> : null}
        {aiRouteQuery.error ? <ErrorStateView title="AI route 실패" message={aiRouteQuery.error.message} onRetry={() => aiRouteQuery.refetch()} /> : null}
        {series.length > 0 ? <RoutePreviewMap series={series} /> : null}
        <Text>{smokeEmail}</Text>
      </GajaCard>
    </GajaScreen>
  );
}

async function registerSmokeUser(email: string): Promise<AuthSession> {
  const payload = await apiRequest<{ data: AuthSession }>('/api/v1/auth/register', {
    method: 'POST',
    body: {
      displayName: 'RnRouteSmoke',
      email,
      password: QA_PASSWORD,
    },
  });

  return payload.data;
}
