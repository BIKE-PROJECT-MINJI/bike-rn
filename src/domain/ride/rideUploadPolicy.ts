import { ApiClientError } from '../../shared/api/apiClient';

export type RideUploadFailure =
  | { readonly kind: 'RETRYABLE'; readonly retryAfterSeconds: number; readonly errorCode: string | null }
  | { readonly kind: 'USER_ACTION'; readonly action: 'LOGIN'; readonly errorCode: string | null }
  | { readonly kind: 'TERMINAL'; readonly errorCode: string | null };

export function classifyRideUploadFailure(error: unknown): RideUploadFailure {
  if (isNetworkOrTimeoutError(error)) {
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

function isNetworkOrTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { readonly name?: unknown; readonly message?: unknown };
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message.trim().toLowerCase() : '';
  return (
    name === 'AbortError' ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('failed to connect') ||
    message.includes('network error') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}
