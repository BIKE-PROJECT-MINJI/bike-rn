import { extractFirstCourseId, extractRideRecordId, normalizeNumber } from './apiTestExtractors';

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
