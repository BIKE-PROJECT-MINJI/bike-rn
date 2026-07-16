import { Platform } from 'react-native';
import { loadAuthSession, saveAuthSession } from '../../domain/auth/authSessionStore';
import { ApiClientError, apiRequest } from './apiClient';

const originalPlatform = Platform.OS;
const memoryStorage = createMemoryStorage();

describe('api client error contract', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });
    memoryStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    memoryStorage.clear();
    jest.restoreAllMocks();
  });

  it('keeps status, errorCode, and Retry-After from a busy response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf({
        status: 503,
        body: JSON.stringify({
          message: '주행 저장 요청이 많습니다.',
          data: { errorCode: 'RIDE_SAVE_BUSY', retryAfterSeconds: 3 },
        }),
        retryAfter: '7',
      }),
    );

    await expect(apiRequest('/api/v1/ride-records')).rejects.toEqual(
      expect.objectContaining({ status: 503, errorCode: 'RIDE_SAVE_BUSY', retryAfterSeconds: 7 }),
    );
  });

  it('marks a malformed successful response as a non-network contract error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf({ status: 200, body: '<html>not json</html>', retryAfter: null }),
    );

    await expect(apiRequest('/health')).rejects.toEqual(
      new ApiClientError({
        message: '서버 응답 형식이 올바르지 않습니다.',
        status: 200,
        errorCode: 'INVALID_SERVER_RESPONSE',
      }),
    );
  });

  it('classifies a fetch transport failure as retryable network evidence', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiRequest('/health')).rejects.toEqual(
      new ApiClientError({
        message: '서버에 연결하지 못했습니다.',
        status: null,
        errorCode: 'NETWORK_ERROR',
      }),
    );
  });

  it('refreshes concurrent 401 responses once and replays each original request exactly once', async () => {
    // Given
    await saveAuthSession(authSession('old-access', 'old-refresh'));
    const protectedCalls: string[] = [];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) {
        return jsonResponse(200, tokenEnvelope('new-access', 'new-refresh'));
      }
      const authorization = new Headers(init?.headers).get('Authorization') ?? '';
      protectedCalls.push(authorization);
      return authorization === 'Bearer old-access'
        ? jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null })
        : jsonResponse(200, { code: 200, message: 'success', data: { ok: true } });
    });

    // When
    const results = await Promise.all([
      apiRequest('/api/v1/profile/me', { accessToken: 'old-access' }),
      apiRequest('/api/v1/ride-records', { accessToken: 'old-access' }),
    ]);

    // Then
    expect(results).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh'))).toHaveLength(1);
    expect(protectedCalls).toEqual([
      'Bearer old-access',
      'Bearer old-access',
      'Bearer new-access',
      'Bearer new-access',
    ]);
    await expect(loadAuthSession()).resolves.toEqual(
      expect.objectContaining({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    );
  });

  it('clears the session and does not replay when refresh fails', async () => {
    // Given
    await saveAuthSession(authSession('expired-access', 'expired-refresh'));
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/api/v1/auth/refresh')
        ? jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null })
        : jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null }),
    );

    // When / Then
    await expect(apiRequest('/api/v1/ride-records', { accessToken: 'expired-access' })).rejects.toEqual(
      expect.objectContaining({ status: 401, errorCode: 'AUTH_SESSION_EXPIRED' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(loadAuthSession()).resolves.toBeNull();
  });

  it('does not start a second refresh when the one allowed replay is also unauthorized', async () => {
    // Given
    await saveAuthSession(authSession('old-access', 'old-refresh'));
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/api/v1/auth/refresh')
        ? jsonResponse(200, tokenEnvelope('new-access', 'new-refresh'))
        : jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null }),
    );

    // When / Then
    await expect(apiRequest('/api/v1/profile/me', { accessToken: 'old-access' })).rejects.toEqual(
      expect.objectContaining({ status: 401, errorCode: 'AUTH_SESSION_EXPIRED' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh'))).toHaveLength(1);
    await expect(loadAuthSession()).resolves.toBeNull();
  });

  it('preserves the session when token refresh is blocked by a transient server failure', async () => {
    // Given
    const originalSession = authSession('old-access', 'old-refresh');
    await saveAuthSession(originalSession);
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/api/v1/auth/refresh')
        ? jsonResponse(503, { code: 503, message: '일시 장애', data: { errorCode: 'SERVICE_UNAVAILABLE' } })
        : jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null }),
    );

    // When / Then
    await expect(apiRequest('/api/v1/profile/me', { accessToken: 'old-access' })).rejects.toEqual(
      expect.objectContaining({ status: 503, errorCode: 'SERVICE_UNAVAILABLE' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(loadAuthSession()).resolves.toEqual(originalSession);
  });

  it('does not replay an old account request with a newly logged-in account token', async () => {
    const refreshResponse = createDeferred<Response>();
    await saveAuthSession(authSession('old-account-access', 'old-account-refresh'));
    const protectedAuthorizations: string[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).endsWith('/api/v1/auth/refresh')) {
        return refreshResponse.promise;
      }
      protectedAuthorizations.push(new Headers(init?.headers).get('Authorization') ?? '');
      return jsonResponse(401, { code: 401, message: '로그인 정보가 필요합니다.', data: null });
    });

    const previousAccountRequest = apiRequest('/api/v1/profile/me', { accessToken: 'old-account-access' });
    await waitForRefreshRequest();
    const newAccountSession = {
      ...authSession('new-account-access', 'new-account-refresh'),
      userId: 77,
      email: 'new@example.com',
    };
    await saveAuthSession(newAccountSession);
    refreshResponse.resolve(jsonResponse(200, tokenEnvelope('late-old-access', 'late-old-refresh')));

    await expect(previousAccountRequest).rejects.toEqual(
      expect.objectContaining({ status: 401, errorCode: 'AUTH_SESSION_CHANGED' }),
    );
    expect(protectedAuthorizations).toEqual(['Bearer old-account-access']);
    await expect(loadAuthSession()).resolves.toEqual(newAccountSession);
  });
});

async function waitForRefreshRequest(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await Promise.resolve();
    const calls = jest.mocked(globalThis.fetch).mock.calls;
    if (calls.some(([input]) => String(input).endsWith('/api/v1/auth/refresh'))) {
      return;
    }
  }
  throw new Error('refresh 요청이 시작되지 않았습니다.');
}

function createDeferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolver: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      if (resolver === null) {
        throw new Error('deferred resolver가 초기화되지 않았습니다.');
      }
      resolver(value);
    },
  };
}

function authSession(accessToken: string, refreshToken: string) {
  return {
    userId: 42,
    email: 'qa@example.com',
    displayName: 'QA',
    accessToken,
    refreshToken,
    accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
    refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
  };
}

function tokenEnvelope(accessToken: string, refreshToken: string) {
  return {
    code: 200,
    message: 'success',
    data: {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      accessExpiresInSec: 3600,
      refreshExpiresInSec: 604800,
      userId: 42,
      displayName: 'QA',
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };
}

function responseOf(input: {
  readonly status: number;
  readonly body: string;
  readonly retryAfter: string | null;
}): Response {
  return new Response(input.body, {
    status: input.status,
    headers: input.retryAfter === null ? undefined : { 'Retry-After': input.retryAfter },
  });
}
