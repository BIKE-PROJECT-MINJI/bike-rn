import {
  appendRidePointsFromOrder,
  type RideDraft,
  type RidePointInput,
  type RideReceipt,
} from './rideQueueModel';

const drafts = new Map<string, RideDraft>();
const locationEvents = new Set<string>();
const pointKeys = new Set<string>();
let latestReceipt: RideReceipt | null = null;

export function ensureRideQueueTables(): void {
  // Web is a design preview. Durable ride storage remains Android SQLite only.
}

export async function saveRideDraft(draft: RideDraft): Promise<void> {
  drafts.set(draft.clientRideId, draft);
}

export async function createRideDraftIfQueueEmpty(draft: RideDraft): Promise<boolean> {
  if ([...drafts.values()].some((item) => item.status === 'RECORDING' || item.status === 'PAUSED')) {
    return false;
  }
  drafts.set(draft.clientRideId, draft);
  return true;
}

export async function appendRidePointsToQueue(
  clientRideId: string,
  points: readonly RidePointInput[],
  eventId?: string,
): Promise<void> {
  const current = drafts.get(clientRideId);
  if (current === undefined || current.status !== 'RECORDING') {
    return;
  }
  const eventKey = eventId === undefined ? null : `${clientRideId}|${eventId}`;
  if (eventKey !== null && locationEvents.has(eventKey)) {
    return;
  }
  if (eventKey !== null) {
    locationEvents.add(eventKey);
  }
  const accepted = points.filter((point) => {
    const key = `${clientRideId}|${point.capturedAtIso}|${point.latitude}|${point.longitude}`;
    if (pointKeys.has(key)) {
      return false;
    }
    pointKeys.add(key);
    return true;
  });
  if (accepted.length === 0) {
    return;
  }
  drafts.set(
    clientRideId,
    appendRidePointsFromOrder(current, accepted, current.routePoints.length + 1),
  );
}

export async function updateRideDraft(
  clientRideId: string,
  update: (draft: RideDraft) => RideDraft,
): Promise<RideDraft | null> {
  const current = drafts.get(clientRideId);
  if (current === undefined) {
    return null;
  }
  const updated = update(current);
  drafts.set(clientRideId, updated);
  return updated;
}

export function loadRideDraft(clientRideId: string): RideDraft | null {
  return drafts.get(clientRideId) ?? null;
}

export function loadActiveRideDraft(): RideDraft | null {
  return [...drafts.values()].find(
    (draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED',
  ) ?? null;
}

export function listPendingRideDrafts(): readonly RideDraft[] {
  return [...drafts.values()];
}

export async function discardRideDraft(clientRideId: string): Promise<void> {
  drafts.delete(clientRideId);
}

export async function completeRideDraft(receipt: RideReceipt): Promise<void> {
  latestReceipt = receipt;
  drafts.delete(receipt.clientRideId);
}

export function loadLatestRideReceipt(): RideReceipt | null {
  return latestReceipt;
}
