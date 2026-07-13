import { mapCourseDetail, mapCourseList, mapCourseRoutePoints, mergeRecordedCourses } from './courseMapper';

describe('courseMapper', () => {
  it('course list API 응답을 화면 카드 모델로 변환한다', () => {
    const result = mapCourseList({
      status: 200,
      message: 'OK',
      data: {
        items: [
          {
            id: 11,
            title: '한강 남쪽 코스',
            distanceKm: 12.4,
            estimatedDurationMin: 48,
            difficulty: { level: 'NORMAL', label: '보통', score: 58, summary: '거리 기준' },
            recorded: true,
          },
        ],
        hasNext: false,
        nextCursor: null,
      },
    });

    expect(result.items).toEqual([
      {
        id: 11,
        title: '한강 남쪽 코스',
        distanceKm: 12.4,
        estimatedDurationMin: 48,
        difficulty: { level: 'NORMAL', label: '보통', score: 58, summary: '거리 기준' },
        featuredRank: null,
        isRecorded: true,
      },
    ]);
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('상세 응답 누락값은 안전한 기본값으로 축약한다', () => {
    expect(mapCourseDetail({ status: 200, message: 'OK', data: { id: 7 } })).toEqual({
      id: 7,
      title: '',
      distanceKm: 0,
      estimatedDurationMin: 0,
      difficulty: null,
      featuredRank: null,
      isRecorded: false,
    });
  });

  it('로컬 recorded course id를 서버 목록에 병합한다', () => {
    expect(
      mergeRecordedCourses(
        [{ id: 1, title: 'A', distanceKm: 1, estimatedDurationMin: 10, difficulty: null, featuredRank: null, isRecorded: false }],
        [1],
      )[0].isRecorded,
    ).toBe(true);
  });

  it('route-points API 응답을 pointOrder 기준 화면 경로로 변환한다', () => {
    const result = mapCourseRoutePoints({
      code: 200,
      message: 'success',
      data: {
        courseId: 11,
        points: [
          { pointOrder: 2, latitude: 37.2, longitude: 127.2 },
          { pointOrder: 1, latitude: 37.1, longitude: 127.1 },
        ],
      },
    });

    expect(result).toEqual([
      { pointOrder: 1, latitude: 37.1, longitude: 127.1 },
      { pointOrder: 2, latitude: 37.2, longitude: 127.2 },
    ]);
  });
});
