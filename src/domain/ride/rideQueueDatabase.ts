import * as SQLite from 'expo-sqlite';

export const rideQueueDatabase = SQLite.openDatabaseSync('gaja-ride-queue.db');
export const RIDE_QUEUE_SCHEMA_VERSION = 2;

type SchemaVersionRow = { readonly user_version: number };
type SchemaMigration = {
  readonly targetVersion: number;
  readonly apply: () => void;
};

let schemaReady = false;

const schemaMigrations: readonly SchemaMigration[] = [
  { targetVersion: 1, apply: createVersion1Schema },
  { targetVersion: 2, apply: addReceiptOwner },
];

export function ensureRideQueueTables(): void {
  if (schemaReady) {
    return;
  }
  validateRideQueueMigrationTargets(
    schemaMigrations.map((migration) => migration.targetVersion),
    RIDE_QUEUE_SCHEMA_VERSION,
  );
  let currentVersion = readSchemaVersion();
  if (currentVersion > RIDE_QUEUE_SCHEMA_VERSION) {
    throw new IncompatibleRideQueueSchemaError();
  }
  rideQueueDatabase.execSync('PRAGMA journal_mode = WAL;');
  for (const migration of schemaMigrations) {
    if (migration.targetVersion <= currentVersion) {
      continue;
    }
    rideQueueDatabase.withTransactionSync(() => {
      migration.apply();
      rideQueueDatabase.execSync(`PRAGMA user_version = ${migration.targetVersion};`);
    });
    currentVersion = migration.targetVersion;
  }
  if (currentVersion !== RIDE_QUEUE_SCHEMA_VERSION) {
    throw new InvalidRideQueueMigrationChainError();
  }
  schemaReady = true;
}

export function validateRideQueueMigrationTargets(targetVersions: readonly number[], schemaVersion: number): void {
  if (targetVersions.length !== schemaVersion) {
    throw new InvalidRideQueueMigrationChainError();
  }
  targetVersions.forEach((targetVersion, index) => {
    if (targetVersion !== index + 1) {
      throw new InvalidRideQueueMigrationChainError();
    }
  });
}

function readSchemaVersion(): number {
  const row = rideQueueDatabase.getFirstSync<SchemaVersionRow>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;
  if (!Number.isInteger(version) || version < 0) {
    throw new CorruptedRideQueueSchemaError();
  }
  return version;
}

function createVersion1Schema(): void {
  rideQueueDatabase.execSync(`
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

function addReceiptOwner(): void {
  rideQueueDatabase.execSync(`
    ALTER TABLE ride_receipts ADD COLUMN owner_user_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_ride_receipts_owner_completed
      ON ride_receipts(owner_user_id, completed_at DESC);
  `);
}

export class IncompatibleRideQueueSchemaError extends Error {
  constructor() {
    super('현재 앱보다 새로운 주행 저장소 버전입니다. 앱을 업데이트한 뒤 다시 시도해 주세요.');
    this.name = 'IncompatibleRideQueueSchemaError';
  }
}

export class CorruptedRideQueueSchemaError extends Error {
  constructor() {
    super('주행 저장소 버전 정보가 손상되었습니다. 원본을 삭제하지 말고 복구가 필요합니다.');
    this.name = 'CorruptedRideQueueSchemaError';
  }
}

export class InvalidRideQueueMigrationChainError extends Error {
  constructor() {
    super('주행 저장소 migration 버전은 1부터 현재 버전까지 중복 없이 연속되어야 합니다.');
    this.name = 'InvalidRideQueueMigrationChainError';
  }
}

export function deleteRidePayloadInternal(clientRideId: string): void {
  rideQueueDatabase.runSync('DELETE FROM ride_location_events WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_point_keys WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_points WHERE client_ride_id = ?', clientRideId);
  rideQueueDatabase.runSync('DELETE FROM ride_outbox WHERE client_ride_id = ?', clientRideId);
}
