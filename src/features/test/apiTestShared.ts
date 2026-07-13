export const DEFAULT_TEST_COURSE_ID = 1;
export const DEFAULT_TEST_LAT = 37.5665;
export const DEFAULT_TEST_LON = 126.978;

export function requiredId(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`${label}가 없습니다. 먼저 관련 생성/목록 API를 실행해 주세요.`);
  }
  return value;
}
