import { apiRequest } from '../../shared/api/apiClient';
import { toAiRoutePlanRequestBody } from './aiRouteMapper';
import { mapAiRoutePromoteResult, mapAiRouteSession } from './aiRouteSessionMapper';
import type {
  AiRouteCandidateUiModel,
  AiRoutePromoteResult,
  AiRouteSessionRequest,
  AiRouteSessionUiModel,
} from './aiRouteSessionModels';

export async function createAiRouteSession(
  request: AiRouteSessionRequest,
  accessToken: string,
): Promise<AiRouteSessionUiModel> {
  const payload = await apiRequest<unknown>('/api/v1/ai-route-sessions', {
    method: 'POST',
    accessToken,
    body: toAiRoutePlanRequestBody(request),
  });
  return mapAiRouteSession(payload);
}

export async function promoteAiRouteCandidate(
  sessionId: number,
  candidate: AiRouteCandidateUiModel,
  accessToken: string,
): Promise<AiRoutePromoteResult> {
  if (candidate.promotedCourseId !== null) {
    return { courseId: candidate.promotedCourseId, routePointCount: candidate.routePointCount };
  }
  const payload = await apiRequest<unknown>(
    `/api/v1/ai-route-sessions/${sessionId}/candidates/${candidate.candidateId}/course`,
    {
      method: 'POST',
      accessToken,
      body: { name: candidate.title, description: candidate.summary, visibility: 'PRIVATE' },
    },
  );
  return mapAiRoutePromoteResult(payload);
}
