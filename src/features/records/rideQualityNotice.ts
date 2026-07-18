import type { RideRouteQualityStatus } from '../../domain/ride/rideRouteQuality';

export type RideQualityNotice = {
  readonly label: string;
  readonly message: string;
  readonly tone: 'warning' | 'danger';
};

export function buildRideQualityNotice(qualityStatus: RideRouteQualityStatus | null): RideQualityNotice | null {
  switch (qualityStatus) {
    case 'PARTIAL':
      return {
        label: '일부 구간 보정',
        message: 'GPS 품질이 낮은 구간을 제외하고 신뢰 가능한 경로만 저장했습니다.',
        tone: 'warning',
      };
    case 'REJECTED':
      return {
        label: '코스화 불가',
        message: 'GPS 품질 기준을 통과하지 못했습니다. 코스로 만들 수 없으며 서버 원본 주행은 보존됩니다.',
        tone: 'danger',
      };
    case 'FULL':
    case null:
      return null;
  }
}
