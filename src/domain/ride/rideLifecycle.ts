import {
  finishRideDraft,
  pauseRideDraft,
  resumeRideDraft,
  type RideDraft,
} from './rideQueueModel';

export type RideLifecycleDependencies = {
  nowMs: () => number;
  captureCurrentLocation: (clientRideId: string) => Promise<void>;
  loadDraft: (clientRideId: string) => RideDraft | null;
  updateDraft: (
    clientRideId: string,
    update: (draft: RideDraft) => RideDraft,
  ) => Promise<RideDraft | null>;
  startCollection: () => Promise<void>;
  stopCollection: () => Promise<void>;
};

export type QueuedRideResult = {
  readonly queued: RideDraft;
  readonly finalCaptureError: Error | null;
  readonly collectionStopError: Error | null;
};

export type RideLifecycleGate = {
  run<T>(operation: () => Promise<T>): Promise<T>;
};

export function createRideLifecycleGate(): RideLifecycleGate {
  let tail: Promise<void> = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export async function pauseOrResumeRide(
  active: RideDraft,
  dependencies: RideLifecycleDependencies,
): Promise<RideDraft> {
  if (active.status === 'RECORDING') {
    const paused = await dependencies.updateDraft(active.clientRideId, (latest) =>
      pauseRideDraft(latest, dependencies.nowMs()),
    );
    if (paused === null) {
      throw new MissingLocalRideError();
    }
    await dependencies.stopCollection();
    return paused;
  }
  if (active.status !== 'PAUSED') {
    throw new InvalidRideLifecycleStateError(active.status);
  }
  await dependencies.startCollection();
  try {
    const recording = await dependencies.updateDraft(active.clientRideId, (latest) =>
      resumeRideDraft(latest, dependencies.nowMs()),
    );
    if (recording === null) {
      throw new MissingLocalRideError();
    }
    return recording;
  } catch (error) {
    await dependencies.stopCollection().catch(() => undefined);
    throw error;
  }
}

export async function queueRideForUpload(
  active: RideDraft,
  dependencies: RideLifecycleDependencies,
): Promise<QueuedRideResult> {
  let finalCaptureError: Error | null = null;
  try {
    await dependencies.captureCurrentLocation(active.clientRideId);
  } catch (error) {
    finalCaptureError = error instanceof Error ? error : new Error(String(error));
  }
  const latest = dependencies.loadDraft(active.clientRideId);
  if (latest === null) {
    throw new MissingLocalRideError();
  }
  if (latest.routePoints.length === 0) {
    throw new MissingRidePointError(finalCaptureError);
  }
  const queued = await dependencies.updateDraft(active.clientRideId, (current) =>
    finishRideDraft(current, dependencies.nowMs()),
  );
  if (queued === null) {
    throw new MissingLocalRideError();
  }
  let collectionStopError: Error | null = null;
  try {
    await dependencies.stopCollection();
  } catch (error) {
    collectionStopError = error instanceof Error ? error : new Error(String(error));
  }
  return { queued, finalCaptureError, collectionStopError };
}

export async function reconcileRideLocationCollection(
  active: RideDraft | null,
  dependencies: RideLifecycleDependencies,
): Promise<void> {
  if (active?.status === 'RECORDING') {
    await dependencies.startCollection();
    return;
  }
  await dependencies.stopCollection();
}

class MissingRidePointError extends Error {
  constructor(cause: Error | null) {
    super('GPS 포인트가 아직 수집되지 않았습니다. 위치 상태를 확인한 뒤 다시 종료해 주세요.', {
      cause: cause ?? undefined,
    });
    this.name = 'MissingRidePointError';
  }
}

class MissingLocalRideError extends Error {
  constructor() {
    super('로컬에서 저장 중인 주행을 찾을 수 없습니다.');
    this.name = 'MissingLocalRideError';
  }
}

class InvalidRideLifecycleStateError extends Error {
  constructor(status: RideDraft['status']) {
    super(`주행 상태 ${status}에서는 일시정지 또는 재개할 수 없습니다.`);
    this.name = 'InvalidRideLifecycleStateError';
  }
}
