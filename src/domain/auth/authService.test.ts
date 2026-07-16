import { apiRequest } from '../../shared/api/apiClient';
import { clearAuthSession } from './authSessionStore';
import { loginWithEmail, logoutCurrentSession, registerWithEmail } from './authService';

jest.mock('../../shared/api/apiClient', () => ({
  apiRequest: jest.fn(),
}));
jest.mock('./authSessionStore', () => ({
  clearAuthSession: jest.fn(),
}));

const apiRequestMock = jest.mocked(apiRequest);
const clearAuthSessionMock = jest.mocked(clearAuthSession);

describe('authService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    apiRequestMock.mockReset();
    clearAuthSessionMock.mockReset();
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

  it('서버 refresh 세션을 폐기한 뒤에만 로컬 세션을 지운다', async () => {
    // Given
    apiRequestMock.mockResolvedValue({ code: 200, message: 'success', data: null });

    // When
    await logoutCurrentSession('access-token');

    // Then
    expect(apiRequestMock).toHaveBeenCalledWith('/api/v1/auth/logout', {
      method: 'POST',
      accessToken: 'access-token',
    });
    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock.mock.invocationCallOrder[0]).toBeLessThan(clearAuthSessionMock.mock.invocationCallOrder[0] ?? 0);
  });

  it('서버 로그아웃 실패 시 로컬 세션을 남겨 재시도할 수 있게 한다', async () => {
    // Given
    apiRequestMock.mockRejectedValue(new Error('server unavailable'));

    // When / Then
    await expect(logoutCurrentSession('access-token')).rejects.toThrow('server unavailable');
    expect(clearAuthSessionMock).not.toHaveBeenCalled();
  });
});
