import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { createRideDraft, finishRideDraft, type RideDraft } from './rideQueueModel';

let mockAppStateHandler: ((state: AppStateStatus) => void) | null = null;
const TEST_USER_ID = 42;
let mockCurrentAppState: AppStateStatus = 'active';
const mockFetchRideStatus = jest.fn();
const mockUploadRideDraft = jest.fn();
const mockStopBackgroundRideLocation = jest.fn(async () => undefined);
const mockRestartBackgroundRideLocation = jest.fn(async () => undefined);
const mockQuarantineLegacyActiveRides = jest.fn(async () => undefined);
const mockListPendingRideDrafts = jest.fn((ownerUserId: number | null) =>
  mockFinalizingDraft.ownerUserId === ownerUserId ? [mockFinalizingDraft] : []);
const mockSaveRideDraft = jest.fn(async (draft: RideDraft) => {
  mockFinalizingDraft = draft;
});
const mockCompleteRideDraft = jest.fn(async () => undefined);
let mockFinalizingDraft: RideDraft = {
  ...finishRideDraft(createRideDraft('ride-finalizing', 1_700_000_000_000), 1_700_000_060_000),
  status: 'FINALIZING',
  rideRecordId: 41,
  finalizationStartedAtMs: Date.now(),
  lastFinalizationPollAtMs: Date.now() + 60_000,
};

jest.mock('./rideApi', () => ({
  fetchRideStatus: mockFetchRideStatus,
  recoverRideStatus: jest.fn().mockResolvedValue(null),
  uploadRideDraft: mockUploadRideDraft,
}));
jest.mock('./backgroundRideLocation', () => ({
  restartBackgroundRideLocation: mockRestartBackgroundRideLocation,
  stopBackgroundRideLocation: mockStopBackgroundRideLocation,
}));
jest.mock('./localRideQueue', () => ({
  quarantineLegacyActiveRides: mockQuarantineLegacyActiveRides,
  completeRideDraft: mockCompleteRideDraft,
  listPendingRideDrafts: mockListPendingRideDrafts,
  loadLegacyRideRecoverySummary: jest.fn(() => ({ activeDraftCount: 0, receiptCount: 0, totalCount: 0 })),
  loadLatestRideReceipt: jest.fn(() => null),
  loadRideDraft: jest.fn(() => mockFinalizingDraft),
  saveRideDraft: mockSaveRideDraft,
}));

const { useRidePendingSync } = require('./useRidePendingSync') as typeof import('./useRidePendingSync');

