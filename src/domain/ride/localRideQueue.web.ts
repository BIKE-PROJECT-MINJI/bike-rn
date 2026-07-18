import {
  appendRidePointsFromOrder,
  type RideDraft,
  type RidePointInput,
  type RideReceipt,
} from './rideQueueModel';
import type { LegacyRideRecoverySummary } from './legacyRideRecovery';

const drafts = new Map<string, RideDraft>();
const locationEvents = new Set<string>();
const pointKeys = new Set<string>();
type OwnedRideReceipt = {
  readonly ownerUserId: number | null;
  readonly receipt: RideReceipt;
};

let latestReceipt: OwnedRideReceipt | null = null;

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

export function loadActiveRideDraft(ownerUserId: number | null): RideDraft | null {
  if (ownerUserId === null) {
    return null;
  }
  return [...drafts.values()].find(
    (draft) => draft.ownerUserId === ownerUserId && (draft.status === 'RECORDING' || draft.status === 'PAUSED'),
  ) ?? null;
}

export function loadAnyActiveRideDraftForBackgroundTask(): RideDraft | null {
  return [...drafts.values()].find(
    (draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED',
  ) ?? null;
}

export function listPendingRideDrafts(ownerUserId: number | null): readonly RideDraft[] {
  return ownerUserId === null
    ? []
    : [...drafts.values()].filter((draft) => draft.ownerUserId === ownerUserId);
}

export function loadLegacyRideRecoverySummary(): LegacyRideRecoverySummary {
  const legacyDrafts = [...drafts.values()].filter((draft) => draft.ownerUserId === null);
  const receiptCount = latestReceipt?.ownerUserId === null ? 1 : 0;
  return {
    activeDraftCount: legacyDrafts.filter((draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED').length,
    receiptCount,
    totalCount: legacyDrafts.length + receiptCount,
  };
}

export async function quarantineLegacyActiveRides(): Promise<void> {
  for (const [clientRideId, draft] of drafts) {
    if (draft.ownerUserId === null && (draft.status === 'RECORDING' || draft.status === 'PAUSED')) {
      const nowMs = Date.now();
      const activeSegmentMs = draft.status === 'RECORDING' && draft.activeSegmentStartedAtMs !== null
        ? Math.max(0, nowMs - draft.activeSegmentStartedAtMs)
        : 0;
      drafts.set(clientRideId, {
        ...draft,
        status: 'FAILED_USER_ACTION',
        endedAtIso: draft.endedAtIso ?? new Date(nowMs).toISOString(),
        accumulatedActiveMs: draft.accumulatedActiveMs + activeSegmentMs,
        activeSegmentStartedAtMs: null,
        nextRetryAtMs: null,
        lastErrorCode: 'LEGACY_RIDE_OWNER_UNKNOWN',
      });
    }
  }
}

export async function discardRideDraft(clientRideId: string): Promise<void> {
  drafts.delete(clientRideId);
}

export async function completeRideDraft(receipt: RideReceipt, ownerUserId: number): Promise<void> {
  latestReceipt = { ownerUserId, receipt };
  drafts.delete(receipt.clientRideId);
}

export function loadLatestRideReceipt(ownerUserId: number | null): RideReceipt | null {
  return latestReceipt?.ownerUserId === ownerUserId ? latestReceipt.receipt : null;
}
