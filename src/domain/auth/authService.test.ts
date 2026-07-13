import { apiRequest } from '../../shared/api/apiClient';
import { loginWithEmail, registerWithEmail } from './authService';

jest.mock('../../shared/api/apiClient', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = jest.mocked(apiRequest);

describe('authService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    apiRequestMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('로그인 응답을 저장 가능한 인증 세션으로 변환한다', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        tokenType: 'Bearer',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessExpiresInSec: 3600,
        refreshExpiresInSec: 604800,
        userId: 10,
        displayName: '가자',
      },
    });

    const session = await loginWithEmail('rider@example.com', 'password123');

    expect(apiRequestMock).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'rider@example.com', password: 'password123' },
    });
    expect(session).toEqual({
      userId: 10,
      email: 'rider@example.com',
      displayName: '가자',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
      refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
    });
  });

  it('회원가입 응답을 저장 가능한 인증 세션으로 변환한다', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        tokenType: 'Bearer',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessExpiresInSec: 1800,
        refreshExpiresInSec: 1209600,
        userId: 11,
        displayName: '새 라이더',
      },
    });

    const session = await registerWithEmail('new@example.com', 'password123', '새 라이더');

    expect(apiRequestMock).toHaveBeenCalledWith('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'new@example.com', password: 'password123', displayName: '새 라이더' },
    });
    expect(session).toEqual({
      userId: 11,
      email: 'new@example.com',
      displayName: '새 라이더',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessTokenExpiresAtEpochMillis: 1_700_001_800_000,
      refreshTokenExpiresAtEpochMillis: 1_701_209_600_000,
    });
  });
});
