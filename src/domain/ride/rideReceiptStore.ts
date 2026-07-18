import type { RideReceipt } from './rideQueueModel';
import { parsePersistedRideDraft } from './rideQueueModel';
import {
  deleteRidePayloadInternal,
  ensureRideQueueTables,
  rideQueueDatabase,
} from './rideQueueDatabase';

type ReceiptRow = {
  readonly client_ride_id: string;
  readonly ride_record_id: number;
  readonly completed_at: number;
  readonly linked_course_id: number | null;
  readonly owner_user_id: number | null;
};

type DraftPayloadRow = { readonly payload: string };

export async function completeRideDraft(receipt: RideReceipt, ownerUserId: number): Promise<void> {
  ensureRideQueueTables();
  rideQueueDatabase.withTransactionSync(() => {
    const draftRow = rideQueueDatabase.getFirstSync<DraftPayloadRow>(
      'SELECT payload FROM ride_outbox WHERE client_ride_id = ?',
      receipt.clientRideId,
    );
    if (draftRow === null) {
      throw new MissingRideDraftForReceiptError();
    }
    const persistedOwnerUserId = parsePersistedRideDraft(draftRow.payload).ownerUserId;
    if (persistedOwnerUserId === null) {
      throw new LegacyRideOwnerRequiredError();
    }
    if (persistedOwnerUserId !== ownerUserId) {
      throw new RideReceiptOwnerMismatchError();
    }
    rideQueueDatabase.runSync(
      `INSERT INTO ride_receipts (client_ride_id, ride_record_id, status, completed_at, linked_course_id, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_ride_id) DO UPDATE SET
         ride_record_id = excluded.ride_record_id,
         status = excluded.status,
         completed_at = excluded.completed_at,
         linked_course_id = excluded.linked_course_id,
         owner_user_id = excluded.owner_user_id`,
      receipt.clientRideId,
      receipt.rideRecordId,
      receipt.status,
      receipt.completedAtMs,
      receipt.linkedCourseId,
      persistedOwnerUserId,
    );
    deleteRidePayloadInternal(receipt.clientRideId);
  });
}

class MissingRideDraftForReceiptError extends Error {
  constructor() {
    super('READY 영수증에 연결할 로컬 주행 원본이 없습니다.');
    this.name = 'MissingRideDraftForReceiptError';
  }
}

class LegacyRideOwnerRequiredError extends Error {
  constructor() {
    super('이전 버전 주행은 계정을 확인한 뒤 완료할 수 있습니다.');
    this.name = 'LegacyRideOwnerRequiredError';
  }
}

class RideReceiptOwnerMismatchError extends Error {
  constructor() {
    super('READY 영수증의 계정이 로컬 주행 원본과 일치하지 않습니다.');
    this.name = 'RideReceiptOwnerMismatchError';
  }
}

export function loadLatestRideReceipt(ownerUserId: number | null): RideReceipt | null {
  ensureRideQueueTables();
  if (ownerUserId === null) {
    return null;
  }
  const row = rideQueueDatabase.getFirstSync<ReceiptRow>(
    `SELECT client_ride_id, ride_record_id, completed_at, linked_course_id, owner_user_id
     FROM ride_receipts WHERE owner_user_id = ? ORDER BY completed_at DESC LIMIT 1`,
    ownerUserId,
  );
  if (row === null) {
    return null;
  }
  return {
    clientRideId: row.client_ride_id,
    rideRecordId: row.ride_record_id,
    status: 'READY',
    completedAtMs: row.completed_at,
    linkedCourseId: row.linked_course_id,
  };
}
