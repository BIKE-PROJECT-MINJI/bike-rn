import { buildRideQualityNotice } from './rideQualityNotice';

describe('buildRideQualityNotice', () => {
  it('explains that PARTIAL kept only reliable route segments', () => {
    expect(buildRideQualityNotice('PARTIAL')).toEqual({
      label: '일부 구간 보정',
      message: 'GPS 품질이 낮은 구간을 제외하고 신뢰 가능한 경로만 저장했습니다.',
      tone: 'warning',
    });
  });

  it('explains that REJECTED cannot become a course and keeps the original', () => {
    expect(buildRideQualityNotice('REJECTED')).toEqual({
      label: '코스화 불가',
      message: 'GPS 품질 기준을 통과하지 못했습니다. 코스로 만들 수 없으며 서버 원본 주행은 보존됩니다.',
      tone: 'danger',
    });
  });

  it('does not add a warning for FULL or legacy missing quality', () => {
    expect(buildRideQualityNotice('FULL')).toBeNull();
    expect(buildRideQualityNotice(null)).toBeNull();
  });
});
