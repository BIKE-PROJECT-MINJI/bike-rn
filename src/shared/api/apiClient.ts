import { expireAuthSession, refreshAccessToken } from '../../domain/auth/authRefreshCoordinator';
import { ApiClientError, executeApiRequest, type ApiRequestOptions } from './apiTransport';

export { ApiClientError } from './apiTransport';

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  try {
    return await executeApiRequest<T>(path, options);
  } catch (error) {
    if (!shouldRefresh(error, path, options.accessToken)) {
      throw error;
    }
  }

  const failedAccessToken = options.accessToken;
  if (typeof failedAccessToken !== 'string') {
    throw new MissingFailedAccessTokenError();
  }
  const refreshedAccessToken = await refreshAccessToken(failedAccessToken);
  try {
    return await executeApiRequest<T>(path, { ...options, accessToken: refreshedAccessToken });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      throw await expireAuthSession(refreshedAccessToken);
    }
    throw error;
  }
}

function shouldRefresh(error: unknown, path: string, accessToken: string | null | undefined): boolean {
  return (
    error instanceof ApiClientError &&
    error.status === 401 &&
    typeof accessToken === 'string' &&
    path !== '/api/v1/auth/refresh'
  );
}

class MissingFailedAccessTokenError extends Error {
  constructor() {
    super('401 재처리에 필요한 access token이 없습니다.');
    this.name = 'MissingFailedAccessTokenError';
  }
}
