import { mapAddressSearch } from './addressMapper';

describe('addressMapper', () => {
  it('주소 검색 응답 상태와 후보를 UI 모델로 변환한다', () => {
    const result = mapAddressSearch({
      status: 200,
      message: 'OK',
      data: {
        status: 'SUCCESS',
        candidates: [
          {
            label: '서울숲',
            address: '서울 성동구 뚝섬로 273',
            lat: 37.5446,
            lon: 127.0374,
          },
        ],
      },
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.statusText).toBe('검색 완료');
    expect(result.candidates[0].label).toBe('서울숲');
  });

  it('backend AMBIGUOUS 응답의 두 후보를 success UI 모델로 보존한다', () => {
    const result = mapAddressSearch({
      status: 200,
      message: 'OK',
      data: {
        status: 'AMBIGUOUS',
        provider: 'FAKE_ADDRESS',
        primaryProvider: 'FAKE_ADDRESS',
        fallbackUsed: false,
        candidates: [
          { label: '테스트 후보 A', address: '테스트 구역 A', lat: 1, lon: 2 },
          { label: '테스트 후보 B', address: '테스트 구역 B', lat: 3, lon: 4 },
        ],
      },
    });

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.uiState).toBe('success');
    expect(result.statusText).toBe('비슷한 후보가 여러 개 있습니다.');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.label)).toEqual(['테스트 후보 A', '테스트 후보 B']);
  });

  it('provider failure는 사용자용 축약 문구로 변환한다', () => {
    const result = mapAddressSearch({
      status: 200,
      message: 'OK',
      data: { status: 'PROVIDER_FAILURE', candidates: [] },
    });

    expect(result.statusText).toBe('주소 검색을 잠시 사용할 수 없습니다.');
    expect(result.candidates).toEqual([]);
  });

  it('fallback metadata를 대체 결과 UI 상태로 보존한다', () => {
    const result = mapAddressSearch({
      status: 200,
      message: 'OK',
      data: {
        status: 'SUCCESS',
        provider: 'NOMINATIM',
        primaryProvider: 'KAKAO_LOCAL',
        fallbackUsed: true,
        fallbackReason: 'KAKAO_LOCAL_PROVIDER_FAILURE',
        candidates: [
          {
            label: '여의나루역',
            address: '서울 영등포구 여의도동',
            lat: 37.5271,
            lon: 126.9328,
          },
        ],
      },
    });

    expect(result.uiState).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('KAKAO_LOCAL_PROVIDER_FAILURE');
    expect(result.statusText).toBe('대체 주소 결과입니다.');
  });
});
