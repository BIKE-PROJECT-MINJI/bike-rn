import { mapAiRoutePlan, toAiRoutePlanRequestBody } from './aiRouteMapper';

describe('aiRouteMapper', () => {
  it('추천 점수와 evidence badge를 UI 모델로 변환한다', () => {
    const result = mapAiRoutePlan({
      recommendationScore: 83,
      scoreBreakdown: { scenery: 80, bikePath: 90, safety: 70, condition: 75, preferenceFit: 85, distancePenalty: 3, unknownPenalty: 2 },
      explanation: { headline: '강변 위주 추천', reason: '자전거도로 비율이 높아요.', caution: '', nextAction: '이 경로로 출발' },
      evidenceBadges: [{ source: 'weather', label: '날씨', status: 'VERIFIED', severity: 'INFO', summary: '주행 가능' }],
      routePoints: [{ label: '출발', lat: 37.1, lon: 127.1 }],
      risks: [{ label: '공사', severity: 'LOW', summary: '확인 필요' }],
      actions: ['출발'],
      aiGenerated: true,
    });

    expect(result.recommendationScore.total).toBe(83);
    expect(result.evidenceBadges[0].statusLabel).toBe('확인됨');
    expect(result.explanation.headline).toBe('강변 위주 추천');
    expect(result.routePoints).toEqual([{ label: '출발', lat: 37.1, lon: 127.1 }]);
  });

  it('요청 body는 목적지 좌표가 있을 때만 포함한다', () => {
    expect(
      toAiRoutePlanRequestBody({
        lat: 37,
        lon: 127,
        destinationLabel: '서울숲',
        rideStyle: 'SCENIC',
      }),
    ).toEqual({
      lat: 37,
      lon: 127,
      destinationLabel: '서울숲',
      rideStyle: 'SCENIC',
    });
  });

  it('fallback metadata가 있으면 대체 후보 UI 상태로 변환한다', () => {
    const result = mapAiRoutePlan({
      summary: '대체 후보를 준비했습니다.',
      routingMetadata: {
        fallbackUsed: true,
        fallbackReason: 'GRAPHHOPPER_TIMEOUT',
      },
      evidenceBadges: [{ source: 'routing', label: '경로', status: 'WARNING', severity: 'MEDIUM', summary: '대체 경로' }],
      routePoints: [{ label: '출발', lat: 37.1, lon: 127.1 }],
    });

    expect(result.uiState).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('GRAPHHOPPER_TIMEOUT');
    expect(result.explanation.caution).toContain('대체');
  });
});
