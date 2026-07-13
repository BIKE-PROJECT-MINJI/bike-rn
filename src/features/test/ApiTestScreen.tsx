import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { resolveApiBaseUrl } from '../../shared/config/env';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import {
  apiTestActions,
  createApiTestLog,
  type ApiTestAction,
  type ApiTestLog,
} from './apiTestActions';
import { ApiTestActionPanel } from './ApiTestActionPanel';
import {
  extractAiCandidateId,
  extractAiSessionId,
  extractCourseId,
  extractFirstCourseId,
  extractPartyId,
  extractRideRecordId,
  normalizeNumber,
} from './apiTestExtractors';
import { ApiTestInputPanel } from './ApiTestInputPanel';
import { ApiTestLogList } from './ApiTestLogList';
import { DEFAULT_TEST_COURSE_ID } from './apiTestShared';

export function ApiTestScreen() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const [courseIdInput, setCourseIdInput] = useState(String(DEFAULT_TEST_COURSE_ID));
  const [rideRecordId, setRideRecordId] = useState<number | null>(null);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [aiSessionId, setAiSessionId] = useState<number | null>(null);
  const [aiCandidateId, setAiCandidateId] = useState<number | null>(null);
  const [addressQuery, setAddressQuery] = useState('잠실역');
  const [routePrompt, setRoutePrompt] = useState('평지 한강이 보이는 코스');
  const [betaCode, setBetaCode] = useState('BIKE-BETA-TEST');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [logs, setLogs] = useState<readonly ApiTestLog[]>([]);

  const accessToken = sessionQuery.data?.accessToken ?? null;
  const refreshToken = sessionQuery.data?.refreshToken ?? null;
  const courseId = normalizeNumber(courseIdInput, DEFAULT_TEST_COURSE_ID);
  const groupedActions = groupActions(apiTestActions);
  const pushLog = (log: ApiTestLog) => setLogs((current) => [log, ...current].slice(0, 8));

  const runAction = async (action: ApiTestAction) => {
    if (action.needsAuth && !accessToken) {
      pushLog(createApiTestLog(action, false, new Error('로그인이 필요한 API입니다. 내 정보 탭에서 먼저 로그인하세요.')));
      return;
    }
    setRunningId(action.id);
    try {
      const payload = await action.run({
        accessToken,
        refreshToken,
        courseId,
        rideRecordId,
        partyId,
        aiSessionId,
        aiCandidateId,
        addressQuery,
        routePrompt,
        betaCode,
      });
      const nextCourseId = extractCourseId(payload) ?? (action.id === 'course-list' ? extractFirstCourseId(payload) : null);
      const nextRideRecordId = extractRideRecordId(payload);
      const nextPartyId = extractPartyId(payload);
      const nextAiSessionId = extractAiSessionId(payload);
      const nextAiCandidateId = extractAiCandidateId(payload);
      if (nextCourseId !== null) {
        setCourseIdInput(String(nextCourseId));
      }
      if (nextRideRecordId !== null) {
        setRideRecordId(nextRideRecordId);
      }
      if (nextPartyId !== null) {
        setPartyId(nextPartyId);
      }
      if (nextAiSessionId !== null) {
        setAiSessionId(nextAiSessionId);
      }
      if (nextAiCandidateId !== null) {
        setAiCandidateId(nextAiCandidateId);
      }
      pushLog(createApiTestLog(action, true, payload));
    } catch (error) {
      if (error instanceof Error) {
        pushLog(createApiTestLog(action, false, error));
      } else {
        pushLog(createApiTestLog(action, false, new Error('알 수 없는 오류가 발생했습니다.')));
      }
    } finally {
      setRunningId(null);
    }
  };

  return (
    <GajaScreen>
      <GajaCard title="API 기능 테스트" subtitle="실사용 디자인이 아니라 백엔드 기능 연결 여부를 빠르게 보는 얇은 콘솔입니다.">
        <View style={styles.stack}>
          <Text style={styles.meta}>BASE: {resolveApiBaseUrl()}</Text>
          <StatusBadge label={accessToken ? '로그인 세션 있음' : '로그인 필요 API 있음'} tone={accessToken ? 'success' : 'warning'} />
          <GajaButton
            label="세션 다시 읽기"
            variant="secondary"
            onPress={() => queryClient.invalidateQueries({ queryKey: ['auth-session'] })}
          />
        </View>
      </GajaCard>

      <ApiTestInputPanel
        courseIdInput={courseIdInput}
        rideRecordIdInput={rideRecordId === null ? '' : String(rideRecordId)}
        partyIdInput={partyId === null ? '' : String(partyId)}
        aiSessionIdInput={aiSessionId === null ? '' : String(aiSessionId)}
        aiCandidateIdInput={aiCandidateId === null ? '' : String(aiCandidateId)}
        addressQuery={addressQuery}
        routePrompt={routePrompt}
        betaCode={betaCode}
        onCourseIdChange={setCourseIdInput}
        onRideRecordIdChange={(value) => setRideRecordId(value.trim().length === 0 ? null : normalizeNumber(value, 0))}
        onPartyIdChange={(value) => setPartyId(value.trim().length === 0 ? null : normalizeNumber(value, 0))}
        onAiSessionIdChange={(value) => setAiSessionId(value.trim().length === 0 ? null : normalizeNumber(value, 0))}
        onAiCandidateIdChange={(value) => setAiCandidateId(value.trim().length === 0 ? null : normalizeNumber(value, 0))}
        onAddressQueryChange={setAddressQuery}
        onRoutePromptChange={setRoutePrompt}
        onBetaCodeChange={setBetaCode}
      />
      <ApiTestActionPanel
        groupedActions={groupedActions}
        runningId={runningId}
        hasAccessToken={Boolean(accessToken)}
        onRun={(action) => {
          void runAction(action);
        }}
      />
      <ApiTestLogList logs={logs} />
    </GajaScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  meta: {
    color: GajaColors.textSecondary,
    fontSize: 13,
  },
});

function groupActions(actions: readonly ApiTestAction[]): readonly { readonly title: string; readonly actions: readonly ApiTestAction[] }[] {
  const groups = new Map<string, ApiTestAction[]>();
  actions.forEach((action) => {
    const current = groups.get(action.group) ?? [];
    current.push(action);
    groups.set(action.group, current);
  });
  return [...groups.entries()].map(([title, grouped]) => ({ title, actions: grouped }));
}
