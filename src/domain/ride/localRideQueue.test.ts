import { appendRidePoint, createRideDraft, finishRideDraft, type RideReceipt } from './rideQueueModel';

const mockOutbox = new Map<
  string,
  { readonly client_ride_id: string; readonly payload: string; readonly updated_at: number }
>();
const mockPoints = new Map<string, Map<number, string>>();
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
      return;
    }
    if (sql.includes('INSERT OR IGNORE INTO ride_points')) {
      const clientRideId = requireString(parameters[0]);
      const pointOrder = requireNumber(parameters[1]);
      const points = mockPoints.get(clientRideId) ?? new Map<number, string>();
      if (!points.has(pointOrder)) {
        points.set(pointOrder, requireString(parameters[2]));
      }
      mockPoints.set(clientRideId, points);
      return;
    }
    if (sql.includes('INSERT INTO ride_receipts')) {
      const clientRideId = requireString(parameters[0]);
      mockReceipts.set(clientRideId, {
        client_ride_id: clientRideId,
        ride_record_id: requireNumber(parameters[1]),
        completed_at: requireNumber(parameters[3]),
        linked_course_id: requireNullableNumber(parameters[4]),
      });
      return;
    }
    if (sql.includes('DELETE FROM ride_points')) {
      mockPoints.delete(requireString(parameters[0]));
    } else if (sql.includes('DELETE FROM ride_outbox')) {
      mockOutbox.delete(requireString(parameters[0]));
    }
  }),
  getFirstSync: jest.fn((sql: string, ...parameters: unknown[]) => {
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
    return [...mockOutbox.values()].sort((left, right) => left.updated_at - right.updated_at);
  }),
  withTransactionSync: jest.fn((operation: () => void) => operation()),
};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

const { completeRideDraft, listPendingRideDrafts, loadRideDraft, loadLatestRideReceipt, saveRideDraft } =
  require('./localRideQueue') as typeof import('./localRideQueue');

describe('local ride queue', () => {
  beforeEach(() => {
    mockOutbox.clear();
    mockPoints.clear();
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
