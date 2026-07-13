import { useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { requestAiRoutePlan, requestAiRoutePlanFromText } from '../../domain/airoute/aiRouteService';
import { searchAddress } from '../../domain/address/addressService';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { fetchCourses, fetchFeaturedCourses } from '../../domain/course/courseService';
import { fetchSystemHealth } from '../../domain/system/systemHealthService';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { RoutePreviewMap } from '../../shared/ui/RoutePreviewMap';
import { EmptyStateView, ErrorStateView, LoadingStateView } from '../../shared/ui/StateViews';
import { buildHomeAiRouteRequest, PROTOTYPE_TEST_START } from './homeRouteRequest';
import type { HomeRouteDestination, HomeRouteStart } from './homeRouteRequest';
import { HomeFallbackBadges } from './HomeFallbackBadges';

export function HomeScreen() {
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<HomeRouteDestination | null>(null);
  const [routePrompt, setRoutePrompt] = useState('');
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const healthQuery = useQuery({ queryKey: ['system-health'], queryFn: fetchSystemHealth, retry: false });
  const featuredQuery = useQuery({ queryKey: ['featured-courses'], queryFn: fetchFeaturedCourses });
  const coursesQuery = useQuery({ queryKey: ['courses-home'], queryFn: () => fetchCourses(8) });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const addressMutation = useMutation({ mutationFn: (query: string) => searchAddress(query, accessToken) });
  const aiRouteMutation = useMutation({
    mutationFn: async (fallbackStart: HomeRouteStart | null) => {
      let start = fallbackStart;
      if (start === null) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('위치 권한이 없으면 현재 위치 기반 추천을 만들 수 없습니다.');
        }
        const location = await Location.getCurrentPositionAsync({});
        start = {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        };
      }
      if (!selectedDestination && routePrompt.trim().length > 0) {
        return requestAiRoutePlanFromText({ lat: start.lat, lon: start.lon, text: routePrompt.trim() }, accessToken);
      }
      return requestAiRoutePlan(buildHomeAiRouteRequest(start, selectedDestination, destinationQuery, routePrompt), accessToken);
    },
  });

  const firstCourses = useMemo(() => coursesQuery.data?.items.slice(0, 3) ?? [], [coursesQuery.data]);
  const canUseRecommendation = Boolean(accessToken);
  const hasRoutePrompt = routePrompt.trim().length > 0;
  const routeButtonDisabled = !canUseRecommendation || (!selectedDestination && !hasRoutePrompt) || aiRouteMutation.isPending;
  const handleDestinationQueryChange = (value: string) => {
    setDestinationQuery(value);
    setSelectedDestination(null);
    addressMutation.reset();
    aiRouteMutation.reset();
  };

  return (
    <GajaScreen>
      <GajaCard title="서버 연결" subtitle="폰에서 백엔드와 ngrok 연결이 살아 있는지 먼저 확인합니다.">
        {healthQuery.isPending ? <LoadingStateView message="백엔드 연결을 확인하는 중입니다." /> : null}
        {healthQuery.data ? (
          <View style={styles.stack}>
            <StatusBadge label={healthQuery.data.label} tone={healthQuery.data.status === 'ok' ? 'success' : 'warning'} />
            <Text style={styles.meta}>{healthQuery.data.service}</Text>
          </View>
        ) : null}
        {healthQuery.error ? (
          <View style={styles.stack}>
            <StatusBadge label="백엔드 연결 실패" tone="danger" />
            <Text style={styles.error}>{healthQuery.error.message}</Text>
            <GajaButton label="연결 다시 확인" variant="secondary" onPress={() => healthQuery.refetch()} />
          </View>
        ) : null}
      </GajaCard>

      <GajaCard title="GAJA" subtitle="주소를 입력하고 Expo Go에서 백엔드 추천 흐름을 빠르게 확인합니다.">
        <TextInput
          value={destinationQuery}
          onChangeText={handleDestinationQueryChange}
          placeholder="목적지 주소 또는 장소명"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={routePrompt}
          onChangeText={(value) => {
            setRoutePrompt(value);
            aiRouteMutation.reset();
          }}
          placeholder="원하는 코스 설명 예: 평지 한강이 보이는 코스"
          style={styles.input}
          autoCapitalize="none"
          multiline
        />
        <View style={styles.row}>
          <GajaButton
            label="주소 검색"
            variant="secondary"
            onPress={() => addressMutation.mutate(destinationQuery)}
            disabled={!canUseRecommendation || destinationQuery.trim().length === 0 || addressMutation.isPending}
          />
          <GajaButton
            label="현재 위치로 추천"
            onPress={() => aiRouteMutation.mutate(null)}
            disabled={routeButtonDisabled}
          />
        </View>
        <GajaButton
          label="테스트 좌표로 추천"
          variant="secondary"
          onPress={() => aiRouteMutation.mutate(PROTOTYPE_TEST_START)}
          disabled={routeButtonDisabled}
        />
        {!canUseRecommendation ? <Text style={styles.meta}>주소 검색과 경로 추천은 내 정보 탭에서 로그인 또는 계정 만들기 후 사용할 수 있습니다.</Text> : null}
        {!selectedDestination && hasRoutePrompt ? <Text style={styles.meta}>목적지를 선택하지 않으면 현재 위치 기반 추천 코스로 생성합니다.</Text> : null}
        <HomeFallbackBadges addressResult={addressMutation.data} aiRouteResult={aiRouteMutation.data} />
        {addressMutation.data ? (
          <View style={styles.stack}>
            <StatusBadge label={addressMutation.data.statusText} tone={addressMutation.data.status === 'SUCCESS' ? 'success' : 'warning'} />
            {addressMutation.data.candidates.map((candidate) => (
              <GajaCard
                key={`${candidate.label}-${candidate.lat}-${candidate.lon}`}
                title={candidate.label}
                subtitle={candidate.address}
                onPress={() => setSelectedDestination({ label: candidate.label, lat: candidate.lat, lon: candidate.lon })}
              >
                <Text style={styles.meta}>{selectedDestination?.label === candidate.label ? '선택됨' : '선택해서 경로 추천에 사용'}</Text>
              </GajaCard>
            ))}
          </View>
        ) : null}
        {addressMutation.error ? <Text style={styles.error}>{addressMutation.error.message}</Text> : null}
        {aiRouteMutation.data ? (
          <GajaCard title={aiRouteMutation.data.explanation.headline} subtitle={aiRouteMutation.data.explanation.reason}>
            <Text style={styles.score}>{aiRouteMutation.data.recommendationScore.total}점</Text>
            <Text style={styles.meta}>{aiRouteMutation.data.explanation.caution}</Text>
            <RoutePreviewMap
              series={[
                {
                  id: 'ai-route-plan',
                  label: 'AI route',
                  tone: 'ai',
                  points: aiRouteMutation.data.routePoints.map((point) => ({ latitude: point.lat, longitude: point.lon })),
                },
              ]}
            />
          </GajaCard>
        ) : null}
        {aiRouteMutation.error ? <Text style={styles.error}>{aiRouteMutation.error.message}</Text> : null}
      </GajaCard>

      <GajaCard title="바로 주행" subtitle="foreground 위치 기반 HUD 골격을 확인합니다.">
        <GajaButton label="자유 주행 시작" onPress={() => router.push('/ride/free')} />
      </GajaCard>

      <GajaCard title="추천 코스">
        {featuredQuery.isPending ? <LoadingStateView message="추천 코스를 불러오는 중입니다." /> : null}
        {featuredQuery.error ? (
          <ErrorStateView title="추천 코스 실패" message={featuredQuery.error.message} onRetry={() => featuredQuery.refetch()} />
        ) : null}
        {featuredQuery.data?.map((course) => (
          <GajaCard key={course.id} title={course.title} subtitle={`${course.distanceKm} km · ${course.estimatedDurationMin}분`} onPress={() => router.push(`/pre-ride/${course.id}`)}>
            <StatusBadge label={course.featuredRank ? `${course.featuredRank}위 추천` : '추천'} tone="success" />
            {course.difficulty ? <StatusBadge label={`난이도 ${course.difficulty.label}`} tone={course.difficulty.level === 'HARD' ? 'warning' : 'success'} /> : null}
          </GajaCard>
        ))}
      </GajaCard>

      <GajaCard title="전체 코스">
        {coursesQuery.isPending ? <LoadingStateView message="코스 목록을 불러오는 중입니다." /> : null}
        {coursesQuery.error ? (
          <ErrorStateView title="전체 코스 실패" message={coursesQuery.error.message} onRetry={() => coursesQuery.refetch()} />
        ) : null}
        {coursesQuery.data && coursesQuery.data.items.length === 0 ? <EmptyStateView title="코스 없음" message="아직 표시할 코스가 없습니다." /> : null}
        {firstCourses.map((course) => (
          <GajaCard key={course.id} title={course.title} subtitle={`${course.distanceKm} km · ${course.estimatedDurationMin}분`} onPress={() => router.push(`/pre-ride/${course.id}`)}>
            {course.difficulty ? <StatusBadge label={`난이도 ${course.difficulty.label}`} tone={course.difficulty.level === 'HARD' ? 'warning' : 'success'} /> : null}
          </GajaCard>
        ))}
      </GajaCard>
    </GajaScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: GajaColors.surfaceMuted,
    borderColor: GajaColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: GajaColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  stack: {
    gap: 10,
  },
  score: {
    color: GajaColors.primary,
    fontSize: 36,
    fontWeight: '900',
  },
  meta: {
    color: GajaColors.textSecondary,
    fontSize: 13,
  },
  error: {
    color: GajaColors.danger,
    fontSize: 13,
  },
});
