import { appendRidePoint, createRideDraft, finishRideDraft } from './rideQueueModel';
import { buildRideSaveRequest, fetchRideRecords, recoverRideStatus } from './rideApi';

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

describe('recoverRideStatus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps clientRideId out of the URL and maps an existing receipt', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf(200, {
        code: 200,
        message: 'OK',
        data: { rideRecordId: 41, status: 'FINALIZING', linkedCourseId: null },
      }),
    );

    await expect(recoverRideStatus('ride/device 001', 'token')).resolves.toEqual({
      rideRecordId: 41,
      status: 'FINALIZING',
      linkedCourseId: null,
      qualityStatus: null,
      qualityReasons: [],
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.gajabike.shop/api/v1/ride-records/receipt',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ clientRideId: 'ride/device 001' }),
      }),
    );
  });

  it('returns null only when the recovery receipt is absent', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf(404, { code: 404, message: '자유 주행 기록을 찾을 수 없습니다.', data: null }),
    );

    await expect(recoverRideStatus('ride-missing', 'token')).resolves.toBeNull();
  });

  it('preserves a recovery provider failure instead of treating it as absent', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf(503, { code: 503, message: '일시 장애', data: { errorCode: 'SERVICE_UNAVAILABLE' } }),
    );

    await expect(recoverRideStatus('ride-unknown', 'token')).rejects.toEqual(
      expect.objectContaining({ status: 503 }),
    );
  });

  it('maps REJECTED quality from a finalization receipt', async () => {
    // Given
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf(200, {
        code: 200,
        message: 'OK',
        data: {
          rideRecordId: 41,
          status: 'READY',
          linkedCourseId: null,
          qualityStatus: 'REJECTED',
          qualityReasons: ['IMPLAUSIBLE_JUMP'],
        },
      }),
    );

    // When / Then
    await expect(recoverRideStatus('ride-rejected', 'token')).resolves.toEqual({
      rideRecordId: 41,
      status: 'READY',
      linkedCourseId: null,
      qualityStatus: 'REJECTED',
      qualityReasons: ['IMPLAUSIBLE_JUMP'],
    });
  });
});

describe('fetchRideRecords quality compatibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('defaults missing quality fields and preserves fields when the list API supplies them', async () => {
    // Given
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      responseOf(200, {
        code: 200,
        message: 'OK',
        data: {
          items: [
            { rideRecordId: 1, distanceM: 1000, durationSec: 300, finalizationStatus: 'READY' },
            {
              rideRecordId: 2,
              distanceM: 900,
              durationSec: 280,
              finalizationStatus: 'READY',
              qualityStatus: 'PARTIAL',
              qualityReasons: ['LOW_ACCURACY'],
            },
          ],
        },
      }),
    );

    // When / Then
    await expect(fetchRideRecords('token')).resolves.toEqual([
      expect.objectContaining({ rideRecordId: 1, qualityStatus: null, qualityReasons: [] }),
      expect.objectContaining({ rideRecordId: 2, qualityStatus: 'PARTIAL', qualityReasons: ['LOW_ACCURACY'] }),
    ]);
  });
});

function responseOf(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
