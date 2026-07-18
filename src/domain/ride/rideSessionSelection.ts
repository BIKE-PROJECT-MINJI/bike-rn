import type { RideDraft } from './rideQueueModel';

export function selectRideSessionDraft(drafts: readonly RideDraft[]): RideDraft | null {
  return drafts.find((draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED') ?? drafts.at(0) ?? null;
}
