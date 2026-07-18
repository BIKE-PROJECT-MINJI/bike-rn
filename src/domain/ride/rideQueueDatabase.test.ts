type SchemaVersionRow = { readonly user_version: number };

let userVersion = 0;
let failMigration = false;

const mockDatabase = {
  execSync: jest.fn((sql: string) => {
    if (failMigration && sql.includes('CREATE TABLE IF NOT EXISTS ride_outbox')) {
      throw new InjectedMigrationError();
    }
    const targetVersion = /PRAGMA user_version = (\d+)/.exec(sql)?.[1];
    if (targetVersion !== undefined) {
      userVersion = Number(targetVersion);
    }
  }),
  getFirstSync: jest.fn((sql: string): SchemaVersionRow | null => {
    if (sql.includes('PRAGMA user_version')) {
      return { user_version: userVersion };
    }
    return null;
  }),
  withTransactionSync: jest.fn((operation: () => void) => {
    const versionSnapshot = userVersion;
    try {
      operation();
    } catch (error) {
      userVersion = versionSnapshot;
      throw error;
    }
  }),
};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

describe('ride queue schema migration', () => {
  beforeEach(() => {
    userVersion = 0;
    failMigration = false;
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('migrates a fresh database to the current schema version', () => {
    const { ensureRideQueueTables, RIDE_QUEUE_SCHEMA_VERSION } = loadDatabaseModule();

    ensureRideQueueTables();

    expect(userVersion).toBe(RIDE_QUEUE_SCHEMA_VERSION);
    expect(mockDatabase.withTransactionSync).toHaveBeenCalledTimes(2);
    expect(mockDatabase.execSync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS ride_outbox'));
  });

  it('adopts the versioned baseline without destructive legacy-data statements', () => {
    const { ensureRideQueueTables } = loadDatabaseModule();

    ensureRideQueueTables();

    const migrationSql = mockDatabase.execSync.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ride_outbox'));
    expect(migrationSql).toBeDefined();
    expect(migrationSql).not.toMatch(/\b(?:DELETE|DROP|REPLACE|TRUNCATE)\b/i);
    expect(userVersion).toBe(2);
  });

  it('adds receipt ownership when upgrading an existing version one database', () => {
    userVersion = 1;
    const { ensureRideQueueTables } = loadDatabaseModule();

    ensureRideQueueTables();

    expect(mockDatabase.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(mockDatabase.execSync).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN owner_user_id'));
    expect(userVersion).toBe(2);
  });

  it('rolls back the schema version when a migration fails', () => {
    failMigration = true;
    const { ensureRideQueueTables } = loadDatabaseModule();

    expect(() => ensureRideQueueTables()).toThrow(InjectedMigrationError);

    expect(userVersion).toBe(0);
  });

  it('rejects a database created by a newer incompatible app version', () => {
    userVersion = 3;
    const { ensureRideQueueTables } = loadDatabaseModule();

    expect(() => ensureRideQueueTables()).toThrow('현재 앱보다 새로운 주행 저장소 버전입니다.');
    expect(mockDatabase.withTransactionSync).not.toHaveBeenCalled();
    expect(mockDatabase.execSync).not.toHaveBeenCalled();
  });

  it.each([
    { targets: [1, 3], schemaVersion: 3 },
    { targets: [1, 2, 2], schemaVersion: 3 },
    { targets: [1, 2], schemaVersion: 3 },
  ])('rejects an incomplete or duplicate migration chain: $targets', ({ targets, schemaVersion }) => {
    const { validateRideQueueMigrationTargets } = loadDatabaseModule();

    expect(() => validateRideQueueMigrationTargets(targets, schemaVersion)).toThrow(
      '주행 저장소 migration 버전은 1부터 현재 버전까지 중복 없이 연속되어야 합니다.',
    );
  });
});

function loadDatabaseModule(): typeof import('./rideQueueDatabase') {
  return require('./rideQueueDatabase') as typeof import('./rideQueueDatabase');
}

class InjectedMigrationError extends Error {}
