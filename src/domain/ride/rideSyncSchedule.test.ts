import { createRideDraft, finishRideDraft, type RideDraft } from './rideQueueModel';
import { planRideSyncs, rideSyncDelayMs, shouldSyncOnForeground } from './rideSyncSchedule';

function finalizingDraft(
  finalizationStartedAtMs: number,
  lastFinalizationPollAtMs: number,
): RideDraft & {
  readonly finalizationStartedAtMs: number;
  readonly lastFinalizationPollAtMs: number;
} {
  return {
    ...finishRideDraft(createRideDraft('ride-finalizing', 1_700_000_000_000), 1_700_000_060_000),
    status: 'FINALIZING',
    rideRecordId: 41,
    finalizationStartedAtMs,
    lastFinalizationPollAtMs,
  };
}

describe('ride finalization sync schedule', () => {
  it('polls every two seconds during the first ten foreground seconds', () => {
    // Given
    const nowMs = 1_700_000_065_500;
    const draft = finalizingDraft(1_700_000_060_000, 1_700_000_065_000);

    // When
    const delayMs = rideSyncDelayMs(draft, nowMs);

    // Then
    expect(delayMs).toBe(1_500);
  });

  it('polls every ten seconds after the first ten foreground seconds', () => {
    // Given
    const nowMs = 1_700_000_075_000;
    const draft = finalizingDraft(1_700_000_060_000, 1_700_000_072_000);

    // When
    const delayMs = rideSyncDelayMs(draft, nowMs);

    // Then
    expect(delayMs).toBe(7_000);
  });

  it('immediately checks a server-issued ride after returning to foreground', () => {
    // Given
    const draft: RideDraft = {
      ...finalizingDraft(1_700_000_060_000, 1_700_000_065_000),
      status: 'RETRY_WAIT',
      nextRetryAtMs: 1_700_000_300_000,
    };

    // When
    const shouldSync = shouldSyncOnForeground(draft);

    // Then
    expect(shouldSync).toBe(true);
  });

  it('creates an independent sync plan for every pending ride', () => {
    // Given
    const active = createRideDraft('ride-active', 1_700_000_000_000);
    const first = finishRideDraft(createRideDraft('ride-pending-1', 1_700_000_001_000), 1_700_000_061_000);
    const second = finishRideDraft(createRideDraft('ride-pending-2', 1_700_000_002_000), 1_700_000_062_000);

    // When
    const plans = planRideSyncs([second, active, first], 1_700_000_070_000);

    // Then
    expect(plans).toEqual([
      { clientRideId: 'ride-pending-1', delayMs: 0 },
      { clientRideId: 'ride-pending-2', delayMs: 0 },
    ]);
  });
});
