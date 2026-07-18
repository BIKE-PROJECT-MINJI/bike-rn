import type { RidePolicyEvaluationUiModel } from '../../domain/ride/ridePolicyModels';

export type RidePolicyPresentation = {
  readonly tone: 'neutral' | 'success' | 'warning' | 'danger';
  readonly label: string;
  readonly detail: string;
};

export function presentRidePolicy(policy: RidePolicyEvaluationUiModel | null): RidePolicyPresentation {
  if (policy === null) {
    return { tone: 'neutral', label: '경로 확인 중', detail: 'GPS 위치를 받으면 코스 상태를 확인합니다.' };
  }
  if (policy.offRouteStatus === 'WARNING') {
    return { tone: 'danger', label: '코스 이탈', detail: policy.defaultMessage };
  }
  if (policy.offRouteStatus === 'CANDIDATE') {
    return { tone: 'warning', label: '경로 확인', detail: policy.defaultMessage };
  }
  if (policy.completionStatus === 'ELIGIBLE') {
    return { tone: 'success', label: '완주 가능', detail: policy.defaultMessage };
  }
  if (policy.offRouteStatus === 'UNDETERMINED' || policy.overallState.includes('UNDETERMINED')) {
    return { tone: 'neutral', label: 'GPS 확인 중', detail: policy.defaultMessage };
  }
  if (policy.overallState.includes('RECOVERED')) {
    return { tone: 'success', label: '코스 복귀', detail: policy.defaultMessage };
  }
  if (policy.offRouteStatus === 'ON_ROUTE') {
    return { tone: 'success', label: '코스 위 주행', detail: policy.defaultMessage };
  }
  return { tone: 'neutral', label: '판정 확인 중', detail: policy.defaultMessage };
}
