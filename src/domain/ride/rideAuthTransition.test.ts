import { loadAnyActiveRideDraftForBackgroundTask } from './localRideQueue';
import { pauseRecordingRideForAuthTransition } from './rideAuthTransition';
import { pauseOrResumeRide } from './rideLifecycle';
import { createRideDraft } from './rideQueueModel';

jest.mock('./localRideQueue', () => ({
  loadAnyActiveRideDraftForBackgroundTask: jest.fn(),
  loadRideDraft: jest.fn(),
  updateRideDraft: jest.fn(),
}));
jest.mock('./rideLifecycle', () => ({
  pauseOrResumeRide: jest.fn(async (draft) => ({ ...draft, status: 'PAUSED' })),
}));
jest.mock('./backgroundRideLocation', () => ({
  captureCurrentRideLocation: jest.fn(),
  restartBackgroundRideLocation: jest.fn(),
  startBackgroundRideLocation: jest.fn(),
  stopBackgroundRideLocation: jest.fn(),
}));

describe('ride auth transition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pauses a recording ride when the next account is different', async () => {
    // Given
    const active = createRideDraft('ride-account-a', 1_700_000_000_000, undefined, 11);
    jest.mocked(loadAnyActiveRideDraftForBackgroundTask).mockReturnValue(active);

    // When
    await pauseRecordingRideForAuthTransition(22);

    // Then
    expect(pauseOrResumeRide).toHaveBeenCalledWith(active, expect.any(Object));
  });

  it('keeps a recording ride active when the same account signs in again', async () => {
    // Given
    jest.mocked(loadAnyActiveRideDraftForBackgroundTask).mockReturnValue(
      createRideDraft('ride-account-a', 1_700_000_000_000, undefined, 11),
    );

    // When
    await pauseRecordingRideForAuthTransition(11);

    // Then
    expect(pauseOrResumeRide).not.toHaveBeenCalled();
  });

  it('does not pause a new account ride for an old account expiration', async () => {
    // Given
    jest.mocked(loadAnyActiveRideDraftForBackgroundTask).mockReturnValue(
      createRideDraft('ride-account-b', 1_700_000_000_000, undefined, 22),
    );

    // When
    await pauseRecordingRideForAuthTransition(null, 11);

    // Then
    expect(pauseOrResumeRide).not.toHaveBeenCalled();
  });
});
