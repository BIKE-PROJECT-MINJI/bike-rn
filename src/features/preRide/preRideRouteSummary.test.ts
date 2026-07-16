import { buildPreRideRouteSummary } from './preRideRouteSummary';

describe('preRideRouteSummary', () => {
  it('경로점이 2개 이상이면 출발 가능한 경로 확인 완료를 알린다', () => {
    expect(buildPreRideRouteSummary(12)).toEqual({
      title: '코스 경로 확인 완료',
      body: '출발점과 도착점을 포함한 경로점 12개를 확인했습니다.',
      hasRoute: true,
    });
  });

  it.each([0, 1])('경로점이 %i개이면 주행 가능한 경로가 없다고 알린다', (pointCount) => {
    expect(buildPreRideRouteSummary(pointCount)).toEqual({
      title: '주행 가능한 경로를 확인하지 못했어요',
      body: '코스 경로를 다시 불러온 뒤 출발해 주세요.',
      hasRoute: false,
    });
  });
});
