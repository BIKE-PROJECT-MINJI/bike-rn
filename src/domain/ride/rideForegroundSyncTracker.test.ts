import { createRideDraft, finishRideDraft, type RideDraft } from './rideQueueModel';
import { createRideForegroundSyncTracker } from './rideForegroundSyncTracker';

function finalizingDraft(clientRideId: string): RideDraft {
  return {
    ...finishRideDraft(createRideDraft(clientRideId, 1_700_000_000_000), 1_700_000_060_000),
    status: 'FINALIZING',
    rideRecordId: 41,
  };
}

describe('ride foreground sync tracker', () => {
  it('selects each server-issued ride once per activation including cold start', () => {
    // Given
    const tracker = createRideForegroundSyncTracker();
    const drafts = [finalizingDraft('ride-finalizing')];

    // When
    const coldStart = tracker.selectOnce(1, drafts);
    const sameActivation = tracker.selectOnce(1, drafts);
    const nextActivation = tracker.selectOnce(2, drafts);

    // Then
    expect(coldStart).toEqual(['ride-finalizing']);
    expect(sameActivation).toEqual([]);
    expect(nextActivation).toEqual(['ride-finalizing']);
  });
});
