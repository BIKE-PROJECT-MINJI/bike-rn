import { apiRequest } from '../../shared/api/apiClient';
import { extractData } from './apiTestExtractors';
import {
  buildAiPlanPayload,
  buildAiSessionPayload,
  buildCourseUpdatePayload,
  buildImportGpxPayload,
  buildPreferencePayload,
  buildProfileUpdatePayload,
  buildRidePolicyPayload,
  buildRideSummaryPayload,
  buildSampleRidePayload,
} from './apiTestPayloads';
import { DEFAULT_TEST_LAT, DEFAULT_TEST_LON, requiredId } from './apiTestShared';

export type ApiTestContext = {
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly courseId: number;
  readonly rideRecordId: number | null;
  readonly partyId: number | null;
  readonly aiSessionId: number | null;
  readonly aiCandidateId: number | null;
  readonly addressQuery: string;
  readonly routePrompt: string;
  readonly betaCode: string;
};

export type ApiTestAction = {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly needsAuth?: boolean;
  readonly run: (context: ApiTestContext) => Promise<unknown>;
};

export type ApiTestLog = {
  readonly id: string;
  readonly title: string;
  readonly ok: boolean;
  readonly summary: string;
  readonly payload: string;
};

export const apiTestActions: readonly ApiTestAction[] = [
  action('health', 'Ops', '서버 health', () => apiRequest<unknown>('/health')),
  action('health-monitor', 'Ops', 'health monitor', () => apiRequest<unknown>('/health/monitor')),
  action('auth-me', 'Auth', 'Auth me', ({ accessToken }) => apiRequest<unknown>('/api/v1/auth/me', { accessToken }), true),
  action('auth-refresh', 'Auth', '토큰 refresh', ({ refreshToken }) =>
    apiRequest<unknown>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } }),
  ),
  action('auth-logout', 'Auth', '로그아웃 API', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/auth/logout', { method: 'POST', accessToken }),
  true),
  action('beta-verify', 'Beta', '베타 코드 검증', ({ betaCode }) =>
    apiRequest<unknown>('/api/v1/beta-invitations/verify', { method: 'POST', body: { code: betaCode } }),
  ),
  action('profile-me', 'Profile', '프로필 me', ({ accessToken }) => apiRequest<unknown>('/api/v1/profile/me', { accessToken }), true),
  action('profile-summary', 'Profile', '활동 요약', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/profile/me/activity-summary', { accessToken }),
  true),
  action('profile-preferences', 'Profile', '선호 설정 조회', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/profile/me/preferences', { accessToken }),
  true),
  action('profile-update', 'Profile', '프로필 수정', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/profile/me', { method: 'PATCH', accessToken, body: buildProfileUpdatePayload() }),
  true),
  action('preference-update', 'Profile', '선호 설정 수정', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/profile/me/preferences', { method: 'PATCH', accessToken, body: buildPreferencePayload() }),
  true),
  action('weather-current', 'Weather', '현재 날씨', () =>
    apiRequest<unknown>(`/api/v1/weather/current?lat=${DEFAULT_TEST_LAT}&lon=${DEFAULT_TEST_LON}`),
  ),
  action('course-list', 'Course', '코스 목록', () => apiRequest<unknown>('/api/v1/courses?limit=10')),
  action('course-featured', 'Course', '추천 코스', () =>
    apiRequest<unknown>(`/api/v1/courses/featured?lat=${DEFAULT_TEST_LAT}&lon=${DEFAULT_TEST_LON}`),
  ),
  action('course-search', 'Course', '코스 검색', ({ addressQuery }) =>
    apiRequest<unknown>(`/api/v1/courses/search?q=${encodeURIComponent(addressQuery)}&sort=LATEST`),
  ),
  action('course-detail', 'Course', '코스 상세', ({ courseId }) => apiRequest<unknown>(`/api/v1/courses/${courseId}`)),
  action('route-points', 'Course', 'route points', ({ courseId }) => apiRequest<unknown>(`/api/v1/courses/${courseId}/route-points`)),
  action('course-import-gpx', 'Course', 'GPX 코스 주입', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/courses/import-gpx', { method: 'POST', accessToken, body: buildImportGpxPayload() }),
  true),
  action('course-update', 'Course', '코스 수정', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}`, { method: 'PUT', accessToken, body: buildCourseUpdatePayload() }),
  true),
  action('course-visibility', 'Course', '공개 범위 변경', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/visibility`, { method: 'PATCH', accessToken, body: { visibility: 'PRIVATE' } }),
  true),
  action('course-publish', 'Course', '코스 공개', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/publication`, { method: 'POST', accessToken }),
  true),
  action('course-unpublish', 'Course', '코스 공개 취소', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/publication`, { method: 'DELETE', accessToken }),
  true),
  action('course-report', 'Course', '코스 신고', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/reports`, { method: 'POST', accessToken, body: { reason: 'INAPPROPRIATE_CONTENT' } }),
  true),
  action('course-share', 'Course', '공유 정보', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/share`, { method: 'POST', accessToken }),
  true),
  action('course-download', 'Course', '코스 다운로드', ({ accessToken, courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/download`, { accessToken }),
  true),
  action('ride-policy', 'Follow', 'HUD 판정', ({ courseId }) =>
    apiRequest<unknown>(`/api/v1/courses/${courseId}/ride-policy/evaluate`, { method: 'POST', body: buildRidePolicyPayload() }),
  ),
  action('ride-save', 'Ride', '자유주행 저장', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/ride-records', { method: 'POST', accessToken, body: buildSampleRidePayload() }),
  true),
  action('ride-summary-save', 'Ride', 'summary 저장', ({ accessToken }) =>
    apiRequest<unknown>('/api/v1/ride-records/summary', { method: 'POST', accessToken, body: buildRideSummaryPayload() }),
  true),
  action('ride-list', 'Ride', '주행 기록 목록', ({ accessToken }) => apiRequest<unknown>('/api/v1/ride-records', { accessToken }), true),
  action('ride-status', 'Ride', 'finalization 상태', ({ accessToken, rideRecordId }) =>
    apiRequest<unknown>(`/api/v1/ride-records/${requiredId(rideRecordId, 'rideRecordId')}`, { accessToken }),
  true),
  action('ride-trace', 'Ride', 'trace 별도 저장', ({ accessToken, rideRecordId }) =>
    apiRequest<unknown>(`/api/v1/ride-records/${requiredId(rideRecordId, 'rideRecordId')}/trace`, {
      method: 'POST',
      accessToken,
      body: { routePoints: buildSampleRidePayload().routePoints },
    }),
  true),
  action('ride-regenerate', 'Ride', 'finalization 재처리', ({ accessToken, rideRecordId }) =>
    apiRequest<unknown>(`/api/v1/ride-records/${requiredId(rideRecordId, 'rideRecordId')}/regenerate`, { method: 'POST', accessToken }),
  true),
  action('ride-delete', 'Ride', '주행 삭제', ({ accessToken, rideRecordId }) =>
    apiRequest<unknown>(`/api/v1/ride-records/${requiredId(rideRecordId, 'rideRecordId')}`, { method: 'DELETE', accessToken }),
  true),
  action('course-from-ride', 'Ride', '주행 기록 코스화', ({ accessToken, rideRecordId }) =>
    apiRequest<unknown>('/api/v1/courses', {
      method: 'POST',
      accessToken,
      body: {
        sourceRideRecordId: requiredId(rideRecordId, 'rideRecordId'),
        name: 'RN 기능 테스트 코스',
        description: 'RN 테스트 콘솔에서 만든 기록 기반 코스',
        visibility: 'PRIVATE',
      },
    }),
  true),
  action('address', 'AI Route', '주소 검색', ({ addressQuery }) =>
    apiRequest<unknown>(`/api/v1/addresses/search?query=${encodeURIComponent(addressQuery)}&page=1&size=3`),
  ),
  action('ai-plan', 'AI Route', 'AI 좌표 코스', ({ accessToken, routePrompt }) =>
    apiRequest<unknown>('/api/v1/ai-routes/plan', { method: 'POST', accessToken, body: buildAiPlanPayload(routePrompt) }),
  ),
  action('ai-text', 'AI Route', 'AI 텍스트 코스', ({ accessToken, routePrompt }) =>
    apiRequest<unknown>('/api/v1/ai-routes/plan/from-text', {
      method: 'POST',
      accessToken,
      body: { lat: DEFAULT_TEST_LAT, lon: DEFAULT_TEST_LON, text: routePrompt },
    }),
  ),
  action('ai-session', 'AI Route', 'AI 세션 생성', ({ accessToken, routePrompt }) =>
    apiRequest<unknown>('/api/v1/ai-route-sessions', { method: 'POST', accessToken, body: buildAiSessionPayload(routePrompt) }),
  true),
  action('ai-session-get', 'AI Route', 'AI 세션 조회', ({ accessToken, aiSessionId }) =>
    apiRequest<unknown>(`/api/v1/ai-route-sessions/${requiredId(aiSessionId, 'aiSessionId')}`, { accessToken }),
  true),
  action('ai-promote-course', 'AI Route', 'AI 후보 코스화', ({ accessToken, aiSessionId, aiCandidateId }) =>
    apiRequest<unknown>(`/api/v1/ai-route-sessions/${requiredId(aiSessionId, 'aiSessionId')}/candidates/${requiredId(aiCandidateId, 'aiCandidateId')}/course`, {
      method: 'POST',
      accessToken,
      body: { name: 'RN AI 후보 코스', description: 'RN 테스트 콘솔에서 승격한 AI 후보', visibility: 'PRIVATE' },
    }),
  true),
  action('party-list', 'Party', 'Party 목록', ({ accessToken, courseId }) => apiRequest<unknown>(`/api/v1/parties?courseId=${courseId}`, { accessToken }), true),
  action('party-create', 'Party', 'Party 생성', ({ accessToken, courseId }) =>
    apiRequest<unknown>('/api/v1/parties', { method: 'POST', accessToken, body: { courseId, title: 'RN 기능 테스트 파티', capacity: 6 } }),
  true),
  action('party-join', 'Party', 'Party 참여', ({ accessToken, partyId }) =>
    apiRequest<unknown>(`/api/v1/parties/${requiredId(partyId, 'partyId')}/join`, { method: 'POST', accessToken }),
  true),
  action('party-members', 'Party', 'Party 멤버', ({ accessToken, partyId }) =>
    apiRequest<unknown>(`/api/v1/parties/${requiredId(partyId, 'partyId')}/members`, { accessToken }),
  true),
  action('party-socket-token', 'Party', 'socket token', ({ accessToken, partyId }) =>
    apiRequest<unknown>(`/api/v1/parties/${requiredId(partyId, 'partyId')}/socket-token`, { method: 'POST', accessToken }),
  true),
  action('party-report', 'Party', 'Party 신고', ({ accessToken, partyId }) =>
    apiRequest<unknown>(`/api/v1/parties/${requiredId(partyId, 'partyId')}/reports`, { method: 'POST', accessToken, body: { reason: 'SPAM_OR_COMMERCIAL' } }),
  true),
  action('party-leave', 'Party', 'Party 나가기', ({ accessToken, partyId }) =>
    apiRequest<unknown>(`/api/v1/parties/${requiredId(partyId, 'partyId')}/leave`, { method: 'POST', accessToken }),
  true),
];

export function createApiTestLog(action: ApiTestAction, ok: boolean, payload: unknown): ApiTestLog {
  return {
    id: `${action.id}-${Date.now()}`,
    title: action.title,
    ok,
    summary: summarizePayload(payload),
    payload: stringifyPayload(payload),
  };
}

function action(
  id: string,
  group: string,
  title: string,
  run: (context: ApiTestContext) => Promise<unknown>,
  needsAuth = false,
): ApiTestAction {
  return { id, group, title, needsAuth, run };
}

function summarizePayload(payload: unknown): string {
  if (payload instanceof Error) {
    return payload.message;
  }
  const data = extractData(payload);
  if (Array.isArray(data)) {
    return `${data.length}건`;
  }
  return data === null ? '응답 수신' : '성공 응답';
}

function stringifyPayload(payload: unknown): string {
  if (payload instanceof Error) {
    return payload.message;
  }
  return JSON.stringify(payload, null, 2);
}
