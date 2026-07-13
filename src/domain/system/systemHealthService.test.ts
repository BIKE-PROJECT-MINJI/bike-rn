import { apiRequest } from '../../shared/api/apiClient';
import { fetchSystemHealth } from './systemHealthService';

jest.mock('../../shared/api/apiClient', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = jest.mocked(apiRequest);

describe('systemHealthService', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('백엔드 health 응답을 폰 테스트용 연결 상태로 변환한다', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        status: 'ok',
        service: 'bike-back',
      },
    });

    const result = await fetchSystemHealth();

    expect(apiRequestMock).toHaveBeenCalledWith('/health');
    expect(result).toEqual({
      status: 'ok',
      service: 'bike-back',
      label: '백엔드 연결 정상',
    });
  });
});