describe('useRidePendingSync foreground activation', () => {
  beforeEach(() => {
    mockCurrentAppState = 'active';
    mockAppStateHandler = null;
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => mockCurrentAppState,
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      mockAppStateHandler = handler;
      return { remove: jest.fn() };
    });
    mockFetchRideStatus.mockReset().mockResolvedValue({
      rideRecordId: 41,
      status: 'FINALIZING',
      linkedCourseId: null,
    });
    mockUploadRideDraft.mockReset();
    mockSaveRideDraft.mockClear();
    mockCompleteRideDraft.mockClear();
    mockStopBackgroundRideLocation.mockClear();
    mockRestartBackgroundRideLocation.mockClear();
    mockQuarantineLegacyActiveRides.mockClear();
    mockListPendingRideDrafts.mockClear();
    mockFinalizingDraft = finalizingDraftWithNextPollAt(Date.now() + 60_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs one immediate GET on cold start and once on the next foreground activation', async () => {
    // Given
    const onMessage = jest.fn();
    const onError = jest.fn();

    // When
    const { unmount } = renderHook(() =>
      useRidePendingSync('token', onMessage, onError, TEST_USER_ID));

    // Then
    await waitFor(() => expect(mockFetchRideStatus).toHaveBeenCalledTimes(1));
    expect(mockUploadRideDraft).not.toHaveBeenCalled();

    act(() => emitAppState('background'));
    act(() => emitAppState('active'));
    await waitFor(() => expect(mockFetchRideStatus).toHaveBeenCalledTimes(2));
    expect(mockUploadRideDraft).not.toHaveBeenCalled();
    unmount();
  });

  it('deduplicates an overdue timer and foreground activation into one remote GET', async () => {
    // Given
    mockCurrentAppState = 'background';
    mockFinalizingDraft = finalizingDraftWithNextPollAt(Date.now() - 10_000);
    let resolveStatus = (_status: {
      readonly rideRecordId: number;
      readonly status: 'FINALIZING' | 'READY';
      readonly linkedCourseId: null;
      readonly qualityStatus?: 'FULL';
    }): void => {
      throw new Error('상태 조회 완료 함수가 준비되지 않았습니다.');
    };
    mockFetchRideStatus.mockImplementation(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    const { unmount } = renderHook(() =>
      useRidePendingSync('token', jest.fn(), jest.fn(), TEST_USER_ID));

    // When
    act(() => emitAppState('active'));
    await waitFor(() => expect(mockFetchRideStatus).toHaveBeenCalledTimes(1));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    // Then
    expect(mockFetchRideStatus).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveStatus({ rideRecordId: 41, status: 'FINALIZING', linkedCourseId: null });
      await Promise.resolve();
    });
    unmount();
  });

  it('does not publish account A completion after switching to account B', async () => {
    let resolveStatus = (_status: {
      readonly rideRecordId: number;
      readonly status: 'FINALIZING' | 'READY';
      readonly linkedCourseId: null;
      readonly qualityStatus?: 'FULL';
    }): void => {
      throw new Error('상태 조회 완료 함수가 준비되지 않았습니다.');
    };
    mockFetchRideStatus.mockImplementation(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    const onMessage = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ token, userId }: { readonly token: string; readonly userId: number }) =>
        useRidePendingSync(token, onMessage, jest.fn(), userId),
      { initialProps: { token: 'token-a', userId: TEST_USER_ID } },
    );
    await waitFor(() => expect(mockFetchRideStatus).toHaveBeenCalledTimes(1));

    rerender({ token: 'token-b', userId: 77 });
    expect(result.current.pendingDrafts).toEqual([]);
    await waitFor(() => expect(result.current.pendingDrafts).toEqual([]));
    await act(async () => {
      resolveStatus({ rideRecordId: 41, status: 'READY', linkedCourseId: null, qualityStatus: 'FULL' });
      await Promise.resolve();
    });

    expect(result.current.pendingDrafts).toEqual([]);
    expect(result.current.receipt).toBeNull();
    expect(mockCompleteRideDraft).toHaveBeenCalledWith(expect.objectContaining({
      clientRideId: 'ride-finalizing',
      status: 'READY',
    }), TEST_USER_ID);
    expect(onMessage).not.toHaveBeenCalled();
    unmount();
  });

  it('stops Android location collection before quarantining a legacy active ride', async () => {
    const { result, unmount } = renderHook(() =>
      useRidePendingSync('token', jest.fn(), jest.fn(), TEST_USER_ID));

    await act(async () => result.current.quarantineLegacyRides());

    expect(mockStopBackgroundRideLocation).toHaveBeenCalledTimes(1);
    expect(mockQuarantineLegacyActiveRides).toHaveBeenCalledTimes(1);
    expect(mockStopBackgroundRideLocation.mock.invocationCallOrder[0]).toBeLessThan(
      mockQuarantineLegacyActiveRides.mock.invocationCallOrder[0],
    );
    unmount();
  });

  it('keeps the legacy ride active when Android location collection cannot stop', async () => {
    const stopError = new Error('위치 수집을 중단하지 못했습니다.');
    mockStopBackgroundRideLocation.mockRejectedValueOnce(stopError);
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRidePendingSync('token', jest.fn(), onError, TEST_USER_ID));

    await act(async () => result.current.quarantineLegacyRides());

    expect(mockQuarantineLegacyActiveRides).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(stopError.message);
    unmount();
  });

  it('restarts Android location collection when legacy SQLite quarantine fails', async () => {
    const quarantineError = new Error('주행 저장소를 갱신하지 못했습니다.');
    mockQuarantineLegacyActiveRides.mockRejectedValueOnce(quarantineError);
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRidePendingSync('token', jest.fn(), onError, TEST_USER_ID));

    await act(async () => result.current.quarantineLegacyRides());

    expect(mockRestartBackgroundRideLocation).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(quarantineError.message);
    unmount();
  });

  it('reports both failures when legacy quarantine and location restart fail', async () => {
    mockQuarantineLegacyActiveRides.mockRejectedValueOnce(new Error('SQLite 격리 실패'));
    mockRestartBackgroundRideLocation.mockRejectedValueOnce(new Error('위치 재개 실패'));
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRidePendingSync('token', jest.fn(), onError, TEST_USER_ID));

    await act(async () => result.current.quarantineLegacyRides());

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('SQLite 격리 실패'));
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('위치 재개 실패'));
    unmount();
  });
});

function emitAppState(nextState: AppStateStatus): void {
  mockCurrentAppState = nextState;
  if (mockAppStateHandler === null) {
    throw new Error('AppState listener가 등록되지 않았습니다.');
  }
  mockAppStateHandler(nextState);
}

function finalizingDraftWithNextPollAt(lastFinalizationPollAtMs: number): RideDraft {
  return {
    ...finishRideDraft(
      createRideDraft('ride-finalizing', 1_700_000_000_000, undefined, TEST_USER_ID),
      1_700_000_060_000,
    ),
    status: 'FINALIZING',
    rideRecordId: 41,
    finalizationStartedAtMs: Date.now() - 20_000,
    lastFinalizationPollAtMs,
  };
}
