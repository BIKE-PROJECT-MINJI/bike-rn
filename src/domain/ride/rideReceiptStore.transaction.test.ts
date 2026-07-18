import { createRideDraft, finishRideDraft, type RideReceipt } from './rideQueueModel';

type ReceiptRow = {
  readonly clientRideId: string;
  readonly rideRecordId: number;
};

const mockOutbox = new Map<string, string>();
const mockPoints = new Map<string, readonly number[]>();
const mockReceipts = new Map<string, ReceiptRow>();
let mockFailure: 'INSERT_RECEIPT' | 'DELETE_POINTS' | 'DELETE_PAYLOAD' | null = null;

const mockDatabase = {
  execSync: jest.fn(),
  getFirstSync: jest.fn((sql: string, ...parameters: unknown[]) => {
    if (sql.includes('PRAGMA user_version')) {
      return { user_version: 2 };
    }
    if (sql.includes('FROM ride_outbox')) {
      const payload = mockOutbox.get(requireString(parameters[0]));
      return payload === undefined ? null : { payload };
    }
    return null;
  }),
  runSync: jest.fn((sql: string, ...parameters: unknown[]) => {
    if (sql.includes('INSERT INTO ride_receipts')) {
      if (mockFailure === 'INSERT_RECEIPT') {
        throw new InjectedStorageError('receipt insert');
      }
      const clientRideId = requireString(parameters[0]);
      mockReceipts.set(clientRideId, {
        clientRideId,
        rideRecordId: requireNumber(parameters[1]),
      });
    }
    if (sql.includes('DELETE FROM ride_outbox')) {
      if (mockFailure === 'DELETE_PAYLOAD') {
        throw new InjectedStorageError('payload delete');
      }
      mockOutbox.delete(requireString(parameters[0]));
    }
    if (sql.includes('DELETE FROM ride_points')) {
      if (mockFailure === 'DELETE_POINTS') {
        throw new InjectedStorageError('point delete');
      }
      mockPoints.delete(requireString(parameters[0]));
    }
    return { changes: 1 };
  }),
  withTransactionSync: jest.fn((operation: () => void) => {
    const outboxSnapshot = new Map(mockOutbox);
    const pointsSnapshot = new Map(mockPoints);
    const receiptSnapshot = new Map(mockReceipts);
    try {
      operation();
    } catch (error) {
      restoreMap(mockOutbox, outboxSnapshot);
      restoreMap(mockPoints, pointsSnapshot);
      restoreMap(mockReceipts, receiptSnapshot);
      throw error;
    }
  }),
};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

const { completeRideDraft } = require('./rideReceiptStore') as typeof import('./rideReceiptStore');

describe('ride receipt transaction rollback', () => {
  beforeEach(() => {
    mockOutbox.clear();
    mockPoints.clear();
    mockReceipts.clear();
    mockFailure = null;
    jest.clearAllMocks();
    mockOutbox.set('ride-ready', JSON.stringify(finishRideDraft(
      createRideDraft(
        'ride-ready',
        1_700_000_000_000,
        { mode: 'FREE', courseId: null, courseTitle: null, partyId: null },
        42,
      ),
      1_700_000_060_000,
    )));
    mockPoints.set('ride-ready', [1, 2, 3]);
  });

  it.each(['INSERT_RECEIPT', 'DELETE_POINTS', 'DELETE_PAYLOAD'] as const)(
    'keeps the raw payload and rolls back the receipt when %s fails',
    async (failure) => {
      // Given
      mockFailure = failure;

      // When
      const completion = completeRideDraft(readyReceipt(), 42);

      // Then
      await expect(completion).rejects.toBeInstanceOf(InjectedStorageError);
      expect(mockOutbox.has('ride-ready')).toBe(true);
      expect(mockPoints.get('ride-ready')).toEqual([1, 2, 3]);
      expect(mockReceipts.has('ride-ready')).toBe(false);
    },
  );
});

function readyReceipt(): RideReceipt {
  return {
    clientRideId: 'ride-ready',
    rideRecordId: 77,
    status: 'READY',
    completedAtMs: 1_700_000_070_000,
    linkedCourseId: null,
  };
}

function restoreMap<K, V>(target: Map<K, V>, snapshot: ReadonlyMap<K, V>): void {
  target.clear();
  for (const [key, value] of snapshot) {
    target.set(key, value);
  }
}

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

class InjectedStorageError extends Error {}
