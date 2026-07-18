import type { RideDraft } from './rideQueueModel';
import { shouldSyncOnForeground } from './rideSyncSchedule';

export type RideForegroundSyncTracker = {
  readonly selectOnce: (activationId: number, drafts: readonly RideDraft[]) => readonly string[];
};

export function createRideForegroundSyncTracker(): RideForegroundSyncTracker {
  let currentActivationId: number | null = null;
  const selectedIds = new Set<string>();
  return {
    selectOnce(activationId, drafts) {
      if (currentActivationId !== activationId) {
        currentActivationId = activationId;
        selectedIds.clear();
      }
      const selected: string[] = [];
      for (const draft of drafts.filter(shouldSyncOnForeground)) {
        if (!selectedIds.has(draft.clientRideId)) {
          selectedIds.add(draft.clientRideId);
          selected.push(draft.clientRideId);
        }
      }
      return selected;
    },
  };
}
