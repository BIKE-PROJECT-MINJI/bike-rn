import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiClientError } from '../../shared/api/apiClient';
import { createRideDraft, finishRideDraft, type RideDraft, type RideReceipt } from './rideQueueModel';

const mockDrafts = new Map<string, RideDraft>();
const mockReceipts: RideReceipt[] = [];
const mockUploadOrder: string[] = [];
let mockCurrentAppState: AppStateStatus = 'active';
let mockActiveUploads = 0;
let mockMaxActiveUploads = 0;
let mockOldestUploadBarrier: Promise<void> = Promise.resolve();
let mockReleaseOldestUpload = (): void => {
  throw new Error('첫 업로드 해제 함수가 준비되지 않았습니다.');
};

const mockUploadRideDraft = jest.fn(async (draft: RideDraft) => {
  mockActiveUploads += 1;
  mockMaxActiveUploads = Math.max(mockMaxActiveUploads, mockActiveUploads);
  mockUploadOrder.push(draft.clientRideId);
  if (draft.clientRideId === 'ride-oldest') {
    await mockOldestUploadBarrier;
  }
  mockActiveUploads -= 1;
  if (draft.clientRideId === 'ride-oldest') {
    throw new ApiClientError({ message: '일시 장애', status: 503 });
  }
  return { rideRecordId: 52, finalizationStatus: 'READY' as const };
});

jest.mock('./rideApi', () => ({
  fetchRideStatus: jest.fn(),
  recoverRideStatus: jest.fn().mockResolvedValue(null),
  uploadRideDraft: mockUploadRideDraft,
}));
jest.mock('./localRideQueue', () => ({
  completeRideDraft: jest.fn(async (receipt: RideReceipt) => {
    mockReceipts.push(receipt);
    mockDrafts.delete(receipt.clientRideId);
  }),
  listPendingRideDrafts: jest.fn(() => [...mockDrafts.values()]),
  loadLatestRideReceipt: jest.fn(() => mockReceipts.at(-1) ?? null),
  loadRideDraft: jest.fn((clientRideId: string) => mockDrafts.get(clientRideId) ?? null),
  saveRideDraft: jest.fn(async (draft: RideDraft) => {
    mockDrafts.set(draft.clientRideId, draft);
  }),
}));

const { useRidePendingSync } = require('./useRidePendingSync') as typeof import('./useRidePendingSync');

describe('useRidePendingSync queued drain', () => {
  beforeEach(() => {
    mockDrafts.clear();
    mockReceipts.length = 0;
    mockUploadOrder.length = 0;
    mockCurrentAppState = 'active';
    mockActiveUploads = 0;
    mockMaxActiveUploads = 0;
    mockOldestUploadBarrier = new Promise((resolve) => {
      mockReleaseOldestUpload = resolve;
    });
    mockUploadRideDraft.mockClear();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => mockCurrentAppState,
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    mockDrafts.set('ride-newer', queuedDraft('ride-newer', 1_700_000_010_000));
    mockDrafts.set('ride-oldest', queuedDraft('ride-oldest', 1_700_000_000_000));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads oldest-first with max concurrency one and continues after the first failure', async () => {
    // Given
    const onMessage = jest.fn();
    const onError = jest.fn();

    // When
    const { result, unmount } = renderHook(() => useRidePendingSync('token', onMessage, onError));

    // Then
    await waitFor(() => expect(mockUploadRideDraft).toHaveBeenCalledTimes(1));
    expect(mockDrafts.get('ride-oldest')).toEqual(expect.objectContaining({ status: 'UPLOADING' }));
    expect(mockDrafts.get('ride-newer')).toEqual(expect.objectContaining({ status: 'QUEUED' }));
    act(mockReleaseOldestUpload);
    await waitFor(() => expect(mockUploadRideDraft).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockReceipts).toHaveLength(1));
    expect(mockUploadOrder).toEqual(['ride-oldest', 'ride-newer']);
    expect(mockMaxActiveUploads).toBe(1);
    expect(mockDrafts.get('ride-oldest')).toEqual(expect.objectContaining({ status: 'RETRY_WAIT' }));
    expect(mockDrafts.has('ride-newer')).toBe(false);
    expect(mockReceipts[0]).toEqual(expect.objectContaining({ clientRideId: 'ride-newer', rideRecordId: 52 }));
    await waitFor(() => expect(result.current.syncing).toBe(false));
    act(unmount);
  });
});

function queuedDraft(clientRideId: string, startedAtMs: number): RideDraft {
  return finishRideDraft(createRideDraft(clientRideId, startedAtMs), startedAtMs + 60_000);
}
