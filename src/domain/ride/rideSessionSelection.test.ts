import { createRideDraft, finishRideDraft } from './rideQueueModel';
import { selectRideSessionDraft } from './rideSessionSelection';

describe('ride session selection', () => {
  it('keeps the active ride on the HUD while newer queued rides sync independently', () => {
    // Given
    const active = createRideDraft('ride-active', 1_700_000_000_000);
    const newerQueued = finishRideDraft(
      createRideDraft('ride-newer-queued', 1_700_000_010_000),
      1_700_000_070_000,
    );

    // When
    const selected = selectRideSessionDraft([newerQueued, active]);

    // Then
    expect(selected?.clientRideId).toBe('ride-active');
  });
});
