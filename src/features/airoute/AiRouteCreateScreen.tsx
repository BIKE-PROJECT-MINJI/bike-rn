import { useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { searchAddress } from '../../domain/address/addressService';
import { createAiRouteSession, promoteAiRouteCandidate } from '../../domain/airoute/aiRouteSessionService';
import type { AiRouteCandidateUiModel } from '../../domain/airoute/aiRouteSessionModels';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { GajaColors } from '../../shared/design/tokens';
import { ApiClientError } from '../../shared/api/apiClient';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { RoutePreviewMap } from '../../shared/ui/RoutePreviewMap';
import type { HomeRouteDestination } from '../home/homeRouteRequest';
import { buildHomeAiRouteRequest } from '../home/homeRouteRequest';
import { destinationSelectionError } from '../home/homeRouteRequest';
import { presentAiRouteSessionError } from './aiRouteSessionPresentation';

export function AiRouteCreateScreen() {
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<HomeRouteDestination | null>(null);
  const [routePrompt, setRoutePrompt] = useState('');
  const [retryBlockedUntilMs, setRetryBlockedUntilMs] = useState<number | null>(null);
  const [retryClockMs, setRetryClockMs] = useState(Date.now());
  const sessionQuery = useQuery({ queryKey: ['auth-session', 'ai-route'], queryFn: loadAuthSession });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const destinationError = destinationSelectionError(destinationQuery, selectedDestination);
  const addressMutation = useMutation({ mutationFn: (query: string) => searchAddress(query, accessToken) });
  const sessionMutation = useMutation({
    mutationFn: async () => {
      if (accessToken === null) {
        throw new MissingAiRouteSessionError();
      }
      if (destinationError !== null) {
        throw new DestinationSelectionRequiredError(destinationError);
      }
      if (selectedDestination === null) {
        throw new DestinationSelectionRequiredError('현재 베타에서는 목적지를 먼저 선택해 주세요.');
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new LocationPermissionError();
      }
      const location = await Location.getCurrentPositionAsync({});
      const start = { lat: location.coords.latitude, lon: location.coords.longitude };
      return createAiRouteSession(
        buildHomeAiRouteRequest(start, selectedDestination, routePrompt),
        accessToken,
      );
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 429) {
        const nowMs = Date.now();
        setRetryClockMs(nowMs);
        setRetryBlockedUntilMs(nowMs + (error.retryAfterSeconds ?? 30) * 1000);
      }
    },
  });
  const promoteMutation = useMutation({
    mutationFn: async (candidate: AiRouteCandidateUiModel) => {
      if (accessToken === null || sessionMutation.data === undefined) {
        throw new MissingAiRouteSessionError();
      }
      return promoteAiRouteCandidate(sessionMutation.data.sessionId, candidate, accessToken);
    },
    onSuccess: (result) => router.push(`/pre-ride/${result.courseId}`),
  });
  useEffect(() => {
    if (retryBlockedUntilMs === null) {
      return;
    }
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setRetryClockMs(nowMs);
      if (nowMs >= retryBlockedUntilMs) {
        setRetryBlockedUntilMs(null);
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [retryBlockedUntilMs]);
  const retryWaitSeconds = retryBlockedUntilMs === null
    ? 0
    : Math.max(0, Math.ceil((retryBlockedUntilMs - retryClockMs) / 1000));
  const disabled = accessToken === null
    || routePrompt.trim().length === 0
    || destinationError !== null
    || sessionMutation.isPending
    || retryWaitSeconds > 0;
  const sessionError = sessionMutation.error === null ? null : presentAiRouteSessionError(sessionMutation.error);

  return (
    <GajaScreen>
      <View style={styles.header}>
        <Text style={styles.title}>AI 코스 만들기</Text>
        <Text style={styles.subtitle}>현재 베타에서는 목적지를 먼저 선택해 주세요. 출발점으로 돌아오는 순환 코스는 준비 중입니다.</Text>
      </View>
      <TextInput
        value={destinationQuery}
        onChangeText={(value) => { setDestinationQuery(value); setSelectedDestination(null); addressMutation.reset(); }}
        placeholder="목적지 주소 또는 장소명"
        style={styles.input}
      />
      <GajaButton label={addressMutation.isPending ? '검색 중' : '주소 검색'} variant="secondary" disabled={!accessToken || !destinationQuery.trim() || addressMutation.isPending} onPress={() => addressMutation.mutate(destinationQuery)} />
      {addressMutation.data?.candidates.map((candidate) => (
        <GajaCard key={`${candidate.label}-${candidate.lat}-${candidate.lon}`} title={candidate.label} subtitle={candidate.address} onPress={() => setSelectedDestination({ label: candidate.label, lat: candidate.lat, lon: candidate.lon })}>
          <StatusBadge label={selectedDestination?.label === candidate.label ? '선택됨' : '목적지로 선택'} tone={selectedDestination?.label === candidate.label ? 'success' : 'neutral'} />
        </GajaCard>
      ))}
      {destinationError ? <Text style={styles.warning}>{destinationError}</Text> : null}
      <TextInput value={routePrompt} onChangeText={setRoutePrompt} placeholder="예: 평지 위주로 한강이 보이는 조용한 코스" style={[styles.input, styles.prompt]} multiline />
      <GajaButton
        label={sessionMutation.isPending ? '후보 생성 중' : retryWaitSeconds > 0 ? `${retryWaitSeconds}초 뒤 다시 시도` : '코스 후보 만들기'}
        disabled={disabled}
        onPress={() => sessionMutation.mutate()}
      />
      {!accessToken ? <GajaButton label="로그인하러 가기" variant="secondary" onPress={() => router.push('/(tabs)/profile')} /> : null}
      {addressMutation.error ? <Text style={styles.error}>{addressMutation.error.message}</Text> : null}
      {sessionError ? (
        <GajaCard title={sessionError.title} subtitle={sessionError.message}>
          {sessionError.retryable ? (
            <GajaButton
              label={retryWaitSeconds > 0 ? `${retryWaitSeconds}초 대기 중` : '같은 조건으로 다시 시도'}
              variant="secondary"
              disabled={retryWaitSeconds > 0}
              onPress={() => sessionMutation.mutate()}
            />
          ) : null}
        </GajaCard>
      ) : null}
      {sessionMutation.data ? (
        <View style={styles.candidates}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{sessionMutation.data.candidates.length}개 후보</Text>
            <StatusBadge
              label={sessionMutation.data.status === 'PARTIAL' ? '일부 후보 생성' : sessionMutation.data.fallbackUsed ? '대체 경로 포함' : '생성 완료'}
              tone={sessionMutation.data.status === 'PARTIAL' || sessionMutation.data.fallbackUsed ? 'warning' : 'success'}
            />
          </View>
          {sessionMutation.data.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.candidateId}
              candidate={candidate}
              busy={promoteMutation.isPending}
              onSelect={() => promoteMutation.mutate(candidate)}
            />
          ))}
        </View>
      ) : null}
      {promoteMutation.error ? <Text style={styles.error}>{promoteMutation.error.message}</Text> : null}
    </GajaScreen>
  );
}

