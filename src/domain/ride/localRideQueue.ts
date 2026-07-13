import * as SQLite from 'expo-sqlite';
import {
  appendRidePoints,
  parsePersistedRideDraft,
  parsePersistedRidePoint,
  type RideDraft,
  type RidePoint,
  type RidePointInput,
  type RideReceipt,
} from './rideQueueModel';

const database = SQLite.openDatabaseSync('gaja-ride-queue.db');

type DraftPayloadRow = { readonly client_ride_id: string; readonly payload: string };
type PointPayloadRow = { readonly payload: string };

export function ensureRideQueueTables(): void {
  database.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ride_outbox (
      client_ride_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ride_points (
      client_ride_id TEXT NOT NULL,
      point_order INTEGER NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (client_ride_id, point_order)
    );
    CREATE TABLE IF NOT EXISTS ride_receipts (
      client_ride_id TEXT PRIMARY KEY NOT NULL,
      ride_record_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      linked_course_id INTEGER
    );
  `);
}

export async function saveRideDraft(draft: RideDraft): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => saveRideDraftInternal(draft));
}

export async function appendRidePointsToQueue(
  clientRideId: string,
  points: readonly RidePointInput[],
): Promise<RideDraft | null> {
  ensureRideQueueTables();
  let updated: RideDraft | null = null;
  database.withTransactionSync(() => {
    const current = loadRideDraftInternal(clientRideId);
    if (current === null || current.status !== 'RECORDING') {
      return;
    }
    updated = appendRidePoints(current, points);
    saveRideMetadataInternal(updated);
    persistPointsInternal(updated.clientRideId, updated.routePoints.slice(current.routePoints.length));
  });
  return updated;
}

export async function updateRideDraft(
  clientRideId: string,
  update: (draft: RideDraft) => RideDraft,
): Promise<RideDraft | null> {
  ensureRideQueueTables();
  let updated: RideDraft | null = null;
  database.withTransactionSync(() => {
    const current = loadRideDraftInternal(clientRideId);
    if (current === null) {
      return;
    }
    updated = update(current);
    saveRideMetadataInternal(updated);
  });
  return updated;
}

export function loadRideDraft(clientRideId: string): RideDraft | null {
  ensureRideQueueTables();
  return loadRideDraftInternal(clientRideId);
}

export function loadActiveRideDraft(): RideDraft | null {
  ensureRideQueueTables();
  const rows = database.getAllSync<DraftPayloadRow>(
    'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at DESC',
  );
  for (const row of rows) {
    const draft = assembleRideDraft(row.client_ride_id, parsePersistedRideDraft(row.payload));
    if (draft.status === 'RECORDING' || draft.status === 'PAUSED') {
      return draft;
    }
  }
  return null;
}

export function listPendingRideDrafts(): readonly RideDraft[] {
  ensureRideQueueTables();
  const rows = database.getAllSync<DraftPayloadRow>(
    'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at ASC',
  );
  return rows.map((row) => assembleRideDraft(row.client_ride_id, parsePersistedRideDraft(row.payload)));
}

export async function completeRideDraft(receipt: RideReceipt): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => {
    database.runSync(
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

export async function discardRideDraft(clientRideId: string): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => deleteRidePayloadInternal(clientRideId));
}

export function loadLatestRideReceipt(): RideReceipt | null {
  ensureRideQueueTables();
  const row = database.getFirstSync<{
    readonly client_ride_id: string;
    readonly ride_record_id: number;
    readonly completed_at: number;
    readonly linked_course_id: number | null;
  }>(
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

function loadRideDraftInternal(clientRideId: string): RideDraft | null {
  const row = database.getFirstSync<DraftPayloadRow>(
    'SELECT client_ride_id, payload FROM ride_outbox WHERE client_ride_id = ?',
    clientRideId,
  );
  return row === null ? null : assembleRideDraft(clientRideId, parsePersistedRideDraft(row.payload));
}

function assembleRideDraft(clientRideId: string, metadata: RideDraft): RideDraft {
  const storedPoints = database
    .getAllSync<PointPayloadRow>(
      'SELECT payload FROM ride_points WHERE client_ride_id = ? ORDER BY point_order ASC',
      clientRideId,
    )
    .map((row) => parsePersistedRidePoint(row.payload));
  if (metadata.routePoints.length > 0) {
    persistPointsInternal(clientRideId, metadata.routePoints);
    saveRideMetadataInternal(metadata);
  }
  return { ...metadata, routePoints: mergePoints(storedPoints, metadata.routePoints) };
}

function saveRideDraftInternal(draft: RideDraft): void {
  saveRideMetadataInternal(draft);
  persistPointsInternal(draft.clientRideId, draft.routePoints);
}

function saveRideMetadataInternal(draft: RideDraft): void {
  const metadata: RideDraft = { ...draft, routePoints: [] };
  database.runSync(
    `INSERT INTO ride_outbox (client_ride_id, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(client_ride_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    draft.clientRideId,
    JSON.stringify(metadata),
    Date.now(),
  );
}

function persistPointsInternal(clientRideId: string, points: readonly RidePoint[]): void {
  for (const point of points) {
    database.runSync(
      `INSERT OR IGNORE INTO ride_points (client_ride_id, point_order, payload)
       VALUES (?, ?, ?)`,
      clientRideId,
      point.pointOrder,
      JSON.stringify(point),
    );
  }
}

function mergePoints(stored: readonly RidePoint[], embedded: readonly RidePoint[]): RidePoint[] {
  const byOrder = new Map<number, RidePoint>();
  for (const point of [...stored, ...embedded]) {
    byOrder.set(point.pointOrder, point);
  }
  return [...byOrder.values()].sort((left, right) => left.pointOrder - right.pointOrder);
}

function deleteRidePayloadInternal(clientRideId: string): void {
  database.runSync('DELETE FROM ride_points WHERE client_ride_id = ?', clientRideId);
  database.runSync('DELETE FROM ride_outbox WHERE client_ride_id = ?', clientRideId);
}
