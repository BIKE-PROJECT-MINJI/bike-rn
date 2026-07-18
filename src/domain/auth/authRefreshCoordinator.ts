import { z } from 'zod';
import { ApiClientError, executeApiRequest } from '../../shared/api/apiTransport';
import type { AuthSession, AuthTokenResponse } from './authModels';
import { pauseRideForAuthTransition } from './authRideBoundary';
import {
  clearAuthSession,
  clearAuthSessionIfAccessToken,
  loadAuthSession,
  replaceAuthSessionTokensIfCurrent,
} from './authSessionStore';

const authTokenResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.object({
    tokenType: z.string(),
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    accessExpiresInSec: z.number().int().positive(),
    refreshExpiresInSec: z.number().int().positive(),
    userId: z.number().int().positive(),
    displayName: z.string(),
  }),
});

const refreshInFlightByAccessToken = new Map<string, Promise<string>>();
const completedRefreshByAccessToken = new Map<string, CompletedRefresh>();

export async function refreshAccessToken(failedAccessToken: string): Promise<string> {
  const existing = refreshInFlightByAccessToken.get(failedAccessToken);
  if (existing !== undefined) {
    return existing;
  }
  const current = await loadAuthSession();
  if (current === null) {
    throw await expireAuthSession(failedAccessToken);
  }
  const startedWhileLoading = refreshInFlightByAccessToken.get(failedAccessToken);
  if (startedWhileLoading !== undefined) {
    return startedWhileLoading;
  }
  if (current.accessToken !== failedAccessToken) {
    const completed = completedRefreshByAccessToken.get(failedAccessToken);
    if (
      completed !== undefined &&
      completed.userId === current.userId &&
      completed.accessToken === current.accessToken
    ) {
      return current.accessToken;
    }
    throw authSessionChangedError();
  }

  const refreshPromise = rotateTokenPair(current).catch(async (error: unknown) => {
    if (isTransientRefreshFailure(error)) {
      throw error;
    }
    throw await expireAuthSession(failedAccessToken);
  });
  refreshInFlightByAccessToken.set(failedAccessToken, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    if (refreshInFlightByAccessToken.get(failedAccessToken) === refreshPromise) {
      refreshInFlightByAccessToken.delete(failedAccessToken);
    }
  }
}

export async function expireAuthSession(expectedAccessToken?: string): Promise<ApiClientError> {
  let expectedCurrentUserId: number | null | undefined;
  if (expectedAccessToken !== undefined) {
    const current = await loadAuthSession();
    if (current === null || current.accessToken !== expectedAccessToken) {
      return authSessionChangedError();
    }
    expectedCurrentUserId = current.userId ?? null;
  }
  await pauseRideForAuthTransition(null, expectedCurrentUserId);
  if (expectedAccessToken === undefined) {
    await clearAuthSession();
  } else {
    const cleared = await clearAuthSessionIfAccessToken(expectedAccessToken);
    if (!cleared) {
      return authSessionChangedError();
    }
  }
  return new ApiClientError({
    message: '세션이 만료되었습니다. 다시 로그인해 주세요.',
    status: 401,
    errorCode: 'AUTH_SESSION_EXPIRED',
  });
}

async function rotateTokenPair(current: AuthSession): Promise<string> {
  const payload = await executeApiRequest<unknown>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken: current.refreshToken },
  });
  const token = authTokenResponseSchema.parse(payload).data satisfies AuthTokenResponse;
  const updated = await replaceAuthSessionTokensIfCurrent(token, current);
  if (updated === null) {
    throw authSessionChangedError();
  }
  rememberCompletedRefresh(current.accessToken, updated);
  return updated.accessToken;
}

function rememberCompletedRefresh(failedAccessToken: string, updated: AuthSession): void {
  completedRefreshByAccessToken.set(failedAccessToken, {
    accessToken: updated.accessToken,
    userId: updated.userId,
  });
  if (completedRefreshByAccessToken.size > MAX_COMPLETED_REFRESHES) {
    const oldest = completedRefreshByAccessToken.keys().next().value;
    if (typeof oldest === 'string') {
      completedRefreshByAccessToken.delete(oldest);
    }
  }
}

function authSessionChangedError(): ApiClientError {
  return new ApiClientError({
    message: '로그인 계정이 변경되어 이전 요청을 중단했습니다.',
    status: 401,
    errorCode: 'AUTH_SESSION_CHANGED',
  });
}

function isTransientRefreshFailure(error: unknown): error is ApiClientError {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  return (
    error.status === null ||
    error.status === 408 ||
    error.status === 429 ||
    (error.status >= 500 && error.status <= 599)
  );
}

type CompletedRefresh = {
  readonly accessToken: string;
  readonly userId: number | undefined;
};

const MAX_COMPLETED_REFRESHES = 8;