function CandidateCard({ candidate, busy, onSelect }: { readonly candidate: AiRouteCandidateUiModel; readonly busy: boolean; readonly onSelect: () => void }) {
  return (
    <GajaCard title={candidate.title} subtitle={candidate.summary}>
      <View style={styles.candidateMeta}>
        <Text style={styles.score}>{candidate.recommendationScore}점</Text>
        <Text style={styles.meta}>{candidate.distanceKm.toFixed(1)} km · 약 {candidate.estimatedDurationMin}분</Text>
        {candidate.preferenceSummary ? <Text style={styles.meta}>{candidate.preferenceSummary}</Text> : null}
        {candidate.totalAscentM === null ? <StatusBadge label="고도 정보 없음" tone="neutral" /> : <StatusBadge label={`상승 ${Math.round(candidate.totalAscentM)}m`} tone="neutral" />}
        <View style={styles.evidenceStatusRow}>
          <StatusBadge label={`고도 ${candidate.elevationStatus ?? 'UNKNOWN'}`} tone={candidate.elevationStatus === 'VERIFIED' ? 'success' : 'neutral'} />
          <StatusBadge label={`풍경 ${candidate.sceneryEvidenceStatus ?? 'UNKNOWN'}`} tone={candidate.sceneryEvidenceStatus === 'PARTIAL' ? 'warning' : 'neutral'} />
          {candidate.routingProvider ? <StatusBadge label={candidate.routingFallbackUsed ? `${candidate.routingProvider} 대체` : candidate.routingProvider} tone={candidate.routingFallbackUsed ? 'warning' : 'success'} /> : null}
        </View>
        {candidate.scoreBreakdown ? (
          <Text style={styles.breakdown}>자전거도로 {candidate.scoreBreakdown.bikePath} · 안전 {candidate.scoreBreakdown.safety} · 선호 {candidate.scoreBreakdown.preferenceFit}</Text>
        ) : null}
        {candidate.evidenceBadges.slice(0, 3).map((badge) => (
          <Text key={`${badge.source}-${badge.label}`} style={styles.evidence}>• {badge.label}: {badge.summary}</Text>
        ))}
      </View>
      <RoutePreviewMap series={[{ id: `ai-route-${candidate.candidateId}`, label: candidate.title, tone: 'ai', points: candidate.routePoints.map((point) => ({ latitude: point.lat, longitude: point.lon })) }]} />
      <GajaButton label={candidate.promotedCourseId === null ? '이 후보 선택' : '저장된 코스로 출발'} disabled={busy} onPress={onSelect} />
    </GajaCard>
  );
}

class LocationPermissionError extends Error {
  constructor() {
    super('현재 위치를 사용하려면 위치 권한이 필요합니다.');
    this.name = 'LocationPermissionError';
  }
}

class MissingAiRouteSessionError extends Error {
  constructor() {
    super('로그인 후 AI 코스를 만들 수 있습니다.');
    this.name = 'MissingAiRouteSessionError';
  }
}

class DestinationSelectionRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DestinationSelectionRequiredError';
  }
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { color: GajaColors.textPrimary, fontSize: 28, fontWeight: '900' },
  subtitle: { color: GajaColors.textSecondary, fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: GajaColors.border, borderRadius: 8, backgroundColor: GajaColors.surface, color: GajaColors.textPrimary, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  prompt: { minHeight: 110, textAlignVertical: 'top' },
  candidates: { gap: 14 },
  resultHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultTitle: { color: GajaColors.textPrimary, fontSize: 20, fontWeight: '900' },
  candidateMeta: { gap: 6 },
  evidenceStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: { color: GajaColors.primary, fontSize: 34, fontWeight: '900' },
  meta: { color: GajaColors.textSecondary, fontSize: 13, lineHeight: 19 },
  breakdown: { color: GajaColors.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  evidence: { color: GajaColors.textMuted, fontSize: 11, lineHeight: 17 },
  error: { color: GajaColors.danger, fontSize: 13, lineHeight: 19 },
  warning: { color: GajaColors.warning, fontSize: 13, lineHeight: 19 },
});
