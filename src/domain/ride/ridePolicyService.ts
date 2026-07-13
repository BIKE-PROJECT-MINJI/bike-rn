import { apiRequest } from '../../shared/api/apiClient';
import { mapRidePolicyEvaluation } from './ridePolicyMapper';
import type { RidePolicyEvaluationRequest, RidePolicyEvaluationUiModel } from './ridePolicyModels';

export async function evaluateRidePolicy(courseId: number, request: RidePolicyEvaluationRequest): Promise<RidePolicyEvaluationUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/courses/${courseId}/ride-policy/evaluate`, {
    method: 'POST',
    body: request,
  });
  return mapRidePolicyEvaluation(payload);
}
