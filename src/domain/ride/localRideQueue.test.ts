import { appendRidePoint, createRideDraft, finishRideDraft, type RideReceipt } from './rideQueueModel';

const mockOutbox = new Map<
  string,
  { readonly client_ride_id: string; readonly payload: string; readonly updated_at: number }
>();
const mockPoints = new Map<string, Map<number, string>>();
const mockPointKeys = new Map<string, Set<string>>();
const mockLocationEvents = new Map<string, Set<string>>();
const mockReceipts = new Map<
  string,
  {
    readonly client_ride_id: string;
    readonly ride_record_id: number;
    readonly completed_at: number;
    readonly linked_course_id: number | null;
  }
>();

const mockDatabase = {
  execSync: jest.fn(),
  runSync: jest.fn((sql: string, ...parameters: unknown[]) => {
    if (sql.includes('INSERT INTO ride_outbox')) {
      const clientRideId = requireString(parameters[0]);
      mockOutbox.set(clientRideId, {
        client_ride_id: clientRideId,
        payload: requireString(parameters[1]),
        updated_at: requireNumber(parameters[2]),
      });
      return { changes: 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO ride_location_events')) {
      const clientRideId = requireString(parameters[0]);
      const eventId = requireString(parameters[1]);
      const events = mockLocationEvents.get(clientRideId) ?? new Set<string>();
      const existed = events.has(eventId);
      events.add(eventId);
      mockLocationEvents.set(clientRideId, events);
      return { changes: existed ? 0 : 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO ride_point_keys')) {
      const clientRideId = requireString(parameters[0]);
      const pointKey = requireString(parameters[1]);
      const keys = mockPointKeys.get(clientRideId) ?? new Set<string>();
      const existed = keys.has(pointKey);
      keys.add(pointKey);
      mockPointKeys.set(clientRideId, keys);
      return { changes: existed ? 0 : 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO ride_points')) {
      const clientRideId = requireString(parameters[0]);
      const pointOrder = requireNumber(parameters[1]);
      const points = mockPoints.get(clientRideId) ?? new Map<number, string>();
      if (!points.has(pointOrder)) {
        points.set(pointOrder, requireString(parameters[2]));
      }
      mockPoints.set(clientRideId, points);
      return { changes: 1 };
    }
    if (sql.includes('INSERT INTO ride_points')) {
      const clientRideId = requireString(parameters[0]);
      const pointOrder = requireNumber(parameters[1]);
      const points = mockPoints.get(clientRideId) ?? new Map<number, string>();
      if (points.has(pointOrder)) {
        throw new Error('UNIQUE constraint failed: ride_points.client_ride_id, ride_points.point_order');
      }
      points.set(pointOrder, requireString(parameters[2]));
      mockPoints.set(clientRideId, points);
      return { changes: 1 };
    }
    if (sql.includes('INSERT INTO ride_receipts')) {
      const clientRideId = requireString(parameters[0]);
      mockReceipts.set(clientRideId, {
        client_ride_id: clientRideId,
        ride_record_id: requireNumber(parameters[1]),
        completed_at: requireNumber(parameters[3]),
        linked_course_id: requireNullableNumber(parameters[4]),
      });
      return { changes: 1 };
    }
    if (sql.includes('DELETE FROM ride_location_events')) {
      mockLocationEvents.delete(requireString(parameters[0]));
    } else if (sql.includes('DELETE FROM ride_point_keys')) {
      mockPointKeys.delete(requireString(parameters[0]));
    } else if (sql.includes('DELETE FROM ride_points')) {
      mockPoints.delete(requireString(parameters[0]));
    } else if (sql.includes('DELETE FROM ride_outbox')) {
      mockOutbox.delete(requireString(parameters[0]));
    }
    return { changes: 1 };
  }),
  getFirstSync: jest.fn((sql: string, ...parameters: unknown[]) => {
    if (sql.includes('COUNT(*)') && sql.includes('FROM ride_outbox')) {
      return { pending_count: mockOutbox.size };
    }
    if (sql.includes('COUNT(*)') && sql.includes('FROM ride_points')) {
      return { point_count: (mockPoints.get(requireString(parameters[0])) ?? new Map()).size };
    }
    if (sql.includes('FROM ride_points')) {
      const points = mockPoints.get(requireString(parameters[0])) ?? new Map<number, string>();
      const latest = [...points.entries()].sort(([left], [right]) => right - left)[0];
      return latest === undefined ? null : { point_order: latest[0], payload: latest[1] };
    }
    if (sql.includes('WHERE client_ride_id')) {
      return mockOutbox.get(requireString(parameters[0])) ?? null;
    }
    return [...mockReceipts.values()].sort((left, right) => right.completed_at - left.completed_at)[0] ?? null;
  }),
  getAllSync: jest.fn((sql: string, ...parameters: unknown[]) => {
    if (sql.includes('FROM ride_points')) {
      const points = mockPoints.get(requireString(parameters[0])) ?? new Map<number, string>();
      return [...points.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, payload]) => ({ payload }));
    }
    return [...mockOutbox.values()].sort((left, right) =>
      sql.includes('DESC') ? right.updated_at - left.updated_at : left.updated_at - right.updated_at,
    );
  }),
  withTransactionSync: jest.fn((operation: () => void) => operation()),
};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

const {
  appendRidePointsToQueue,
  completeRideDraft,
  createRideDraftIfQueueEmpty,
  listPendingRideDrafts,
  loadRideDraft,
  loadLatestRideReceipt,
  saveRideDraft,
} =
  require('./localRideQueue') as typeof import('./localRideQueue');

describe('local ride queue', () => {
  beforeEach(() => {
    mockOutbox.clear();
    mockPoints.clear();
    mockPointKeys.clear();
    mockLocationEvents.clear();
    mockReceipts.clear();
    jest.clearAllMocks();
  });

  it('restores a queued ride with the same clientRideId after local persistence', async () => {
    const recording = appendRidePoint(createRideDraft('ride-relaunch', 1_700_000_000_000), {
      latitude: 37.5665,
      longitude: 126.978,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 5,
      speedMps: 3,
      bearingDeg: 30,
      altitudeM: null,
    });
    const draft = finishRideDraft(recording, 1_700_000_060_000);

    await saveRideDraft(draft);

    expect(loadRideDraft('ride-relaunch')).toEqual(draft);
    expect(listPendingRideDrafts()).toEqual([draft]);
  });

  it('removes the upload payload only after a READY receipt is stored', async () => {
    const draft = finishRideDraft(createRideDraft('ride-ready', 1_700_000_000_000), 1_700_000_060_000);
    const receipt: RideReceipt = {
      clientRideId: 'ride-ready',
      rideRecordId: 77,
      status: 'READY',
      completedAtMs: 1_700_000_070_000,
      linkedCourseId: null,
    };
    await saveRideDraft(draft);

    await completeRideDraft(receipt);

    expect(loadRideDraft('ride-ready')).toBeNull();
    expect(loadLatestRideReceipt()).toEqual(receipt);
  });

  it('continues from the highest stored point order instead of the point count', async () => {
    const first = appendRidePoint(createRideDraft('ride-order-gap', 1_700_000_000_000), {
      latitude: 37.5665,
      longitude: 126.978,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 5,
      speedMps: 3,
      bearingDeg: 30,
      altitudeM: null,
    });
    await saveRideDraft(first);
    const firstPoint = first.routePoints[0];
    if (firstPoint === undefined) {
      throw new Error('The fixture must contain its first point.');
    }
    const pointThree = { ...firstPoint, pointOrder: 3, capturedAtIso: '2026-07-14T00:00:03.000Z' };
    mockPoints.get('ride-order-gap')?.set(3, JSON.stringify(pointThree));

    await appendRidePointsToQueue('ride-order-gap', [
      {
        latitude: 37.567,
        longitude: 126.979,
        capturedAtIso: '2026-07-14T00:00:05.000Z',
        accuracyM: 5,
        speedMps: 3,
        bearingDeg: 31,
        altitudeM: null,
      },
    ]);

    expect(loadRideDraft('ride-order-gap')?.routePoints.map((point) => point.pointOrder)).toEqual([1, 3, 4]);
  });

  it('stores an identical background point only once across duplicate callbacks', async () => {
    await saveRideDraft(createRideDraft('ride-duplicate-event', 1_700_000_000_000));
    const point = {
      latitude: 37.5665,
      longitude: 126.978,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 5,
      speedMps: 3,
      bearingDeg: 30,
      altitudeM: null,
    } as const;

    await appendRidePointsToQueue('ride-duplicate-event', [point]);
    await appendRidePointsToQueue('ride-duplicate-event', [point]);

    expect(loadRideDraft('ride-duplicate-event')?.routePoints).toHaveLength(1);
  });

  it('creates only one draft when start requests race', async () => {
    const first = createRideDraft('ride-start-first', 1_700_000_000_000);
    const second = createRideDraft('ride-start-second', 1_700_000_000_001);

    const results = await Promise.all([
      createRideDraftIfQueueEmpty(first),
      createRideDraftIfQueueEmpty(second),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(listPendingRideDrafts()).toHaveLength(1);
  });

  it('preserves every local trace even when two drafts started within two seconds', async () => {
    const orphan = appendRidePoint(createRideDraft('ride-active-orphan', 1_700_000_000_000), {
      latitude: 37.5666,
      longitude: 126.9781,
      capturedAtIso: '2026-07-14T00:01:01.000Z',
      accuracyM: 5,
      speedMps: 3,
      bearingDeg: 30,
      altitudeM: null,
    });
    const recording = appendRidePoint(createRideDraft('ride-finished-original', 1_700_000_000_163), {
      latitude: 37.5665,
      longitude: 126.978,
      capturedAtIso: '2026-07-14T00:00:01.000Z',
      accuracyM: 5,
      speedMps: 3,
      bearingDeg: 30,
      altitudeM: null,
    });
    const failed = {
      ...finishRideDraft(recording, 1_700_000_060_000),
      status: 'FAILED_TERMINAL' as const,
      lastErrorCode: 'UNEXPECTED_CLIENT_ERROR',
    };
    await saveRideDraft(orphan);
    await saveRideDraft(failed);

    const pending = listPendingRideDrafts();

    expect(pending).toHaveLength(2);
    expect(loadRideDraft(orphan.clientRideId)).toEqual(orphan);
    expect(loadRideDraft(failed.clientRideId)).toEqual(failed);
  });

  it('does not repair an active draft whose start time is outside the duplicate window', async () => {
    const active = createRideDraft('ride-separate-active', 1_700_000_000_000);
    const finished = finishRideDraft(createRideDraft('ride-older-finished', 1_699_999_990_000), 1_700_000_020_000);
    await saveRideDraft(active);
    await saveRideDraft(finished);

    const pending = listPendingRideDrafts();

    expect(pending).toHaveLength(2);
    expect(loadRideDraft(active.clientRideId)).toEqual(active);
    expect(loadRideDraft(finished.clientRideId)).toEqual(finished);
  });
});

function requireString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Expected a string SQL parameter.');
  }
  return value;
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number') {
    throw new TypeError('Expected a number SQL parameter.');
  }
  return value;
}

function requireNullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  return requireNumber(value);
}
