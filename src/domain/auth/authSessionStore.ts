import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession } from './authModels';

const KEY = 'gaja.auth.session';

type RawSessionStore = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly removeItem: (key: string) => Promise<void>;
  readonly setItem: (key: string, value: string) => Promise<void>;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

const secureSessionStore: RawSessionStore = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

const webSessionStore: RawSessionStore = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  removeItem: async (key: string) => {
    globalThis.localStorage?.removeItem(key);
  },
  setItem: async (key: string, value: string) => {
    globalThis.localStorage?.setItem(key, value);
  },
};

export async function loadAuthSession(): Promise<AuthSession | null> {
  const sessionStore = getSessionStore();
  const raw = await sessionStore.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAuthSession(parsed)) {
      return parsed;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
  }
  await sessionStore.removeItem(KEY);
  return null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await getSessionStore().setItem(KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await getSessionStore().removeItem(KEY);
}

function getSessionStore(): RawSessionStore {
  return Platform.OS === 'web' ? webSessionStore : secureSessionStore;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.accessTokenExpiresAtEpochMillis === 'number' &&
    typeof value.refreshTokenExpiresAtEpochMillis === 'number'
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}
