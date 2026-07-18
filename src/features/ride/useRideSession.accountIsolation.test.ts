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
const mockRefreshLocal = jest.fn();

jest.mock('../../domain/ride/localRideQueue', () => ({
  createRideDraftIfQueueEmpty: jest.fn(),
  discardRideDraft: jest.fn(),
  loadActiveRideDraft: jest.fn(() => null),
  loadAnyActiveRideDraftForBackgroundTask: jest.fn(() => mockAccountARide),
}));
jest.mock('../../domain/ride/rideLifecycle', () => ({
  createRideLifecycleGate: () => ({ run: (operation: () => Promise<void>) => operation() }),
  pauseOrResumeRide: jest.fn(),
  queueRideForUpload: jest.fn(),
  reconcileRideLocationCollection: mockReconcileRideLocationCollection,
}));
jest.mock('../../domain/ride/RideSyncContext', () => ({
  useRideSyncCoordinator: () => ({
    accessToken: 'account-b-token',
    userId: 22,
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
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps account A background collection running without exposing it to account B', async () => {
    const { result, unmount } = renderHook(() => useRideSession());

    await waitFor(() => expect(mockReconcileRideLocationCollection).toHaveBeenCalledWith(
      mockAccountARide,
      expect.any(Object),
    ));
    expect(result.current.draft).toBeNull();
    expect(result.current.pendingDrafts).toEqual([]);

    unmount();
  });
});
