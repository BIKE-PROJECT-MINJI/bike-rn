import { ApiClientError } from '../../shared/api/apiClient';

export type RideUploadFailure =
  | { readonly kind: 'RETRYABLE'; readonly retryAfterSeconds: number; readonly errorCode: string | null }
  | { readonly kind: 'USER_ACTION'; readonly action: 'LOGIN'; readonly errorCode: string | null }
  | { readonly kind: 'TERMINAL'; readonly errorCode: string | null };

export function classifyRideUploadFailure(error: unknown): RideUploadFailure {
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
    return { kind: 'RETRYABLE', retryAfterSeconds: 5, errorCode: 'NETWORK_ERROR' };
  }
  if (!(error instanceof ApiClientError)) {
    return { kind: 'TERMINAL', errorCode: 'UNEXPECTED_CLIENT_ERROR' };
  }
  if (error.status === 401) {
    return { kind: 'USER_ACTION', action: 'LOGIN', errorCode: error.errorCode };
  }
  if (error.status === 408 || error.status === 429 || error.status === null || error.status >= 500) {
    return {
      kind: 'RETRYABLE',
      retryAfterSeconds: error.retryAfterSeconds ?? 5,
      errorCode: error.errorCode,
    };
  }
  return { kind: 'TERMINAL', errorCode: error.errorCode };
}
