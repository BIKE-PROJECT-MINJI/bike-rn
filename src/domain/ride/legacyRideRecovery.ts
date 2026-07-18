import { ensureRideQueueTables, rideQueueDatabase as database } from './rideQueueDatabase';
import { parsePersistedRideDraft } from './rideQueueModel';

type DraftPayloadRow = { readonly client_ride_id: string; readonly payload: string };
type CountRow = { readonly item_count: number };

export type LegacyRideRecoverySummary = {
  readonly activeDraftCount: number;
  readonly receiptCount: number;
  readonly totalCount: number;
};

export function loadLegacyRideRecoverySummary(): LegacyRideRecoverySummary {
  ensureRideQueueTables();
  const rows = database.getAllSync<DraftPayloadRow>(
    'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at DESC',
  );
  const legacyDrafts = rows
    .map((row) => parsePersistedRideDraft(row.payload))
    .filter((draft) => draft.ownerUserId === null);
  const receiptRow = database.getFirstSync<CountRow>(
    'SELECT COUNT(*) AS item_count FROM ride_receipts WHERE owner_user_id IS NULL',
  );
  const receiptCount = receiptRow?.item_count ?? 0;
  return {
    activeDraftCount: legacyDrafts.filter((draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED').length,
    receiptCount,
    totalCount: legacyDrafts.length + receiptCount,
  };
}

export async function quarantineLegacyActiveRides(): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => {
    const rows = database.getAllSync<DraftPayloadRow>(
      'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at DESC',
    );
    for (const row of rows) {
      const draft = parsePersistedRideDraft(row.payload);
      if (draft.ownerUserId === null && (draft.status === 'RECORDING' || draft.status === 'PAUSED')) {
        const nowMs = Date.now();
        const activeSegmentMs = draft.status === 'RECORDING' && draft.activeSegmentStartedAtMs !== null
          ? Math.max(0, nowMs - draft.activeSegmentStartedAtMs)
          : 0;
        database.runSync(
          'UPDATE ride_outbox SET payload = ?, updated_at = ? WHERE client_ride_id = ?',
          JSON.stringify({
            ...draft,
            status: 'FAILED_USER_ACTION',
            endedAtIso: draft.endedAtIso ?? new Date(nowMs).toISOString(),
            accumulatedActiveMs: draft.accumulatedActiveMs + activeSegmentMs,
            activeSegmentStartedAtMs: null,
            nextRetryAtMs: null,
            lastErrorCode: 'LEGACY_RIDE_OWNER_UNKNOWN',
          }),
          nowMs,
          row.client_ride_id,
        );
      }
    }
  });
}
