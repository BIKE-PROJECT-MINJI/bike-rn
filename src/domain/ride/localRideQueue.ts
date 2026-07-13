import * as SQLite from 'expo-sqlite';
import type { RideRecordPoint } from './rideTracking';

export type QueuedRideDraft = {
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  distanceMeters: number;
  durationSec: number;
  routePoints: RideRecordPoint[];
};

const database = SQLite.openDatabaseSync('gaja-ride-queue.db');

export function ensureRideQueueTable(): void {
  database.execSync(
    'CREATE TABLE IF NOT EXISTS queued_rides (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)',
  );
}

export function enqueueRideDraft(draft: QueuedRideDraft): void {
  ensureRideQueueTable();
  database.runSync(
    'INSERT OR REPLACE INTO queued_rides (id, payload, created_at) VALUES (?, ?, ?)',
    draft.id,
    JSON.stringify(draft),
    Date.now(),
  );
}

export function listQueuedRideDrafts(): QueuedRideDraft[] {
  ensureRideQueueTable();
  const rows = database.getAllSync<{ payload: string }>('SELECT payload FROM queued_rides ORDER BY created_at ASC');
  return rows.map((row) => JSON.parse(row.payload) as QueuedRideDraft);
}
