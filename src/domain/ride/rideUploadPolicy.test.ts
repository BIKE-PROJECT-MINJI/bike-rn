import { ApiClientError } from '../../shared/api/apiClient';
import { classifyRideUploadFailure } from './rideUploadPolicy';

describe('ride upload failure policy', () => {
  it('uses Retry-After for RIDE_SAVE_BUSY without dropping the local trace', () => {
    // Given
    const error = new ApiClientError({
      message: '주행 저장 요청이 몰리고 있습니다.',
      status: 503,
      errorCode: 'RIDE_SAVE_BUSY',
      retryAfterSeconds: 7,
    });

    // When
    const result = classifyRideUploadFailure(error);

    // Then
    expect(result).toEqual({ kind: 'RETRYABLE', retryAfterSeconds: 7, errorCode: 'RIDE_SAVE_BUSY' });
  });

  it('requires login instead of retrying an expired session forever', () => {
    // Given
    const error = new ApiClientError({ message: '인증이 필요합니다.', status: 401 });

    // When
    const result = classifyRideUploadFailure(error);

    // Then
    expect(result).toEqual({ kind: 'USER_ACTION', action: 'LOGIN', errorCode: null });
  });

  it('marks an invalid ride payload as terminal', () => {
    // Given
    const error = new ApiClientError({ message: '잘못된 요청입니다.', status: 400 });

    // When
    const result = classifyRideUploadFailure(error);

    // Then
    expect(result).toEqual({ kind: 'TERMINAL', errorCode: null });
  });

  it.each([408, 500, 502, 504])('retries transient HTTP %s failures with the same local ride', (status) => {
    const error = new ApiClientError({ message: '일시적인 서버 오류입니다.', status });

    expect(classifyRideUploadFailure(error)).toEqual({
      kind: 'RETRYABLE',
      retryAfterSeconds: 5,
      errorCode: null,
    });
  });

  it('respects Retry-After for 429 rate limiting', () => {
    const error = new ApiClientError({
      message: '요청이 너무 많습니다.',
      status: 429,
      retryAfterSeconds: 12,
    });

    expect(classifyRideUploadFailure(error)).toEqual({
      kind: 'RETRYABLE',
      retryAfterSeconds: 12,
      errorCode: null,
    });
  });

  it.each([
    new TypeError('Network request failed'),
    Object.assign(new Error('timed out'), { name: 'AbortError' }),
    new Error('Network request failed'),
    { name: 'TypeError', message: 'Network request failed.' },
    {
      name: 'TypeError',
      message: 'fetch failed: java.net.ConnectException: Failed to connect to the configured API host',
    },
  ])('retries connection and timeout errors without losing the draft', (error) => {
    expect(classifyRideUploadFailure(error)).toEqual({
      kind: 'RETRYABLE',
      retryAfterSeconds: 5,
      errorCode: 'NETWORK_ERROR',
    });
  });

  it('does not retry an unexpected client programming error forever', () => {
    expect(classifyRideUploadFailure(new Error('mapper defect'))).toEqual({
      kind: 'TERMINAL',
      errorCode: 'UNEXPECTED_CLIENT_ERROR',
    });
  });
});
