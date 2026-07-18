import type { RideDraft } from '../../domain/ride/rideQueueModel';

export function countPendingRideUploads(drafts: readonly RideDraft[]): number {
  return drafts.filter((draft) => draft.status !== 'RECORDING' && draft.status !== 'PAUSED').length;
}
