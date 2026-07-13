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
