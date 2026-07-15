import { createApiTestLog, type ApiTestAction } from './apiTestActions';
import { extractFirstCourseId, extractRideRecordId, normalizeNumber } from './apiTestExtractors';

const action: ApiTestAction = {
  id: 'redaction-check',
  title: '공개 로그 검사',
  group: 'Ops',
  run: async () => undefined,
};

describe('apiTestActions', () => {
  it('코스 목록 응답에서 첫 courseId를 꺼낸다', () => {
    const result = extractFirstCourseId({
      code: 200,
      message: 'success',
      data: {
        items: [{ id: 42, title: '테스트 코스' }],
      },
    });

    expect(result).toBe(42);
  });

  it('주행 저장 응답에서 rideRecordId를 꺼낸다', () => {
    const result = extractRideRecordId({
      code: 200,
      message: 'success',
      data: {
        rideRecordId: 77,
        finalizationStatus: 'FINALIZING',
      },
    });

    expect(result).toBe(77);
  });

  it('숫자 입력이 비었거나 잘못되면 fallback을 사용한다', () => {
    expect(normalizeNumber('', 1)).toBe(1);
    expect(normalizeNumber('abc', 1)).toBe(1);
    expect(normalizeNumber('12', 1)).toBe(12);
  });
});

describe('API test log redaction', () => {
  it('does not render tokens, email addresses, or coordinates in the on-screen payload', () => {
    const log = createApiTestLog(action, true, {
      accessToken: 'header.payload.signature',
      refresh_token: 'refresh-secret',
      profile: { email: 'rider@example.com' },
      routePoints: [{ latitude: 37.5665, longitude: 126.978 }],
    });

    expect(log.payload).not.toContain('header.payload.signature');
    expect(log.payload).not.toContain('refresh-secret');
    expect(log.payload).not.toContain('rider@example.com');
    expect(log.payload).not.toContain('37.5665');
    expect(log.payload).not.toContain('126.978');
    expect(log.payload).toContain('[REDACTED]');
  });

  it('redacts sensitive values embedded in error messages', () => {
    const log = createApiTestLog(
      action,
      false,
      new Error('Bearer secret-token for rider@example.com failed'),
    );

    expect(log.summary).not.toContain('secret-token');
    expect(log.payload).not.toContain('rider@example.com');
  });
});
