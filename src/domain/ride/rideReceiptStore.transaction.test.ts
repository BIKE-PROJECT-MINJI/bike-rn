import type { RideReceipt } from './rideQueueModel';

type ReceiptRow = {
  readonly clientRideId: string;
  readonly rideRecordId: number;
};

const mockOutbox = new Map<string, string>();
const mockReceipts = new Map<string, ReceiptRow>();
let mockFailure: 'INSERT_RECEIPT' | 'DELETE_PAYLOAD' | null = null;

const mockDatabase = {
  execSync: jest.fn(),
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
    return { changes: 1 };
  }),
  withTransactionSync: jest.fn((operation: () => void) => {
    const outboxSnapshot = new Map(mockOutbox);
    const receiptSnapshot = new Map(mockReceipts);
    try {
      operation();
    } catch (error) {
      restoreMap(mockOutbox, outboxSnapshot);
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
    mockReceipts.clear();
    mockFailure = null;
    jest.clearAllMocks();
    mockOutbox.set('ride-ready', 'raw-gps-payload');
  });

  it.each(['INSERT_RECEIPT', 'DELETE_PAYLOAD'] as const)(
    'keeps the raw payload and rolls back the receipt when %s fails',
    async (failure) => {
      // Given
      mockFailure = failure;

      // When
      const completion = completeRideDraft(readyReceipt());

      // Then
      await expect(completion).rejects.toBeInstanceOf(InjectedStorageError);
      expect(mockOutbox.get('ride-ready')).toBe('raw-gps-payload');
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
