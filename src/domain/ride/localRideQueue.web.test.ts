import {
  completeRideDraft,
  discardRideDraft,
  listPendingRideDrafts,
  loadLegacyRideRecoverySummary,
  loadLatestRideReceipt,
  loadRideDraft,
  quarantineLegacyActiveRides,
  saveRideDraft,
} from './localRideQueue.web';
import { createRideDraft } from './rideQueueModel';

describe('localRideQueue web platform boundary', () => {
  it('previews ride state without loading the native SQLite store', async () => {
    const ownerUserId = 42;
    const draft = createRideDraft(
      'web-preview-ride',
      Date.parse('2026-07-15T00:00:00.000Z'),
      { mode: 'FREE', courseId: null, courseTitle: null, partyId: null },
      ownerUserId,
    );

    await saveRideDraft(draft);
    expect(listPendingRideDrafts(ownerUserId)).toEqual([draft]);

    await completeRideDraft({
      clientRideId: draft.clientRideId,
      rideRecordId: 1,
      status: 'READY',
      completedAtMs: Date.parse('2026-07-15T00:10:00.000Z'),
      linkedCourseId: null,
    }, ownerUserId);
    expect(listPendingRideDrafts(ownerUserId)).toEqual([]);
    expect(loadLatestRideReceipt(ownerUserId)?.clientRideId).toBe(draft.clientRideId);

    await discardRideDraft(draft.clientRideId);
  });

  it('quarantines an ownerless active ride without exposing it to an account', async () => {
    const legacyDraft = createRideDraft('web-legacy-ride', Date.parse('2026-07-15T01:00:00.000Z'));
    await saveRideDraft(legacyDraft);

    expect(loadLegacyRideRecoverySummary()).toEqual({ activeDraftCount: 1, receiptCount: 0, totalCount: 1 });

    await quarantineLegacyActiveRides();

    expect(listPendingRideDrafts(42)).toEqual([]);
    expect(loadRideDraft(legacyDraft.clientRideId)).toEqual(expect.objectContaining({
      ownerUserId: null,
      status: 'FAILED_USER_ACTION',
      lastErrorCode: 'LEGACY_RIDE_OWNER_UNKNOWN',
    }));
    expect(loadLegacyRideRecoverySummary()).toEqual({ activeDraftCount: 0, receiptCount: 0, totalCount: 1 });
    await discardRideDraft(legacyDraft.clientRideId);
  });
});
