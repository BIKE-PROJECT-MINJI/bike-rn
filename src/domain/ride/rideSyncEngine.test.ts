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
      recoverRemote: jest.fn(),
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
      recoverRemote: jest.fn(),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn().mockResolvedValue({
        rideRecordId: 41,
        status: 'READY',
        linkedCourseId: null,
        qualityStatus: 'FULL',
      }),
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
      .mockResolvedValueOnce({ rideRecordId: 41, status: 'READY', linkedCourseId: null, qualityStatus: 'FULL' });
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn(),
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
      recoverRemote: jest.fn(),
      saveRemote: jest.fn().mockRejectedValue({ name: 'TypeError', message: 'Network request failed.' }),
      getRemoteStatus: jest.fn().mockResolvedValue({
        rideRecordId: 42,
        status: 'READY',
        linkedCourseId: null,
        qualityStatus: 'FULL',
      }),
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

  it('recovers a committed upload by clientRideId without posting the route again', async () => {
    const recoveredDraft: RideDraft = { ...queuedDraft(), status: 'UPLOADING', attemptCount: 1 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockResolvedValue({ rideRecordId: 41, status: 'FINALIZING', linkedCourseId: null }),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: jest.fn(),
      complete: jest.fn(),
    };

    const result = await syncRideDraft(recoveredDraft, dependencies);

    expect(result).toEqual({ status: 'FINALIZING', rideRecordId: 41 });
    expect(dependencies.recoverRemote).toHaveBeenCalledWith('ride-device-001');
    expect(dependencies.saveRemote).not.toHaveBeenCalled();
    expect(dependencies.persist).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FINALIZING', rideRecordId: 41 }),
    );
  });

  it('posts only after an attempted upload recovery returns 404', async () => {
    const retryDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 1 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockResolvedValue(null),
      saveRemote: jest.fn().mockResolvedValue({ rideRecordId: 42, finalizationStatus: 'READY' }),
      getRemoteStatus: jest.fn().mockResolvedValue({
        rideRecordId: 42,
        status: 'READY',
        linkedCourseId: null,
        qualityStatus: 'FULL',
      }),
      persist: jest.fn(),
      complete: jest.fn(),
    };

    await syncRideDraft(retryDraft, dependencies);

    expect(dependencies.recoverRemote).toHaveBeenCalledTimes(1);
    expect(dependencies.saveRemote).toHaveBeenCalledTimes(1);
    expect(dependencies.getRemoteStatus).toHaveBeenCalledWith(42);
  });

  it('does not post when attempted upload recovery is unavailable', async () => {
    const persisted: RideDraft[] = [];
    const retryDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 1 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockRejectedValue(new ApiClientError({ message: '일시 장애', status: 503 })),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: async (next) => { persisted.push(next); },
      complete: jest.fn(),
    };

    const result = await syncRideDraft(retryDraft, dependencies);

    expect(result.status).toBe('RETRY_WAIT');
    expect(dependencies.saveRemote).not.toHaveBeenCalled();
    expect(persisted.at(-1)).toEqual(expect.objectContaining({ status: 'RETRY_WAIT', attemptCount: 2 }));
  });

  it('keeps the attempted marker when a successful POST response violates the contract', async () => {
    const persisted: RideDraft[] = [];
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn(),
      saveRemote: jest.fn().mockRejectedValue(
        new ApiClientError({ message: '응답 계약 오류', status: 200, errorCode: 'INVALID_SERVER_RESPONSE' }),
      ),
      getRemoteStatus: jest.fn(),
      persist: async (next) => { persisted.push(next); },
      complete: jest.fn(),
    };

    await syncRideDraft(queuedDraft(), dependencies);

    expect(persisted.at(-1)).toEqual(
      expect.objectContaining({ status: 'FAILED_TERMINAL', attemptCount: 1 }),
    );
  });

  it('keeps the original and avoids POST when recovery requires login', async () => {
    const persisted: RideDraft[] = [];
    const retryDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 1 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockRejectedValue(new ApiClientError({ message: '로그인 필요', status: 401 })),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: async (next) => { persisted.push(next); },
      complete: jest.fn(),
    };

    const result = await syncRideDraft(retryDraft, dependencies);

    expect(result.status).toBe('FAILED_USER_ACTION');
    expect(dependencies.saveRemote).not.toHaveBeenCalled();
    expect(persisted.at(-1)).toEqual(expect.objectContaining({ status: 'FAILED_USER_ACTION', attemptCount: 1 }));
  });

  it('completes a recovered READY receipt without a second POST', async () => {
    const retryDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 1 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockResolvedValue({
        rideRecordId: 43,
        status: 'READY',
        linkedCourseId: 7,
        qualityStatus: 'PARTIAL',
      }),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: jest.fn(),
      complete: jest.fn(),
    };

    const result = await syncRideDraft(retryDraft, dependencies);

    expect(result).toEqual({ status: 'READY', rideRecordId: 43 });
    expect(dependencies.saveRemote).not.toHaveBeenCalled();
    expect(dependencies.complete).toHaveBeenCalledWith(
      expect.objectContaining({ clientRideId: 'ride-device-001', rideRecordId: 43, linkedCourseId: 7 }),
    );
  });

  it('stops automatic retries after the retry attempt budget while preserving the draft', async () => {
    // Given
    const persisted: RideDraft[] = [];
    const exhaustedDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 7 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn().mockRejectedValue(new ApiClientError({ message: '일시 장애', status: 503 })),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: async (next) => { persisted.push(next); },
      complete: jest.fn(),
    };

    // When
    const result = await syncRideDraft(exhaustedDraft, dependencies);

    // Then
    expect(result.status).toBe('FAILED_USER_ACTION');
    expect(persisted.at(-1)).toEqual(expect.objectContaining({
      clientRideId: exhaustedDraft.clientRideId,
      status: 'FAILED_USER_ACTION',
      attemptCount: 8,
      nextRetryAtMs: null,
      lastErrorCode: 'RIDE_RETRY_BUDGET_EXHAUSTED',
    }));
  });

  it('stops automatic retries when a pending ride has exceeded the retry age budget', async () => {
    // Given
    const persisted: RideDraft[] = [];
    const agedDraft: RideDraft = { ...queuedDraft(), status: 'RETRY_WAIT', attemptCount: 1 };
    const endedAtMs = Date.parse(agedDraft.endedAtIso ?? agedDraft.startedAtIso);
    const dependencies: RideSyncDependencies = {
      nowMs: () => endedAtMs + 24 * 60 * 60 * 1000 + 1,
      recoverRemote: jest.fn().mockRejectedValue(new ApiClientError({ message: '일시 장애', status: 503 })),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn(),
      persist: async (next) => { persisted.push(next); },
      complete: jest.fn(),
    };

    // When
    const result = await syncRideDraft(agedDraft, dependencies);

    // Then
    expect(result.status).toBe('FAILED_USER_ACTION');
    expect(persisted.at(-1)).toEqual(expect.objectContaining({
      status: 'FAILED_USER_ACTION',
      nextRetryAtMs: null,
      lastErrorCode: 'RIDE_RETRY_BUDGET_EXHAUSTED',
    }));
  });

  it('preserves the original trace when finalization rejects route quality', async () => {
    // Given
    const persist = jest.fn();
    const complete = jest.fn();
    const finalizing: RideDraft = { ...queuedDraft(), status: 'FINALIZING', rideRecordId: 41 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn(),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn().mockResolvedValue({
        rideRecordId: 41,
        status: 'READY',
        linkedCourseId: null,
        qualityStatus: 'REJECTED',
        qualityReasons: ['IMPLAUSIBLE_JUMP'],
      }),
      persist,
      complete,
    };

    // When
    const result = await syncRideDraft(finalizing, dependencies);

    // Then
    expect(result.status).toBe('FAILED_TERMINAL');
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      clientRideId: finalizing.clientRideId,
      rideRecordId: 41,
      status: 'FAILED_TERMINAL',
      lastErrorCode: 'RIDE_ROUTE_QUALITY_REJECTED',
    }));
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps the local original when READY has no verified route quality', async () => {
    const persist = jest.fn();
    const complete = jest.fn();
    const finalizing: RideDraft = { ...queuedDraft(), status: 'FINALIZING', rideRecordId: 41 };
    const dependencies: RideSyncDependencies = {
      nowMs: () => 1_700_000_070_000,
      recoverRemote: jest.fn(),
      saveRemote: jest.fn(),
      getRemoteStatus: jest.fn().mockResolvedValue({
        rideRecordId: 41,
        status: 'READY',
        linkedCourseId: null,
        qualityStatus: null,
      }),
      persist,
      complete,
    };

    const result = await syncRideDraft(finalizing, dependencies);

    expect(result).toEqual({
      status: 'FAILED_USER_ACTION',
      errorCode: 'RIDE_ROUTE_QUALITY_UNVERIFIED',
    });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      status: 'FAILED_USER_ACTION',
      rideRecordId: 41,
      lastErrorCode: 'RIDE_ROUTE_QUALITY_UNVERIFIED',
    }));
    expect(complete).not.toHaveBeenCalled();
  });
});
