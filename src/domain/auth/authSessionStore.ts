import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession, AuthTokenResponse } from './authModels';

const KEY = 'gaja.auth.session';
const sessionChangeListeners = new Set<() => void>();
let sessionMutationQueue: Promise<void> = Promise.resolve();

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
  return loadAuthSessionFrom(getSessionStore());
}

async function loadAuthSessionFrom(sessionStore: RawSessionStore): Promise<AuthSession | null> {
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
  await enqueueSessionMutation(async () => {
    await getSessionStore().setItem(KEY, JSON.stringify(session));
    notifySessionChanged();
  });
}

export async function clearAuthSession(): Promise<void> {
  await enqueueSessionMutation(async () => {
    await getSessionStore().removeItem(KEY);
    notifySessionChanged();
  });
}

export async function replaceAuthSessionTokens(
  token: AuthTokenResponse,
  issuedAtEpochMillis = Date.now(),
): Promise<AuthSession> {
  return enqueueSessionMutation(async () => {
    const current = await loadAuthSessionFrom(getSessionStore());
    if (current === null) {
      throw new MissingStoredAuthSessionError();
    }
    return storeRotatedSession(current, token, issuedAtEpochMillis);
  });
}

export async function replaceAuthSessionTokensIfCurrent(
  token: AuthTokenResponse,
  expected: AuthSession,
  issuedAtEpochMillis = Date.now(),
): Promise<AuthSession | null> {
  return enqueueSessionMutation(async () => {
    const current = await loadAuthSessionFrom(getSessionStore());
    if (
      current === null ||
      !hasSameSessionLineage(current, expected) ||
      token.userId !== current.userId
    ) {
      return null;
    }
    return storeRotatedSession(current, token, issuedAtEpochMillis);
  });
}

export async function clearAuthSessionIfAccessToken(expectedAccessToken: string): Promise<boolean> {
  return enqueueSessionMutation(async () => {
    const sessionStore = getSessionStore();
    const current = await loadAuthSessionFrom(sessionStore);
    if (current === null || current.accessToken !== expectedAccessToken) {
      return false;
    }
    await sessionStore.removeItem(KEY);
    notifySessionChanged();
    return true;
  });
}

export function subscribeAuthSessionChanges(listener: () => void): () => void {
  sessionChangeListeners.add(listener);
  return () => sessionChangeListeners.delete(listener);
}

function getSessionStore(): RawSessionStore {
  return Platform.OS === 'web' ? webSessionStore : secureSessionStore;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.userId === 'number' &&
    Number.isInteger(value.userId) &&
    value.userId > 0 &&
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

function notifySessionChanged(): void {
  for (const listener of sessionChangeListeners) {
    listener();
  }
}

function enqueueSessionMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = sessionMutationQueue.then(operation, operation);
  sessionMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function storeRotatedSession(
  current: AuthSession,
  token: AuthTokenResponse,
  issuedAtEpochMillis: number,
): Promise<AuthSession> {
  const updated: AuthSession = {
    ...current,
    userId: token.userId,
    displayName: token.displayName,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    accessTokenExpiresAtEpochMillis: issuedAtEpochMillis + token.accessExpiresInSec * 1000,
    refreshTokenExpiresAtEpochMillis: issuedAtEpochMillis + token.refreshExpiresInSec * 1000,
  };
  await getSessionStore().setItem(KEY, JSON.stringify(updated));
  notifySessionChanged();
  return updated;
}

function hasSameSessionLineage(current: AuthSession, expected: AuthSession): boolean {
  return (
    current.userId === expected.userId &&
    current.email === expected.email &&
    current.accessToken === expected.accessToken &&
    current.refreshToken === expected.refreshToken
  );
}

class MissingStoredAuthSessionError extends Error {
  constructor() {
    super('교체할 인증 세션이 없습니다.');
    this.name = 'MissingStoredAuthSessionError';
  }
}
