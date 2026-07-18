import { ApiClientError } from '../../shared/api/apiClient';
import { presentAiRouteSessionError } from './aiRouteSessionPresentation';

describe('AI route session error presentation', () => {
  it.each([
    [422, false, '조건에 맞는 코스가 없습니다'],
    [429, true, '잠시 후 다시 시도해 주세요'],
    [503, true, '경로 서비스를 연결하지 못했습니다'],
  ])('keeps HTTP %i as a distinct user decision', (status, retryable, title) => {
    const result = presentAiRouteSessionError(new ApiClientError({ message: '오류', status }));

    expect(result).toEqual(expect.objectContaining({ retryable, title }));
  });

  it('shows the server Retry-After duration for quota responses', () => {
    const result = presentAiRouteSessionError(new ApiClientError({
      message: 'quota',
      status: 429,
      retryAfterSeconds: 17,
    }));

    expect(result).toEqual(expect.objectContaining({ retryAfterSeconds: 17 }));
    expect(result.message).toContain('17초');
  });
});
