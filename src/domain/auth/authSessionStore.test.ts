import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession } from './authModels';
import { clearAuthSession, loadAuthSession, saveAuthSession } from './authSessionStore';

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
});
