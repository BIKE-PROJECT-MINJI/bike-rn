import {
  buildHomeAiRouteRequest,
  destinationSelectionError,
  PROTOTYPE_TEST_START,
} from './homeRouteRequest';

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

  it('목적지가 없으면 목적지 필드를 보내지 않는다', () => {
    const result = buildHomeAiRouteRequest(PROTOTYPE_TEST_START, null, '');

    expect(result).toEqual({
      lat: 37.4812,
      lon: 126.9527,
      destinationLabel: '',
      rideStyle: 'SCENIC',
      elevationPreference: 'BALANCED_ELEVATION',
    });
  });

  it('검색어를 입력했지만 주소 후보를 고르지 않으면 생성을 막는다', () => {
    expect(destinationSelectionError('서울대입구', null)).toBe('검색 결과에서 목적지를 선택하거나 입력을 지워 주세요.');
    expect(destinationSelectionError('', null)).toBeNull();
  });
});
