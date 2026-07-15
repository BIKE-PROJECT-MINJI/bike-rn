import type { RideReceipt } from './rideQueueModel';
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
};

export async function completeRideDraft(receipt: RideReceipt): Promise<void> {
  ensureRideQueueTables();
  rideQueueDatabase.withTransactionSync(() => {
    rideQueueDatabase.runSync(
      `INSERT INTO ride_receipts (client_ride_id, ride_record_id, status, completed_at, linked_course_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(client_ride_id) DO UPDATE SET
         ride_record_id = excluded.ride_record_id,
         status = excluded.status,
         completed_at = excluded.completed_at,
         linked_course_id = excluded.linked_course_id`,
      receipt.clientRideId,
      receipt.rideRecordId,
      receipt.status,
      receipt.completedAtMs,
      receipt.linkedCourseId,
    );
    deleteRidePayloadInternal(receipt.clientRideId);
  });
}

export function loadLatestRideReceipt(): RideReceipt | null {
  ensureRideQueueTables();
  const row = rideQueueDatabase.getFirstSync<ReceiptRow>(
    `SELECT client_ride_id, ride_record_id, completed_at, linked_course_id
     FROM ride_receipts ORDER BY completed_at DESC LIMIT 1`,
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
