import type { RideDraft } from './rideQueueModel';

export type RideSyncPlan = {
  readonly clientRideId: string;
  readonly delayMs: number;
};

export function planRideSyncs(drafts: readonly RideDraft[], nowMs: number): readonly RideSyncPlan[] {
  const plans: RideSyncPlan[] = [];
  const oldestFirst = [...drafts].sort((left, right) => {
    const startedAtOrder = left.startedAtIso.localeCompare(right.startedAtIso);
    return startedAtOrder === 0 ? left.clientRideId.localeCompare(right.clientRideId) : startedAtOrder;
  });
  for (const draft of oldestFirst) {
    const delayMs = rideSyncDelayMs(draft, nowMs);
    if (delayMs !== null) {
      plans.push({ clientRideId: draft.clientRideId, delayMs });
    }
  }
  return plans;
}

export function rideSyncDelayMs(draft: RideDraft, nowMs: number): number | null {
  if (draft.status === 'FINALIZING') {
    if (draft.finalizationStartedAtMs === null || draft.lastFinalizationPollAtMs === null) {
      return 0;
    }
    const elapsedMs = Math.max(0, nowMs - draft.finalizationStartedAtMs);
    const intervalMs = elapsedMs < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
    return Math.max(0, draft.lastFinalizationPollAtMs + intervalMs - nowMs);
  }
  if (draft.status === 'QUEUED' || draft.status === 'UPLOADING') {
    return 0;
  }
  if (draft.status === 'RETRY_WAIT') {
    return Math.max(0, (draft.nextRetryAtMs ?? nowMs) - nowMs);
  }
  return null;
}

export function shouldSyncOnForeground(draft: RideDraft): boolean {
  if (draft.rideRecordId === null) {
    return false;
  }
  return draft.status === 'FINALIZING' || draft.status === 'RETRY_WAIT';
}

const FAST_POLL_WINDOW_MS = 10_000;
const FAST_POLL_INTERVAL_MS = 2_000;
const SLOW_POLL_INTERVAL_MS = 10_000;
