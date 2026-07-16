export type PreRideRouteSummary = {
  readonly title: string;
  readonly body: string;
  readonly hasRoute: boolean;
};

export function buildPreRideRouteSummary(pointCount: number): PreRideRouteSummary {
  if (pointCount < 2) {
    return {
      title: '주행 가능한 경로를 확인하지 못했어요',
      body: '코스 경로를 다시 불러온 뒤 출발해 주세요.',
      hasRoute: false,
    };
  }
  return {
    title: '코스 경로 확인 완료',
    body: `출발점과 도착점을 포함한 경로점 ${pointCount}개를 확인했습니다.`,
    hasRoute: true,
  };
}
