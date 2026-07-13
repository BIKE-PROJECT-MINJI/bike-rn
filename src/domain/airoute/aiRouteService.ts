import { apiRequest } from '../../shared/api/apiClient';
import { mapAiRoutePlan, toAiRoutePlanRequestBody } from './aiRouteMapper';
import type { AiRoutePlanRequest, AiRoutePlanUiModel, AiRouteTextPlanRequest } from './aiRouteModels';

export async function requestAiRoutePlan(request: AiRoutePlanRequest, accessToken?: string | null): Promise<AiRoutePlanUiModel> {
  const payload = await apiRequest<{ data?: unknown }>('/api/v1/ai-routes/plan', {
    method: 'POST',
    accessToken,
    body: toAiRoutePlanRequestBody(request),
  });
  return mapAiRoutePlan(payload.data ?? payload);
}

export async function requestAiRoutePlanFromText(request: AiRouteTextPlanRequest, accessToken?: string | null): Promise<AiRoutePlanUiModel> {
  const payload = await apiRequest<{ data?: unknown }>('/api/v1/ai-routes/plan/from-text', {
    method: 'POST',
    accessToken,
    body: request,
  });
  return mapAiRoutePlan(payload.data ?? payload);
}
