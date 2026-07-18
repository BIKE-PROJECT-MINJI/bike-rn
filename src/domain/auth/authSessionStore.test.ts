import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession } from './authModels';
import {
  clearAuthSession,
  loadAuthSession,
  replaceAuthSessionTokens,
  replaceAuthSessionTokensIfCurrent,
  saveAuthSession,
  subscribeAuthSessionChanges,
} from './authSessionStore';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const secureStoreMock = jest.mocked(SecureStore);
const originalPlatform = Platform.OS;

const testSession: AuthSession = {
  userId: 42,
  email: 'qa@example.com',
  displayName: 'QA User',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
  refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
};

type MemoryStorage = {
  readonly clear: () => void;
  readonly getItem: (key: string) => string | null;
  readonly removeItem: (key: string) => void;
  readonly setItem: (key: string, value: string) => void;
};

function createMemoryStorage(): MemoryStorage {
  const entries = new Map<string, string>();

  return {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => entries.set(key, value),
  };
}

describe('authSessionStore', () => {
  const memoryStorage = createMemoryStorage();

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });
    memoryStorage.clear();
    secureStoreMock.deleteItemAsync.mockReset();
    secureStoreMock.getItemAsync.mockReset();
    secureStoreMock.setItemAsync.mockReset();
  });

  afterEach(() => {
    memoryStorage.clear();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('web 환경에서는 localStorage에 인증 세션을 저장하고 지운다', async () => {
    await saveAuthSession(testSession);

    await expect(loadAuthSession()).resolves.toEqual(testSession);
    expect(secureStoreMock.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.getItemAsync).not.toHaveBeenCalled();

    await clearAuthSession();

    await expect(loadAuthSession()).resolves.toBeNull();
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('userId가 없는 구버전 세션을 제거해 계정 격리 없는 로그인 상태를 허용하지 않는다', async () => {
    const { userId: _userId, ...legacySession } = testSession;
    memoryStorage.setItem('gaja.auth.session', JSON.stringify(legacySession));

    await expect(loadAuthSession()).resolves.toBeNull();
    expect(memoryStorage.getItem('gaja.auth.session')).toBeNull();
  });

  it('Android에서는 새 access/refresh token 쌍을 SecureStore 한 번의 쓰기로 교체한다', async () => {
    // Given
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    secureStoreMock.getItemAsync.mockResolvedValue(JSON.stringify(testSession));
    secureStoreMock.setItemAsync.mockResolvedValue();

    // When
    await replaceAuthSessionTokens({
      tokenType: 'Bearer',
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
      accessExpiresInSec: 900,
      refreshExpiresInSec: 86_400,
      userId: 42,
      displayName: 'QA User',
    }, 1_700_000_000_000);

    // Then
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledTimes(1);
    const storedJson = secureStoreMock.setItemAsync.mock.calls[0]?.[1];
    expect(storedJson).toBeDefined();
    expect(JSON.parse(storedJson ?? '{}')).toEqual({
      ...testSession,
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
      accessTokenExpiresAtEpochMillis: 1_700_000_900_000,
      refreshTokenExpiresAtEpochMillis: 1_700_086_400_000,
    });
  });

  it('세션 변경을 구독자에게 알려 캐시가 만료된 token을 계속 쓰지 않게 한다', async () => {
    // Given
    const listener = jest.fn();
    const unsubscribe = subscribeAuthSessionChanges(listener);

    // When
    await saveAuthSession(testSession);
    await clearAuthSession();

    // Then
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('refresh 응답이 늦게 와도 새로 로그인한 계정의 세션을 덮지 않는다', async () => {
    const newAccount: AuthSession = {
      ...testSession,
      userId: 77,
      email: 'new@example.com',
      accessToken: 'new-account-access',
      refreshToken: 'new-account-refresh',
    };
    await saveAuthSession(testSession);
    await saveAuthSession(newAccount);

    const replaced = await replaceAuthSessionTokensIfCurrent({
      tokenType: 'Bearer',
      accessToken: 'late-rotated-access',
      refreshToken: 'late-rotated-refresh',
      accessExpiresInSec: 900,
      refreshExpiresInSec: 86_400,
      userId: 42,
      displayName: 'QA User',
    }, testSession, 1_700_000_000_000);

    expect(replaced).toBeNull();
    await expect(loadAuthSession()).resolves.toEqual(newAccount);
  });
});
