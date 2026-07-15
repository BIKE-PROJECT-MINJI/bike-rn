import * as SQLite from 'expo-sqlite';

export const rideQueueDatabase = SQLite.openDatabaseSync('gaja-ride-queue.db');

export function ensureRideQueueTables(): void {
  rideQueueDatabase.execSync(`
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
    CREATE TABLE IF NOT EXISTS ride_location_events (
      client_ride_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      PRIMARY KEY (client_ride_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS ride_point_keys (
      client_ride_id TEXT NOT NULL,
      point_key TEXT NOT NULL,
      PRIMARY KEY (client_ride_id, point_key)
    );
  `);
}

export function deleteRidePayloadInternal(clientRideId: string): void {
  rideQueueDatabase.runSync('DELETE FROM ride_location_events WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_point_keys WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_points WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_outbox WHERE client_ride_id = ?', clientRideId);
}
