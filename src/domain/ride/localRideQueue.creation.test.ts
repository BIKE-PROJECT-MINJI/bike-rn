import { createRideDraft, finishRideDraft, pauseRideDraft } from './rideQueueModel';

type OutboxRow = {
  readonly client_ride_id: string;
  readonly payload: string;
  readonly updated_at: number;
};

const mockOutbox = new Map<string, OutboxRow>();

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
    }
    return { changes: 1 };
  }),
  getFirstSync: jest.fn((sql: string) => {
    if (sql.includes('COUNT(*)') && sql.includes('FROM ride_outbox')) {
      return { pending_count: mockOutbox.size };
    }
    return null;
  }),
  getAllSync: jest.fn((sql: string) => {
    if (sql.includes('FROM ride_points')) {
      return [];
    }
    return [...mockOutbox.values()].sort((left, right) => right.updated_at - left.updated_at);
  }),
  withTransactionSync: jest.fn((operation: () => void) => operation()),
};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

const { createRideDraftIfQueueEmpty, listPendingRideDrafts, saveRideDraft } =
  require('./localRideQueue') as typeof import('./localRideQueue');

describe('local ride creation gate', () => {
  beforeEach(() => {
    mockOutbox.clear();
    jest.clearAllMocks();
  });

  it('rejects a second active ride while a RECORDING ride exists', async () => {
    // Given
    await saveRideDraft(createRideDraft('ride-active-first', 1_700_000_000_000));

    // When
    const created = await createRideDraftIfQueueEmpty(
      createRideDraft('ride-active-second', 1_700_000_001_000),
    );

    // Then
    expect(created).toBe(false);
    expect(listPendingRideDrafts()).toHaveLength(1);
  });

  it('rejects a second active ride while a PAUSED ride exists', async () => {
    // Given
    const paused = pauseRideDraft(createRideDraft('ride-paused-first', 1_700_000_000_000), 1_700_000_010_000);
    await saveRideDraft(paused);

    // When
    const created = await createRideDraftIfQueueEmpty(
      createRideDraft('ride-active-second', 1_700_000_020_000),
    );

    // Then
    expect(created).toBe(false);
    expect(listPendingRideDrafts()).toHaveLength(1);
  });

  it('preserves a queued ride while allowing a new active ride', async () => {
    // Given
    const queued = finishRideDraft(
      createRideDraft('ride-upload-pending', 1_700_000_000_000),
      1_700_000_060_000,
    );
    await saveRideDraft(queued);

    // When
    const created = await createRideDraftIfQueueEmpty(
      createRideDraft('ride-active-new', 1_700_000_070_000),
    );

    // Then
    expect(created).toBe(true);
    expect(listPendingRideDrafts().map((draft) => draft.clientRideId).sort()).toEqual([
      'ride-active-new',
      'ride-upload-pending',
    ]);
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
