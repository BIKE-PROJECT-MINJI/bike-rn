import {
  appendRidePoint,
  appendRidePoints,
  createRideDraft,
  finishRideDraft,
  canManuallyRetryRide,
  parsePersistedRideDraft,
  pauseRideDraft,
  resumeRideDraft,
  type RideDraft,
} from './rideQueueModel';

describe('ride queue model', () => {
  it('persists course and party context across process recovery', () => {
    const draft = createRideDraft('ride-party-001', 1_700_000_000_000, {
      mode: 'PARTY', courseId: 31, courseTitle: '한강 평지 코스', partyId: 9,
    });

    const restored = parsePersistedRideDraft(JSON.stringify(draft));

    expect(restored).toMatchObject({ mode: 'PARTY', courseId: 31, courseTitle: '한강 평지 코스', partyId: 9 });
  });

  it('defaults legacy drafts without ride context to free ride', () => {
    const legacy = JSON.parse(JSON.stringify(createRideDraft('ride-legacy', 1_700_000_000_000))) as Record<string, unknown>;
    delete legacy.mode;
    delete legacy.courseId;
    delete legacy.courseTitle;
    delete legacy.partyId;

    expect(parsePersistedRideDraft(JSON.stringify(legacy))).toMatchObject({
      mode: 'FREE', courseId: null, courseTitle: null, partyId: null,
    });
  });

  it('keeps the same clientRideId after a queued ride is serialized and restored', () => {
    // Given
    const recording = createRideDraft('ride-device-001', 1_700_000_000_000);
    const queued = finishRideDraft(recording, 1_700_000_060_000);

    // When
    const restored = parsePersistedRideDraft(JSON.stringify(queued));

    // Then
    expect(restored.clientRideId).toBe('ride-device-001');
    expect(restored.status).toBe('QUEUED');
  });

  it('rejects a corrupted persisted ride instead of uploading guessed fields', () => {
    // Given
    const corrupted = JSON.stringify({ clientRideId: 'ride-device-001', status: 'QUEUED' });

    // When / Then
    expect(() => parsePersistedRideDraft(corrupted)).toThrow('저장된 주행 데이터가 손상되었습니다.');
  });

  it('preserves the client id when an upload retry state is restored', () => {
    // Given
    const draft: RideDraft = {
      ...finishRideDraft(createRideDraft('ride-stable-id', 1_700_000_000_000), 1_700_000_010_000),
      status: 'RETRY_WAIT',
      attemptCount: 1,
      nextRetryAtMs: 1_700_000_020_000,
      lastErrorCode: 'RIDE_SAVE_BUSY',
    };

    // When
    const restored = parsePersistedRideDraft(JSON.stringify(draft));

    // Then
    expect(restored.clientRideId).toBe('ride-stable-id');
    expect(restored.attemptCount).toBe(1);
  });

  it('allows manual retry only for a user-action failure', () => {
    const queued = finishRideDraft(createRideDraft('ride-manual', 1_700_000_000_000), 1_700_000_010_000);

    expect(canManuallyRetryRide({ ...queued, status: 'FAILED_USER_ACTION' })).toBe(true);
    expect(canManuallyRetryRide({ ...queued, status: 'FAILED_TERMINAL' })).toBe(false);
    expect(canManuallyRetryRide(queued)).toBe(false);
  });

  it('persists accepted samples incrementally and ignores samples while paused', () => {
    // Given
    const first = appendRidePoint(createRideDraft('ride-incremental', 1_700_000_000_000), {
      latitude: 37.5665,
      longitude: 126.978,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 8,
      speedMps: 4,
      bearingDeg: 90,
      altitudeM: 12,
    });
    const paused = pauseRideDraft(first, 1_700_000_005_000);

    // When
    const ignored = appendRidePoint(paused, {
      latitude: 37.567,
      longitude: 126.979,
      capturedAtIso: '2026-07-14T00:00:06.000Z',
      accuracyM: 8,
      speedMps: 4,
      bearingDeg: 90,
      altitudeM: 12,
    });
    const resumed = resumeRideDraft(ignored, 1_700_000_010_000);
    const second = appendRidePoint(resumed, {
      latitude: 37.567,
      longitude: 126.979,
      capturedAtIso: '2026-07-14T00:00:11.000Z',
      accuracyM: 8,
      speedMps: 4,
      bearingDeg: 90,
      altitudeM: 12,
    });

    // Then
    expect(second.routePoints).toHaveLength(2);
    expect(second.routePoints[1]?.pointOrder).toBe(2);
    expect(second.distanceMeters).toBeGreaterThan(0);
  });

  it('appends a background batch with contiguous point order in one transition', () => {
    const draft = createRideDraft('ride-batch', 1_700_000_000_000);

    const updated = appendRidePoints(draft, [
      {
        latitude: 37.5665,
        longitude: 126.978,
        capturedAtIso: '2026-07-14T00:00:01.000Z',
        accuracyM: 5,
        speedMps: 3,
        bearingDeg: 30,
        altitudeM: null,
      },
      {
        latitude: 37.567,
        longitude: 126.979,
        capturedAtIso: '2026-07-14T00:00:03.000Z',
        accuracyM: 5,
        speedMps: 3,
        bearingDeg: 31,
        altitudeM: null,
      },
    ]);

    expect(updated.routePoints.map((point) => point.pointOrder)).toEqual([1, 2]);
    expect(updated.distanceMeters).toBeGreaterThan(0);
  });
});
