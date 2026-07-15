import { mapAiRoutePromoteResult, mapAiRouteSession } from './aiRouteSessionMapper';

describe('AI route session mapper', () => {
  it('maps one to three bounded candidates', () => {
    const result = mapAiRouteSession({
      data: {
        sessionId: 11,
        status: 'PARTIAL',
        fallbackUsed: true,
        provider: 'mixed',
        fallbackReason: 'PARTIAL_CANDIDATES',
        candidates: [candidate(1), candidate(2), candidate(3)],
      },
    });

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((item) => item.candidateId)).toEqual([1, 2, 3]);
    expect(result.candidates[0]?.totalAscentM).toBe(120);
    expect(result.candidates[0]?.scoreBreakdown?.bikePath).toBe(20);
    expect(result.candidates[0]?.evidenceBadges[0]?.source).toBe('graphhopper.road_class');
    expect(result.candidates[0]?.routingProvider).toBe('GRAPHHOPPER');
  });

  it('rejects an empty candidate session instead of rendering guessed content', () => {
    expect(() => mapAiRouteSession({
      data: { sessionId: 11, status: 'READY', fallbackUsed: false, provider: 'gemini', fallbackReason: null, candidates: [] },
    })).toThrow();
  });

  it('maps the idempotent promote receipt', () => {
    expect(mapAiRoutePromoteResult({ data: { courseId: 44, routePointCount: 120 } })).toEqual({
      courseId: 44,
      routePointCount: 120,
    });
  });
});

function candidate(candidateId: number) {
  return {
    candidateId,
    title: `후보 ${candidateId}`,
    summary: '한강 자전거도로 중심',
    distanceKm: 12.4,
    estimatedDurationMin: 48,
    recommendationScore: 82,
    scoreBreakdown: {
      total: 82, scenery: 12, bikePath: 20, safety: 15, condition: 10,
      elevation: 5, preferenceFit: 20, distancePenalty: 0, unknownPenalty: 0,
    },
    evidenceBadges: [{
      source: 'graphhopper.road_class', label: '자전거도로 근거', status: 'VERIFIED',
      severity: 'INFO', summary: 'cycleway detail',
    }],
    elevationSummary: { totalAscentM: 120 },
    routingMetadata: { provider: 'GRAPHHOPPER', fallbackUsed: false },
    preferenceSummary: '자전거도로 우선',
    elevationStatus: 'VERIFIED',
    sceneryEvidenceStatus: 'PARTIAL',
    routePoints: [
      { lat: 37.5, lon: 127, label: '출발' },
      { lat: 37.51, lon: 127.01, label: '도착' },
    ],
    routePointCount: 2,
    promotedCourseId: null,
  };
}
