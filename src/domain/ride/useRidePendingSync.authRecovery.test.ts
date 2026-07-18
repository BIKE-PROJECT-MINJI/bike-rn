import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { createRideDraft, finishRideDraft, type RideDraft, type RideReceipt } from './rideQueueModel';

let mockDraft: RideDraft | null = null;
const mockRecoverRideStatus = jest.fn();
const mockUploadRideDraft = jest.fn();
const mockCompleteRideDraft = jest.fn(async (_receipt: RideReceipt, _ownerUserId: number) => {
  mockDraft = null;
});
const mockSaveRideDraft = jest.fn(async (draft: RideDraft) => {
  mockDraft = draft;
});

jest.mock('./rideApi', () => ({
  fetchRideStatus: jest.fn(),
  recoverRideStatus: mockRecoverRideStatus,
  uploadRideDraft: mockUploadRideDraft,
}));
jest.mock('./backgroundRideLocation', () => ({
  restartBackgroundRideLocation: jest.fn(async () => undefined),
  stopBackgroundRideLocation: jest.fn(async () => undefined),
}));
jest.mock('./localRideQueue', () => ({
  quarantineLegacyActiveRides: jest.fn(async () => undefined),
  completeRideDraft: mockCompleteRideDraft,
  listPendingRideDrafts: jest.fn((ownerUserId: number | null) =>
    mockDraft === null || mockDraft.ownerUserId !== ownerUserId ? [] : [mockDraft]),
  loadLegacyRideRecoverySummary: jest.fn(() => ({
    activeDraftCount: mockDraft?.ownerUserId === null && (mockDraft.status === 'RECORDING' || mockDraft.status === 'PAUSED') ? 1 : 0,
    receiptCount: 0,
    totalCount: mockDraft?.ownerUserId === null ? 1 : 0,
  })),
  loadLatestRideReceipt: jest.fn(() => null),
  loadRideDraft: jest.fn(() => mockDraft),
  saveRideDraft: mockSaveRideDraft,
}));

const { useRidePendingSync } = require('./useRidePendingSync') as typeof import('./useRidePendingSync');

describe('useRidePendingSync authentication recovery', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_070_000);
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    mockRecoverRideStatus.mockReset().mockResolvedValue({
      rideRecordId: 41,
      status: 'READY',
      linkedCourseId: null,
      qualityStatus: 'FULL',
    });
    mockUploadRideDraft.mockReset();
    mockCompleteRideDraft.mockClear();
    mockSaveRideDraft.mockClear();
    mockDraft = failedAuthenticationDraft();
  });

  afterEach(() => jest.restoreAllMocks());

  it('resumes an authentication-blocked outbox with the same clientRideId after login succeeds', async () => {
    // Given
    const { rerender, unmount } = renderHook(
      ({ token, userId }: { readonly token: string | null; readonly userId: number | null }) =>
        useRidePendingSync(token, jest.fn(), jest.fn(), userId),
      { initialProps: { token: null, userId: null } },
    );
    await waitFor(() => expect(mockRecoverRideStatus).not.toHaveBeenCalled());

    // When
    rerender({ token: 'rotated-access', userId: 42 });

    // Then
    await waitFor(() => expect(mockRecoverRideStatus).toHaveBeenCalledWith('ride-auth-recovery', 'rotated-access'));
    await waitFor(() => expect(mockCompleteRideDraft).toHaveBeenCalledWith(
      expect.objectContaining({ clientRideId: 'ride-auth-recovery', rideRecordId: 41 }),
      42,
    ));
    expect(mockUploadRideDraft).not.toHaveBeenCalled();
    act(unmount);
  });

  it('keeps account A outbox local when account B logs in', async () => {
    // Given
    const { result, rerender, unmount } = renderHook(
      ({ token, userId }: { readonly token: string | null; readonly userId: number | null }) =>
        useRidePendingSync(token, jest.fn(), jest.fn(), userId),
      { initialProps: { token: null, userId: null } },
    );

    // When
    rerender({ token: 'account-b-access', userId: 77 });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Then
    expect(mockRecoverRideStatus).not.toHaveBeenCalled();
    expect(mockUploadRideDraft).not.toHaveBeenCalled();
    expect(result.current.pendingDrafts).toEqual([]);
    expect(result.current.draft).toBeNull();
    expect(mockDraft).toMatchObject({ clientRideId: 'ride-auth-recovery', ownerUserId: 42 });
    act(unmount);
  });

  it('does not automatically resume a ride whose retry budget is exhausted', async () => {
    // Given
    mockDraft = { ...failedAuthenticationDraft(), lastErrorCode: 'RIDE_RETRY_BUDGET_EXHAUSTED' };

    // When
    const { unmount } = renderHook(() =>
      useRidePendingSync('rotated-access', jest.fn(), jest.fn(), 42));

    // Then
    await act(async () => Promise.resolve());
    expect(mockRecoverRideStatus).not.toHaveBeenCalled();
    act(unmount);
  });

  it('keeps a legacy ownerless outbox local after login', async () => {
    // Given
    mockDraft = { ...failedAuthenticationDraft(), ownerUserId: null };

    // When
    const { unmount } = renderHook(() =>
      useRidePendingSync('rotated-access', jest.fn(), jest.fn(), 42));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Then
    expect(mockRecoverRideStatus).not.toHaveBeenCalled();
    expect(mockUploadRideDraft).not.toHaveBeenCalled();
    expect(mockDraft).toMatchObject({ clientRideId: 'ride-auth-recovery', ownerUserId: null });
    act(unmount);
  });
});

function failedAuthenticationDraft(): RideDraft {
  return {
    ...finishRideDraft(createRideDraft(
      'ride-auth-recovery',
      1_700_000_000_000,
      undefined,
      42,
    ), 1_700_000_060_000),
    status: 'FAILED_USER_ACTION',
    attemptCount: 1,
    lastErrorCode: 'AUTHENTICATION_REQUIRED',
  };
}
