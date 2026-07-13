import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { fetchCourses } from '../../domain/course/courseService';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { EmptyStateView, ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';

export function CoursesScreen() {
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: () => fetchCourses(30) });

  return (
    <GajaScreen>
      <GajaCard title="코스 목록" subtitle="백엔드 `/api/v1/courses` 계약을 Expo Go에서 확인합니다.">
        {coursesQuery.isPending ? <LoadingStateView message="코스 목록을 불러오는 중입니다." /> : null}
        {coursesQuery.error ? (
          <ErrorStateView title="코스 목록 실패" message={coursesQuery.error.message} onRetry={() => coursesQuery.refetch()} />
        ) : null}
        {coursesQuery.data && coursesQuery.data.items.length === 0 ? <EmptyStateView title="코스 없음" message="조건에 맞는 코스가 없습니다." /> : null}
        {coursesQuery.data?.items.map((course) => (
          <GajaCard key={course.id} title={course.title} subtitle={`${course.distanceKm} km · ${course.estimatedDurationMin}분`} onPress={() => router.push(`/pre-ride/${course.id}`)}>
            {course.difficulty ? <StatusBadge label={`난이도 ${course.difficulty.label}`} tone={course.difficulty.level === 'HARD' ? 'warning' : 'success'} /> : null}
            {course.isRecorded ? <StatusBadge label="기록 기반" tone="success" /> : null}
          </GajaCard>
        ))}
      </GajaCard>
    </GajaScreen>
  );
}
