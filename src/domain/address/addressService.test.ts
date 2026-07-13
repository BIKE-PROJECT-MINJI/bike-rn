import { apiRequest } from '../../shared/api/apiClient';
import { searchAddress } from './addressService';

jest.mock('../../shared/api/apiClient', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = jest.mocked(apiRequest);

describe('addressService', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('주소 검색 요청에 인증 토큰을 전달한다', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        status: 'SUCCESS',
        candidates: [
          {
            label: '서울대입구역',
            address: '서울 관악구',
            lat: 37.4812,
            lon: 126.9527,
          },
        ],
      },
    });

    const result = await searchAddress('서울대입구', 'access-token');

    expect(apiRequestMock).toHaveBeenCalledWith('/api/v1/addresses/search?query=%EC%84%9C%EC%9A%B8%EB%8C%80%EC%9E%85%EA%B5%AC&page=1&size=3', {
      accessToken: 'access-token',
    });
    expect(result.candidates[0].label).toBe('서울대입구역');
  });
});
