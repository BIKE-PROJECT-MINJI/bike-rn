import { buildHomeAiRouteRequest, PROTOTYPE_TEST_START } from './homeRouteRequest';

describe('homeRouteRequest', () => {
  it('선택한 후보 좌표와 테스트 출발 좌표로 AI route 요청을 만든다', () => {
    const result = buildHomeAiRouteRequest(
      PROTOTYPE_TEST_START,
      {
        label: '서울대입구 자전거 여행 출발지',
        lat: 37.592,
        lon: 126.966,
      },
      '서울대입구',
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

  it('후보 좌표가 없으면 목적지 라벨만 포함한다', () => {
    const result = buildHomeAiRouteRequest(PROTOTYPE_TEST_START, null, '서울대입구');

    expect(result).toEqual({
      lat: 37.4812,
      lon: 126.9527,
      destinationLabel: '서울대입구',
      rideStyle: 'SCENIC',
      elevationPreference: 'BALANCED_ELEVATION',
    });
  });
});
