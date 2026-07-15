import {
  appendRidePointsFromOrder,
  parsePersistedRideDraft,
  parsePersistedRidePoint,
  type RideDraft,
  type RidePoint,
  type RidePointInput,
} from './rideQueueModel';
import {
  deleteRidePayloadInternal,
  ensureRideQueueTables,
  rideQueueDatabase as database,
} from './rideQueueDatabase';

export { ensureRideQueueTables } from './rideQueueDatabase';
export { completeRideDraft, loadLatestRideReceipt } from './rideReceiptStore';

type DraftPayloadRow = { readonly client_ride_id: string; readonly payload: string };
type PointPayloadRow = { readonly payload: string };
type LatestPointPayloadRow = { readonly point_order: number; readonly payload: string };

export async function saveRideDraft(draft: RideDraft): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => saveRideDraftInternal(draft));
}

export async function createRideDraftIfQueueEmpty(draft: RideDraft): Promise<boolean> {
  ensureRideQueueTables();
  let created = false;
  database.withTransactionSync(() => {
    const rows = database.getAllSync<DraftPayloadRow>(
      'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at DESC',
    );
    const hasActiveRide = rows.some((row) => {
      const status = parsePersistedRideDraft(row.payload).status;
      return status === 'RECORDING' || status === 'PAUSED';
    });
    if (hasActiveRide) {
      return;
    }
    saveRideDraftInternal(draft);
    created = true;
  });
  return created;
}

export async function appendRidePointsToQueue(
  clientRideId: string,
  points: readonly RidePointInput[],
  eventId?: string,
): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => {
    const current = loadRideMetadataInternal(clientRideId);
    if (current === null || current.status !== 'RECORDING') {
      return;
    }
    if (eventId !== undefined && !claimLocationEvent(clientRideId, eventId)) {
      return;
    }
    const latestPointRow = database.getFirstSync<LatestPointPayloadRow>(
      `SELECT point_order, payload FROM ride_points
       WHERE client_ride_id = ? ORDER BY point_order DESC LIMIT 1`,
      clientRideId,
    );
    const acceptedPoints = points.filter((point) => claimPointKey(clientRideId, point));
    if (acceptedPoints.length === 0) {
      return;
    }
    const latestPoint = latestPointRow === null ? null : parsePersistedRidePoint(latestPointRow.payload);
    const firstPointOrder = (latestPointRow?.point_order ?? 0) + 1;
    const updated = appendRidePointsFromOrder(
      { ...current, routePoints: latestPoint === null ? [] : [latestPoint] },
      acceptedPoints,
      firstPointOrder,
    );
    const newPoints = updated.routePoints.filter((point) => point.pointOrder >= firstPointOrder);
    persistNewPointsInternal(clientRideId, newPoints);
    saveRideMetadataInternal(updated);
  });
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
    'SELECT client_ride_id, payload FROM ride_outbox ORDER BY updated_at DESC',
  );
  return rows.map((row) => assembleRideDraft(row.client_ride_id, parsePersistedRideDraft(row.payload)));
}

export async function discardRideDraft(clientRideId: string): Promise<void> {
  ensureRideQueueTables();
  database.withTransactionSync(() => deleteRidePayloadInternal(clientRideId));
}

function loadRideDraftInternal(clientRideId: string): RideDraft | null {
  const metadata = loadRideMetadataInternal(clientRideId);
  return metadata === null ? null : assembleRideDraft(clientRideId, metadata);
}

function loadRideMetadataInternal(clientRideId: string): RideDraft | null {
  const row = database.getFirstSync<DraftPayloadRow>(
    'SELECT client_ride_id, payload FROM ride_outbox WHERE client_ride_id = ?',
    clientRideId,
  );
  return row === null ? null : parsePersistedRideDraft(row.payload);
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
    claimPointKey(clientRideId, point);
    database.runSync(
      `INSERT OR IGNORE INTO ride_points (client_ride_id, point_order, payload)
       VALUES (?, ?, ?)`,
      clientRideId,
      point.pointOrder,
      JSON.stringify(point),
    );
  }
}

function persistNewPointsInternal(clientRideId: string, points: readonly RidePoint[]): void {
  for (const point of points) {
    database.runSync(
      `INSERT INTO ride_points (client_ride_id, point_order, payload)
       VALUES (?, ?, ?)`,
      clientRideId,
      point.pointOrder,
      JSON.stringify(point),
    );
  }
}

function claimLocationEvent(clientRideId: string, eventId: string): boolean {
  const result = database.runSync(
    `INSERT OR IGNORE INTO ride_location_events (client_ride_id, event_id)
     VALUES (?, ?)`,
    clientRideId,
    eventId,
  );
  return result.changes === 1;
}

function claimPointKey(clientRideId: string, point: RidePointInput): boolean {
  const pointKey = `${point.capturedAtIso}|${point.latitude}|${point.longitude}`;
  const result = database.runSync(
    `INSERT OR IGNORE INTO ride_point_keys (client_ride_id, point_key)
     VALUES (?, ?)`,
    clientRideId,
    pointKey,
  );
  return result.changes === 1;
}

function mergePoints(stored: readonly RidePoint[], embedded: readonly RidePoint[]): RidePoint[] {
  const byOrder = new Map<number, RidePoint>();
  for (const point of [...stored, ...embedded]) {
    byOrder.set(point.pointOrder, point);
  }
  return [...byOrder.values()].sort((left, right) => left.pointOrder - right.pointOrder);
}
