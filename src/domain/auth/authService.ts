import { apiRequest } from '../../shared/api/apiClient';
import type { AuthSession, AuthTokenResponse } from './authModels';

type AuthApiResponse = {
  readonly data: AuthTokenResponse;
};

export async function loginWithEmail(email: string, password: string): Promise<AuthSession> {
  const normalizedEmail = email.trim();
  const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email: normalizedEmail, password },
  });
  return toAuthSession(normalizedEmail, payload.data);
}

export async function registerWithEmail(email: string, password: string, displayName: string): Promise<AuthSession> {
  const normalizedEmail = email.trim();
  const payload = await apiRequest<AuthApiResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: { email: normalizedEmail, password, displayName: displayName.trim() },
  });
  return toAuthSession(normalizedEmail, payload.data);
}

function toAuthSession(email: string, token: AuthTokenResponse): AuthSession {
  const issuedAtEpochMillis = Date.now();

  return {
    userId: token.userId,
    email,
    displayName: token.displayName,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    accessTokenExpiresAtEpochMillis: issuedAtEpochMillis + token.accessExpiresInSec * 1000,
    refreshTokenExpiresAtEpochMillis: issuedAtEpochMillis + token.refreshExpiresInSec * 1000,
  };
}
