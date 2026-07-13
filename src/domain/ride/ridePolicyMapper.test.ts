import { mapRidePolicyEvaluation } from './ridePolicyMapper';

describe('ridePolicyMapper', () => {
  it('주행 정책 평가 응답을 HUD 모델로 변환한다', () => {
    const result = mapRidePolicyEvaluation({
      code: 200,
      message: 'success',
      data: {
        phase: 'ACTIVE',
        startGate: { status: 'ELIGIBLE' },
        offRoute: { status: 'ON_ROUTE', distanceM: 3 },
        completion: { status: 'IN_PROGRESS', coveragePercent: 42 },
        progress: { distanceAlongRouteM: 1200, remainingDistanceM: 800, progressPercent: 60 },
        overallState: 'ACTIVE_ON_ROUTE',
        defaultMessage: '현재 코스를 따라 주행 중입니다.',
      },
    });

    expect(result).toEqual({
      phase: 'ACTIVE',
      overallState: 'ACTIVE_ON_ROUTE',
      defaultMessage: '현재 코스를 따라 주행 중입니다.',
      startGateStatus: 'ELIGIBLE',
      offRouteStatus: 'ON_ROUTE',
      offRouteDistanceM: 3,
      completionStatus: 'IN_PROGRESS',
      completionCoveragePercent: 42,
      progressPercent: 60,
      remainingDistanceM: 800,
      distanceAlongRouteM: 1200,
    });
  });
});
