import { createRideDraft, finishRideDraft, type RideDraft } from './rideQueueModel';
import { syncRideDraft, type RideSyncDependencies } from './rideSyncEngine';
import { ApiClientError } from '../../shared/api/apiClient';

function queuedDraft(): RideDraft {
  return finishRideDraft(createRideDraft('ride-device-001', 1_700_000_000_000), 1_700_000_060_000);
}

describe('ride sync engine', () => {
  it('submits the persisted clientRideId and keeps polling metadata while finalizing', async () => {
    // Given
    const saved: RideDraft[] = [];
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_061_000,
      saveRemote: jest.fn().mockResolvedValue({ rideRecordId: 41, finalizationStatus: 'FINALIZING' }),
      getRemoteStatus: jest.fn(),
      persist: async (draft) => {
        saved.push(draft);
      },
      complete: jest.fn(),
    };

    // When
    const result = await syncRideDraft(queuedDraft(), dependencies);

    // Then
    expect(dependencies.saveRemote).toHaveBeenCalledWith(expect.objectContaining({ clientRideId: 'ride-device-001' }));
    expect(result.status).toBe('FINALIZING');
    if (result.status === 'FINALIZING') {
      expect(result.rideRecordId).toBe(41);
    }
    expect(saved.at(-1)?.clientRideId).toBe('ride-device-001');
    expect(saved.at(-1)).toEqual(
      expect.objectContaining({
        finalizationStartedAtMs: 1_700_000_061_000,
        lastFinalizationPollAtMs: 1_700_000_061_000,
      }),
    );
  });

  it('removes the upload payload only after READY and writes a receipt', async () => {
    // Given
    const complete = jest.fn();
    const draft: RideDraft = { ...queuedDraft(), status: 'FINALIZING', rideRecordId: 41 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn().mockResolvedValue({ rideRecordId: 41, status: 'READY', linkedCourseId: null }),
      persist: jest.fn(),
      complete,
    };

    // When
    const result = await syncRideDraft(draft, dependencies);

    // Then
    expect(result.status).toBe('READY');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ clientRideId: 'ride-device-001', rideRecordId: 41 }));
  });

  it('retries a failed FINALIZING status GET without posting the full route again', async () => {
    const persisted: RideDraft[] = [];
    const saveRemote = jest.fn();
    const getRemoteStatus = jest
      .fn()
      .mockRejectedValueOnce(new ApiClientError({ message: '일시 장애', status: 503 }))
      .mockResolvedValueOnce({ rideRecordId: 41, status: 'READY', linkedCourseId: null });
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      saveRemote,
      getRemoteStatus,
      persist: async (draft) => {
        persisted.push(draft);
      },
      complete: jest.fn(),
    };
    const finalizing: RideDraft = { ...queuedDraft(), status: 'FINALIZING', rideRecordId: 41 };

    await syncRideDraft(finalizing, dependencies);
    const retry = persisted.at(-1);
    if (!retry) {
      throw new Error('재시도 draft가 저장되지 않았습니다.');
    }
    await syncRideDraft(retry, dependencies);

    expect(saveRemote).not.toHaveBeenCalled();
    expect(getRemoteStatus).toHaveBeenCalledTimes(2);
    expect(dependencies.complete).toHaveBeenCalled();
  });

  it('keeps a React Native cross-realm network failure retryable', async () => {
    const persisted: RideDraft[] = [];
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      saveRemote: jest.fn().mockRejectedValue({ name: 'TypeError', message: 'Network request failed.' }),
      getRemoteStatus: jest.fn(),
      persist: async (draft) => {
        persisted.push(draft);
      },
      complete: jest.fn(),
    };

    const result = await syncRideDraft(queuedDraft(), dependencies);

    expect(result.status).toBe('RETRY_WAIT');
    expect(persisted.at(-1)).toEqual(
      expect.objectContaining({ status: 'RETRY_WAIT', lastErrorCode: 'NETWORK_ERROR' }),
    );
  });
});
