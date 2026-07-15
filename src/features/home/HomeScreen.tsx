import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchCourses, fetchFeaturedCourses } from '../../domain/course/courseService';
import { listPendingRideDrafts } from '../../domain/ride/localRideQueue';
import { GajaColors } from '../../shared/design/tokens';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';
import { FeaturedCourseRow } from './FeaturedCourseRow';
import { HomeActionCard } from './HomeActionCard';
import { HomeHeader } from './HomeHeader';
import { countPendingRideUploads } from './homeRideSummary';

export function HomeScreen() {
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const featuredQuery = useQuery({ queryKey: ['featured-courses'], queryFn: fetchFeaturedCourses });
  const coursesQuery = useQuery({ queryKey: ['courses-home'], queryFn: () => fetchCourses(4) });
  const pendingQuery = useQuery({
    queryKey: ['pending-rides-home'],
    queryFn: async () => listPendingRideDrafts(),
    refetchInterval: 5_000,
  });
  const courses = featuredQuery.data?.length ? featuredQuery.data : coursesQuery.data?.items ?? [];
  const pendingCount = countPendingRideUploads(pendingQuery.data ?? []);

  return (
    <GajaScreen>
      <HomeHeader />
      <View style={styles.actionGrid}>
        <HomeActionCard
          title="AI 코스 만들기"
          description="목적지와 원하는 분위기를 입력해 코스를 찾아보세요."
          actionLabel="만들기"
          icon="sparkles"
          accent="green"
          onPress={() => router.push('/ai-route/create')}
        />
        <HomeActionCard
          title="자유주행 시작"
          description="기록을 먼저 기기에 보존하며 바로 라이딩을 시작합니다."
          actionLabel="시작하기"
          icon="navigate"
          accent="blue"
          onPress={() => router.push('/ride/free')}
        />
      </View>

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner}>
          <View style={styles.pendingIcon}>
            <Ionicons name="cloud-upload" size={24} color={GajaColors.primary} />
          </View>
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>저장 대기 {pendingCount}건</Text>
            <Text style={styles.pendingMeta}>원본은 기기에 안전하게 보관 중입니다.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="저장 대기 기록 보기" onPress={() => router.push('/(tabs)/records')} style={styles.pendingLink}>
            <Ionicons name="chevron-forward" size={22} color={GajaColors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘 추천 코스</Text>
          <Text accessibilityRole="link" onPress={() => router.push('/(tabs)/courses')} style={styles.more}>더보기</Text>
        </View>
        {featuredQuery.isPending && coursesQuery.isPending ? <LoadingStateView message="추천 코스를 불러오는 중입니다." /> : null}
        {featuredQuery.error && coursesQuery.error ? (
          <ErrorStateView title="추천 코스를 불러오지 못했어요" message="잠시 후 다시 확인해 주세요." onRetry={() => Promise.all([featuredQuery.refetch(), coursesQuery.refetch()])} />
        ) : null}
        {courses.slice(0, 2).map((course) => (
          <FeaturedCourseRow key={course.id} course={course} onPress={() => router.push(`/pre-ride/${course.id}`)} />
        ))}
      </View>
      {!sessionQuery.data?.accessToken ? <Text style={styles.loginNote}>마이에서 로그인하면 저장과 파티 기능을 사용할 수 있습니다.</Text> : null}
    </GajaScreen>
  );
}

const styles = StyleSheet.create({
  actionGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  pendingBanner: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GajaColors.border,
    backgroundColor: GajaColors.surface,
  },
  pendingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5E8', alignItems: 'center', justifyContent: 'center' },
  pendingCopy: { flex: 1, gap: 3 },
  pendingTitle: { color: GajaColors.textPrimary, fontSize: 15, fontWeight: '900' },
  pendingMeta: { color: GajaColors.textSecondary, fontSize: 12 },
  pendingLink: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: GajaColors.textPrimary, fontSize: 22, fontWeight: '900' },
  more: { color: GajaColors.textSecondary, fontSize: 14, fontWeight: '700', paddingVertical: 8 },
  loginNote: { color: GajaColors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
