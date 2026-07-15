import { render } from '@testing-library/react-native';
import type { RidePolicyEvaluationUiModel } from '../../domain/ride/ridePolicyModels';
import { RidePolicyBanner } from './RidePolicyBanner';

const READY_POLICY: RidePolicyEvaluationUiModel = {
  phase: 'ACTIVE',
  overallState: 'ACTIVE_ON_ROUTE',
  defaultMessage: '코스 위를 주행 중입니다.',
  startGateStatus: 'ELIGIBLE',
  offRouteStatus: 'ON_ROUTE',
  offRouteDistanceM: 4,
  completionStatus: 'ELIGIBLE',
  completionCoveragePercent: 84,
  progressPercent: 84,
  remainingDistanceM: 200,
  distanceAlongRouteM: 1_000,
};

describe('RidePolicyBanner', () => {
  it('GPS가 stale이면 이전 완주 가능 상태와 진행률을 숨긴다', () => {
    const screen = render(
      <RidePolicyBanner policy={READY_POLICY} loading={false} error={null} stale topInset={0} />,
    );

    expect(screen.getByText('GPS 업데이트 대기')).toBeTruthy();
    expect(screen.queryByText('완주 가능')).toBeNull();
    expect(screen.queryByText('진행 84%')).toBeNull();
  });
});
