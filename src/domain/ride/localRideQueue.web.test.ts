import {
  completeRideDraft,
  discardRideDraft,
  listPendingRideDrafts,
  loadLatestRideReceipt,
  saveRideDraft,
} from './localRideQueue.web';
import { createRideDraft } from './rideQueueModel';

describe('localRideQueue web platform boundary', () => {
  it('previews ride state without loading the native SQLite store', async () => {
    const draft = createRideDraft('web-preview-ride', Date.parse('2026-07-15T00:00:00.000Z'));

    await saveRideDraft(draft);
    expect(listPendingRideDrafts()).toEqual([draft]);

    await completeRideDraft({
      clientRideId: draft.clientRideId,
      rideRecordId: 1,
      status: 'READY',
      completedAtMs: Date.parse('2026-07-15T00:10:00.000Z'),
      linkedCourseId: null,
    });
    expect(listPendingRideDrafts()).toEqual([]);
    expect(loadLatestRideReceipt()?.clientRideId).toBe(draft.clientRideId);

    await discardRideDraft(draft.clientRideId);
  });
});
