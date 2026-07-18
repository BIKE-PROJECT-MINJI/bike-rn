import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { createRideDraft, type RideDraft } from '../../domain/ride/rideQueueModel';

const mockAccountARide: RideDraft = createRideDraft(
  'ride-account-a-active',
  1_700_000_000_000,
  { mode: 'FREE', courseId: null, courseTitle: null, partyId: null },
  11,
);
const mockReconcileRideLocationCollection = jest.fn(async () => undefined);
const mockPauseOrResumeRide = jest.fn(async () => ({ ...mockAccountARide, status: 'PAUSED' as const }));
const mockRefreshLocal = jest.fn();
let mockUserId: number | null = 22;

jest.mock('../../domain/ride/localRideQueue', () => ({
  createRideDraftIfQueueEmpty: jest.fn(),
  discardRideDraft: jest.fn(),
  loadActiveRideDraft: jest.fn(() => null),
  loadAnyActiveRideDraftForBackgroundTask: jest.fn(() => mockAccountARide),
}));
jest.mock('../../domain/ride/rideLifecycle', () => ({
  createRideLifecycleGate: () => ({ run: (operation: () => Promise<void>) => operation() }),
  pauseOrResumeRide: mockPauseOrResumeRide,
  queueRideForUpload: jest.fn(),
  reconcileRideLocationCollection: mockReconcileRideLocationCollection,
}));
jest.mock('../../domain/ride/RideSyncContext', () => ({
  useRideSyncCoordinator: () => ({
    accessToken: 'account-b-token',
    userId: mockUserId,
    draft: null,
    pendingDrafts: [],
    receipt: null,
    legacyRecovery: { activeDraftCount: 0, receiptCount: 0, totalCount: 0 },
    syncing: false,
    message: '준비됨',
    errorMessage: null,
    refreshLocal: mockRefreshLocal,
    syncById: jest.fn(async () => undefined),
    quarantineLegacyRides: jest.fn(async () => undefined),
    setMessage: jest.fn(),
    setErrorMessage: jest.fn(),
  }),
}));
jest.mock('./activeReconcileScheduler', () => ({
  createActiveReconcileScheduler: (reconcile: () => Promise<void>) => ({
    dispose: jest.fn(),
    onAppStateChange: () => void reconcile(),
  }),
  createActiveRideRecoveryMessageGate: () => ({ messageFor: jest.fn(() => null) }),
}));

const { useRideSession } = require('./useRideSession') as typeof import('./useRideSession');

describe('useRideSession account isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 22;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('pauses account A collection before account B can append locations', async () => {
    const { result, unmount } = renderHook(() => useRideSession());

    await waitFor(() => expect(mockPauseOrResumeRide).toHaveBeenCalledWith(
      mockAccountARide,
      expect.any(Object),
    ));
    expect(mockReconcileRideLocationCollection).not.toHaveBeenCalled();
    expect(result.current.draft).toBeNull();
    expect(result.current.pendingDrafts).toEqual([]);

    unmount();
  });

  it('does not pause a ride while the authentication query is still loading', async () => {
    // Given
    mockUserId = null;

    // When
    const { unmount } = renderHook(() => useRideSession());

    // Then
    await waitFor(() => expect(mockRefreshLocal).toHaveBeenCalled());
    expect(mockPauseOrResumeRide).not.toHaveBeenCalled();
    unmount();
  });
});
