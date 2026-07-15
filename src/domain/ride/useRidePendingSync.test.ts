import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { createRideDraft, finishRideDraft, type RideDraft } from './rideQueueModel';

let mockAppStateHandler: ((state: AppStateStatus) => void) | null = null;
let mockCurrentAppState: AppStateStatus = 'active';
const mockFetchRideStatus = jest.fn();
const mockUploadRideDraft = jest.fn();
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
  uploadRideDraft: mockUploadRideDraft,
}));
jest.mock('./localRideQueue', () => ({
  completeRideDraft: mockCompleteRideDraft,
  listPendingRideDrafts: jest.fn(() => [mockFinalizingDraft]),
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
    const { unmount } = renderHook(() => useRidePendingSync('token', onMessage, onError));

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
    let resolveStatus = (_status: { readonly rideRecordId: number; readonly status: 'FINALIZING'; readonly linkedCourseId: null }): void => {
      throw new Error('상태 조회 완료 함수가 준비되지 않았습니다.');
    };
    mockFetchRideStatus.mockImplementation(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    const { unmount } = renderHook(() => useRidePendingSync('token', jest.fn(), jest.fn()));

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
    ...finishRideDraft(createRideDraft('ride-finalizing', 1_700_000_000_000), 1_700_000_060_000),
    status: 'FINALIZING',
    rideRecordId: 41,
    finalizationStartedAtMs: Date.now() - 20_000,
    lastFinalizationPollAtMs,
  };
}
