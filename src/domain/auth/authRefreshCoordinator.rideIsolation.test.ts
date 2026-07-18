import { pauseRideForAuthTransition } from './authRideBoundary';
import { clearAuthSession, clearAuthSessionIfAccessToken, loadAuthSession } from './authSessionStore';
import { expireAuthSession } from './authRefreshCoordinator';

jest.mock('./authRideBoundary', () => ({
  pauseRideForAuthTransition: jest.fn(async () => undefined),
}));
jest.mock('./authSessionStore', () => ({
  clearAuthSession: jest.fn(async () => undefined),
  clearAuthSessionIfAccessToken: jest.fn(async () => true),
  loadAuthSession: jest.fn(),
  replaceAuthSessionTokensIfCurrent: jest.fn(),
}));

describe('auth refresh ride isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(pauseRideForAuthTransition).mockResolvedValue(undefined);
    jest.mocked(loadAuthSession).mockResolvedValue({
      userId: 11,
      email: 'a@example.com',
      displayName: 'A',
      accessToken: 'account-a-access',
      refreshToken: 'account-a-refresh',
      accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
      refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
    });
  });

  it('pauses a recording ride before an expired auth session is cleared', async () => {
    // Given
    // When
    await expireAuthSession('account-a-access');

    // Then
    expect(pauseRideForAuthTransition).toHaveBeenCalledWith(null);
    expect(jest.mocked(pauseRideForAuthTransition).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(clearAuthSessionIfAccessToken).mock.invocationCallOrder[0] ?? 0,
    );
    expect(clearAuthSession).not.toHaveBeenCalled();
  });

  it('does not pause the new account ride when an old account 401 finishes late', async () => {
    // Given
    jest.mocked(loadAuthSession).mockResolvedValue({
      userId: 22,
      email: 'b@example.com',
      displayName: 'B',
      accessToken: 'account-b-access',
      refreshToken: 'account-b-refresh',
      accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
      refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
    });
    // When
    const error = await expireAuthSession('account-a-access');

    // Then
    expect(error.errorCode).toBe('AUTH_SESSION_CHANGED');
    expect(pauseRideForAuthTransition).not.toHaveBeenCalled();
    expect(clearAuthSessionIfAccessToken).not.toHaveBeenCalled();
  });
});
