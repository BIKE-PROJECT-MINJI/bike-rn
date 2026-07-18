import type { AiRouteCandidateUiModel } from './aiRouteSessionModels';
import { createAiRouteSession, promoteAiRouteCandidate } from './aiRouteSessionService';

describe('AI route session service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates the canonical session with the normalized route request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(responseOf(200, sessionPayload()));

    const session = await createAiRouteSession({
      lat: 37.52,
      lon: 126.92,
      destinationLabel: '여의도',
      rideStyle: 'SCENERY_FIRST',
      textIntent: '평지 한강 풍경',
    }, 'token');

    expect(session.candidates).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.gajabike.shop/api/v1/ai-route-sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not call promote again when the candidate already has a course receipt', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const candidate = { ...sessionCandidate(), promotedCourseId: 44 };

    await expect(promoteAiRouteCandidate(11, candidate, 'token')).resolves.toEqual({ courseId: 44, routePointCount: 2 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function sessionPayload() {
  return {
    code: 200,
    message: 'OK',
    data: {
      sessionId: 11,
      status: 'READY',
      fallbackUsed: false,
      provider: 'GRAPHHOPPER',
      fallbackReason: null,
      candidates: [sessionCandidate()],
    },
  };
}

function sessionCandidate(): AiRouteCandidateUiModel {
  return {
    candidateId: 1,
    title: '한강 코스',
    summary: '평지 위주',
    distanceKm: 12,
    estimatedDurationMin: 48,
    recommendationScore: 82,
    scoreBreakdown: null,
    evidenceBadges: [],
    totalAscentM: 100,
    routingProvider: null,
    routingFallbackUsed: false,
    preferenceSummary: null,
    elevationStatus: null,
    sceneryEvidenceStatus: null,
    routePoints: [{ lat: 37.52, lon: 126.92, label: '출발' }, { lat: 37.53, lon: 126.93, label: '도착' }],
    routePointCount: 2,
    promotedCourseId: null,
  };
}

function responseOf(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
