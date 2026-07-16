import type { RideDraft, RideReceipt } from './rideQueueModel';
import {
  RIDE_ROUTE_QUALITY_REJECTED_ERROR_CODE,
  RIDE_ROUTE_QUALITY_UNVERIFIED_ERROR_CODE,
  type RideRouteQualityStatus,
} from './rideRouteQuality';
import {
  isAutomaticRetryBudgetExhausted,
  RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
} from './rideRetryPolicy';
import { classifyRideUploadFailure } from './rideUploadPolicy';

export type RemoteRideSaveResult = {
  readonly rideRecordId: number;
  readonly finalizationStatus: 'FINALIZING' | 'READY' | 'FAILED';
};

export type RemoteRideStatusResult = {
  readonly rideRecordId: number;
  readonly status: 'FINALIZING' | 'READY' | 'FAILED';
  readonly linkedCourseId: number | null;
  readonly qualityStatus?: RideRouteQualityStatus | null;
  readonly qualityReasons?: readonly string[];
};

export type RideSyncDependencies = {
  readonly nowMs: () => number;
  readonly recoverRemote: (clientRideId: string) => Promise<RemoteRideStatusResult | null>;
  readonly saveRemote: (draft: RideDraft) => Promise<RemoteRideSaveResult>;
  readonly getRemoteStatus: (rideRecordId: number) => Promise<RemoteRideStatusResult>;
  readonly persist: (draft: RideDraft) => Promise<void>;
  readonly complete: (receipt: RideReceipt) => Promise<void>;
};

export type RideSyncResult =
  | { readonly status: 'FINALIZING'; readonly rideRecordId: number }
  | { readonly status: 'READY'; readonly rideRecordId: number }
  | { readonly status: 'RETRY_WAIT'; readonly retryAtMs: number }
  | { readonly status: 'FAILED_USER_ACTION'; readonly errorCode: string | null }
  | { readonly status: 'FAILED_TERMINAL' };

export async function syncRideDraft(draft: RideDraft, dependencies: RideSyncDependencies): Promise<RideSyncResult> {
  let persistedAttempt = draft;
  try {
    if (draft.rideRecordId !== null) {
      const remoteStatus = await dependencies.getRemoteStatus(draft.rideRecordId);
      return applyRemoteStatus(draft, remoteStatus, dependencies);
    }

    if (draft.attemptCount > 0) {
      const recovered = await dependencies.recoverRemote(draft.clientRideId);
      if (recovered !== null) {
        return applyRemoteStatus(draft, recovered, dependencies);
      }
    }

    const uploading: RideDraft = { ...draft, status: 'UPLOADING', attemptCount: draft.attemptCount + 1 };
    await dependencies.persist(uploading);
    persistedAttempt = uploading;
    const remote = await dependencies.saveRemote(uploading);
    if (remote.finalizationStatus === 'READY') {
      const verifiedStatus = await dependencies.getRemoteStatus(remote.rideRecordId);
      return applyRemoteStatus(uploading, verifiedStatus, dependencies);
    }
    return applyRemoteStatus(
      uploading,
      { rideRecordId: remote.rideRecordId, status: remote.finalizationStatus, linkedCourseId: null },
      dependencies,
    );
  } catch (error) {
    const failure = classifyRideUploadFailure(error);
    switch (failure.kind) {
      case 'RETRYABLE': {
        const nextAttemptCount = Math.max(draft.attemptCount + 1, persistedAttempt.attemptCount);
        const nowMs = dependencies.nowMs();
        if (isAutomaticRetryBudgetExhausted(persistedAttempt, nextAttemptCount, nowMs)) {
          await dependencies.persist({
            ...persistedAttempt,
            status: 'FAILED_USER_ACTION',
            attemptCount: nextAttemptCount,
            nextRetryAtMs: null,
            lastErrorCode: RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
          });
          return {
            status: 'FAILED_USER_ACTION',
            errorCode: RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
          };
        }
        const retryDelaySeconds = Math.max(failure.retryAfterSeconds, exponentialBackoffSeconds(nextAttemptCount));
        const retryAtMs = nowMs + retryDelaySeconds * 1000;
        await dependencies.persist({
          ...persistedAttempt,
          status: 'RETRY_WAIT',
          attemptCount: nextAttemptCount,
          nextRetryAtMs: retryAtMs,
          lastErrorCode: failure.errorCode,
        });
        return { status: 'RETRY_WAIT', retryAtMs };
      }
      case 'USER_ACTION':
        await dependencies.persist({ ...persistedAttempt, status: 'FAILED_USER_ACTION', lastErrorCode: failure.errorCode });
        return { status: 'FAILED_USER_ACTION', errorCode: failure.errorCode };
      case 'TERMINAL':
        await dependencies.persist({ ...persistedAttempt, status: 'FAILED_TERMINAL', lastErrorCode: failure.errorCode });
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
      {
        const polledAtMs = dependencies.nowMs();
        await dependencies.persist({
          ...draft,
          status: 'FINALIZING',
          rideRecordId: remote.rideRecordId,
          finalizationStartedAtMs: draft.finalizationStartedAtMs ?? polledAtMs,
          lastFinalizationPollAtMs: polledAtMs,
        });
      }
      return { status: 'FINALIZING', rideRecordId: remote.rideRecordId };
    case 'READY':
      if (remote.qualityStatus === null || remote.qualityStatus === undefined) {
        await dependencies.persist({
          ...draft,
          status: 'FAILED_USER_ACTION',
          rideRecordId: remote.rideRecordId,
          lastErrorCode: RIDE_ROUTE_QUALITY_UNVERIFIED_ERROR_CODE,
        });
        return { status: 'FAILED_USER_ACTION', errorCode: RIDE_ROUTE_QUALITY_UNVERIFIED_ERROR_CODE };
      }
      if (remote.qualityStatus === 'REJECTED') {
        await dependencies.persist({
          ...draft,
          status: 'FAILED_TERMINAL',
          rideRecordId: remote.rideRecordId,
          lastErrorCode: RIDE_ROUTE_QUALITY_REJECTED_ERROR_CODE,
        });
        return { status: 'FAILED_TERMINAL' };
      }
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
