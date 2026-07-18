import type { RidePolicyEvaluationUiModel } from '../../domain/ride/ridePolicyModels';
import { presentRidePolicy } from './ridePolicyPresentation';

describe('ride policy presentation', () => {
  it.each([
    ['ON_ROUTE', 'ACTIVE', 'IN_PROGRESS', 'success', '코스 위 주행'],
    ['CANDIDATE', 'ACTIVE', 'IN_PROGRESS', 'warning', '경로 확인'],
    ['WARNING', 'ACTIVE', 'IN_PROGRESS', 'danger', '코스 이탈'],
    ['UNDETERMINED', 'ACTIVE_UNDETERMINED', 'UNDETERMINED', 'neutral', 'GPS 확인 중'],
    ['ON_ROUTE', 'RECOVERED_WITHIN_THRESHOLD', 'IN_PROGRESS', 'success', '코스 복귀'],
    ['ON_ROUTE', 'ACTIVE', 'ELIGIBLE', 'success', '완주 가능'],
  ])('maps %s to an explicit HUD state', (offRouteStatus, overallState, completionStatus, tone, label) => {
    const policy: RidePolicyEvaluationUiModel = {
      phase: 'ACTIVE',
      overallState,
      defaultMessage: '서버 판정 메시지',
      startGateStatus: 'ELIGIBLE',
      offRouteStatus,
      offRouteDistanceM: 10,
      completionStatus,
      completionCoveragePercent: 50,
      progressPercent: 50,
      remainingDistanceM: 1_000,
      distanceAlongRouteM: 1_000,
    };

    expect(presentRidePolicy(policy)).toEqual(expect.objectContaining({ tone, label }));
  });
});
