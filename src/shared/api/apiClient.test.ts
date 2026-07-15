import { ApiClientError, apiRequest } from './apiClient';

describe('api client error contract', () => {
  afterEach(() => jest.restoreAllMocks());

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
});

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
