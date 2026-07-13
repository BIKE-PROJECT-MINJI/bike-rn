import { appendRidePoint, createRideDraft, finishRideDraft } from './rideQueueModel';
import { buildRideSaveRequest } from './rideApi';

describe('buildRideSaveRequest', () => {
  it('maps a finished local ride to the backend save contract', () => {
    const startedAtMs = Date.parse('2026-07-14T00:00:00.000Z');
    const firstPoint = {
      latitude: 37.521,
      longitude: 126.924,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 3.5,
      speedMps: 4.2,
      bearingDeg: 90,
      altitudeM: 12.4,
    };
    const draft = finishRideDraft(
      appendRidePoint(createRideDraft('ride-fixed-id', startedAtMs), firstPoint),
      startedAtMs + 10_400,
    );

    expect(buildRideSaveRequest(draft)).toEqual({
      clientRideId: 'ride-fixed-id',
      startedAt: '2026-07-14T00:00:00.000Z',
      endedAt: '2026-07-14T00:00:10.400Z',
      summary: { distanceM: 0, durationSec: 10 },
      routePoints: [
        {
          pointOrder: 1,
          latitude: 37.521,
          longitude: 126.924,
          capturedAt: '2026-07-14T00:00:01.000Z',
          accuracyM: 3.5,
          speedMps: 4.2,
          bearingDeg: 90,
          altitudeM: 12.4,
          distanceToRouteM: null,
          routeProgressPct: null,
        },
      ],
    });
  });

  it('rejects an unfinished local ride', () => {
    expect(() => buildRideSaveRequest(createRideDraft('ride-active', 1_700_000_000_000))).toThrow(
      '종료되지 않은 주행은 서버에 전송할 수 없습니다.',
    );
  });
});
