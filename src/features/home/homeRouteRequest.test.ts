import {
  buildHomeAiRouteRequest,
  destinationSelectionError,
} from './homeRouteRequest';

const TEST_START = { lat: 37.4812, lon: 126.9527 };

describe('homeRouteRequest', () => {
  it('선택한 후보 좌표와 테스트 출발 좌표로 AI route 요청을 만든다', () => {
    const result = buildHomeAiRouteRequest(
      TEST_START,
      {
        label: '서울대입구 자전거 여행 출발지',
        lat: 37.592,
        lon: 126.966,
      },
      '평지 한강이 보이는 코스',
    );

    expect(result).toEqual({
      lat: 37.4812,
      lon: 126.9527,
      destinationLat: 37.592,
      destinationLon: 126.966,
      destinationLabel: '서울대입구 자전거 여행 출발지',
      rideStyle: 'SCENERY_FIRST',
      elevationPreference: 'FLAT_FIRST',
      textIntent: '평지 한강이 보이는 코스',
    });
  });

  it('검색어를 입력했지만 주소 후보를 고르지 않으면 생성을 막는다', () => {
    expect(destinationSelectionError('서울대입구', null)).toBe('검색 결과에서 목적지를 선택하거나 입력을 지워 주세요.');
    expect(destinationSelectionError('', null)).toBe('현재 베타에서는 목적지를 먼저 선택해 주세요. 출발점으로 돌아오는 순환 코스는 준비 중입니다.');
    expect(destinationSelectionError('서울대입구', { label: '서울대입구', lat: 37.48, lon: 126.95 })).toBeNull();
  });
});
