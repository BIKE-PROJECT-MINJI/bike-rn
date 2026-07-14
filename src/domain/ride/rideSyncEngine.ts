import type { RideDraft, RideReceipt } from './rideQueueModel';
import { classifyRideUploadFailure } from './rideUploadPolicy';

export type RemoteRideSaveResult = {
  readonly rideRecordId: number;
  readonly finalizationStatus: 'FINALIZING' | 'READY' | 'FAILED';
};

export type RemoteRideStatusResult = {
  readonly rideRecordId: number;
  readonly status: 'FINALIZING' | 'READY' | 'FAILED';
  readonly linkedCourseId: number | null;
};

export type RideSyncDependencies = {
  readonly nowMs: () => number;
  readonly saveRemote: (draft: RideDraft) => Promise<RemoteRideSaveResult>;
  readonly getRemoteStatus: (rideRecordId: number) => Promise<RemoteRideStatusResult>;
  readonly persist: (draft: RideDraft) => Promise<void>;
  readonly complete: (receipt: RideReceipt) => Promise<void>;
};

export type RideSyncResult =
  | { readonly status: 'FINALIZING'; readonly rideRecordId: number }
  | { readonly status: 'READY'; readonly rideRecordId: number }
  | { readonly status: 'RETRY_WAIT'; readonly retryAtMs: number }
  | { readonly status: 'FAILED_USER_ACTION' }
  | { readonly status: 'FAILED_TERMINAL' };

export async function syncRideDraft(draft: RideDraft, dependencies: RideSyncDependencies): Promise<RideSyncResult> {
  try {
    if (draft.rideRecordId !== null) {
      const remoteStatus = await dependencies.getRemoteStatus(draft.rideRecordId);
      return applyRemoteStatus(draft, remoteStatus, dependencies);
    }

    const uploading: RideDraft = { ...draft, status: 'UPLOADING', attemptCount: draft.attemptCount + 1 };
    await dependencies.persist(uploading);
    const remote = await dependencies.saveRemote(uploading);
    return applyRemoteStatus(
      uploading,
      { rideRecordId: remote.rideRecordId, status: remote.finalizationStatus, linkedCourseId: null },
      dependencies,
    );
  } catch (error) {
    const failure = classifyRideUploadFailure(error);
    switch (failure.kind) {
      case 'RETRYABLE': {
        const nextAttemptCount = draft.attemptCount + 1;
        const retryDelaySeconds = Math.max(failure.retryAfterSeconds, exponentialBackoffSeconds(nextAttemptCount));
        const retryAtMs = dependencies.nowMs() + retryDelaySeconds * 1000;
        await dependencies.persist({
          ...draft,
          status: 'RETRY_WAIT',
          attemptCount: nextAttemptCount,
          nextRetryAtMs: retryAtMs,
          lastErrorCode: failure.errorCode,
        });
        return { status: 'RETRY_WAIT', retryAtMs };
      }
      case 'USER_ACTION':
        await dependencies.persist({ ...draft, status: 'FAILED_USER_ACTION', lastErrorCode: failure.errorCode });
        return { status: 'FAILED_USER_ACTION' };
      case 'TERMINAL':
        await dependencies.persist({ ...draft, status: 'FAILED_TERMINAL', lastErrorCode: failure.errorCode });
        return { status: 'FAILED_TERMINAL' };
    }
  }
}

function exponentialBackoffSeconds(attemptCount: number): number {
  return Math.min(300, 5 * 2 ** Math.min(Math.max(0, attemptCount - 1), 6));
}

async function applyRemoteStatus(
  draft: RideDraft,
  remote: RemoteRideStatusResult,
  dependencies: RideSyncDependencies,
): Promise<RideSyncResult> {
  switch (remote.status) {
    case 'FINALIZING':
      await dependencies.persist({ ...draft, status: 'FINALIZING', rideRecordId: remote.rideRecordId });
      return { status: 'FINALIZING', rideRecordId: remote.rideRecordId };
    case 'READY':
      await dependencies.complete({
        clientRideId: draft.clientRideId,
        rideRecordId: remote.rideRecordId,
        status: 'READY',
        completedAtMs: dependencies.nowMs(),
        linkedCourseId: remote.linkedCourseId,
      });
      return { status: 'READY', rideRecordId: remote.rideRecordId };
    case 'FAILED':
      await dependencies.persist({ ...draft, status: 'FAILED_TERMINAL', rideRecordId: remote.rideRecordId });
      return { status: 'FAILED_TERMINAL' };
  }
}
